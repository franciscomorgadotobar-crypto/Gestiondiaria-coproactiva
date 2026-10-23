insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('compromisos-adjuntos','compromisos-adjuntos',false,15728640,
array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'])
on conflict(id) do nothing;
create table if not exists public.compromisos_avances_adjuntos (
 id uuid primary key default gen_random_uuid(),
 avance_id uuid not null references public.compromisos_avances(id) on delete cascade,
 ruta text not null unique, nombre text not null, tipo text,
 tamano bigint not null check(tamano >= 0 and tamano <= 15728640),
 creado_en timestamptz not null default now()
);
alter table public.compromisos_avances_adjuntos enable row level security;
create policy adjuntos_compromisos_select on public.compromisos_avances_adjuntos for select to authenticated
using (exists(select 1 from public.compromisos_avances a where a.id=avance_id));
create policy adjuntos_compromisos_insert on public.compromisos_avances_adjuntos for insert to authenticated
with check(public.puede_gestionar_compromisos());
grant select,insert on public.compromisos_avances_adjuntos to authenticated;
create policy archivo_compromisos_insert on storage.objects for insert to authenticated
with check(bucket_id='compromisos-adjuntos' and public.puede_gestionar_compromisos());
create policy archivo_compromisos_select on storage.objects for select to authenticated
using(bucket_id='compromisos-adjuntos' and (public.puede_gestionar_compromisos() or exists(
 select 1 from public.compromisos_avances_adjuntos aj where aj.ruta=name
)));