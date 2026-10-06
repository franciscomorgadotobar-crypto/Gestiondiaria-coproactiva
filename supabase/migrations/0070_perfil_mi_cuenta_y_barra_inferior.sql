alter table public.perfiles
  add column if not exists telefono text;

alter table public.perfiles
  add column if not exists bottom_nav text[] not null default array[
    'inicio','comunidades','levantamientos','notificaciones'
  ]::text[];

update public.perfiles
set bottom_nav=array['inicio','comunidades','levantamientos','notificaciones']::text[]
where bottom_nav is null or bottom_nav='{}'::text[];

alter table public.perfiles
  drop constraint if exists perfiles_bottom_nav_valid;

alter table public.perfiles
  add constraint perfiles_bottom_nav_valid
  check (
    cardinality(bottom_nav)=4
    and bottom_nav <@ array[
      'inicio','comunidades','levantamientos','notificaciones',
      'plantillas','bitacora','mantenciones','mapa'
    ]::text[]
  );

create or replace function public.perfil_actualizar_mi_cuenta(
  p_nombre text,
  p_telefono text,
  p_bottom_nav text[]
)
returns table(
  id uuid,
  nombre text,
  email text,
  telefono text,
  rol public.rol_usuario,
  activo boolean,
  bottom_nav text[]
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_rol public.rol_usuario;
  v_permitidos text[];
begin
  if auth.uid() is null then raise exception 'Sesión requerida.'; end if;

  select p.rol into v_rol
  from public.perfiles p
  where p.id=auth.uid() and p.activo;

  if v_rol is null then raise exception 'Perfil no disponible.'; end if;
  if nullif(btrim(coalesce(p_nombre,'')),'') is null then raise exception 'El nombre es obligatorio.'; end if;
  if p_bottom_nav is null or cardinality(p_bottom_nav) <> 4 then
    raise exception 'Selecciona cuatro accesos para la barra inferior.';
  end if;
  if (select count(distinct x) from unnest(p_bottom_nav) x) <> 4 then
    raise exception 'No repitas accesos en la barra inferior.';
  end if;

  v_permitidos := array[
    'inicio','comunidades','levantamientos','notificaciones',
    'bitacora','mantenciones','mapa'
  ]::text[];

  if v_rol::text in ('superadmin','admin','jefatura') then
    v_permitidos := v_permitidos || array['plantillas']::text[];
  end if;

  if exists(select 1 from unnest(p_bottom_nav) x where not (x=any(v_permitidos))) then
    raise exception 'Uno de los accesos seleccionados no está habilitado para tu usuario.';
  end if;

  update public.perfiles p
  set nombre=btrim(p_nombre),
      telefono=nullif(btrim(coalesce(p_telefono,'')),''),
      bottom_nav=p_bottom_nav,
      editado_en=now()
  where p.id=auth.uid();

  return query
  select p.id,p.nombre,p.email,p.telefono,p.rol,p.activo,p.bottom_nav
  from public.perfiles p
  where p.id=auth.uid();
end;
$$;

revoke all on function public.perfil_actualizar_mi_cuenta(text,text,text[]) from public,anon;
grant execute on function public.perfil_actualizar_mi_cuenta(text,text,text[]) to authenticated;
