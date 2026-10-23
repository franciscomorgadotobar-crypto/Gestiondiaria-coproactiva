-- Seguridad: impedir que una cuenta desactivada recupere acceso mediante la API.
-- Aplicar solo después de revisar y probar en un entorno aislado.
-- No modifica registros ni los datos existentes.
--
-- El módulo Equipo llama a una Edge Function que usa service_role para activar
-- y dar de baja usuarios. Ese flujo autorizado se mantiene.

-- Todas las comprobaciones de rol se deben basar en una cuenta activa.
-- Las consultas de cuentas desactivadas devuelven NULL, incluyendo administradores.
create or replace function public.mi_rol()
returns public.rol_usuario
language sql stable security definer
set search_path = ''
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid()
    and p.activo is true;
$$;

-- No basta tener una asignación antigua para conservar acceso.
create or replace function public.ve_comunidad(cid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.mi_rol() is not null
    and (
      public.es_superadmin()
      or exists (
        select 1
        from public.perfil_comunidades pc
        where pc.perfil_id = auth.uid()
          and pc.comunidad_id = cid
      )
    );
$$;

-- Un usuario inactivo tampoco puede ver controles de prospectos que aún
-- figure como responsable, aunque conserve un JWT no vencido.
create or replace function public.ve_control(cid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.mi_rol() is not null
    and exists (
      select 1
      from public.controles c
      where c.id = cid
        and (
          (c.comunidad_id is not null and public.ve_comunidad(c.comunidad_id))
          or (
            c.prospecto_id is not null
            and (
              public.es_admin()
              or public.mi_rol() = 'jefatura'
              or c.responsable_id = auth.uid()
            )
          )
        )
    );
$$;

-- La operación tampoco se habilita por una asignación a un usuario inactivo.
create or replace function public.puede_operar_control(
  p_comunidad_id uuid,
  p_prospecto_id uuid,
  p_responsable_id uuid
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.mi_rol() is not null
    and (
      (p_comunidad_id is not null and public.ve_comunidad(p_comunidad_id))
      or (
        p_prospecto_id is not null
        and (
          public.es_admin()
          or public.mi_rol() = 'jefatura'
          or p_responsable_id = auth.uid()
        )
      )
    )
    and (
      public.es_admin()
      or public.mi_rol() = 'jefatura'
      or p_responsable_id = auth.uid()
    );
$$;

-- Bloquear explícitamente las consultas directas que comprueban solo
-- responsable_id = auth.uid() sin consultar ve_control().
drop policy if exists controles_exigir_perfil_activo on public.controles;
create policy controles_exigir_perfil_activo
on public.controles as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

-- Las asignaciones a comunidades no deben exponerse al usuario desactivado.
drop policy if exists asignaciones_exigir_perfil_activo on public.perfil_comunidades;
create policy asignaciones_exigir_perfil_activo
on public.perfil_comunidades as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

-- Impedir acceso residual a registros propios de una cuenta desactivada.
-- Las políticas permisivas existentes siguen controlando la titularidad.
-- Esta restricción solo añade la comprobación del estado de la cuenta.
drop policy if exists notificaciones_exigir_perfil_activo on public.notificaciones;
create policy notificaciones_exigir_perfil_activo
on public.notificaciones as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

drop policy if exists portal_cliente_comunidades_exigir_perfil_activo on public.portal_cliente_comunidades;
create policy portal_cliente_comunidades_exigir_perfil_activo
on public.portal_cliente_comunidades as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

drop policy if exists portal_cliente_plantillas_exigir_perfil_activo on public.portal_cliente_plantillas;
create policy portal_cliente_plantillas_exigir_perfil_activo
on public.portal_cliente_plantillas as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

drop policy if exists tutorial_asignaciones_exigir_perfil_activo on public.tutorial_asignaciones;
create policy tutorial_asignaciones_exigir_perfil_activo
on public.tutorial_asignaciones as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

drop policy if exists tutorial_progreso_exigir_perfil_activo on public.tutorial_progreso;
create policy tutorial_progreso_exigir_perfil_activo
on public.tutorial_progreso as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

drop policy if exists notificaciones_mantenimiento_exigir_perfil_activo on public.notificaciones_mantenimiento;
create policy notificaciones_mantenimiento_exigir_perfil_activo
on public.notificaciones_mantenimiento as restrictive for all to authenticated
using (public.mi_rol() is not null)
with check (public.mi_rol() is not null);

-- RLS compara el rol, pero no impide actualizar el propio campo activo.
-- Un trigger distingue OLD y NEW: solo un administrador activo puede cambiar
-- el estado de otra persona. Nadie puede reactivarse ni darse de baja a sí mismo.
-- service_role conserva el flujo de la Edge Function de Equipo.
create or replace function public.proteger_estado_activo_perfil()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.activo is distinct from old.activo
    and auth.role() is distinct from 'service_role'
  then
    if auth.uid() is null
      or auth.uid() = old.id
      or not coalesce(public.es_admin(), false)
    then
      raise exception 'Solo un administrador activo puede cambiar el estado de otra cuenta.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_estado_activo_perfil()
from public, anon, authenticated;

drop trigger if exists trg_proteger_estado_activo_perfil on public.perfiles;
create trigger trg_proteger_estado_activo_perfil
before update of activo on public.perfiles
for each row execute function public.proteger_estado_activo_perfil();
