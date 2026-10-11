-- Flujo de revisión SEO. Las modificaciones reales de la web se realizan mediante GitHub PR.
create table if not exists public.seo_propuestas (
  id uuid primary key default gen_random_uuid(),
  ruta text not null check (ruta like '/%' and char_length(ruta) <= 200),
  consulta_principal text not null,
  consultas jsonb not null default '[]'::jsonb,
  metricas jsonb not null default '{}'::jsonb,
  titulo_actual text not null default '',
  titulo_propuesto text not null default '',
  descripcion_actual text not null default '',
  descripcion_propuesta text not null default '',
  h1_actual text not null default '',
  diagnostico text not null default '',
  motivo text not null default '',
  estado text not null default 'aprobada'
    check (estado in ('aprobada','preparada','ajustes_solicitados','descartada','publicada','error_preparacion')),
  autor_id uuid not null references auth.users(id),
  revisor_id uuid references auth.users(id),
  observaciones text,
  repo_ruta text,
  rama_git text,
  pr_numero integer,
  pr_url text,
  base_sha text,
  metricas_basales jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now(),
  editada_en timestamptz not null default now(),
  publicada_en timestamptz,
  publicacion_sha text,
  constraint seo_propuestas_estado_pr_check check (
    (estado <> 'preparada' and estado <> 'publicada')
    or (pr_numero is not null and pr_url is not null)
  )
);
create index if not exists idx_seo_propuestas_estado on public.seo_propuestas(estado,creada_en desc);
create index if not exists idx_seo_propuestas_ruta on public.seo_propuestas(ruta,creada_en desc);
alter table public.seo_propuestas enable row level security;
-- Sin políticas para anon ni authenticated: exclusivamente a través del backend JWT+rol
-- con service role, nunca con clave de servicio en el navegador.
comment on table public.seo_propuestas is 'Aprobaciones SEO, propuestas para PR y seguimiento. Escribe sólo Edge Function autorizada.';
