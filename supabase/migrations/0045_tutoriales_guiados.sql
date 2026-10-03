-- 0045 — Tutoriales guiados y capacitación.
-- La versión aplicada en producción se llama tutoriales_guiados.

create table if not exists public.tutoriales (
  id text primary key,
  nombre text not null,
  descripcion text not null default '',
  version integer not null default 1 check (version > 0),
  duracion_min integer not null default 3 check (duracion_min > 0),
  roles text[] not null default array['terreno','jefatura','admin','superadmin']::text[],
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now(),
  constraint tutorial_id_formato check (id ~ '^[a-z0-9_]+$')
);

create table if not exists public.tutorial_asignaciones (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  tutorial_id text not null references public.tutoriales(id) on delete cascade,
  version integer not null check (version > 0),
  iniciar_automaticamente boolean not null default true,
  asignado_por uuid references public.perfiles(id) on delete set null,
  asignado_en timestamptz not null default now(),
  primary key (perfil_id, tutorial_id, version)
);

create table if not exists public.tutorial_progreso (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  tutorial_id text not null references public.tutoriales(id) on delete cascade,
  version integer not null check (version > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_curso','completado')),
  paso_actual integer not null default 0 check (paso_actual >= 0),
  iniciado_en timestamptz,
  completado_en timestamptz,
  actualizado_en timestamptz not null default now(),
  primary key (perfil_id, tutorial_id, version)
);

create index if not exists tutorial_asignaciones_perfil_idx on public.tutorial_asignaciones(perfil_id);
create index if not exists tutorial_progreso_perfil_idx on public.tutorial_progreso(perfil_id);

alter table public.tutoriales enable row level security;
alter table public.tutorial_asignaciones enable row level security;
alter table public.tutorial_progreso enable row level security;

create policy tutoriales_lectura on public.tutoriales for select to authenticated
using (activo or mi_rol() = 'superadmin');
create policy tutoriales_superadmin on public.tutoriales for all to authenticated
using (mi_rol() = 'superadmin') with check (mi_rol() = 'superadmin');

create policy tutorial_asignaciones_lectura on public.tutorial_asignaciones for select to authenticated
using ((select auth.uid()) = perfil_id or mi_rol() = 'superadmin');
create policy tutorial_asignaciones_superadmin on public.tutorial_asignaciones for all to authenticated
using (mi_rol() = 'superadmin') with check (mi_rol() = 'superadmin');

create policy tutorial_progreso_lectura on public.tutorial_progreso for select to authenticated
using ((select auth.uid()) = perfil_id or mi_rol() = 'superadmin');
create policy tutorial_progreso_insercion on public.tutorial_progreso for insert to authenticated
with check ((select auth.uid()) = perfil_id or mi_rol() = 'superadmin');
create policy tutorial_progreso_edicion on public.tutorial_progreso for update to authenticated
using ((select auth.uid()) = perfil_id or mi_rol() = 'superadmin')
with check ((select auth.uid()) = perfil_id or mi_rol() = 'superadmin');
create policy tutorial_progreso_borrado on public.tutorial_progreso for delete to authenticated
using (mi_rol() = 'superadmin');

grant select on public.tutoriales to authenticated;
grant select, insert, update, delete on public.tutorial_asignaciones to authenticated;
grant select, insert, update, delete on public.tutorial_progreso to authenticated;

insert into public.tutoriales (id,nombre,descripcion,version,duracion_min,roles,orden)
values
('primeros_pasos','Primeros pasos',
 'Conoce el inicio, el avance del trabajo y dónde volver a encontrar la ayuda.',
 1,3,array['terreno','jefatura','admin','superadmin']::text[],10),
('ejecutar_levantamiento','Ejecutar un levantamiento',
 'Practica categorías, preguntas, respuestas, evidencia y finalización sin modificar datos reales.',
 1,6,array['terreno','jefatura','admin','superadmin']::text[],20)
on conflict (id) do update set
  nombre=excluded.nombre, descripcion=excluded.descripcion, version=excluded.version,
  duracion_min=excluded.duracion_min, roles=excluded.roles, orden=excluded.orden,
  activo=true, editado_en=now();

create or replace function public.asignar_tutoriales_a_nuevo_perfil()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.activo and new.rol::text <> 'cliente' then
    insert into tutorial_asignaciones(perfil_id,tutorial_id,version,iniciar_automaticamente,asignado_por)
    select new.id,t.id,t.version,true,null
    from tutoriales t
    where t.activo and new.rol::text = any(t.roles)
      and t.id in ('primeros_pasos','ejecutar_levantamiento')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger perfiles_tutoriales_iniciales
after insert on public.perfiles
for each row execute function public.asignar_tutoriales_a_nuevo_perfil();
