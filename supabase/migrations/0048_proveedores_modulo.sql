-- Módulo Proveedores: gestión, lista negra e historial de contactos.

alter table public.proveedores
  add column if not exists origen text not null default 'manual',
  add column if not exists lista_negra boolean not null default false,
  add column if not exists lista_negra_en timestamptz,
  add column if not exists lista_negra_por uuid references public.perfiles(id) on delete set null,
  add column if not exists lista_negra_motivo text,
  add column if not exists lista_negra_detalle text,
  add column if not exists creado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists editado_por uuid references public.perfiles(id) on delete set null;

update public.proveedores
set origen = 'correo'
where gmail_thread_id is not null
  and origen = 'manual';

create index if not exists proveedores_estado_idx on public.proveedores(estado);
create index if not exists proveedores_lista_negra_idx on public.proveedores(lista_negra) where lista_negra;
create index if not exists proveedores_fecha_contacto_idx on public.proveedores(fecha_contacto desc);
create index if not exists proveedores_lista_negra_por_idx on public.proveedores(lista_negra_por);
create index if not exists proveedores_creado_por_idx on public.proveedores(creado_por);
create index if not exists proveedores_editado_por_idx on public.proveedores(editado_por);

drop policy if exists "admins gestionan proveedores" on public.proveedores;

create policy proveedores_lectura_admin
on public.proveedores for select to authenticated
using (es_admin());

create policy proveedores_insert_admin
on public.proveedores for insert to authenticated
with check (es_admin());

create policy proveedores_update_admin
on public.proveedores for update to authenticated
using (es_admin())
with check (es_admin());

create policy proveedores_delete_superadmin
on public.proveedores for delete to authenticated
using (es_superadmin());

grant select, insert, update, delete on public.proveedores to authenticated;

create table if not exists public.proveedor_interacciones (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  canal text not null check (canal in ('llamada','whatsapp','correo','nota')),
  detalle text,
  realizado_por uuid references public.perfiles(id) on delete set null default auth.uid(),
  realizado_en timestamptz not null default now()
);

alter table public.proveedor_interacciones enable row level security;

create policy proveedor_interacciones_lectura
on public.proveedor_interacciones for select to authenticated
using (es_admin());

create policy proveedor_interacciones_insert
on public.proveedor_interacciones for insert to authenticated
with check (es_admin());

create policy proveedor_interacciones_update
on public.proveedor_interacciones for update to authenticated
using (es_admin())
with check (es_admin());

create policy proveedor_interacciones_delete
on public.proveedor_interacciones for delete to authenticated
using (es_superadmin());

grant select, insert, update, delete on public.proveedor_interacciones to authenticated;

create index if not exists proveedor_interacciones_proveedor_fecha_idx
  on public.proveedor_interacciones(proveedor_id, realizado_en desc);
create index if not exists proveedor_interacciones_realizado_por_idx
  on public.proveedor_interacciones(realizado_por);

comment on table public.proveedor_interacciones is
  'Historial de contactos y notas operativas de cada proveedor.';
