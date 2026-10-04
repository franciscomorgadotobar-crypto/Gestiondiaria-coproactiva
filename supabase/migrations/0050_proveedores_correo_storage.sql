-- Archivos fuente de correos de proveedores.
-- Bucket privado para PDF, correo original (.eml) y otros adjuntos útiles.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proveedores-correo',
  'proveedores-correo',
  false,
  20971520,
  array[
    'application/pdf',
    'message/rfc822',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy proveedor_correo_archivos_lectura_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'proveedores-correo'
  and public.es_admin()
);

create policy proveedor_correo_archivos_insert_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'proveedores-correo'
  and public.es_admin()
);

create policy proveedor_correo_archivos_update_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'proveedores-correo'
  and public.es_admin()
)
with check (
  bucket_id = 'proveedores-correo'
  and public.es_admin()
);

create policy proveedor_correo_archivos_delete_superadmin
on storage.objects for delete to authenticated
using (
  bucket_id = 'proveedores-correo'
  and public.es_superadmin()
);

comment on table public.proveedor_correos is
  'Correos de Gmail asociados a proveedores. Guarda cuerpo y metadatos; adjuntos referencia archivos privados del bucket proveedores-correo.';
