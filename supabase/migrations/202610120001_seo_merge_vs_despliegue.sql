-- Separa merge GitHub de publicacion comprobada en www.coproactiva.cl
alter table public.seo_propuestas drop constraint if exists seo_propuestas_estado_check;
alter table public.seo_propuestas add constraint seo_propuestas_estado_check
  check (estado in ('aprobada','preparada','integrada','ajustes_solicitados','descartada','publicada','error_preparacion'));
alter table public.seo_propuestas add column if not exists fusionada_en timestamptz;
alter table public.seo_propuestas add column if not exists verificada_en timestamptz;
alter table public.seo_propuestas add column if not exists ultima_verificacion_en timestamptz;
alter table public.seo_propuestas add column if not exists verificacion_detalle text;
alter table public.seo_propuestas add column if not exists fuente_integracion text;
alter table public.seo_propuestas add column if not exists seguimiento_snapshot jsonb not null default '{}'::jsonb;
create index if not exists idx_seo_seguimiento on public.seo_propuestas(estado,verificada_en);
-- PR #1 comprobado mediante GitHub API el 12-10-2026. Fusion != web desplegada.
update public.seo_propuestas
  set estado='integrada', pr_numero=1,
      pr_url='https://github.com/franciscomorgadotobar-crypto/web-coproactiva/pull/1',
      rama_git='seo/propuesta-7bcd9263-723c',
      fusionada_en='2026-10-12T01:13:06+00'::timestamptz,
      publicacion_sha='e454b833e9eddfe73f781161a1182e7c2e53ba73',
      fuente_integracion='verificacion_git_connector',
      verificacion_detalle='Fusion confirmada en GitHub. Falta verificar HTML servido por el hosting.',
      editada_en=now()
where id='7bcd9263-723c-494d-b21d-813ef993aa49'::uuid
  and estado='aprobada' and pr_numero is null;