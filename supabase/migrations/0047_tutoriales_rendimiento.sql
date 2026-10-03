-- Ajustes de rendimiento de las tablas de tutoriales.
-- Evita políticas SELECT duplicadas y reemplaza índices redundantes por los de FK.

drop policy if exists tutoriales_superadmin on public.tutoriales;
create policy tutoriales_superadmin_insert on public.tutoriales
for insert to authenticated
with check (mi_rol() = 'superadmin');
create policy tutoriales_superadmin_update on public.tutoriales
for update to authenticated
using (mi_rol() = 'superadmin')
with check (mi_rol() = 'superadmin');
create policy tutoriales_superadmin_delete on public.tutoriales
for delete to authenticated
using (mi_rol() = 'superadmin');

drop policy if exists tutorial_asignaciones_superadmin on public.tutorial_asignaciones;
create policy tutorial_asignaciones_superadmin_insert on public.tutorial_asignaciones
for insert to authenticated
with check (mi_rol() = 'superadmin');
create policy tutorial_asignaciones_superadmin_update on public.tutorial_asignaciones
for update to authenticated
using (mi_rol() = 'superadmin')
with check (mi_rol() = 'superadmin');
create policy tutorial_asignaciones_superadmin_delete on public.tutorial_asignaciones
for delete to authenticated
using (mi_rol() = 'superadmin');

drop index if exists public.tutorial_asignaciones_perfil_idx;
drop index if exists public.tutorial_progreso_perfil_idx;

create index if not exists tutorial_asignaciones_tutorial_idx
  on public.tutorial_asignaciones(tutorial_id);
create index if not exists tutorial_asignaciones_asignado_por_idx
  on public.tutorial_asignaciones(asignado_por);
create index if not exists tutorial_progreso_tutorial_idx
  on public.tutorial_progreso(tutorial_id);
