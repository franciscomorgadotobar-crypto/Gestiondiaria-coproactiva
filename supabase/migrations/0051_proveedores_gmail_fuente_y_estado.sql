alter table public.proveedor_correos
  add column if not exists cuerpo_html text,
  add column if not exists destinatarios text[] not null default '{}',
  add column if not exists cc text[] not null default '{}',
  add column if not exists rfc_message_id text,
  add column if not exists storage_path_eml text;

alter table public.proveedores
  add column if not exists gmail_sync_error text;

create table if not exists public.proveedor_sync_estado (
  clave text primary key,
  ultima_revision timestamptz,
  ultimo_exito timestamptz,
  ultimo_error text,
  en_ejecucion_desde timestamptz,
  correos_procesados integer not null default 0,
  proveedores_actualizados integer not null default 0,
  editado_en timestamptz not null default now()
);

alter table public.proveedor_sync_estado enable row level security;

create policy proveedor_sync_estado_lectura_admin
on public.proveedor_sync_estado for select to authenticated
using (es_admin());

grant select on public.proveedor_sync_estado to authenticated;
grant select, insert, update, delete on public.proveedor_sync_estado to service_role;

insert into public.proveedor_sync_estado (clave)
values ('gmail_proveedores')
on conflict (clave) do nothing;

comment on column public.proveedor_correos.storage_path_eml is
  'Ruta privada al correo original RFC822 dentro del bucket proveedores-correo.';
comment on column public.proveedor_correos.cuerpo_html is
  'HTML original procesado del correo para una futura vista interna; nunca debe renderizarse sin sanitizar.';
