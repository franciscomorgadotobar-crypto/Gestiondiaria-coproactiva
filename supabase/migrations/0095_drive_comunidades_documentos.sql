-- Provisión asíncrona documental; nunca poner credenciales Google en el navegador.
create table if not exists public.drive_carpetas_comunidad (
 comunidad_id uuid primary key references public.comunidades(id) on delete cascade,
 estado text not null default 'pendiente' check(estado in ('pendiente','lista','error','sin_configurar')),
 carpetas jsonb not null default '{}'::jsonb,
 ultimo_error text,
 intentos integer not null default 0,
 editado_en timestamptz not null default now()
);
create table if not exists public.drive_archivos_comunidad (
 id uuid primary key default gen_random_uuid(),
 comunidad_id uuid not null references public.comunidades(id) on delete cascade,
 categoria text not null check(categoria in ('administracion','finanzas','operaciones','seguimiento')),
 origen_tipo text not null check(origen_tipo in ('levantamiento','mantencion','incidencia','compromiso','informe','general')),
 origen_id text,
 drive_file_id text not null unique,
 nombre text not null,
 mime text,
 tamano bigint not null check(tamano>=0),
 visible_cliente boolean not null default false,
 registrado_por uuid references auth.users(id),
 creado_en timestamptz not null default now()
);
create index if not exists drive_archivos_comunidad_idx on public.drive_archivos_comunidad(comunidad_id,categoria,creado_en desc);
create index if not exists drive_archivos_origen_idx on public.drive_archivos_comunidad(origen_tipo,origen_id);
create or replace function public.preparar_carpeta_drive() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.drive_carpetas_comunidad(comunidad_id) values(new.id) on conflict do nothing;
 return new;
end $$;
drop trigger if exists preparar_drive_comunidad on public.comunidades;
create trigger preparar_drive_comunidad after insert on public.comunidades
for each row execute function public.preparar_carpeta_drive();
insert into public.drive_carpetas_comunidad(comunidad_id) select id from public.comunidades on conflict do nothing;
alter table public.drive_carpetas_comunidad enable row level security;
alter table public.drive_archivos_comunidad enable row level security;
drop policy if exists drive_carpeta_lectura on public.drive_carpetas_comunidad;
create policy drive_carpeta_lectura on public.drive_carpetas_comunidad for select to authenticated
using(public.puede_gestionar_compromisos());
drop policy if exists drive_archivos_lectura on public.drive_archivos_comunidad;
create policy drive_archivos_lectura on public.drive_archivos_comunidad for select to authenticated
using(public.puede_gestionar_compromisos() or (visible_cliente and exists(
 select 1 from public.portal_cliente_dashboard() d where d.comunidad_id::text=drive_archivos_comunidad.comunidad_id::text
)));
revoke all on public.drive_carpetas_comunidad,public.drive_archivos_comunidad from anon,authenticated;
grant select on public.drive_carpetas_comunidad,public.drive_archivos_comunidad to authenticated;
grant select,insert,update,delete on public.drive_carpetas_comunidad,public.drive_archivos_comunidad to service_role;
comment on table public.drive_archivos_comunidad is 'Metadatos únicamente; bytes de archivos permanecen en Google Drive.';
