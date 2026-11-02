-- Progreso calculado por subtareas, cierre con check, adjuntos por subtarea.
-- Migración aditiva. No hace backfill de compromisos históricos.
-- Avance individual ajustable. 100% únicamente con el check de cierre.
alter table public.compromisos_subtareas
 add column if not exists avance smallint not null default 0;
-- La relación previa completada=true representa ya 100%.
update public.compromisos_subtareas set avance=100
 where completada and avance<>100;
alter table public.compromisos_subtareas
 drop constraint if exists compromisos_subtareas_avance_check;
alter table public.compromisos_subtareas
 add constraint compromisos_subtareas_avance_check check(
  (completada and avance=100) or (not completada and avance between 0 and 99)
 );

create table if not exists public.compromisos_subtareas_adjuntos (
  id uuid primary key default gen_random_uuid(),
  subtarea_id uuid not null references public.compromisos_subtareas(id) on delete cascade,
  ruta text not null unique,
  nombre text not null check (length(trim(nombre)) between 1 and 255),
  tipo text,
  tamano bigint not null check (tamano between 0 and 15728640),
  creado_en timestamptz not null default now()
);
create index if not exists compromisos_subtareas_adjuntos_subtarea_idx
 on public.compromisos_subtareas_adjuntos(subtarea_id,creado_en);
alter table public.compromisos_subtareas_adjuntos enable row level security;
drop policy if exists compromisos_subtareas_adjuntos_leer on public.compromisos_subtareas_adjuntos;
create policy compromisos_subtareas_adjuntos_leer on public.compromisos_subtareas_adjuntos
 for select to authenticated using (
   exists (select 1 from public.compromisos_subtareas s
     join public.compromisos_administracion c on c.id=s.compromiso_id
     where s.id=compromisos_subtareas_adjuntos.subtarea_id
       and (public.puede_gestionar_compromisos() or c.publicado))
 );
drop policy if exists compromisos_subtareas_adjuntos_insertar on public.compromisos_subtareas_adjuntos;
create policy compromisos_subtareas_adjuntos_insertar on public.compromisos_subtareas_adjuntos
 for insert to authenticated with check (
   public.puede_gestionar_compromisos() and exists (
     select 1 from public.compromisos_subtareas s where s.id=subtarea_id
   )
 );
drop policy if exists compromisos_subtareas_adjuntos_eliminar on public.compromisos_subtareas_adjuntos;
create policy compromisos_subtareas_adjuntos_eliminar on public.compromisos_subtareas_adjuntos
 for delete to authenticated using (public.puede_gestionar_compromisos());
revoke all on public.compromisos_subtareas_adjuntos from public,anon,authenticated;
grant select,insert,delete on public.compromisos_subtareas_adjuntos to authenticated;

-- Bucket ya existente compromisos-adjuntos (privado, máximo 15 MB).
-- La ruta por subtarea debe coincidir con sus metadatos; sin URL pública.
drop policy if exists archivo_subtareas_compromisos_select on storage.objects;
create policy archivo_subtareas_compromisos_select on storage.objects
 for select to authenticated using (
   bucket_id='compromisos-adjuntos' and exists (
     select 1 from public.compromisos_subtareas_adjuntos adj
     where adj.ruta=storage.objects.name
   )
 );

-- Función interna invocada únicamente por el trigger. Trabaja con el
-- registro de origen y actualiza el compromiso en la misma transacción.
create or replace function public.compromisos_recalcular_desde_subtareas(p_compromiso_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_total integer;
 v_cerradas integer;
 v_porcentaje smallint;
 v_actual public.compromisos_administracion%rowtype;
 v_estado text;
begin
 select * into v_actual from public.compromisos_administracion
 where id=p_compromiso_id for update;
 if not found then return; end if;

 select count(*),count(*) filter (where completada),coalesce(round(avg(avance)),0)::smallint
 into v_total,v_cerradas,v_porcentaje
 from public.compromisos_subtareas where compromiso_id=p_compromiso_id;

 -- v_porcentaje ya es el promedio exacto de los avances de subtareas.
 -- Check cerrado = 100; actividad en ejecución = 0..99.

 v_estado=v_actual.estado;
 if v_total>0 and v_cerradas=v_total then v_estado='completado';
 elsif v_actual.estado='completado' then v_estado='en_curso';
 elsif v_porcentaje>0 and v_actual.estado='pendiente' then v_estado='en_curso';
 end if;

 if v_actual.avance is distinct from v_porcentaje or
    v_actual.estado is distinct from v_estado then
   update public.compromisos_administracion set
     avance=v_porcentaje,
     estado=v_estado,
     fecha_inicio=case when v_estado='en_curso' and fecha_inicio is null
       then (now() at time zone 'America/Santiago')::date else fecha_inicio end,
     fecha_cierre=case when v_estado='completado'
       then coalesce(fecha_cierre,(now() at time zone 'America/Santiago')::date)
       else null end,
     actualizado_en=now()
   where id=p_compromiso_id;

   if v_actual.estado is distinct from v_estado then
     insert into public.compromisos_transiciones (
       compromiso_id,estado_anterior,estado_nuevo,observacion,
       fecha_proxima_accion,cambiado_por
     ) values (
       p_compromiso_id,v_actual.estado,v_estado,
       'Actualización automática por casillas de subtareas',
       v_actual.fecha_proxima_accion,auth.uid()
     );
   end if;
 end if;
end;$$;
-- No exponer la función auxiliar como RPC.
revoke all on function public.compromisos_recalcular_desde_subtareas(uuid) from public,anon,authenticated;

create or replace function public.compromisos_subtareas_progreso_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
   perform public.compromisos_recalcular_desde_subtareas(old.compromiso_id);
   return old;
 end if;
 perform public.compromisos_recalcular_desde_subtareas(new.compromiso_id);
 if tg_op='UPDATE' and new.compromiso_id is distinct from old.compromiso_id then
   perform public.compromisos_recalcular_desde_subtareas(old.compromiso_id);
 end if;
 return new;
end;$$;
revoke all on function public.compromisos_subtareas_progreso_trigger() from public,anon,authenticated;
drop trigger if exists compromisos_subtareas_progreso on public.compromisos_subtareas;
create trigger compromisos_subtareas_progreso
 after insert or update of avance,completada,compromiso_id or delete
 on public.compromisos_subtareas
 for each row execute function public.compromisos_subtareas_progreso_trigger();
