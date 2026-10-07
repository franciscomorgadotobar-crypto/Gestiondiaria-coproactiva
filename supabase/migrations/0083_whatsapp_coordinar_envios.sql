-- Serialize conversation mutations before message locks; taking control waits for in-flight sends.
create or replace function public.whatsapp_process_commit(p_token uuid,p_message uuid,p_revision bigint,p_plan jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare m public.whatsapp_messages; c public.whatsapp_conversations; d jsonb:=p_plan->'data'; ctx jsonb; cfg public.whatsapp_config; r jsonb; v_correlativo text; v_prospect uuid; v_tel text;
begin
 select * into cfg from public.whatsapp_config where id;
 if cfg.worker_token is distinct from p_token or cfg.worker_hasta<now() then return false;end if;
 select * into m from public.whatsapp_messages where id=p_message and direccion='entrante';
 if m.id is null or m.procesado_en is not null then return false;end if;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
 select * into m from public.whatsapp_messages where id=p_message for update;
 if m.procesado_en is not null then return false;end if;
 if c.estado in ('derivada','atencion_humana','cerrada') then
   update public.whatsapp_messages set procesado_en=now() where id=m.id;return true;
 end if;
 if c.revision<>p_revision then return false;end if;
 ctx:=d->'context';
 select wa_id into v_tel from public.whatsapp_contacts where id=c.contacto_id;
 -- Revalidate context against authoritative phone/unit relations at commit.
 if ctx is not null and ctx<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(public.whatsapp_contextos(v_tel)) x where x->>'unidad_id'=ctx->>'unidad_id') then
   ctx:=null; d:=d-'context';
   p_plan:=p_plan||jsonb_build_object('state','derivada','step','humano','action','revision');
 end if;
 update public.whatsapp_conversations set motivo=p_plan->>'motive',estado=p_plan->>'state',paso_actual=p_plan->>'step',datos=d,revision=revision+1,
   comunidad_id=case when ctx is not null then (ctx->>'comunidad_id')::uuid else comunidad_id end,
   unidad_id=case when ctx is not null then (ctx->>'unidad_id')::uuid else unidad_id end,
   residente_id=case when ctx is not null then (ctx->>'residente_id')::uuid else residente_id end,
   copropietario_id=case when ctx is not null then (ctx->>'copropietario_id')::uuid else copropietario_id end,
   validacion=case when ctx is not null then 'telefono' else validacion end,
   cerrada_en=case when p_plan->>'state'='cerrada' then now() else null end where id=c.id;
 if p_plan->>'action'='bitacora' then
   v_correlativo:=public.whatsapp_registrar_bitacora(c.id,cfg.responsable_recepcion);
   p_plan:=jsonb_set(p_plan,'{replies}',jsonb_build_array(jsonb_build_object('text','Solicitud registrada: '||v_correlativo||'. Administración la revisará.')));
 elsif p_plan->>'action'='prospecto' then
   perform pg_advisory_xact_lock(hashtextextended('wa-prospecto:'||v_tel||':'||lower(btrim(d->>'comunidad')),0));
   select id into v_prospect from public.prospectos where public.whatsapp_telefono(telefono)=v_tel and lower(btrim(nombre_condominio))=lower(btrim(d->>'comunidad')) order by creado_en limit 1 for update;
   if v_prospect is null then
     insert into public.prospectos(nombre_condominio,comuna,unidades,nombre_contacto,telefono,email,tipo_servicio,fuente,observaciones)
     values(d->>'comunidad',d->>'comuna',(d->>'unidades')::integer,d->>'nombre','+'||v_tel,d->>'email',(d->>'servicio')::public.tipo_servicio,'WhatsApp',concat_ws(E'\n','Solicitud WhatsApp · '||c.id::text,d->>'comentario')) returning id into v_prospect;
   else
     update public.prospectos set observaciones=concat_ws(E'\n',observaciones,'Solicitud WhatsApp · '||c.id::text||' · '||(d->>'servicio_nombre'),d->>'comentario'),fecha_ultima_interaccion=now(),editado_en=now() where id=v_prospect;
   end if;
   update public.whatsapp_conversations set prospecto_id=v_prospect where id=c.id;
   insert into public.whatsapp_events(conversation_id,evento,detalle) values(c.id,'prospecto_vinculado',jsonb_build_object('prospecto_id',v_prospect));
   p_plan:=jsonb_set(p_plan,'{replies}',jsonb_build_array(jsonb_build_object('text','Recibimos tu solicitud de cotización. Te contactaremos.')));
 elsif p_plan->>'action'='revision' then
   p_plan:=jsonb_set(p_plan,'{replies}',jsonb_build_array(jsonb_build_object('text','Recibimos tu solicitud. Administración revisará tus datos y la gestionará.')));
 end if;
 if p_plan->>'state' in ('derivada','cerrada') then
   update public.whatsapp_messages set estado='cancelado' where conversation_id=c.id and es_bot and estado='pendiente';
 end if;
 for r in select value from jsonb_array_elements(coalesce(p_plan->'replies','[]')) loop
   insert into public.whatsapp_messages(conversation_id,direccion,tipo,contenido,respuesta,estado,es_bot)
   values(c.id,'saliente',case when r ? 'choices' then 'interaccion' else 'texto' end,r->>'text',r,'pendiente',true);
 end loop;
 update public.whatsapp_messages set procesado_en=now() where id=m.id;
 if p_plan->>'state' in ('derivada','cerrada') then
   insert into public.whatsapp_events(conversation_id,evento,detalle) values(c.id,p_plan->>'state',jsonb_build_object('bot',true,'paso',p_plan->>'step'));
 end if;
 return true;
end; $$;

create or replace function public.whatsapp_process_error(p_token uuid,p_message uuid,p_revision bigint) returns void language plpgsql security definer set search_path=public as $$
declare m public.whatsapp_messages;c public.whatsapp_conversations;begin
 if not exists(select 1 from public.whatsapp_config where id and worker_token=p_token and worker_hasta>now()) then return;end if;
 select * into m from public.whatsapp_messages where id=p_message;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
 select * into m from public.whatsapp_messages where id=p_message for update;
 if m.procesado_en is not null or c.revision<>p_revision then return;end if;
 if c.estado in ('bot','esperando_usuario') then
   update public.whatsapp_conversations set estado='derivada',paso_actual='error_registro',revision=revision+1 where id=c.id;
   update public.whatsapp_messages set estado='cancelado' where conversation_id=c.id and es_bot and estado='pendiente';
   insert into public.whatsapp_messages(conversation_id,direccion,tipo,contenido,respuesta,estado,es_bot)
   values(c.id,'saliente','texto','Tu mensaje quedó pendiente de revisión por administración.',jsonb_build_object('text','Tu mensaje quedó pendiente de revisión por administración.'),'pendiente',true);
   insert into public.whatsapp_events(conversation_id,evento) values(c.id,'error_registro');
 end if;
 update public.whatsapp_messages set procesado_en=now() where id=m.id;
end; $$;

create or replace function public.whatsapp_accion(p_conv uuid,p_accion text,p_valor text default null) returns void language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations;v_actor uuid:=auth.uid();v_target uuid;v_correlativo text; begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 select * into c from public.whatsapp_conversations where id=p_conv for update;
 if c.id is null then raise exception 'Conversación inexistente';end if;
 if p_accion in ('tomar','reasignar','cerrar') and exists(select 1 from public.whatsapp_messages where conversation_id=c.id and estado='enviando' and lease_hasta>now()) then raise exception 'Hay un envío en curso. Intenta nuevamente en unos segundos.';end if;
 if p_accion='tomar' then
   if c.estado='cerrada' then raise exception 'Conversación cerrada';end if;
   if c.asignado_a is not null and c.asignado_a<>v_actor then raise exception 'Ya tiene responsable; usa Reasignar';end if;
   update public.whatsapp_conversations set estado='atencion_humana',asignado_a=v_actor,revision=revision+1 where id=c.id;
 elsif p_accion='reasignar' then
   if c.estado='cerrada' then raise exception 'Conversación cerrada';end if;
   v_target:=p_valor::uuid;
   if not exists(select 1 from public.perfiles where id=v_target and activo and rol::text in ('admin','superadmin')) then raise exception 'Responsable no válido';end if;
   update public.whatsapp_conversations set estado='atencion_humana',asignado_a=v_target,revision=revision+1 where id=c.id;
 elsif p_accion='cerrar' then
   update public.whatsapp_conversations set estado='cerrada',cerrada_en=now(),revision=revision+1 where id=c.id;
 elsif p_accion='responder' then
   if c.estado<>'atencion_humana' or c.asignado_a<>v_actor then raise exception 'Toma la conversación antes de responder';end if;
   if nullif(btrim(p_valor),'') is null or length(p_valor)>3500 then raise exception 'Mensaje no válido';end if;
   if not exists(select 1 from public.whatsapp_messages where conversation_id=c.id and direccion='entrante' and creado_en>now()-interval '24 hours') then raise exception 'Fuera de la ventana de 24 horas';end if;
   insert into public.whatsapp_messages(conversation_id,direccion,tipo,contenido,respuesta,estado,autor_id)
   values(c.id,'saliente','texto',p_valor,jsonb_build_object('text',p_valor),'pendiente',v_actor);
 elsif p_accion='crear_bitacora' then
   if c.estado<>'atencion_humana' or c.asignado_a<>v_actor then raise exception 'Toma la conversación antes de registrar';end if;
   v_correlativo:=public.whatsapp_registrar_bitacora(c.id,v_actor);
 else raise exception 'Acción no válida';end if;
 if p_accion in ('tomar','reasignar','cerrar') then
   update public.whatsapp_messages set estado='cancelado' where conversation_id=c.id and estado='pendiente' and (es_bot or p_accion in ('cerrar','reasignar'));
   update public.whatsapp_messages set procesado_en=now() where conversation_id=c.id and direccion='entrante' and procesado_en is null;
 end if;
 insert into public.whatsapp_events(conversation_id,actor_id,evento,detalle) values(c.id,v_actor,p_accion,jsonb_build_object('responsable',v_target));
end; $$;

create or replace function public.whatsapp_validar(p_conv uuid,p_unidad uuid,p_nota text) returns void language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations;u public.unidades;cn text; begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 select * into c from public.whatsapp_conversations where id=p_conv for update;
 if c.asignado_a is distinct from auth.uid() or c.estado<>'atencion_humana' then raise exception 'Toma la conversación antes de validar';end if;
 if length(btrim(coalesce(p_nota,'')))<10 then raise exception 'Describe cómo verificaste la identidad por un canal confiable';end if;
 select * into u from public.unidades where id=p_unidad;
 if u.id is null then raise exception 'Unidad no válida';end if;
 select nombre into cn from public.comunidades where id=u.comunidad_id;
 update public.whatsapp_conversations set comunidad_id=u.comunidad_id,unidad_id=u.id,validacion='humana',revision=revision+1,
   datos=jsonb_set(datos,'{context}',jsonb_build_object('unidad_id',u.id,'comunidad_id',u.comunidad_id,'comunidad_nombre',cn,'numero',u.numero)) where id=c.id;
 insert into public.whatsapp_events(conversation_id,actor_id,evento,detalle) values(c.id,auth.uid(),'identidad_validada',jsonb_build_object('unidad_id',u.id,'metodo',left(p_nota,1000)));
end; $$;

create or replace function public.whatsapp_preparar_envio(p_token uuid,p_message uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.whatsapp_messages;c public.whatsapp_conversations;t text;v_last timestamptz;begin
 if not exists(select 1 from public.whatsapp_config where id and habilitado and worker_token=p_token and worker_hasta>now()) then return null;end if;
 select * into m from public.whatsapp_messages where id=p_message and estado='pendiente';
 if m.id is null then return null;end if;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
 select * into m from public.whatsapp_messages where id=p_message and estado='pendiente' for update;
 if m.id is null then return null;end if;
 -- Final bot acknowledgements were queued by the same transactional handoff;
 -- any subsequent human action cancels those before a dispatch can begin.
 if m.es_bot and c.estado='atencion_humana' then update public.whatsapp_messages set estado='cancelado' where id=m.id;return null;end if;
 select max(creado_en) into v_last from public.whatsapp_messages where conversation_id=c.id and direccion='entrante';
 if v_last is null or v_last<=now()-interval '24 hours' then update public.whatsapp_messages set estado='fuera_ventana' where id=m.id;return null;end if;
 select wa_id into t from public.whatsapp_contacts where id=c.contacto_id;
 update public.whatsapp_messages set estado='enviando',lease_hasta=now()+interval '45 seconds' where id=m.id;
 return jsonb_build_object('id',m.id,'to',t,'reply',m.respuesta);
end; $$;

create or replace function public.whatsapp_envio_resultado(p_token uuid,p_message uuid,p_estado text,p_meta_id text default null,p_error text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_conv uuid;
begin
 if not exists(select 1 from public.whatsapp_config where id and worker_token=p_token) then return;end if;
 if p_estado not in ('enviado','fallido','incierto') then raise exception 'Estado no válido';end if;
 select conversation_id into v_conv from public.whatsapp_messages where id=p_message;
 perform 1 from public.whatsapp_conversations where id=v_conv for update;
 update public.whatsapp_messages set estado=p_estado,message_id_meta=p_meta_id,error_codigo=left(p_error,120),lease_hasta=null where id=p_message and estado='enviando' returning conversation_id into v_conv;
 if v_conv is not null and p_estado in ('fallido','incierto') then
   update public.whatsapp_conversations set estado='derivada',paso_actual='error_envio',revision=revision+1 where id=v_conv and estado in ('bot','esperando_usuario');
   update public.whatsapp_messages set estado='cancelado' where conversation_id=v_conv and es_bot and estado='pendiente';
   insert into public.whatsapp_events(conversation_id,evento,detalle) values(v_conv,'error_envio',jsonb_build_object('estado',p_estado,'codigo',p_error));
 end if;
end; $$;
