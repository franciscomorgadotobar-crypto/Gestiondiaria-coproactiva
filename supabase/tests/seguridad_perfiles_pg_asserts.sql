-- PRUEBAS POST-CORRECCIÓN EN POSTGRES 17 DESCARTABLE
-- Ejecutar después de bootstrap y de la migración real incluida en el PR.
\set ON_ERROR_STOP on

-- Un administrador desactivado no recibe permisos de administrador.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
  do $$
  begin
    if public.mi_rol() is not null then raise exception 'FAIL: rol de admin inactivo'; end if;
    if public.es_admin() or public.es_superadmin() then raise exception 'FAIL: admin inactivo con permisos'; end if;
    if public.ve_comunidad('10000000-0000-0000-0000-000000000001') then
      raise exception 'FAIL: admin inactivo ve su comunidad';
    end if;
    if (select count(*) from public.comunidades) <> 0 then
      raise exception 'FAIL: admin inactivo lee comunidades por SELECT';
    end if;
    if (select count(*) from public.perfil_comunidades) <> 0 then
      raise exception 'FAIL: admin inactivo lee asignaciones';
    end if;
    raise notice 'PASS: admin inactivo bloqueado por rol, función y RLS';
  end $$;
commit;

-- Personal de terreno activo conserva el acceso asignado y su vista de controles.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
  do $$
  begin
    if public.mi_rol() <> 'terreno' then raise exception 'FAIL: terreno activo pierde rol'; end if;
    if not public.ve_comunidad('10000000-0000-0000-0000-000000000001') then
      raise exception 'FAIL: terreno activo sin comunidad asignada';
    end if;
    if public.ve_comunidad('10000000-0000-0000-0000-000000000002') then
      raise exception 'FAIL: terreno activo ve comunidad no asignada';
    end if;
    if not public.ve_control('20000000-0000-0000-0000-000000000001') then
      raise exception 'FAIL: terreno activo sin su control';
    end if;
    if (select count(*) from public.comunidades) <> 1 then
      raise exception 'FAIL: lectura real de comunidades por RLS';
    end if;
    if (select count(*) from public.controles) <> 1 then
      raise exception 'FAIL: lectura de control en RLS';
    end if;
    if not public.puede_operar_control('10000000-0000-0000-0000-000000000001',null,auth.uid()) then
      raise exception 'FAIL: terreno activo no puede operar su control';
    end if;
    raise notice 'PASS: terreno activo sigue leyendo y operando en comunidad asignada';
  end $$;
commit;

-- Terreno desactivado con asignación antigua no recibe acceso residual.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
  do $$
  begin
    if public.mi_rol() is not null then raise exception 'FAIL: terreno inactivo conserva rol'; end if;
    if public.ve_comunidad('10000000-0000-0000-0000-000000000001') then
      raise exception 'FAIL: terreno inactivo conserva comunidad';
    end if;
    if public.ve_control('20000000-0000-0000-0000-000000000002') then
      raise exception 'FAIL: terreno inactivo conserva control de prospecto';
    end if;
    if public.puede_operar_control(null,'30000000-0000-0000-0000-000000000001',auth.uid()) then
      raise exception 'FAIL: terreno inactivo puede operar';
    end if;
    if (select count(*) from public.controles) <> 0 then
      raise exception 'FAIL: terreno inactivo lee controles vía RLS';
    end if;
    if (select count(*) from public.perfil_comunidades) <> 0 then
      raise exception 'FAIL: terreno inactivo lee asignaciones vía RLS';
    end if;
    raise notice 'PASS: terreno inactivo sin acceso residual';
  end $$;
commit;

-- No debe permitirse la reactivación propia, ni tampoco la baja propia de admin.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
  do $$
  begin
    begin
      update public.perfiles set activo=true where id=auth.uid();
    exception when others then null;
    end;
    if (select activo from public.perfiles where id=auth.uid()) is distinct from false then
      raise exception 'FAIL: usuario inactivo se reactivó';
    end if;
    raise notice 'PASS: reactivación propia denegada';
  end $$;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
  do $$
  begin
    begin
      update public.perfiles set activo=false where id=auth.uid();
    exception when others then null;
    end;
    if (select activo from public.perfiles where id=auth.uid()) is distinct from true then
      raise exception 'FAIL: administrador pudo desactivarse a sí mismo';
    end if;
    raise notice 'PASS: no es posible cambiar estado propio siendo administrador';
  end $$;
commit;

-- Un administrador activo puede reactivar a otra persona (flujo Equipo).
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
  do $$
  begin
    update public.perfiles set activo=true
      where id='00000000-0000-0000-0000-000000000005';
    if (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000005') is distinct from true then
      raise exception 'FAIL: administrador activo no puede reactivar a otro';
    end if;
    update public.perfiles set activo=false
      where id='00000000-0000-0000-0000-000000000005';
    if (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000005') is distinct from false then
      raise exception 'FAIL: administrador activo no puede desactivar a otro';
    end if;
    raise notice 'PASS: administración conserva el alta y baja de otros usuarios';
  end $$;
commit;

-- Rol servicio conserva el mecanismo real de Equipo (Edge Function).
begin;
  set local role service_role;
  set local request.jwt.claim.role='service_role';
  update public.perfiles set activo=true
    where id='00000000-0000-0000-0000-000000000005';
commit;
begin;
  set local role service_role;
  set local request.jwt.claim.role='service_role';
  do $
  begin
    if not (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000005') then
      raise exception 'FAIL: service_role no logra reactivar usuario';
    end if;
    update public.perfiles set activo=false
      where id='00000000-0000-0000-0000-000000000005';
    raise notice 'PASS: service_role conserva la reactivación autorizada';
  end $;
commit;

-- Un cliente activo no se convierte en operador interno ni modifica el perfil.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000006';
  do $$
  begin
    if public.mi_rol() <> 'cliente' then raise exception 'FAIL: cliente pierde su rol'; end if;
    if public.es_admin() then raise exception 'FAIL: cliente recibe permiso admin'; end if;
    if (select count(*) from public.comunidades) <> 0 then
      raise exception 'FAIL: cliente ve comunidades internas';
    end if;
    begin
      update public.perfiles set nombre='cambio-no-permitido' where id=auth.uid();
    exception when others then null;
    end;
    if (select nombre from public.perfiles where id=auth.uid()) = 'cambio-no-permitido' then
      raise exception 'FAIL: cliente editó el perfil interno';
    end if;
    raise notice 'PASS: cliente sigue aislado de la operación interna';
  end $$;
commit;

-- Superadmin activo sigue pudiendo ver ambas comunidades.
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
  do $$
  begin
    if not public.es_superadmin() then raise exception 'FAIL: superadmin activo perdió rol'; end if;
    if (select count(*) from public.comunidades) <> 2 then
      raise exception 'FAIL: superadmin activo no lee todas las comunidades';
    end if;
    raise notice 'PASS: superadmin activo conserva la lectura global';
  end $$;
commit;

-- Verificación final de las dos cuentas inactivas después de todas las pruebas.
do $$
begin
  if (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000003')
     or (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000005')
  then raise exception 'FAIL: pruebas dejaron una cuenta inactiva reactivada'; end if;
  raise notice 'PASS: cuentas de prueba mantienen su estado correcto';
end $$;
