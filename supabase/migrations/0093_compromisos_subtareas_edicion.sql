-- Subtareas, borrado de adjuntos y seguridad de accesos de compromisos.
create table if not exists public.compromisos_subtareas (
 id uuid primary key default gen_random_uuid(),
 compromiso_id uuid not null references public.compromisos_administracion(id) on delete cascade,
 titulo text not null check(length(trim(titulo))>0),
 completada boolean not null default false,
 orden integer not null default 0,
 creado_en timestamptz not null default now()
);
create index if not exists idx_subtareas_compromiso on public.compromisos_subtareas(compromiso_id,orden);
alter table public.compromisos_subtareas enable row level security;
drop policy if exists compromisos_subtareas_lectura on public.compromisos_subtareas;
create policy compromisos_subtareas_lectura on public.compromisos_subtareas for select to authenticated
using(public.puede_gestionar_compromisos() or exists(select 1 from public.compromisos_administracion c where c.id=compromiso_id));
drop policy if exists compromisos_subtareas_gestion on public.compromisos_subtareas;
create policy compromisos_subtareas_gestion on public.compromisos_subtareas for all to authenticated using(public.puede_gestionar_compromisos()) with check(public.puede_gestionar_compromisos());
grant select,insert,update,delete on public.compromisos_subtareas to authenticated;
drop policy if exists adjuntos_compromisos_eliminar on public.compromisos_avances_adjuntos;
create policy adjuntos_compromisos_eliminar on public.compromisos_avances_adjuntos for delete to authenticated using(public.puede_gestionar_compromisos());
grant delete on public.compromisos_avances_adjuntos to authenticated;
drop policy if exists archivo_compromisos_eliminar on storage.objects;
create policy archivo_compromisos_eliminar on storage.objects for delete to authenticated using(bucket_id='compromisos-adjuntos' and public.puede_gestionar_compromisos());
drop policy if exists compromisos_lectura on public.compromisos_administracion;
create policy compromisos_lectura on public.compromisos_administracion for select to authenticated using(public.puede_gestionar_compromisos() or (publicado and exists(select 1 from public.portal_cliente_dashboard() d where d.comunidad_id::text=compromisos_administracion.comunidad_id::text)));
drop policy if exists archivo_compromisos_select on storage.objects;
create policy archivo_compromisos_select on storage.objects for select to authenticated using(bucket_id='compromisos-adjuntos' and (public.puede_gestionar_compromisos() or exists(
select 1 from public.compromisos_avances_adjuntos aj join public.compromisos_avances a on a.id=aj.avance_id join public.compromisos_administracion c on c.id=a.compromiso_id where aj.ruta=storage.objects.name and a.publicado and c.publicado
)));
