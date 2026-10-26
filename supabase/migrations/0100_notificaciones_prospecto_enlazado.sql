-- Enlazar cada aviso de formulario web con el prospecto que lo originó.
-- Las notificaciones históricas se recuperan mediante timestamps exactos,
-- propios de la misma transacción. Nunca se deduce por nombres ambiguos.
alter table public.notificaciones
  add column if not exists prospecto_id uuid
  references public.prospectos(id) on delete set null;
create index if not exists notificaciones_prospecto_id_idx
  on public.notificaciones(prospecto_id)
  where prospecto_id is not null;

with unicas as (
  select n.creado_en, min(w.prospecto_id::text)::uuid as prospecto_id
  from public.notificaciones n
  join public.web_form_ingresos w on w.recibido_en = n.creado_en
  where n.tipo = 'lead_web' and n.prospecto_id is null and w.prospecto_id is not null
  group by n.creado_en
  having count(distinct w.prospecto_id) = 1
)
update public.notificaciones n
set prospecto_id = u.prospecto_id
from unicas u
where n.tipo = 'lead_web' and n.prospecto_id is null and n.creado_en = u.creado_en;

-- Se conserva toda la validación y control de tasa existentes del formulario.
create or replace function public.registrar_formulario_web(
 p_nombre text,p_condominio text,p_email text,p_telefono text,p_servicio text,p_mensaje text,
 p_formulario text,p_utm_source text,p_utm_medium text,p_utm_campaign text,
 p_fingerprint text,p_contacto_hash text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_prospecto uuid; v_tipo public.tipo_servicio; v_fuente text; v_duplicado uuid;
begin
 if trim(coalesce(p_nombre,''))='' or trim(coalesce(p_condominio,''))='' or trim(coalesce(p_email,''))='' then
  raise exception 'Campos obligatorios faltantes';
 end if;
 select prospecto_id into v_duplicado from public.web_form_ingresos where fingerprint=p_fingerprint;
 if found then return jsonb_build_object('ok',true,'duplicado',true,'prospecto_id',v_duplicado); end if;
 if (select count(*) from public.web_form_ingresos where contacto_hash=p_contacto_hash and recibido_en>now()-interval '1 hour')>=4 then
  raise exception 'Demasiadas solicitudes; inténtalo más tarde';
 end if;
 v_tipo:=case when lower(coalesce(p_servicio,'')) like '%primera%' then 'primera_administracion'::public.tipo_servicio
 when lower(coalesce(p_servicio,'')) like '%auditor%' then 'auditoria'::public.tipo_servicio
 when lower(coalesce(p_servicio,'')) like '%asesor%' then 'asesoria'::public.tipo_servicio
 when lower(coalesce(p_servicio,'')) like '%admin%' then 'administracion'::public.tipo_servicio else 'otro'::public.tipo_servicio end;
 v_fuente:='web_coproactiva_cl' || case when nullif(p_utm_source,'') is not null then ':'||left(p_utm_source,75) else '' end;
 insert into public.web_form_ingresos(fingerprint,contacto_hash,formulario,servicio_original,utm_source,utm_medium,utm_campaign)
 values(p_fingerprint,p_contacto_hash,left(coalesce(p_formulario,'contact_form'),80),left(coalesce(p_servicio,''),150),
 left(coalesce(p_utm_source,''),150),left(coalesce(p_utm_medium,''),150),left(coalesce(p_utm_campaign,''),150))
 returning id into v_id;
 insert into public.prospectos(nombre_condominio,nombre_contacto,telefono,email,tipo_servicio,fuente,
 etapa,fecha_primer_contacto,fecha_ultima_interaccion,proxima_accion,observaciones)
 values(left(trim(p_condominio),180),left(trim(p_nombre),180),left(trim(p_telefono),40),left(lower(trim(p_email)),254),
 v_tipo,v_fuente,'nuevo',now(),now(),'Primer contacto · responder en 24 horas',
 left(concat_ws(E'\n',nullif(trim(p_mensaje),''),'Formulario: '||left(coalesce(p_formulario,'contact_form'),80),'Servicio solicitado: '||left(coalesce(p_servicio,''),150)),4000))
 returning id into v_prospecto;
 update public.web_form_ingresos set prospecto_id=v_prospecto where id=v_id;
 insert into public.notificaciones(destinatario_id,tipo,titulo,mensaje,prospecto_id)
 select id,'lead_web','Nuevo contacto desde la web',
 left('Comunidad: '||trim(p_condominio)||' · Contacto: '||trim(p_nombre)||' · Revisar Pipeline comercial',400),v_prospecto
 from public.perfiles where activo=true and rol in ('admin','superadmin','jefatura');
 return jsonb_build_object('ok',true,'duplicado',false,'prospecto_id',v_prospecto);
exception when unique_violation then
 select prospecto_id into v_duplicado from public.web_form_ingresos where fingerprint=p_fingerprint;
 return jsonb_build_object('ok',true,'duplicado',true,'prospecto_id',v_duplicado);
end $$;

-- Permisos originales de ejecución: solo el servidor de los formularios.
revoke all on function public.registrar_formulario_web(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.registrar_formulario_web(text,text,text,text,text,text,text,text,text,text,text,text) to service_role;
