create or replace function public.bitacora_crear(
  p_comunidad_id uuid,
  p_tipo_codigo text,
  p_tipo_otro text,
  p_nivel text,
  p_titulo text,
  p_descripcion text
)
returns public.bitacora_registros
language plpgsql
security definer
set search_path=public
as $$
declare
  v_reg public.bitacora_registros%rowtype;
  v_comunidad text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida.'; end if;

  if not public.bitacora_puede_ver_comunidad(p_comunidad_id) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  if not exists(select 1 from public.bitacora_tipos where codigo=p_tipo_codigo and activa) then
    raise exception 'Tipo de registro no válido.';
  end if;

  if p_nivel not in ('registro','atencion','urgente') then
    raise exception 'Nivel de atención no válido.';
  end if;

  if nullif(btrim(coalesce(p_titulo,'')),'') is null then
    raise exception 'El título es obligatorio.';
  end if;

  if nullif(btrim(coalesce(p_descripcion,'')),'') is null then
    raise exception 'La descripción es obligatoria.';
  end if;

  if p_tipo_codigo='otro' and nullif(btrim(coalesce(p_tipo_otro,'')),'') is null then
    raise exception 'Especifica el tipo de registro.';
  end if;

  insert into public.bitacora_registros(
    comunidad_id,tipo_codigo,tipo_otro,nivel,titulo,descripcion,registrado_por
  )
  values(
    p_comunidad_id,p_tipo_codigo,nullif(btrim(coalesce(p_tipo_otro,'')),''),
    p_nivel,btrim(p_titulo),btrim(p_descripcion),auth.uid()
  )
  returning * into v_reg;

  if p_nivel in ('atencion','urgente') then
    select nombre into v_comunidad from public.comunidades where id=p_comunidad_id;

    insert into public.notificaciones(
      destinatario_id,tipo,titulo,mensaje,comunidad_id,bitacora_id
    )
    select
      p.id,
      case when p_nivel='urgente' then 'bitacora_urgente' else 'bitacora_atencion' end,
      case
        when p_nivel='urgente' then 'Bitácora urgente · ' || v_reg.correlativo
        else 'Bitácora requiere atención · ' || v_reg.correlativo
      end,
      v_comunidad || ' · ' || btrim(p_titulo),
      p_comunidad_id,
      v_reg.id
    from public.perfiles p
    where p.activo and p.rol::text='superadmin';
  end if;

  return v_reg;
end;
$$;

revoke all on function public.bitacora_crear(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.bitacora_crear(uuid,text,text,text,text,text) to authenticated;
