-- Registro auditable de correos comerciales desde Pipeline.
create table if not exists public.prospecto_correos (
 id uuid primary key default gen_random_uuid(),
 prospecto_id uuid not null references public.prospectos(id) on delete cascade,
 enviado_por uuid not null references public.perfiles(id),
 destinatario text not null,
 asunto text not null,
 mensaje text not null,
 estado text not null default 'pendiente' check (estado in ('pendiente','enviado','fallido')),
 error text,
 creado_en timestamptz not null default now(),
 enviado_en timestamptz
);
create index if not exists prospecto_correos_registro_idx on public.prospecto_correos(prospecto_id, creado_en desc);
create index if not exists prospecto_correos_limite_idx on public.prospecto_correos(enviado_por, creado_en desc);

alter table public.prospecto_correos enable row level security;
revoke all on public.prospecto_correos from public, anon, authenticated;
grant select on public.prospecto_correos to authenticated;

-- Solo miembros activos del área comercial pueden consultar el historial.
-- La creación y confirmación las efectúa exclusivamente la Edge Function
-- con service_role después de validar la identidad y autorización.
create policy prospecto_correos_comercial_lectura on public.prospecto_correos
  for select to authenticated
  using (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario);
