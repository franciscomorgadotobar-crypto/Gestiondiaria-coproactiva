-- Enriquecimiento de Proveedores desde Gmail.
-- Conserva cada correo fuente y amplía la ficha del proveedor con datos
-- estructurados que pueden provenir de varios mensajes.

alter table public.proveedores
  add column if not exists direccion text,
  add column if not exists regiones text[] not null default '{}',
  add column if not exists especialidades text[] not null default '{}',
  add column if not exists palabras_clave text[] not null default '{}',
  add column if not exists contactos jsonb not null default '[]'::jsonb,
  add column if not exists certificaciones text[] not null default '{}',
  add column if not exists marcas text[] not null default '{}',
  add column if not exists condiciones_comerciales text,
  add column if not exists gmail_ultimo_mensaje_id text,
  add column if not exists gmail_asunto_ultimo text,
  add column if not exists gmail_ultima_sincronizacion timestamptz;

create table if not exists public.proveedor_correos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores(id) on delete cascade,
  gmail_message_id text not null unique,
  gmail_thread_id text,
  remitente_nombre text,
  remitente_email text,
  asunto text,
  fecha_correo timestamptz,
  snippet text,
  cuerpo_texto text,
  adjuntos jsonb not null default '[]'::jsonb,
  datos_extraidos jsonb not null default '{}'::jsonb,
  procesado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  constraint proveedor_correos_adjuntos_array
    check (jsonb_typeof(adjuntos) = 'array'),
  constraint proveedor_correos_datos_objeto
    check (jsonb_typeof(datos_extraidos) = 'object')
);

comment on table public.proveedor_correos is
  'Correos de Gmail asociados a proveedores. Conserva la fuente y los datos estructurados extraídos para poder reanalizar sin perder información.';

comment on column public.proveedor_correos.cuerpo_texto is
  'Contenido textual del correo usado como fuente para extracción y futuras reextracciones.';

alter table public.proveedor_correos enable row level security;

create policy proveedor_correos_lectura_admin
on public.proveedor_correos for select to authenticated
using (es_admin());

create policy proveedor_correos_insert_admin
on public.proveedor_correos for insert to authenticated
with check (es_admin());

create policy proveedor_correos_update_admin
on public.proveedor_correos for update to authenticated
using (es_admin())
with check (es_admin());

create policy proveedor_correos_delete_superadmin
on public.proveedor_correos for delete to authenticated
using (es_superadmin());

grant select, insert, update, delete on public.proveedor_correos to authenticated;
grant select, insert, update, delete on public.proveedor_correos to service_role;

create index if not exists proveedor_correos_proveedor_fecha_idx
  on public.proveedor_correos(proveedor_id, fecha_correo desc);
create index if not exists proveedor_correos_thread_idx
  on public.proveedor_correos(gmail_thread_id);
create index if not exists proveedor_correos_remitente_idx
  on public.proveedor_correos(lower(remitente_email));

create index if not exists proveedores_especialidades_gin_idx
  on public.proveedores using gin(especialidades);
create index if not exists proveedores_palabras_clave_gin_idx
  on public.proveedores using gin(palabras_clave);
create index if not exists proveedores_regiones_gin_idx
  on public.proveedores using gin(regiones);
create index if not exists proveedores_contactos_gin_idx
  on public.proveedores using gin(contactos jsonb_path_ops);

comment on column public.proveedores.especialidades is
  'Especialidades normalizadas extraídas de correos y complementadas manualmente.';
comment on column public.proveedores.palabras_clave is
  'Términos de búsqueda extraídos de servicios, productos, problemas y soluciones mencionados en los correos.';
comment on column public.proveedores.contactos is
  'Contactos adicionales del proveedor como objetos con nombre, cargo, email y teléfono.';
comment on column public.proveedores.gmail_ultima_sincronizacion is
  'Última vez que el proveedor fue enriquecido a partir del correo de CoproActiva.';
