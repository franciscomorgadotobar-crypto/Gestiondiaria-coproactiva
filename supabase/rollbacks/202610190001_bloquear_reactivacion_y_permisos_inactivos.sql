-- REVERSIÓN de 202610190001_bloquear_reactivacion_y_permisos_inactivos.sql
-- SOLO si hay un incidente de compatibilidad que requiera rollback inmediato.
-- ADVERTENCIA: restaurar estas reglas reabre el problema de cuentas inactivas.
-- Aplicar con privilegios administrativos de base de datos.

drop trigger if exists trg_proteger_estado_activo_perfil on public.perfiles;
drop function if exists public.proteger_estado_activo_perfil();

drop policy if exists controles_exigir_perfil_activo on public.controles;
drop policy if exists asignaciones_exigir_perfil_activo on public.perfil_comunidades;

create or replace function public.mi_rol()
returns public.rol_usuario
language sql stable security definer
set search_path = public
as $$
  select rol from perfiles where id = auth.uid();
$$;

create or replace function public.ve_comunidad(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select es_superadmin() or exists (
    select 1 from perfil_comunidades
    where perfil_id = auth.uid() and comunidad_id = cid
  );
$$;

create or replace function public.ve_control(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from controles c
    where c.id = cid
      and (
        (c.comunidad_id is not null and ve_comunidad(c.comunidad_id))
        or (c.prospecto_id is not null
            and (es_admin() or mi_rol() = 'jefatura' or c.responsable_id = auth.uid()))
      )
  );
$$;

create or replace function public.puede_operar_control(
  p_comunidad_id uuid,
  p_prospecto_id uuid,
  p_responsable_id uuid
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select (
    (p_comunidad_id is not null and ve_comunidad(p_comunidad_id))
    or (
      p_prospecto_id is not null
      and (es_admin() or mi_rol() = 'jefatura' or p_responsable_id = auth.uid())
    )
  )
  and (es_admin() or mi_rol() = 'jefatura' or p_responsable_id = auth.uid());
$$;
