-- Ejecutar en una sesión SQL tras la migración 0080.
-- Todas las comunidades y cambios de prueba se revierten mediante subtransacción.
create or replace function pg_temp.probar_plan_contable()
returns jsonb language plpgsql as $test$
declare
  tpl record;
  ent uuid;
  cuenta_id uuid;
  padre_id uuid;
  resultado jsonb:='[]'::jsonb;
  esperadas integer;
  visibles integer;
  rechazado boolean;
begin
  begin
    perform set_config('request.jwt.claim.sub',
      (select id::text from public.perfiles where rol='superadmin' limit 1),true);
    execute 'set local role authenticated';

    select count(*) into visibles from public.contabilidad_plan_plantillas where origen='sistema' and activa;
    if visibles<>4 then raise exception 'No se pueden visualizar las cuatro plantillas.'; end if;

    for tpl in select * from public.contabilidad_plan_plantillas where origen='sistema' and activa order by codigo loop
      insert into public.contabilidad_entidades(nombre,tipo)
      values('Prueba transaccional del plan',tpl.naturaleza) returning id into ent;
      select count(*) into esperadas from public.contabilidad_plan_plantilla_cuentas where plantilla_id=tpl.id;
      perform public.contabilidad_aplicar_plantilla(ent,tpl.id);
      if (select count(*) from public.contabilidad_cuentas where entidad_id=ent)<>esperadas then
        raise exception 'Asignación incompleta: %',tpl.codigo;
      end if;

      -- La segunda asignación también debe funcionar y no duplicar cuentas.
      perform public.contabilidad_aplicar_plantilla(ent,tpl.id);
      if (select count(*) from public.contabilidad_cuentas where entidad_id=ent)<>esperadas then
        raise exception 'Reasignación incompleta: %',tpl.codigo;
      end if;

      if exists(select 1 from public.contabilidad_cuentas c
        left join public.contabilidad_cuentas p on p.id=c.parent_id
        where c.entidad_id=ent and c.parent_id is not null and
          (p.entidad_id<>ent or p.clase<>'titulo' or c.nivel<>p.nivel+1 or c.codigo not like p.codigo||'.%'))
      then raise exception 'Jerarquía inválida: %',tpl.codigo; end if;

      select id into cuenta_id from public.contabilidad_cuentas where entidad_id=ent and codigo='1.1.01.001';
      update public.contabilidad_cuentas set cuenta='Caja ñ / Ámbito de prueba' where id=cuenta_id;
      if not exists(select 1 from public.contabilidad_cuentas where id=cuenta_id and cuenta='Caja ñ / Ámbito de prueba')
      then raise exception 'No se pudo editar la cuenta.'; end if;
      if exists(select 1 from public.contabilidad_plan_plantilla_cuentas where plantilla_id=tpl.id and cuenta='Caja ñ / Ámbito de prueba')
      then raise exception 'Editar la copia alteró la referencia.'; end if;

      select id into padre_id from public.contabilidad_cuentas where entidad_id=ent and codigo='1.1.01';
      update public.contabilidad_cuentas set cuenta='Activos personalizados' where id=padre_id;
      if not exists(select 1 from public.contabilidad_cuentas where id=padre_id and clase='titulo' and not imputable)
      then raise exception 'La agrupadora perdió su condición.'; end if;
      insert into public.contabilidad_cuentas(entidad_id,parent_id,codigo,cuenta,clase,tipo_contable,naturaleza,clasificacion_balance)
      values(ent,padre_id,'1.1.01.090','Cuenta editable adicional','movimiento','activo','deudora','activo');

      rechazado:=false;
      begin
        update public.contabilidad_cuentas set cuenta='Otros cobros' where id=cuenta_id;
      exception when raise_exception then
        if sqlerrm<>'Las cuentas “Otros” deben usar el terminal .099.' then raise; end if;
        rechazado:=true;
      end;
      if not rechazado then raise exception 'La reserva del código .099 dejó de validarse.'; end if;

      resultado:=resultado||jsonb_build_array(jsonb_build_object('plantilla',tpl.codigo,'cuentas',esperadas,
        'visualizar',true,'asignar',true,'reasignar',true,'editar',true,'agregar',true,'referencia_intacta',true));
    end loop;

    -- La protección de la empresa con movimientos debe seguir vigente.
    select id into ent from public.contabilidad_entidades
    where nombre='Coproactiva Administración SpA' and public.contabilidad_entidad_tiene_movimientos(id) limit 1;
    if ent is not null then
      rechazado:=false;
      begin
        perform public.contabilidad_aplicar_plantilla(ent,
          (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'));
      exception when raise_exception then
        if sqlerrm<>'El plan está protegido porque la entidad ya tiene movimientos.' then raise; end if;
        rechazado:=true;
      end;
      if not rechazado then raise exception 'Se permitió reemplazar un plan con historial.'; end if;
      update public.contabilidad_cuentas set cuenta='Caja editable con historial'
      where entidad_id=ent and codigo='1.1.01.001';
      if not found then raise exception 'No se pudo editar el nombre con historial.'; end if;
    end if;

    raise exception using errcode='ZX001',message='Revertir todos los datos de prueba';
  exception when sqlstate 'ZX001' then
    return jsonb_build_object('pruebas',resultado,'historial_protegido',true,'datos_prueba_revertidos',true);
  end;
end;
$test$;
select pg_temp.probar_plan_contable();
