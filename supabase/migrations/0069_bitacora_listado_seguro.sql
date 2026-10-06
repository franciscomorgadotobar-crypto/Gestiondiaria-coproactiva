
create or replace function public.bitacora_listar()
returns table(
  id uuid,
  comunidad_id uuid,
  comunidad_nombre text,
  comunidad_comuna text,
  tipo_codigo text,
  tipo_nombre text,
  tipo_otro text,
  nivel text,
  titulo text,
  descripcion text,
  registrado_por uuid,
  registrado_por_nombre text,
  registrado_en timestamptz,
  adjuntos integer
)
language sql
stable
security definer
set search_path=public
as $$
  select
    b.id,
    b.comunidad_id,
    c.nombre,
    c.comuna,
    b.tipo_codigo,
    t.nombre,
    b.tipo_otro,
    b.nivel,
    b.titulo,
    b.descripcion,
    b.registrado_por,
    p.nombre,
    b.registrado_en,
    (select count(*)::integer from public.bitacora_adjuntos a where a.bitacora_id=b.id)
  from public.bitacora_registros b
  join public.comunidades c on c.id=b.comunidad_id
  join public.bitacora_tipos t on t.codigo=b.tipo_codigo
  join public.perfiles p on p.id=b.registrado_por
  where public.bitacora_puede_ver_comunidad(b.comunidad_id)
  order by b.registrado_en desc;
$$;

revoke all on function public.bitacora_listar() from public,anon;
grant execute on function public.bitacora_listar() to authenticated;
