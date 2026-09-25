-- Ganar un prospecto: el puente del CRM a la operación.
--
-- Antes lo hacía el navegador en dos pasos (crear la comunidad, luego ligarla
-- al prospecto) con los permisos de quien estaba conectado. Solo funcionaba
-- para el superadmin: la base no deja que jefatura cree comunidades, y un
-- admin creaba la comunidad pero no podía verla, porque ve_comunidad() exige
-- una asignación que nadie le había hecho. El prospecto quedaba sin ganar y
-- la comunidad huérfana.
--
-- Ahora es un solo paso en el servidor, atómico: crea la comunidad con los
-- datos del prospecto, la liga, lo pasa a Ganado y asigna la comunidad a
-- quien lo ganó y al responsable del prospecto (así los dos la ven en
-- Operación). Solo lo puede pedir quien trabaja el CRM: superadmin, admin
-- o jefatura.

create or replace function public.ganar_prospecto(p_prospecto_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p prospectos%rowtype;
  v_comunidad uuid;
begin
  if not (es_admin() or mi_rol() = 'jefatura') then
    raise exception 'No tienes permiso para ganar prospectos.' using errcode = '42501';
  end if;

  select * into p from prospectos where id = p_prospecto_id for update;
  if not found then
    raise exception 'El prospecto no existe.' using errcode = 'P0002';
  end if;

  -- Ya ganado: no se crea una segunda comunidad.
  if p.comunidad_id is not null then
    update prospectos set etapa = 'ganado' where id = p.id and etapa <> 'ganado';
    return p.comunidad_id;
  end if;

  insert into comunidades (nombre, direccion, comuna, unidades_declaradas,
                           contacto_nombre, contacto_telefono, contacto_email)
  values (p.nombre_condominio, p.direccion, p.comuna, p.unidades,
          p.nombre_contacto, p.telefono, p.email)
  returning id into v_comunidad;

  update prospectos
     set etapa = 'ganado',
         comunidad_id = v_comunidad,
         fecha_ultima_interaccion = now()
   where id = p.id;

  -- Quien lo ganó y el responsable del prospecto (si es del equipo y está
  -- activo) quedan asignados a la comunidad nueva.
  insert into perfil_comunidades (perfil_id, comunidad_id)
  select pf.id, v_comunidad
    from perfiles pf
   where pf.id in (auth.uid(), p.responsable_id)
     and pf.activo
     and pf.rol::text <> 'cliente'
  on conflict do nothing;

  return v_comunidad;
end;
$$;

revoke all on function public.ganar_prospecto(uuid) from public, anon;
grant execute on function public.ganar_prospecto(uuid) to authenticated;
