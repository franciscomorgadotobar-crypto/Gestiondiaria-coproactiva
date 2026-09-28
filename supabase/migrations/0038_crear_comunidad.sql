-- Nueva comunidad directa, sin pasar por el Pipeline (por ejemplo, un
-- cliente que llega recomendado y se firma sin proceso comercial).
--
-- Mismo criterio que ganar_prospecto: lo pueden hacer superadmin, admin y
-- jefatura, y quien la crea queda asignado a la comunidad. Sin esa
-- asignación un admin creaba la comunidad y no la veía (ve_comunidad()
-- exige una), y jefatura no podía crearla porque la tabla solo acepta
-- inserciones de administración.

create or replace function public.crear_comunidad(
  p_nombre text,
  p_direccion text default null,
  p_comuna text default null,
  p_unidades integer default null,
  p_contacto_nombre text default null,
  p_contacto_telefono text default null,
  p_contacto_email text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_comunidad uuid;
begin
  if not (es_admin() or mi_rol() = 'jefatura') then
    raise exception 'No tienes permiso para crear comunidades.' using errcode = '42501';
  end if;

  if nullif(trim(p_nombre), '') is null then
    raise exception 'La comunidad necesita un nombre.' using errcode = '23514';
  end if;

  if p_unidades is not null and p_unidades < 0 then
    raise exception 'Las unidades no pueden ser negativas.' using errcode = '23514';
  end if;

  insert into comunidades (nombre, direccion, comuna, unidades_declaradas,
                           contacto_nombre, contacto_telefono, contacto_email)
  values (trim(p_nombre), nullif(trim(p_direccion), ''), nullif(trim(p_comuna), ''), p_unidades,
          nullif(trim(p_contacto_nombre), ''), nullif(trim(p_contacto_telefono), ''),
          nullif(trim(p_contacto_email), ''))
  returning id into v_comunidad;

  insert into perfil_comunidades (perfil_id, comunidad_id)
  values (auth.uid(), v_comunidad)
  on conflict do nothing;

  return v_comunidad;
end;
$$;

revoke all on function public.crear_comunidad(text, text, text, integer, text, text, text) from public, anon;
grant execute on function public.crear_comunidad(text, text, text, integer, text, text, text) to authenticated;
