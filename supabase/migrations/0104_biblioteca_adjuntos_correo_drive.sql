-- Biblioteca interna de adjuntos: bytes solamente en Drive corporativo.
-- Metadatos privados en Supabase, accesibles a responsables CRM.
create table if not exists public.correo_archivos_drive (
 id uuid primary key default gen_random_uuid(),
 drive_file_id text not null unique,
 nombre text not null,
 mime text not null,
 tamano bigint not null check(tamano > 0 and tamano <= 8388608),
 categoria text not null default 'General',
 subido_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 eliminado_en timestamptz
);
create index if not exists correo_archivos_drive_busqueda
 on public.correo_archivos_drive(categoria, creado_en desc) where eliminado_en is null;
alter table public.correo_archivos_drive enable row level security;
drop policy if exists correo_archivos_drive_lectura on public.correo_archivos_drive;
create policy correo_archivos_drive_lectura on public.correo_archivos_drive
 for select to authenticated using (public.puede_gestionar_compromisos());
revoke all on public.correo_archivos_drive from public,anon,authenticated;
grant select on public.correo_archivos_drive to authenticated;
-- Copia de metadatos para la auditoría de envío; no guarda bytes.
alter table public.prospecto_correos
 add column if not exists adjuntos jsonb not null default '[]'::jsonb;
