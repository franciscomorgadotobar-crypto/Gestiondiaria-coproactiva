-- Coproactiva · Gestiones y avances v1 (2026-11-06)
-- MIGRACIÓN ADITIVA. Originales y rollback documentados en docs/reversion-gestiones-20261106.md.
-- Base de datos anterior copiada en schema privada copro_reversion_20261106.
begin;

-- Biblioteca reusable de procesos. Cada aplicación crea copia independiente de tareas.
create table if not exists public.gestiones_tipos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null check(length(trim(nombre)) between 2 and 180),
  descripcion text not null default '',
  categoria text not null default 'Administración',
  tareas jsonb not null default '[]'::jsonb check(jsonb_typeof(tareas)='array'),
  documentos_esperados jsonb not null default '[]'::jsonb check(jsonb_typeof(documentos_esperados)='array'),
  responsable_sugerido text,
  plazo_dias integer check(plazo_dias between 0 and 3650),
  activo boolean not null default true,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists gestiones_tipos_nombre_unico on public.gestiones_tipos(lower(trim(nombre)));
alter table public.gestiones_tipos enable row level security;
drop policy if exists gestiones_tipos_lectura on public.gestiones_tipos;
create policy gestiones_tipos_lectura on public.gestiones_tipos
 for select to authenticated using (public.puede_gestionar_compromisos());
drop policy if exists gestiones_tipos_escritura on public.gestiones_tipos;
create policy gestiones_tipos_escritura on public.gestiones_tipos
 for all to authenticated using (public.puede_gestionar_compromisos())
 with check (public.puede_gestionar_compromisos());
revoke all on public.gestiones_tipos from public,anon,authenticated;
grant select,insert,update,delete on public.gestiones_tipos to authenticated;

-- El contrato antiguo sigue siendo válido: no se renombra la tabla ni sus PK.
alter table public.compromisos_administracion
  add column if not exists tipo_gestion_id uuid references public.gestiones_tipos(id) on delete set null,
  add column if not exists prioridad text not null default 'normal',
  add column if not exists resultado text,
  add column if not exists proxima_accion_texto text,
  add column if not exists documentos_esperados jsonb not null default '[]'::jsonb;
alter table public.compromisos_administracion drop constraint if exists gestiones_documentos_esperados_check;
alter table public.compromisos_administracion add constraint gestiones_documentos_esperados_check
  check(jsonb_typeof(documentos_esperados)='array');
alter table public.compromisos_administracion drop constraint if exists compromisos_administracion_prioridad_check;
alter table public.compromisos_administracion add constraint compromisos_administracion_prioridad_check
  check(prioridad in ('baja','normal','alta','urgente'));
alter table public.compromisos_administracion drop constraint if exists compromisos_administracion_estado_check;
alter table public.compromisos_administracion add constraint compromisos_administracion_estado_check
  check(estado in ('pendiente','en_curso','en_espera','en_pausa','bloqueado','completado'));
create index if not exists gestiones_tipo_en_comunidad_idx
 on public.compromisos_administracion(comunidad_id,tipo_gestion_id);

-- Una observación no cambia el estado ni el porcentaje. Un avance puede registrar
-- próxima acción y evidencia. El resultado formal se gestiona al cerrar la ficha.
alter table public.compromisos_avances
 add column if not exists tipo_registro text not null default 'avance',
 add column if not exists proxima_accion text;
alter table public.compromisos_avances drop constraint if exists compromisos_avances_tipo_registro_check;
alter table public.compromisos_avances add constraint compromisos_avances_tipo_registro_check
 check(tipo_registro in ('avance','observacion','resultado'));
alter table public.compromisos_avances drop constraint if exists compromisos_avances_estado_check;
alter table public.compromisos_avances add constraint compromisos_avances_estado_check
 check(estado in ('pendiente','en_curso','en_espera','en_pausa','bloqueado','completado'));
alter table public.compromisos_avances alter column publicado set default true;
alter table public.compromisos_avances alter column registrado_por set default auth.uid();
-- Los avances administrativos anteriores quedan en el portal autenticado del mismo
-- cliente de la comunidad; las políticas originales siguen delimitando acceso.
update public.compromisos_avances set publicado=true where publicado=false;

-- Repositorio inicial versionado: 24 procesos de referencia Santa Clara.
insert into public.gestiones_tipos(codigo,nombre,categoria)
select x.codigo,x.titulo,'Administración de comunidades'
from (values
  ('SC-01', 'Recepción de antecedentes del proyecto', 1),
  ('SC-02', 'Informe de estado documental', 2),
  ('SC-03', 'Habilitación tributaria y bancaria', 3),
  ('SC-04', 'Recorrido e inventario de bienes comunes Etapa I', 4),
  ('SC-05', 'Cronograma de puesta en marcha', 5),
  ('SC-06', 'Preparación operativa de la comunidad', 6),
  ('SC-07', 'Registro de aportes de financiamiento inicial', 7),
  ('SC-08', 'Informe de puesta en marcha', 8),
  ('SC-09', 'Administración y conservación de bienes comunes', 9),
  ('SC-10', 'Atención presencial semanal', 10),
  ('SC-11', 'Reunión mensual de coordinación', 11),
  ('SC-12', 'Gestión de incidencias por nivel de respuesta', 12),
  ('SC-13', 'Escalamiento de incidencias de nivel Alto', 13),
  ('SC-14', 'Notificación de gastos de emergencia', 14),
  ('SC-15', 'Seguimiento de observaciones de postventa', 15),
  ('SC-16', 'Control y respaldo de pagos comunitarios', 16),
  ('SC-17', 'Gestión de cobranza extrajudicial', 17),
  ('SC-18', 'Rendición mensual documentada', 18),
  ('SC-19', 'Presupuesto estimativo anual', 19),
  ('SC-20', 'Convocatoria de primera asamblea', 20),
  ('SC-21', 'Balance anual para asamblea', 21),
  ('SC-22', 'Coordinación de incorporación de Etapa II', 22),
  ('SC-23', 'Acta de Condiciones Etapa II', 23),
  ('SC-24', 'Informe de gestión al término', 24)
) as x(codigo,titulo,orden)
where not exists(select 1 from public.gestiones_tipos t where lower(trim(t.nombre))=lower(trim(x.titulo)))
on conflict do nothing;

-- Conservar vinculación del modelo donde exista, sin reescribir avances/tareas.
update public.compromisos_administracion c
 set tipo_gestion_id=t.id
from public.gestiones_tipos t
where c.tipo_gestion_id is null and lower(trim(c.titulo))=lower(trim(t.nombre));

-- Capturar en la biblioteca las tareas ya diseñadas para el primer ejemplar
-- correspondiente a cada tipo. No se copian documentos ni información del cliente.
update public.gestiones_tipos t set
 tareas=coalesce((
  select jsonb_agg(jsonb_build_object('titulo',s.titulo) order by s.orden,s.creado_en)
  from public.compromisos_subtareas s
  where s.compromiso_id=(
    select c.id from public.compromisos_administracion c
    where c.tipo_gestion_id=t.id
      and exists(select 1 from public.compromisos_subtareas x where x.compromiso_id=c.id)
    order by c.creado_en limit 1
  )
 ),'[]'::jsonb)
where t.codigo like 'SC-%' and t.tareas='[]'::jsonb;

-- Creación transaccional: identidad, fechas y checklist propios de la comunidad.
create or replace function public.gestiones_crear_desde_tipo(
 p_comunidad_id uuid,p_tipo_id uuid,
 p_responsable text default null,p_fecha_inicio date default null,p_fecha_limite date default null
) returns public.compromisos_administracion
language plpgsql security definer set search_path='' as $$
declare modelo public.gestiones_tipos%rowtype;
        creado public.compromisos_administracion%rowtype;
        paso jsonb;
        n integer := 0;
begin
 if auth.uid() is null or not public.puede_gestionar_compromisos() then
   raise exception 'Sin permiso para crear gestiones';
 end if;
 select * into modelo from public.gestiones_tipos where id=p_tipo_id and activo for share;
 if not found then raise exception 'Modelo inexistente o inactivo'; end if;
 if not exists(select 1 from public.comunidades where id=p_comunidad_id) then
   raise exception 'Comunidad no encontrada';
 end if;
 insert into public.compromisos_administracion(
  comunidad_id,tipo_gestion_id,titulo,descripcion,responsable,
  fecha_inicio,fecha_limite,estado,avance,publicado,creado_por,documentos_esperados
 ) values (
  p_comunidad_id,modelo.id,modelo.nombre,modelo.descripcion,
  coalesce(nullif(trim(p_responsable),''),modelo.responsable_sugerido),
  coalesce(p_fecha_inicio,(now() at time zone 'America/Santiago')::date),
  coalesce(p_fecha_limite,
    case when modelo.plazo_dias is not null then
      (now() at time zone 'America/Santiago')::date+modelo.plazo_dias else null end),
  'pendiente',0,true,auth.uid(),modelo.documentos_esperados
 ) returning * into creado;
 for paso in select value from jsonb_array_elements(modelo.tareas)
 loop
  if length(trim(coalesce(paso->>'titulo','')))>0 then
    n:=n+1;
    insert into public.compromisos_subtareas(compromiso_id,titulo,orden)
    values(creado.id,left(trim(paso->>'titulo'),180),n);
  end if;
 end loop;
 return creado;
end; $$;
revoke all on function public.gestiones_crear_desde_tipo(uuid,uuid,text,date,date) from public,anon;
grant execute on function public.gestiones_crear_desde_tipo(uuid,uuid,text,date,date) to authenticated;

-- Estado deliberadamente independiente del porcentaje del checklist.
-- El resultado es obligatorio para cerrar una gestión nueva de forma manual.
create or replace function public.gestiones_cambiar_estado(
 p_gestion_id uuid,p_estado text,
 p_proxima_accion date default null,p_observacion text default null,p_resultado text default null
) returns public.compromisos_administracion
language plpgsql security definer set search_path='' as $$
declare anterior public.compromisos_administracion%rowtype;
        actualizado public.compromisos_administracion%rowtype;
        resultado_final text;
begin
 if auth.uid() is null or not public.puede_gestionar_compromisos() then
   raise exception 'Sin permiso para modificar gestiones';
 end if;
 if p_estado not in ('pendiente','en_curso','en_espera','en_pausa','bloqueado','completado') then
   raise exception 'Estado de gestión inválido';
 end if;
 select * into anterior from public.compromisos_administracion
  where id=p_gestion_id for update;
 if not found then raise exception 'Gestión inexistente'; end if;
 resultado_final=coalesce(nullif(trim(p_resultado),''),anterior.resultado);
 if p_estado='completado' and nullif(trim(coalesce(resultado_final,'')),'') is null then
   raise exception 'Registra el resultado antes de completar la gestión';
 end if;
 if p_estado='en_espera' and
    coalesce(p_proxima_accion,anterior.fecha_proxima_accion) is null then
   raise exception 'En espera: registra la fecha de próxima acción';
 end if;
 if p_estado is distinct from anterior.estado or
    p_proxima_accion is distinct from anterior.fecha_proxima_accion or
    nullif(trim(coalesce(p_observacion,'')),'') is not null or
    resultado_final is distinct from anterior.resultado then
   update public.compromisos_administracion set
     estado=p_estado,
     resultado=resultado_final,
     fecha_proxima_accion=coalesce(p_proxima_accion,fecha_proxima_accion),
     fecha_inicio=case when p_estado='en_curso' and fecha_inicio is null
       then (now() at time zone 'America/Santiago')::date else fecha_inicio end,
     fecha_cierre=case when p_estado='completado'
       then coalesce(fecha_cierre,(now() at time zone 'America/Santiago')::date)
       else null end,
     actualizado_en=now()
   where id=p_gestion_id returning * into actualizado;
   insert into public.compromisos_transiciones(
     compromiso_id,estado_anterior,estado_nuevo,observacion,fecha_proxima_accion,cambiado_por
   ) values (
     p_gestion_id,anterior.estado,p_estado,
     nullif(trim(left(coalesce(p_observacion,''),2000)),''),
     actualizado.fecha_proxima_accion,auth.uid()
   );
 else
   actualizado=anterior;
 end if;
 return actualizado;
end; $$;
revoke all on function public.gestiones_cambiar_estado(uuid,text,date,text,text) from public,anon;
grant execute on function public.gestiones_cambiar_estado(uuid,text,date,text,text) to authenticated;

-- El motor existente mantiene el porcentaje sin forzar estado completado.
-- Evita que un check cierre indebidamente una gestión pendiente de aprobación.
create or replace function public.compromisos_recalcular_desde_subtareas(p_compromiso_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_total integer;
        v_porcentaje smallint;
        v_actual public.compromisos_administracion%rowtype;
begin
 select * into v_actual from public.compromisos_administracion
 where id=p_compromiso_id for update;
 if not found then return; end if;
 select count(*),coalesce(round(avg(avance)),0)::smallint
 into v_total,v_porcentaje
 from public.compromisos_subtareas where compromiso_id=p_compromiso_id;
 -- Sin tareas, el porcentaje manual no debe perderse.
 if v_total=0 then return; end if;
 if v_actual.avance is distinct from v_porcentaje then
  update public.compromisos_administracion set
    avance=v_porcentaje, actualizado_en=now()
  where id=p_compromiso_id;
 end if;
end; $$;
revoke all on function public.compromisos_recalcular_desde_subtareas(uuid) from public,anon,authenticated;

comment on table public.gestiones_tipos is
 'Biblioteca de procesos reutilizables: modificar un modelo NO cambia las gestiones existentes.';
comment on column public.compromisos_administracion.resultado is
 'Resultado verificable de la gestión, independiente del porcentaje de tareas.';

commit;
