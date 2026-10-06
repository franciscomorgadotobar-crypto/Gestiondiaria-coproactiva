-- Desde esta versión, "Eliminar comunidad" significa eliminación física del maestro.
-- Los datos propios de la comunidad se eliminan; documentos/prospectos con FK SET NULL
-- se conservan desacoplados y la contabilidad con asientos se preserva como entidad histórica.

create or replace function public.comunidad_eliminar_segura(p_comunidad_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_comunidad public.comunidades%rowtype;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para eliminar comunidades.';
  end if;

  select * into v_comunidad
  from public.comunidades
  where id=p_comunidad_id
  for update;

  if not found then
    raise exception 'La comunidad no existe.';
  end if;

  delete from public.ordenes_trabajo
  where comunidad_id=p_comunidad_id;

  delete from public.hallazgos
  where comunidad_id=p_comunidad_id;

  delete from public.controles
  where comunidad_id=p_comunidad_id;

  delete from public.comunidades
  where id=p_comunidad_id;

  return jsonb_build_object(
    'resultado','eliminada',
    'mensaje','Comunidad eliminada definitivamente.'
  );
end;
$$;

revoke all on function public.comunidad_eliminar_segura(uuid) from public,anon;
grant execute on function public.comunidad_eliminar_segura(uuid) to authenticated;

do $$
declare
  r record;
begin
  for r in
    select id
    from public.comunidades
    where estado::text='terminado'
  loop
    delete from public.ordenes_trabajo where comunidad_id=r.id;
    delete from public.hallazgos where comunidad_id=r.id;
    delete from public.controles where comunidad_id=r.id;
    delete from public.comunidades where id=r.id;
  end loop;
end;
$$;
