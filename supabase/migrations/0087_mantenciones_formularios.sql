-- Activities reuse existing form templates; each visit keeps its own snapshot.
alter table public.mantenimiento_actividades add column plantilla_id uuid references public.plantillas_control(id) on delete set null;
create index mantenimiento_actividad_plantilla on public.mantenimiento_actividades(plantilla_id) where plantilla_id is not null;
alter table public.controles add column mantenimiento_actividad_id uuid references public.mantenimiento_actividades(id) on delete set null;
alter table public.controles add column mantenimiento_agendamiento_id uuid references public.mantenimiento_agendamientos(id) on delete set null;
alter table public.controles add column mantenimiento_fecha_exigible date;
create index controles_mantenimiento_actividad on public.controles(mantenimiento_actividad_id) where mantenimiento_actividad_id is not null;
create unique index controles_mantenimiento_visita on public.controles(mantenimiento_agendamiento_id) where mantenimiento_agendamiento_id is not null and estado<>'anulado';
create unique index controles_mantenimiento_periodo on public.controles(mantenimiento_actividad_id,coalesce(mantenimiento_fecha_exigible,'-infinity'::date))
 where mantenimiento_actividad_id is not null and mantenimiento_agendamiento_id is null and estado<>'anulado';

create or replace function public.validar_plantilla_mantenimiento() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.plantilla_id is not null then
   if not exists(select 1 from public.plantillas_control p where p.id=new.plantilla_id and p.activa and coalesce(p.codigo,'')<>'diagnostico_comercial' and (p.comunidad_id is null or p.comunidad_id=new.comunidad_id)) then
     raise exception 'Elige un formulario activo disponible para esta comunidad.';
   end if;
   if not exists(select 1 from public.plantilla_items where plantilla_id=new.plantilla_id and activo) then
     raise exception 'El formulario elegido todavía no tiene preguntas activas.';
   end if;
 end if;
 return new;
end;$$;
create trigger mantenimiento_validar_plantilla before insert or update of plantilla_id,comunidad_id on public.mantenimiento_actividades for each row execute function public.validar_plantilla_mantenimiento();

create or replace function public.validar_control_mantenimiento() returns trigger language plpgsql security invoker set search_path=public as $$
declare a public.mantenimiento_actividades;begin
 if new.mantenimiento_actividad_id is null then
   if new.mantenimiento_agendamiento_id is not null then
     if tg_op='UPDATE' and old.mantenimiento_actividad_id is not null and not exists(select 1 from public.mantenimiento_actividades where id=old.mantenimiento_actividad_id) then return new;end if;
     raise exception 'La visita requiere una actividad de mantención.';
   end if;
   return new;
 end if;
 select * into a from public.mantenimiento_actividades where id=new.mantenimiento_actividad_id;
 if a.id is null or new.comunidad_id is distinct from a.comunidad_id or new.prospecto_id is not null or new.es_diagnostico then
   raise exception 'El formulario debe corresponder a la comunidad de la mantención.';
 end if;
 if new.mantenimiento_agendamiento_id is not null and not exists(select 1 from public.mantenimiento_agendamientos where id=new.mantenimiento_agendamiento_id and actividad_id=a.id and comunidad_id=a.comunidad_id) then
   raise exception 'La visita no corresponde a esta actividad.';
 end if;
 if tg_op='INSERT' and new.plantilla_id is distinct from a.plantilla_id then raise exception 'El formulario no corresponde al definido en el plan.';end if;
 return new;
end;$$;
create trigger controles_validar_mantenimiento before insert or update of mantenimiento_actividad_id,mantenimiento_agendamiento_id,comunidad_id,prospecto_id,es_diagnostico on public.controles for each row execute function public.validar_control_mantenimiento();

create or replace function public.mantenimiento_abrir_formulario(p_actividad_id uuid,p_agendamiento_id uuid default null) returns uuid
language plpgsql security invoker set search_path=public as $$
declare a public.mantenimiento_actividades;ag public.mantenimiento_agendamientos;p public.plantillas_control;v_control uuid;v_responsable uuid;
begin
 if not public.usuario_puede_gestionar_operacion() then raise exception 'No tienes permiso para abrir formularios de mantención.';end if;
 select * into a from public.mantenimiento_actividades where id=p_actividad_id for share;
 if a.id is null or not public.usuario_puede_ver_comunidad(a.comunidad_id) then raise exception 'No tienes acceso a esta actividad.';end if;
 if not a.activa or exists(select 1 from public.comunidades where id=a.comunidad_id and estado::text='terminado') then raise exception 'Esta mantención ya no está activa.';end if;
 if p_agendamiento_id is not null then
   select * into ag from public.mantenimiento_agendamientos where id=p_agendamiento_id and actividad_id=a.id and comunidad_id=a.comunidad_id for share;
   if ag.id is null then raise exception 'La visita no corresponde a esta actividad.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('mantencion-formulario:'||a.id::text||':'||coalesce(ag.id::text,a.proxima_exigible::text,'sin-fecha'),0));
 select id into v_control from public.controles where mantenimiento_actividad_id=a.id and estado<>'anulado'
   and ((ag.id is not null and mantenimiento_agendamiento_id=ag.id) or (ag.id is null and mantenimiento_agendamiento_id is null and mantenimiento_fecha_exigible is not distinct from a.proxima_exigible))
   order by creado_en limit 1;
 if v_control is not null then return v_control;end if;
 if ag.id is not null and ag.estado not in ('agendada','en_curso') then raise exception 'La visita ya está cerrada o cancelada.';end if;
 if a.plantilla_id is null then raise exception 'Selecciona un formulario en el plan de mantención.';end if;
 select * into p from public.plantillas_control where id=a.plantilla_id and activa;
 if p.id is null or coalesce(p.codigo,'')='diagnostico_comercial' or (p.comunidad_id is not null and p.comunidad_id<>a.comunidad_id) then raise exception 'El formulario ya no está disponible. Elige otro en el plan.';end if;
 if not exists(select 1 from public.plantilla_items where plantilla_id=p.id and activo) then raise exception 'El formulario elegido todavía no tiene preguntas activas.';end if;
 v_responsable:=coalesce(ag.responsable_id,a.responsable_id,auth.uid());
 if not exists(select 1 from public.perfiles where id=v_responsable and activo and rol::text<>'cliente') then v_responsable:=auth.uid();end if;
 insert into public.controles(comunidad_id,plantilla_id,responsable_id,periodo,programado_para,secuencial,es_diagnostico,observaciones,mantenimiento_actividad_id,mantenimiento_agendamiento_id,mantenimiento_fecha_exigible)
 values(a.comunidad_id,p.id,v_responsable,coalesce(a.proxima_exigible::text,'Mantención'),ag.programado_para,p.secuencial,false,'Mantención: '||a.trabajo,a.id,ag.id,coalesce(ag.vencimiento_original,a.proxima_exigible)) returning id into v_control;
 insert into public.control_items(control_id,plantilla_item_id,grupo,texto,ayuda,orden,tipo_ingreso,config,requiere_foto,es_critico,obligatorio)
 select v_control,i.id,i.grupo,i.texto,i.ayuda,(row_number() over(order by i.orden_grupo,i.orden,i.id)-1)::integer,i.tipo_ingreso,i.config,i.requiere_foto,i.es_critico,i.obligatorio
 from public.plantilla_items i where i.plantilla_id=p.id and i.activo;
 return v_control;
end;$$;
revoke all on function public.validar_plantilla_mantenimiento(),public.validar_control_mantenimiento(),public.mantenimiento_abrir_formulario(uuid,uuid) from public,anon;
grant execute on function public.mantenimiento_abrir_formulario(uuid,uuid) to authenticated;
comment on column public.mantenimiento_actividades.plantilla_id is 'Formulario de Plantillas asociado a esta actividad. Los controles creados conservan sus preguntas como copia independiente.';
