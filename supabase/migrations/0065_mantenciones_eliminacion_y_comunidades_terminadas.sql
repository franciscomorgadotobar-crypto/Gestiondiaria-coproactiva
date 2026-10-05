-- Mantenciones: eliminación segura y cierre automático al terminar una comunidad.
create or replace function public.mantenimiento_resumen_global()
returns table(
  actividad_id uuid, comunidad_id uuid, comunidad_nombre text, comuna text,
  activo_id uuid, activo_nombre text, activo_categoria text, trabajo text,
  frecuencia_unidad text, frecuencia_valor integer, proxima_exigible date,
  proveedor_id uuid, proveedor_nombre text, proveedor_telefono text, proveedor_email text,
  responsable_id uuid, agendamiento_id uuid, programado_para timestamptz,
  vencimiento_original date, estado_agendamiento text, ultima_ejecucion timestamptz,
  ejecutor text, observaciones text, documentos integer
)
language plpgsql
stable security definer
set search_path=public
as $$
begin
  if not public.usuario_es_interno_activo() then
    raise exception 'No tienes acceso a mantenciones.';
  end if;

  return query
  select
    a.id,
    a.comunidad_id,
    c.nombre,
    c.comuna,
    ac.id,
    ac.nombre,
    ac.categoria,
    a.trabajo,
    a.frecuencia_unidad,
    a.frecuencia_valor,
    a.proxima_exigible,
    coalesce(a.proveedor_id, ac.proveedor_id),
    coalesce(p.empresa, a.proveedor, ac.proveedor),
    p.telefono,
    p.email,
    a.responsable_id,
    ag.id,
    ag.programado_para,
    ag.vencimiento_original,
    ag.estado::text,
    ex.realizado_en,
    ex.ejecutor_texto,
    ex.observaciones,
    coalesce(doc.cantidad, 0)::integer
  from public.mantenimiento_actividades a
  join public.activos_comunidad ac on ac.id=a.activo_id
  join public.comunidades c on c.id=a.comunidad_id
  left join public.proveedores p on p.id=coalesce(a.proveedor_id, ac.proveedor_id)
  left join lateral (
    select x.*
    from public.mantenimiento_agendamientos x
    where x.actividad_id=a.id
      and x.estado in ('agendada','en_curso')
    order by x.programado_para asc
    limit 1
  ) ag on true
  left join lateral (
    select e.realizado_en,e.ejecutor_texto,e.observaciones,e.id
    from public.ejecuciones_mantenimiento e
    where e.actividad_id=a.id
    order by e.realizado_en desc
    limit 1
  ) ex on true
  left join lateral (
    select count(*) as cantidad
    from public.mantenimiento_documentos md
    where md.actividad_id=a.id
  ) doc on true
  where a.activa
    and c.estado::text <> 'terminado'
    and public.usuario_puede_ver_comunidad(a.comunidad_id)
  order by coalesce(a.proxima_exigible, ag.programado_para::date) nulls last,
           c.nombre,ac.nombre,a.trabajo;
end;
$$;

create or replace function public.mantenimiento_eliminar_actividad(p_actividad_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actividad public.mantenimiento_actividades%rowtype;
  v_ejecuciones integer;
begin
  if not public.usuario_puede_gestionar_operacion() then
    raise exception 'No tienes permiso para eliminar mantenciones.';
  end if;

  select * into v_actividad
  from public.mantenimiento_actividades
  where id=p_actividad_id
  for update;

  if not found then
    raise exception 'La mantención no existe.';
  end if;

  if not public.usuario_puede_ver_comunidad(v_actividad.comunidad_id) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  select count(*) into v_ejecuciones
  from public.ejecuciones_mantenimiento
  where actividad_id=p_actividad_id;

  if v_ejecuciones=0 then
    delete from public.mantenimiento_actividades
    where id=p_actividad_id;

    return jsonb_build_object(
      'resultado','eliminada',
      'mensaje','Mantención eliminada definitivamente.'
    );
  end if;

  update public.mantenimiento_actividades
  set activa=false,actualizado_en=now()
  where id=p_actividad_id;

  update public.mantenimiento_agendamientos
  set estado='cancelada',actualizado_en=now()
  where actividad_id=p_actividad_id
    and estado in ('agendada','en_curso');

  return jsonb_build_object(
    'resultado','archivada',
    'mensaje','La mantención tenía ejecuciones registradas. Se retiró de uso y se conservó su historial.'
  );
end;
$$;

revoke all on function public.mantenimiento_eliminar_actividad(uuid) from public,anon;
grant execute on function public.mantenimiento_eliminar_actividad(uuid) to authenticated;

create or replace function public.mantenimiento_cerrar_al_terminar_comunidad()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.estado::text='terminado' and old.estado::text is distinct from new.estado::text then
    update public.mantenimiento_actividades
    set activa=false,actualizado_en=now()
    where comunidad_id=new.id and activa;

    update public.mantenimiento_agendamientos
    set estado='cancelada',actualizado_en=now()
    where comunidad_id=new.id
      and estado in ('agendada','en_curso');
  end if;

  return new;
end;
$$;

revoke all on function public.mantenimiento_cerrar_al_terminar_comunidad() from public,anon,authenticated;
grant execute on function public.mantenimiento_cerrar_al_terminar_comunidad() to service_role;

drop trigger if exists trg_mantenimiento_cerrar_comunidad on public.comunidades;
create trigger trg_mantenimiento_cerrar_comunidad
after update of estado on public.comunidades
for each row
execute function public.mantenimiento_cerrar_al_terminar_comunidad();

update public.mantenimiento_actividades a
set activa=false,actualizado_en=now()
from public.comunidades c
where c.id=a.comunidad_id
  and c.estado::text='terminado'
  and a.activa;

update public.mantenimiento_agendamientos ag
set estado='cancelada',actualizado_en=now()
from public.comunidades c
where c.id=ag.comunidad_id
  and c.estado::text='terminado'
  and ag.estado in ('agendada','en_curso');
