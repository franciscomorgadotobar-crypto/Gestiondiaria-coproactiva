-- ENTORNO DESCARTABLE: PostgreSQL 17, sin usuarios ni datos de Coproactiva.
-- Esquema mínimo que reproduce RLS / rol y el bug ANTES de la corrección.
\set ON_ERROR_STOP on

create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to authenticated, anon, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text
language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;

create type public.rol_usuario as enum ('superadmin','admin','jefatura','terreno','cliente');
create table public.perfiles(
  id uuid primary key,
  nombre text not null,
  rol public.rol_usuario not null,
  activo boolean not null default true,
  email text,
  editado_en timestamptz
);
create table public.comunidades(id uuid primary key, nombre text not null);
create table public.perfil_comunidades(
  perfil_id uuid not null references public.perfiles(id),
  comunidad_id uuid not null references public.comunidades(id),
  primary key(perfil_id,comunidad_id)
);
create table public.controles(
  id uuid primary key,
  comunidad_id uuid references public.comunidades(id),
  prospecto_id uuid,
  responsable_id uuid references public.perfiles(id)
);

-- Definiciones vigentes ANTES del parche, derivadas de la configuración real.
create or replace function public.mi_rol() returns public.rol_usuario
language sql stable security definer set search_path = public
as $$ select rol from perfiles where id = auth.uid() $$;
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(mi_rol() in ('superadmin','admin'),false) $$;
create or replace function public.es_superadmin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(mi_rol() = 'superadmin',false) $$;
create or replace function public.usuario_es_cliente_activo() returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol='cliente') $$;
create or replace function public.ve_comunidad(cid uuid) returns boolean
language sql stable security definer set search_path=public
as $$
select es_superadmin() or exists(
  select 1 from perfil_comunidades
  where perfil_id=auth.uid() and comunidad_id=cid
)
$$;
create or replace function public.ve_control(cid uuid) returns boolean
language sql stable security definer set search_path=public
as $$
select exists(
  select 1 from controles c
  where c.id=cid
    and (
      (c.comunidad_id is not null and ve_comunidad(c.comunidad_id))
      or (c.prospecto_id is not null and (
        es_admin() or mi_rol()='jefatura' or c.responsable_id=auth.uid()
      ))
    )
)
$$;
create or replace function public.puede_operar_control(
  p_comunidad_id uuid,p_prospecto_id uuid,p_responsable_id uuid
) returns boolean
language sql stable security definer set search_path=public
as $$
select (
  (p_comunidad_id is not null and ve_comunidad(p_comunidad_id))
  or (p_prospecto_id is not null and (
    es_admin() or mi_rol()='jefatura' or p_responsable_id=auth.uid()
  ))
)
and (es_admin() or mi_rol()='jefatura' or p_responsable_id=auth.uid())
$$;

-- Copia reducida y fiel de los otros dos triggers BEFORE UPDATE de producción.
create or replace function public.tocar_editado_en()
returns trigger language plpgsql set search_path=public as $
begin
  new.editado_en = now();
  return new;
end; $;
create trigger perfiles_editado before update on public.perfiles
for each row execute function public.tocar_editado_en();

create or replace function public.proteger_email_perfil()
returns trigger language plpgsql security definer set search_path=public as $
begin
  if new.email is distinct from old.email
    and auth.uid() is not null
    and not public.es_superadmin() then
    raise exception 'El correo de acceso solo puede modificarlo un superadministrador.';
  end if;
  return new;
end; $;
create trigger trg_proteger_email_perfil before update on public.perfiles
for each row execute function public.proteger_email_perfil();

alter table public.perfiles enable row level security;
alter table public.comunidades enable row level security;
alter table public.perfil_comunidades enable row level security;
alter table public.controles enable row level security;
create policy perfiles_lectura on public.perfiles for select
using (id=auth.uid() or public.es_admin());
create policy perfiles_edicion_propia on public.perfiles for update
using (id=auth.uid()) with check (id=auth.uid() and rol=public.mi_rol());
create policy perfiles_administracion on public.perfiles for all
using(public.es_admin() and (rol <> 'superadmin' or public.es_superadmin()))
with check(public.es_admin() and (rol <> 'superadmin' or public.es_superadmin()));
create policy perfiles_bloqueo_cliente_escritura on public.perfiles as restrictive
for update to authenticated using(not public.usuario_es_cliente_activo())
with check(not public.usuario_es_cliente_activo());
create policy perfiles_limite_cliente_select on public.perfiles as restrictive
for select to authenticated
using(not public.usuario_es_cliente_activo() or id=auth.uid());

create policy comunidades_lectura on public.comunidades for select
using(public.ve_comunidad(id));
create policy asignaciones_lectura on public.perfil_comunidades for select
using(perfil_id=auth.uid() or public.es_admin());
create policy controles_lectura on public.controles for select
using(public.ve_control(id));

grant usage on schema public to authenticated, service_role;
grant select, update on public.perfiles to authenticated;
grant select on public.comunidades, public.perfil_comunidades, public.controles to authenticated;
grant all on all tables in schema public to service_role;

-- Datos íntegramente ficticios. IDs fijos para ejecutar la misma prueba siempre.
insert into public.perfiles(id,nombre,rol,activo) values
('00000000-0000-0000-0000-000000000001','Superadmin de prueba','superadmin',true),
('00000000-0000-0000-0000-000000000002','Admin de prueba','admin',true),
('00000000-0000-0000-0000-000000000003','Admin inactivo de prueba','admin',false),
('00000000-0000-0000-0000-000000000004','Terreno de prueba','terreno',true),
('00000000-0000-0000-0000-000000000005','Terreno inactivo de prueba','terreno',false),
('00000000-0000-0000-0000-000000000006','Cliente de prueba','cliente',true);
insert into public.comunidades(id,nombre) values
('10000000-0000-0000-0000-000000000001','Comunidad A ficticia'),
('10000000-0000-0000-0000-000000000002','Comunidad B ficticia');
insert into public.perfil_comunidades(perfil_id,comunidad_id) values
('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001');
insert into public.controles(id,comunidad_id,prospecto_id,responsable_id) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null,'00000000-0000-0000-0000-000000000004'),
('20000000-0000-0000-0000-000000000002',null,'30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005');

-- Confirmación de reproducción de la falla original (cuenta inactiva propia).
begin;
  set local role authenticated;
  set local request.jwt.claim.role='authenticated';
  set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
  update public.perfiles set activo=true
  where id='00000000-0000-0000-0000-000000000005';
commit;

do $$
begin
  if not (select activo from public.perfiles where id='00000000-0000-0000-0000-000000000005') then
    raise exception 'El escenario no reproduce la vulnerabilidad previa: revisar modelo de prueba';
  end if;
  raise notice 'PASS: reproducción de auto-reactivación ANTES de la corrección';
  update public.perfiles set activo=false
    where id='00000000-0000-0000-0000-000000000005';
end $$;
