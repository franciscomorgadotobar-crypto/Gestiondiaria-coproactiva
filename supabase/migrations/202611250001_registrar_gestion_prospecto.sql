create or replace function public.registrar_gestion_prospecto(
 p_prospecto_id uuid,p_editado_en timestamptz,p_tipo text,p_resultado text,
 p_proxima_accion text,p_fecha_proxima_accion timestamptz
) returns public.prospectos
language plpgsql security invoker set search_path=public
as $$
declare anterior public.prospectos; actualizado public.prospectos;
begin
 if auth.uid() is null or not (coalesce(public.es_admin(),false) or coalesce(public.mi_rol()::text='jefatura',false)) then
  raise exception 'Acceso comercial requerido' using errcode='42501';
 end if;
 if p_tipo is null or p_tipo not in ('completar','reagendar','registrar') then raise exception 'Tipo de gestión inválido'; end if;
 if nullif(btrim(p_resultado),'') is null then raise exception 'Registra el resultado o motivo de la gestión'; end if;
 if (nullif(btrim(p_proxima_accion),'') is null) <> (p_fecha_proxima_accion is null) then
  raise exception 'La siguiente acción requiere descripción y fecha';
 end if;
 if p_tipo='reagendar' and p_fecha_proxima_accion is null then raise exception 'Indica la nueva fecha'; end if;
 select * into anterior from public.prospectos where id=p_prospecto_id for update;
 if not found then raise exception 'Prospecto no encontrado'; end if;
 if anterior.editado_en is distinct from p_editado_en then raise exception 'La ficha cambió. Actualiza y reintenta'; end if;
 if p_tipo in ('completar','reagendar') and nullif(btrim(anterior.proxima_accion),'') is null and anterior.fecha_proxima_accion is null then
  raise exception 'No hay acción pendiente';
 end if;
 if p_tipo='reagendar' and anterior.proxima_accion is distinct from nullif(btrim(p_proxima_accion),'') then
  raise exception 'Para reagendar conserva la acción pendiente';
 end if;
 if anterior.etapa::text in ('ganado','perdido') and p_fecha_proxima_accion is not null then
  raise exception 'Reabre el prospecto antes de programar una acción';
 end if;
 update public.prospectos set proxima_accion=nullif(btrim(p_proxima_accion),''),
 fecha_proxima_accion=p_fecha_proxima_accion,fecha_ultima_interaccion=now()
 where id=p_prospecto_id returning * into actualizado;
 insert into public.prospecto_historial(prospecto_id,etapa_anterior,etapa_nueva,accion,responsable_id,notas)
 values(p_prospecto_id,anterior.etapa,actualizado.etapa,
 case p_tipo when 'completar' then 'Acción completada' when 'reagendar' then 'Acción reagendada' else 'Gestión registrada' end,
 auth.uid(), concat_ws(E'\n',case when anterior.proxima_accion is not null then 'Acción anterior: '||anterior.proxima_accion end,
 case when anterior.fecha_proxima_accion is not null then 'Fecha anterior (Chile): '||to_char(anterior.fecha_proxima_accion at time zone 'America/Santiago','DD/MM/YYYY HH24:MI') end,
 'Resultado: '||btrim(p_resultado),case when actualizado.proxima_accion is not null then 'Próxima acción: '||actualizado.proxima_accion end,
 case when actualizado.fecha_proxima_accion is not null then 'Fecha próxima (Chile): '||to_char(actualizado.fecha_proxima_accion at time zone 'America/Santiago','DD/MM/YYYY HH24:MI') end));
 return actualizado;
end;
$$;
revoke all on function public.registrar_gestion_prospecto(uuid,timestamptz,text,text,text,timestamptz) from public,anon;
grant execute on function public.registrar_gestion_prospecto(uuid,timestamptz,text,text,text,timestamptz) to authenticated;
