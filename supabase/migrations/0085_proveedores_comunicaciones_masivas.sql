-- Comunicaciones masivas a proveedores: cabecera, destinatarios y trazabilidad.

create table if not exists public.proveedor_comunicaciones (
  id uuid primary key default gen_random_uuid(),
  asunto text not null check (length(btrim(asunto)) between 1 and 200),
  mensaje text not null check (length(btrim(mensaje)) between 1 and 20000),
  alcance text not null check (alcance in ('seleccionados','filtrados','todos')),
  filtros jsonb not null default '{}'::jsonb,
  incluir_telefono boolean not null default false,
  destinatarios_total integer not null default 0,
  enviados integer not null default 0,
  fallidos integer not null default 0,
  omitidos integer not null default 0,
  estado text not null default 'procesando'
    check (estado in ('procesando','enviada','parcial','fallida')),
  creado_por uuid not null references public.perfiles(id) on delete restrict default auth.uid(),
  creado_en timestamptz not null default now(),
  finalizado_en timestamptz
);

create table if not exists public.proveedor_comunicacion_destinatarios (
  id uuid primary key default gen_random_uuid(),
  comunicacion_id uuid not null references public.proveedor_comunicaciones(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  empresa text not null,
  contacto_nombre text,
  email text,
  asunto text not null,
  mensaje text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','enviado','error','omitido')),
  motivo_omision text,
  error text,
  enviado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists proveedor_comunicaciones_fecha_idx
  on public.proveedor_comunicaciones(creado_en desc);
create index if not exists proveedor_comunicaciones_creado_por_idx
  on public.proveedor_comunicaciones(creado_por, creado_en desc);
create index if not exists proveedor_comunicacion_destinatarios_comunicacion_idx
  on public.proveedor_comunicacion_destinatarios(comunicacion_id, estado);
create index if not exists proveedor_comunicacion_destinatarios_proveedor_idx
  on public.proveedor_comunicacion_destinatarios(proveedor_id, creado_en desc);

alter table public.proveedor_comunicaciones enable row level security;
alter table public.proveedor_comunicacion_destinatarios enable row level security;

drop policy if exists proveedor_comunicaciones_lectura on public.proveedor_comunicaciones;
create policy proveedor_comunicaciones_lectura
on public.proveedor_comunicaciones for select to authenticated
using (public.es_admin());

drop policy if exists proveedor_comunicaciones_insert on public.proveedor_comunicaciones;
create policy proveedor_comunicaciones_insert
on public.proveedor_comunicaciones for insert to authenticated
with check (public.es_admin() and creado_por=auth.uid());

drop policy if exists proveedor_comunicaciones_delete on public.proveedor_comunicaciones;
create policy proveedor_comunicaciones_delete
on public.proveedor_comunicaciones for delete to authenticated
using (public.es_superadmin());

drop policy if exists proveedor_comunicacion_destinatarios_lectura on public.proveedor_comunicacion_destinatarios;
create policy proveedor_comunicacion_destinatarios_lectura
on public.proveedor_comunicacion_destinatarios for select to authenticated
using (public.es_admin());

grant select,insert,delete on public.proveedor_comunicaciones to authenticated;
grant select on public.proveedor_comunicacion_destinatarios to authenticated;

comment on table public.proveedor_comunicaciones is
  'Cabecera de comunicaciones enviadas a uno o más proveedores.';
comment on table public.proveedor_comunicacion_destinatarios is
  'Snapshot por proveedor de cada comunicación, con estado individual de entrega.';
