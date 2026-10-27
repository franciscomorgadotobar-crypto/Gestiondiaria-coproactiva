-- Fechas y cambios de etapa de compromisos (sin alterar registros históricos).
alter table public.compromisos_administracion
 add column if not exists fecha_inicio date,
 add column if not exists fecha_proxima_accion date,
 add column if not exists fecha_cierre date;

create table if not exists public.compromisos_transiciones (
 id uuid primary key default gen_random_uuid(),
 compromiso_id uuid not null references public.compromisos_administracion(id) on delete cascade,
 estado_anterior text not null,
 estado_nuevo text not null,
 observacion text,
 fecha_proxima_accion date,
 cambiado_por uuid references auth.users(id),
 cambiado_en timestamptz not null default now()
);
create index if not exists compromisos_transiciones_historial_idx
 on public.compromisos_transiciones(compromiso_id,cambiado_en desc);
alter table public.compromisos_transiciones enable row level security;

drop policy if exists compromisos_transiciones_lectura on public.compromisos_transiciones;
create policy compromisos_transiciones_lectura on public.compromisos_transiciones
 for select to authenticated using (
  public.puede_gestionar_compromisos() or exists (
   select 1 from public.compromisos_administracion c
   where c.id=compromiso_id and c.publicado
  )
 );
-- Solo la función de cambio de estado inserta una transición:
-- No hay INSERT directo desde el frontend ni escritura de historiales ajenos.
revoke all on table public.compromisos_transiciones from public,anon,authenticated;
grant select on public.compromisos_transiciones to authenticated;

create or replace function public.compromisos_cambiar_etapa(
 p_compromiso_id uuid, p_estado text,
 p_proxima_accion date default null, p_observacion text default null
) returns public.compromisos_administracion
language plpgsql
security definer set search_path = ''
as $$
declare anterior public.compromisos_administracion%rowtype;
        actualizado public.compromisos_administracion%rowtype;
begin
 if auth.uid() is null or not public.puede_gestionar_compromisos() then
   raise exception 'No autorizado para gestionar compromisos';
 end if;
 if p_estado not in ('pendiente','en_curso','en_espera','completado') then
   raise exception 'Etapa inválida';
 end if;
 select * into anterior from public.compromisos_administracion
 where id=p_compromiso_id for update;
 if not found then raise exception 'Compromiso no encontrado'; end if;
 if p_estado='en_espera' and p_proxima_accion is null and anterior.fecha_proxima_accion is null then
   raise exception 'En espera: registra fecha próxima acción';
 end if;
 if p_estado <> anterior.estado
    or p_proxima_accion is distinct from anterior.fecha_proxima_accion then
   update public.compromisos_administracion
   set estado=p_estado, fecha_proxima_accion=coalesce(p_proxima_accion,fecha_proxima_accion),
       fecha_inicio=case when p_estado='en_curso' and fecha_inicio is null
         then current_date else fecha_inicio end,
       fecha_cierre=case when p_estado='completado' then coalesce(fecha_cierre,current_date)
         else null end,
       actualizado_en=now()
   where id=p_compromiso_id returning * into actualizado;
   insert into public.compromisos_transiciones(
    compromiso_id,estado_anterior,estado_nuevo,observacion,fecha_proxima_accion,cambiado_por
   ) values(
    p_compromiso_id,anterior.estado,p_estado,
    nullif(trim(left(coalesce(p_observacion,''),2000)),''),
    actualizado.fecha_proxima_accion,auth.uid()
   );
 else
   actualizado=anterior;
 end if;
 return actualizado;
end;
$$;
revoke all on function public.compromisos_cambiar_etapa(uuid,text,date,text) from public,anon;
grant execute on function public.compromisos_cambiar_etapa(uuid,text,date,text) to authenticated;

-- Plantillas de correos comerciales reutilizables, separadas de
-- las plantillas de levantamientos.
create table if not exists public.plantillas_correo_crm (
 id uuid primary key default gen_random_uuid(),
 nombre text not null check (length(trim(nombre)) between 1 and 120),
 asunto text not null default '',
 cuerpo text not null default '',
 activa boolean not null default true,
 creada_por uuid references auth.users(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now()
);
alter table public.plantillas_correo_crm enable row level security;
drop policy if exists plantillas_correo_crm_lectura on public.plantillas_correo_crm;
create policy plantillas_correo_crm_lectura on public.plantillas_correo_crm
 for select to authenticated using (public.puede_gestionar_compromisos());
drop policy if exists plantillas_correo_crm_escritura on public.plantillas_correo_crm;
create policy plantillas_correo_crm_escritura on public.plantillas_correo_crm
 for all to authenticated using (public.puede_gestionar_compromisos())
 with check (public.puede_gestionar_compromisos());
revoke all on table public.plantillas_correo_crm from public,anon;
grant select,insert,update,delete on public.plantillas_correo_crm to authenticated;

insert into public.plantillas_correo_crm(nombre,asunto,cuerpo)
select seed.nombre,seed.asunto,seed.cuerpo from (values
 ('Presentación Coproactiva','Presentación de administración · {{comunidad}}',
  'Hola {{nombre}},\n\nGracias por contactar a Coproactiva respecto de {{comunidad}}. Podemos revisar las necesidades de la comunidad y las alternativas de administración.\n\nSaludos,\n{{responsable}}'),
 ('Coordinación de reunión','Reunión para {{comunidad}}',
  'Hola {{nombre}},\n\nMe gustaría coordinar una reunión para conocer las necesidades de {{comunidad}}. ¿Qué disponibilidad tienes esta semana?\n\nSaludos,\n{{responsable}}'),
 ('Seguimiento de propuesta','Seguimiento propuesta · {{comunidad}}',
  'Hola {{nombre}},\n\nQuisiera consultar si tuvieron oportunidad de revisar la propuesta para {{comunidad}} y si necesitan alguna aclaración.\n\nSaludos,\n{{responsable}}')
) as seed(nombre,asunto,cuerpo)
where not exists(select 1 from public.plantillas_correo_crm where nombre=seed.nombre);
