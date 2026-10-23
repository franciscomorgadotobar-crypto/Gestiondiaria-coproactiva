-- Compromisos contractuales y avances publicables por comunidad.
-- No se precargan compromisos de borradores sin aprobación.
create table if not exists public.compromisos_administracion (
 id uuid primary key default gen_random_uuid(),
 comunidad_id uuid not null references public.comunidades(id) on delete cascade,
 titulo text not null check (length(trim(titulo)) > 0),
 descripcion text not null default '',
 referencia_contractual text,
 fecha_limite date,
 responsable text,
 estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','en_espera','completado')),
 avance smallint not null default 0 check (avance between 0 and 100),
 publicado boolean not null default false,
 creado_por uuid references auth.users(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now()
);
create table if not exists public.compromisos_avances (
 id uuid primary key default gen_random_uuid(),
 compromiso_id uuid not null references public.compromisos_administracion(id) on delete cascade,
 descripcion text not null check(length(trim(descripcion)) > 0),
 porcentaje smallint check (porcentaje between 0 and 100),
 estado text check (estado in ('pendiente','en_curso','en_espera','completado')),
 referencia_tipo text check(referencia_tipo in ('bitacora','levantamiento','mantencion','documento','agenda')),
 referencia_id text,
 evidencia_url text,
 publicado boolean not null default false,
 registrado_por uuid references auth.users(id),
 registrado_en timestamptz not null default now()
);
create index if not exists compromisos_comunidad_idx on public.compromisos_administracion(comunidad_id);
create index if not exists compromisos_avances_compromiso_idx on public.compromisos_avances(compromiso_id, registrado_en desc);
alter table public.compromisos_administracion enable row level security;
alter table public.compromisos_avances enable row level security;
create or replace function public.puede_gestionar_compromisos() returns boolean
language sql stable security definer set search_path=public as $$
 select exists (select 1 from public.perfiles where id=auth.uid() and rol in ('superadmin','admin','jefatura') and coalesce(activo,true));
$$;
revoke all on function public.puede_gestionar_compromisos() from public;
grant execute on function public.puede_gestionar_compromisos() to authenticated;
create policy compromisos_lectura on public.compromisos_administracion for select to authenticated
 using (public.puede_gestionar_compromisos() or (publicado and exists (
 select 1 from public.portal_cliente_dashboard() d where d.comunidad_id::text = comunidad_id::text
 )));
create policy compromisos_escritura on public.compromisos_administracion for all to authenticated
 using (public.puede_gestionar_compromisos()) with check (public.puede_gestionar_compromisos());
create policy avances_lectura on public.compromisos_avances for select to authenticated
 using (public.puede_gestionar_compromisos() or (publicado and exists (
 select 1 from public.compromisos_administracion c where c.id=compromiso_id and c.publicado
 )));
create policy avances_escritura on public.compromisos_avances for all to authenticated
 using (public.puede_gestionar_compromisos()) with check (public.puede_gestionar_compromisos());
grant select, insert, update, delete on public.compromisos_administracion, public.compromisos_avances to authenticated;
comment on table public.compromisos_administracion is 'Compromisos de administración por comunidad; publicar solo tras validar el contrato.';
