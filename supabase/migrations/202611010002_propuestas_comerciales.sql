-- Integración del generador comercial histórico de Coproactiva.
-- No elimina datos Netlify ni cambia las propuestas históricas existentes.
create table if not exists public.propuestas_comerciales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) between 1 and 160),
  prospecto_id uuid references public.prospectos(id) on delete set null,
  datos jsonb not null default '{}'::jsonb,
  opciones jsonb not null default '{"portada":true,"numeros":true,"honorarios":true}'::jsonb,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint propuesta_comercial_datos_objeto check(jsonb_typeof(datos)='object'),
  constraint propuesta_comercial_opciones_objeto check(jsonb_typeof(opciones)='object')
);
create index if not exists propuestas_comerciales_prospecto_idx
  on public.propuestas_comerciales(prospecto_id,actualizado_en desc);
alter table public.propuestas_comerciales enable row level security;
revoke all on public.propuestas_comerciales from public,anon;
grant select,insert,update,delete on public.propuestas_comerciales to authenticated;

drop policy if exists propuestas_comerciales_select on public.propuestas_comerciales;
create policy propuestas_comerciales_select on public.propuestas_comerciales
for select to authenticated using (
  exists(select 1 from public.perfiles p where p.id=auth.uid()
    and p.activo and p.rol::text in ('superadmin','admin','jefatura'))
);
drop policy if exists propuestas_comerciales_insert on public.propuestas_comerciales;
create policy propuestas_comerciales_insert on public.propuestas_comerciales
for insert to authenticated with check (
  exists(select 1 from public.perfiles p where p.id=auth.uid()
    and p.activo and p.rol::text in ('superadmin','admin','jefatura'))
);
drop policy if exists propuestas_comerciales_update on public.propuestas_comerciales;
create policy propuestas_comerciales_update on public.propuestas_comerciales
for update to authenticated using (
  exists(select 1 from public.perfiles p where p.id=auth.uid()
    and p.activo and p.rol::text in ('superadmin','admin','jefatura'))
) with check (
  exists(select 1 from public.perfiles p where p.id=auth.uid()
    and p.activo and p.rol::text in ('superadmin','admin','jefatura'))
);
drop policy if exists propuestas_comerciales_delete on public.propuestas_comerciales;
create policy propuestas_comerciales_delete on public.propuestas_comerciales
for delete to authenticated using (
  exists(select 1 from public.perfiles p where p.id=auth.uid()
    and p.activo and p.rol::text in ('superadmin','admin','jefatura'))
);
