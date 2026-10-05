-- Comunidades es el maestro de las entidades contables tipo comunidad.
-- Sincroniza identidad y ciclo de vida, y agrega edición/eliminación segura.

create or replace function public.contabilidad_sincronizar_entidad_comunidad()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.contabilidad_entidades(
    comunidad_id,nombre,rut,tipo,moneda,activa,creado_por,editado_en
  )
  values (
    new.id,new.nombre,new.rut,'comunidad','CLP',
    new.estado::text <> 'terminado',null,now()
  )
  on conflict (comunidad_id) do update
  set nombre=excluded.nombre,
      rut=excluded.rut,
      tipo='comunidad',
      activa=excluded.activa,
      editado_en=now();
  return new;
end;
$$;

revoke all on function public.contabilidad_sincronizar_entidad_comunidad() from public,anon,authenticated;
grant execute on function public.contabilidad_sincronizar_entidad_comunidad() to service_role;

drop trigger if exists trg_contabilidad_sync_comunidad on public.comunidades;
create trigger trg_contabilidad_sync_comunidad
after insert or update of nombre,rut,estado
on public.comunidades
for each row execute function public.contabilidad_sincronizar_entidad_comunidad();

create or replace function public.contabilidad_preservar_entidad_al_borrar_comunidad()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_entidad uuid;
begin
  select id into v_entidad
  from public.contabilidad_entidades
  where comunidad_id=old.id
  limit 1;

  if v_entidad is null then
    return old;
  end if;

  if exists (
    select 1 from public.contabilidad_asientos
    where entidad_id=v_entidad
  ) then
    update public.contabilidad_entidades
    set comunidad_id=null,
        activa=false,
        nombre=old.nombre,
        rut=old.rut,
        editado_en=now()
    where id=v_entidad;
  else
    delete from public.contabilidad_entidades where id=v_entidad;
  end if;

  return old;
end;
$$;

revoke all on function public.contabilidad_preservar_entidad_al_borrar_comunidad() from public,anon,authenticated;
grant execute on function public.contabilidad_preservar_entidad_al_borrar_comunidad() to service_role;

drop trigger if exists trg_contabilidad_preservar_entidad_borrado_comunidad on public.comunidades;
create trigger trg_contabilidad_preservar_entidad_borrado_comunidad
before delete on public.comunidades
for each row execute function public.contabilidad_preservar_entidad_al_borrar_comunidad();

create or replace function public.contabilidad_editar_entidad(
  p_entidad_id uuid,
  p_nombre text,
  p_rut text default null
)
returns public.contabilidad_entidades
language plpgsql
security definer
set search_path=public
as $$
declare
  v_entidad public.contabilidad_entidades%rowtype;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para editar entidades contables.';
  end if;

  if nullif(btrim(coalesce(p_nombre,'')),'') is null then
    raise exception 'El nombre es obligatorio.';
  end if;

  select * into v_entidad
  from public.contabilidad_entidades
  where id=p_entidad_id and activa
  for update;

  if not found then
    raise exception 'La entidad no existe o está inactiva.';
  end if;

  if v_entidad.comunidad_id is not null then
    update public.comunidades
    set nombre=btrim(p_nombre),
        rut=nullif(btrim(coalesce(p_rut,'')),''),
        editado_en=now()
    where id=v_entidad.comunidad_id;

    select * into v_entidad
    from public.contabilidad_entidades
    where id=p_entidad_id;
  else
    update public.contabilidad_entidades
    set nombre=btrim(p_nombre),
        rut=nullif(btrim(coalesce(p_rut,'')),''),
        editado_en=now()
    where id=p_entidad_id
    returning * into v_entidad;
  end if;

  return v_entidad;
end;
$$;

revoke all on function public.contabilidad_editar_entidad(uuid,text,text) from public,anon;
grant execute on function public.contabilidad_editar_entidad(uuid,text,text) to authenticated;

create or replace function public.comunidad_eliminar_segura(p_comunidad_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_comunidad public.comunidades%rowtype;
  v_entidad uuid;
  v_tiene_asientos boolean:=false;
  v_tiene_dependencias boolean:=false;
  v_ref record;
  v_existe boolean;
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

  select id into v_entidad
  from public.contabilidad_entidades
  where comunidad_id=p_comunidad_id
  limit 1;

  if v_entidad is not null then
    select exists(
      select 1 from public.contabilidad_asientos where entidad_id=v_entidad
    ) into v_tiene_asientos;
  end if;

  for v_ref in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    join pg_class refrel on refrel.oid=con.confrelid
    join pg_namespace refns on refns.oid=refrel.relnamespace
    join lateral unnest(con.conkey) with ordinality as k(attnum,ord) on true
    join pg_attribute att on att.attrelid=con.conrelid and att.attnum=k.attnum
    where con.contype='f'
      and refns.nspname='public'
      and refrel.relname='comunidades'
      and not (ns.nspname='public' and rel.relname='contabilidad_entidades')
  loop
    execute format(
      'select exists(select 1 from %I.%I where %I=$1 limit 1)',
      v_ref.schema_name,v_ref.table_name,v_ref.column_name
    )
    into v_existe
    using p_comunidad_id;

    if v_existe then
      v_tiene_dependencias:=true;
      exit;
    end if;
  end loop;

  if not v_tiene_asientos and not v_tiene_dependencias then
    if v_entidad is not null then
      delete from public.contabilidad_entidades where id=v_entidad;
    end if;
    delete from public.comunidades where id=p_comunidad_id;

    return jsonb_build_object(
      'resultado','eliminada',
      'mensaje','Comunidad eliminada definitivamente.'
    );
  end if;

  update public.comunidades
  set estado='terminado',
      editado_en=now()
  where id=p_comunidad_id;

  return jsonb_build_object(
    'resultado','terminada',
    'mensaje','La comunidad tenía historial. Se retiró de uso y se conservó su información.'
  );
end;
$$;

revoke all on function public.comunidad_eliminar_segura(uuid) from public,anon;
grant execute on function public.comunidad_eliminar_segura(uuid) to authenticated;

create or replace function public.contabilidad_eliminar_entidad(p_entidad_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_entidad public.contabilidad_entidades%rowtype;
  v_tiene_asientos boolean;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para eliminar entidades contables.';
  end if;

  select * into v_entidad
  from public.contabilidad_entidades
  where id=p_entidad_id
  for update;

  if not found then
    raise exception 'La entidad no existe.';
  end if;

  if v_entidad.comunidad_id is not null then
    return public.comunidad_eliminar_segura(v_entidad.comunidad_id);
  end if;

  select exists(
    select 1 from public.contabilidad_asientos where entidad_id=p_entidad_id
  ) into v_tiene_asientos;

  if v_tiene_asientos then
    update public.contabilidad_entidades
    set activa=false,editado_en=now()
    where id=p_entidad_id;

    return jsonb_build_object(
      'resultado','archivada',
      'mensaje','La entidad tenía movimientos contables. Se retiró de uso y se conservó su historial.'
    );
  end if;

  delete from public.contabilidad_entidades where id=p_entidad_id;

  return jsonb_build_object(
    'resultado','eliminada',
    'mensaje','Entidad eliminada definitivamente.'
  );
end;
$$;

revoke all on function public.contabilidad_eliminar_entidad(uuid) from public,anon;
grant execute on function public.contabilidad_eliminar_entidad(uuid) to authenticated;

update public.contabilidad_entidades e
set nombre=c.nombre,
    rut=c.rut,
    activa=(c.estado::text <> 'terminado'),
    editado_en=now()
from public.comunidades c
where e.comunidad_id=c.id;
