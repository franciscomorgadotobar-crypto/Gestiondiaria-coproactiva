-- Archivos de documentos corporativos se guardan en Google Drive.
-- Supabase solo conserva IDs, versiones y relaciones; no almacena PDF binarios.
alter table public.correo_archivos_drive
  add column if not exists documento_id uuid references public.documentos_gestion(id) on delete set null,
  add column if not exists version_documento integer,
  add column if not exists carpeta_drive_id text;
alter table public.correo_archivos_drive
  drop constraint if exists correo_archivos_version_documento_valid;
alter table public.correo_archivos_drive
  add constraint correo_archivos_version_documento_valid
  check (version_documento is null or version_documento >= 1);
create unique index if not exists correo_archivos_drive_documento_version_unica
 on public.correo_archivos_drive(documento_id,version_documento)
 where documento_id is not null and version_documento is not null and eliminado_en is null;
create index if not exists correo_archivos_drive_documento
 on public.correo_archivos_drive(documento_id,creado_en desc)
 where documento_id is not null;
