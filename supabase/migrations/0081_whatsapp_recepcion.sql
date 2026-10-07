-- WhatsApp reception: private tables, transactional registration and durable outbox.
create or replace function public.whatsapp_es_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol::text in ('superadmin','admin'));
$$;
revoke all on function public.whatsapp_es_admin() from public,anon;
grant execute on function public.whatsapp_es_admin() to authenticated,service_role;
create table public.whatsapp_config (
  id boolean primary key default true check(id), habilitado boolean not null default false,
  responsable_recepcion uuid references public.perfiles(id), worker_token uuid, worker_hasta timestamptz,
  cron_token_hash text, editado_en timestamptz not null default now()
);
insert into public.whatsapp_config(id) values(true);
create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(), wa_id text not null unique check(wa_id ~ '^[0-9]{8,15}$'),
  telefono text not null, nombre_whatsapp text, ultimo_contacto timestamptz not null default now(), creado_en timestamptz not null default now()
);
create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(), contacto_id uuid not null references public.whatsapp_contacts(id),
  motivo text check(motivo in ('residente','cotizacion','postulacion','proveedor','otro')),
  estado text not null default 'bot' check(estado in ('bot','esperando_usuario','derivada','atencion_humana','cerrada')),
  paso_actual text not null default 'inicio', datos jsonb not null default '{}', version_flujo text not null default '1.0', revision bigint not null default 0,
  comunidad_id uuid references public.comunidades(id), unidad_id uuid references public.unidades(id),
  residente_id uuid references public.residentes(id), copropietario_id uuid references public.copropietarios(id),
  validacion text not null default 'pendiente' check(validacion in ('pendiente','telefono','humana')),
  asignado_a uuid references public.perfiles(id), bitacora_id uuid references public.bitacora_registros(id), prospecto_id uuid references public.prospectos(id),
  iniciada_en timestamptz not null default now(), ultima_interaccion timestamptz not null default now(), cerrada_en timestamptz
);
create unique index whatsapp_conversation_activa on public.whatsapp_conversations(contacto_id) where estado <> 'cerrada';
create index whatsapp_bandeja on public.whatsapp_conversations(estado,ultima_interaccion desc);
create index whatsapp_conversation_asignado on public.whatsapp_conversations(asignado_a) where asignado_a is not null;
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.whatsapp_conversations(id),
  message_id_meta text unique, direccion text not null check(direccion in ('entrante','saliente')),
  tipo text not null check(tipo in ('texto','interaccion','imagen','documento','audio','video','sticker','otro')),
  contenido text not null default '', metadatos jsonb not null default '{}', respuesta jsonb,
  estado text not null default 'recibido' check(estado in ('recibido','pendiente','enviando','enviado','entregado','leido','fallido','incierto','cancelado','fuera_ventana')),
  autor_id uuid references public.perfiles(id), es_bot boolean not null default false, procesado_en timestamptz,
  creado_en timestamptz not null default now(), orden bigint generated always as identity unique, lease_hasta timestamptz, error_codigo text,
  check(length(contenido)<=5000), check(jsonb_typeof(metadatos)='object')
);
create index whatsapp_messages_historial on public.whatsapp_messages(conversation_id,creado_en,id);
create index whatsapp_incoming_pending on public.whatsapp_messages(creado_en,id) where direccion='entrante' and procesado_en is null;
create index whatsapp_outgoing_pending on public.whatsapp_messages(creado_en,id) where estado='pendiente';
create table public.whatsapp_events (
  id bigint generated always as identity primary key, conversation_id uuid references public.whatsapp_conversations(id),
  actor_id uuid references public.perfiles(id), evento text not null, detalle jsonb not null default '{}', creado_en timestamptz not null default now()
);
create index whatsapp_events_conversation on public.whatsapp_events(conversation_id,creado_en);
alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_events enable row level security;
-- UI reads only; controlled RPCs handle every mutation and audit its actor.
create policy whatsapp_contacts_read on public.whatsapp_contacts for select to authenticated using(public.whatsapp_es_admin());
create policy whatsapp_conversations_read on public.whatsapp_conversations for select to authenticated using(public.whatsapp_es_admin());
create policy whatsapp_messages_read on public.whatsapp_messages for select to authenticated using(public.whatsapp_es_admin());
create policy whatsapp_events_read on public.whatsapp_events for select to authenticated using(public.whatsapp_es_admin());
revoke all on public.whatsapp_config,public.whatsapp_contacts,public.whatsapp_conversations,public.whatsapp_messages,public.whatsapp_events from anon,authenticated;
grant select on public.whatsapp_contacts,public.whatsapp_conversations,public.whatsapp_messages,public.whatsapp_events to authenticated;
grant all on public.whatsapp_config,public.whatsapp_contacts,public.whatsapp_conversations,public.whatsapp_messages,public.whatsapp_events to service_role;
grant usage,select on sequence public.whatsapp_events_id_seq to service_role;
grant usage,select on sequence public.whatsapp_messages_orden_seq to service_role;

create or replace function public.whatsapp_telefono(p_text text) returns text language sql immutable set search_path=public as $$
 select case when length(regexp_replace(coalesce(p_text,''),'[^0-9]','','g'))=9 then '56'||regexp_replace(p_text,'[^0-9]','','g') else regexp_replace(coalesce(p_text,''),'[^0-9]','','g') end;
$$;
create or replace function public.whatsapp_contextos(p_telefono text) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.comunidad_nombre,x.numero),'[]') from (
   select u.id unidad_id,u.comunidad_id,c.nombre comunidad_nombre,u.numero,
    case when r.id is not null and r.activo and public.whatsapp_telefono(p_telefono) in (public.whatsapp_telefono(r.telefono_principal),public.whatsapp_telefono(r.telefono_secundario)) then r.id end residente_id,
    case when o.id is not null and public.whatsapp_telefono(o.telefono)=public.whatsapp_telefono(p_telefono) then o.id end copropietario_id
   from public.unidades u join public.comunidades c on c.id=u.comunidad_id
   left join public.residentes r on r.id=u.residente_id and r.comunidad_id=u.comunidad_id
   left join public.copropietarios o on o.id=u.copropietario_id and o.comunidad_id=u.comunidad_id
   where c.estado::text in ('activo','marcha_blanca') and length(public.whatsapp_telefono(p_telefono))>=8
    and ((r.activo and public.whatsapp_telefono(p_telefono) in (public.whatsapp_telefono(r.telefono_principal),public.whatsapp_telefono(r.telefono_secundario)))
      or public.whatsapp_telefono(o.telefono)=public.whatsapp_telefono(p_telefono))
 ) x;
$$;
revoke all on function public.whatsapp_contextos(text) from public,anon,authenticated;
grant execute on function public.whatsapp_contextos(text) to service_role;

create or replace function public.whatsapp_ingresar(p_wa_id text,p_nombre text,p_meta_id text,p_tipo text,p_contenido text,p_fecha timestamptz,p_metadatos jsonb default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare v_contact public.whatsapp_contacts; v_conv public.whatsapp_conversations; v_id uuid;
begin
 if not (select habilitado from public.whatsapp_config where id) then raise exception 'Canal deshabilitado'; end if;
 if p_wa_id !~ '^[0-9]{8,15}$' or nullif(p_meta_id,'') is null then raise exception 'Evento inválido'; end if;
 if p_metadatos - array['mime_type','filename'] <> '{}'::jsonb then raise exception 'Solo metadatos de adjuntos'; end if;
 if exists(select 1 from public.whatsapp_messages where message_id_meta=p_meta_id) then return null; end if;
 insert into public.whatsapp_contacts(wa_id,telefono,nombre_whatsapp,ultimo_contacto) values(p_wa_id,'+'||p_wa_id,left(p_nombre,120),least(p_fecha,now()))
 on conflict(wa_id) do update set ultimo_contacto=greatest(whatsapp_contacts.ultimo_contacto,excluded.ultimo_contacto),nombre_whatsapp=coalesce(excluded.nombre_whatsapp,whatsapp_contacts.nombre_whatsapp)
 returning * into v_contact;
 -- Contact row lock serializes simultaneous webhook deliveries and new sessions.
 select * into v_conv from public.whatsapp_conversations where contacto_id=v_contact.id and estado<>'cerrada' for update;
 if v_conv.id is null then
   insert into public.whatsapp_conversations(contacto_id) values(v_contact.id) returning * into v_conv;
   insert into public.whatsapp_events(conversation_id,evento) values(v_conv.id,'iniciada');
 end if;
 insert into public.whatsapp_messages(conversation_id,message_id_meta,direccion,tipo,contenido,metadatos,creado_en)
 values(v_conv.id,p_meta_id,'entrante',p_tipo,case when p_tipo in ('texto','interaccion') then left(p_contenido,3500) else '[Adjunto recibido: '||p_tipo||']' end,p_metadatos,least(p_fecha,now()))
 on conflict(message_id_meta) do nothing returning id into v_id;
 update public.whatsapp_conversations set ultima_interaccion=greatest(ultima_interaccion,least(p_fecha,now())) where id=v_conv.id;
 return v_id;
end;
$$;
revoke all on function public.whatsapp_ingresar(text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.whatsapp_ingresar(text,text,text,text,text,timestamptz,jsonb) to service_role;

create or replace function public.whatsapp_worker_claim() returns uuid language plpgsql security definer set search_path=public as $$
declare v_token uuid:=gen_random_uuid(); begin
 update public.whatsapp_config set worker_token=v_token,worker_hasta=now()+interval '90 seconds'
 where id and habilitado and (worker_hasta is null or worker_hasta<now());
 if not found then return null; end if;
 -- A request whose response was lost must never be blindly resent.
 update public.whatsapp_messages set estado='incierto',error_codigo='envio_interrumpido' where estado='enviando' and lease_hasta<now();
 return v_token;
end; $$;
create or replace function public.whatsapp_worker_release(p_token uuid) returns void language sql security definer set search_path=public as $$
 update public.whatsapp_config set worker_hasta=null,worker_token=null where id and worker_token=p_token;
$$;

create or replace function public.whatsapp_registrar_bitacora(p_conv uuid,p_actor uuid) returns text language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations; d jsonb; b public.bitacora_registros; v_context jsonb;
begin
 select * into c from public.whatsapp_conversations where id=p_conv for update;
 if c.bitacora_id is not null then select correlativo into b.correlativo from public.bitacora_registros where id=c.bitacora_id;return b.correlativo;end if;
 if c.comunidad_id is null or c.validacion not in ('telefono','humana') then raise exception 'Identidad pendiente';end if;
 if not exists(select 1 from public.perfiles where id=p_actor and activo and rol::text in ('admin','superadmin')) then raise exception 'Responsable de recepción requerido';end if;
 d:=c.datos;
 if nullif(btrim(d->>'descripcion'),'') is null then raise exception 'Descripción requerida';end if;
 insert into public.bitacora_registros(comunidad_id,tipo_codigo,tipo_otro,nivel,titulo,descripcion,registrado_por)
 values(c.comunidad_id,coalesce(d->>'categoria','administracion'),case when d->>'categoria'='otro' then coalesce(d->>'categoria_nombre','Solicitud WhatsApp') end,
 case when coalesce((d->>'urgente')::boolean,false) then 'urgente' else 'atencion' end,
 left(coalesce(d->>'categoria_nombre','Solicitud de gestión')||' · WhatsApp',160),
 (d->>'descripcion')||E'\nLugar: '||coalesce(d->>'lugar','Por precisar')||E'\nDesde: '||coalesce(d->>'desde','Por precisar')||E'\nRecepción: WhatsApp. '||
 case when auth.uid() is null then 'Registro automático. Responsable de recepción configurado: ' else 'Registro revisado por: ' end||p_actor::text||E'\nConversación: '||c.id::text,p_actor)
 returning * into b;
 update public.whatsapp_conversations set bitacora_id=b.id where id=c.id;
 insert into public.whatsapp_events(conversation_id,actor_id,evento,detalle) values(c.id,auth.uid(),'bitacora_creada',jsonb_build_object('bitacora_id',b.id,'automatica',auth.uid() is null));
 insert into public.notificaciones(destinatario_id,tipo,titulo,mensaje,comunidad_id,bitacora_id)
 select id,case when b.nivel='urgente' then 'bitacora_urgente' else 'bitacora_atencion' end,'WhatsApp · '||b.correlativo,b.titulo,c.comunidad_id,b.id
 from public.perfiles where activo and rol::text in ('admin','superadmin');
 return b.correlativo;
end; $$;

create or replace function public.whatsapp_process_commit(p_token uuid,p_message uuid,p_revision bigint,p_plan jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare m public.whatsapp_messages; c public.whatsapp_conversations; d jsonb:=p_plan->'data'; ctx jsonb; cfg public.whatsapp_config; r jsonb; v_correlativo text; v_prospect uuid; v_tel text;
begin
 select * into cfg from public.whatsapp_config where id;
 if cfg.worker_token is distinct from p_token or cfg.worker_hasta<now() then return false;end if;
 select * into m from public.whatsapp_messages where id=p_message and direccion='entrante' for update;
 if m.id is null or m.procesado_en is not null then return false;end if;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
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
 select * into m from public.whatsapp_messages where id=p_message for update;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
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

-- Administrative actions use Auth identity, never a browser-provided role.
create or replace function public.whatsapp_accion(p_conv uuid,p_accion text,p_valor text default null) returns void language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations;v_actor uuid:=auth.uid();v_target uuid;v_correlativo text; begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 select * into c from public.whatsapp_conversations where id=p_conv for update;
 if c.id is null then raise exception 'Conversación inexistente';end if;
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
 if c.asignado_a<>auth.uid() or c.estado<>'atencion_humana' then raise exception 'Toma la conversación antes de validar';end if;
 if length(btrim(coalesce(p_nota,'')))<10 then raise exception 'Describe cómo verificaste la identidad por un canal confiable';end if;
 select * into u from public.unidades where id=p_unidad;
 if u.id is null then raise exception 'Unidad no válida';end if;
 select nombre into cn from public.comunidades where id=u.comunidad_id;
 update public.whatsapp_conversations set comunidad_id=u.comunidad_id,unidad_id=u.id,validacion='humana',revision=revision+1,
   datos=jsonb_set(datos,'{context}',jsonb_build_object('unidad_id',u.id,'comunidad_id',u.comunidad_id,'comunidad_nombre',cn,'numero',u.numero)) where id=c.id;
 insert into public.whatsapp_events(conversation_id,actor_id,evento,detalle) values(c.id,auth.uid(),'identidad_validada',jsonb_build_object('unidad_id',u.id,'metodo',left(p_nota,1000)));
end; $$;

create or replace function public.whatsapp_preparar_solicitud(p_conv uuid,p_descripcion text) returns void language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations;begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 select * into c from public.whatsapp_conversations where id=p_conv for update;
 if c.asignado_a is distinct from auth.uid() or c.estado<>'atencion_humana' then raise exception 'Toma la conversación antes de registrar';end if;
 if c.motivo<>'residente' or c.bitacora_id is not null then raise exception 'Registro no disponible';end if;
 if nullif(btrim(p_descripcion),'') is null or length(p_descripcion)>3500 then raise exception 'Descripción requerida';end if;
 update public.whatsapp_conversations set datos=datos||jsonb_build_object('descripcion',p_descripcion,'categoria',coalesce(datos->>'categoria','administracion'),'categoria_nombre',coalesce(datos->>'categoria_nombre','Solicitud de gestión')),revision=revision+1 where id=c.id;
 insert into public.whatsapp_events(conversation_id,actor_id,evento) values(c.id,auth.uid(),'solicitud_revisada');
end;$$;

create or replace function public.whatsapp_preparar_envio(p_token uuid,p_message uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.whatsapp_messages;c public.whatsapp_conversations;t text;v_last timestamptz;begin
 if not exists(select 1 from public.whatsapp_config where id and habilitado and worker_token=p_token and worker_hasta>now()) then return null;end if;
 select * into m from public.whatsapp_messages where id=p_message and estado='pendiente' for update;
 if m.id is null then return null;end if;
 select * into c from public.whatsapp_conversations where id=m.conversation_id for update;
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
 update public.whatsapp_messages set estado=p_estado,message_id_meta=p_meta_id,error_codigo=left(p_error,120),lease_hasta=null where id=p_message and estado='enviando' returning conversation_id into v_conv;
 if v_conv is not null and p_estado in ('fallido','incierto') then
   update public.whatsapp_conversations set estado='derivada',paso_actual='error_envio',revision=revision+1 where id=v_conv and estado in ('bot','esperando_usuario');
   update public.whatsapp_messages set estado='cancelado' where conversation_id=v_conv and es_bot and estado='pendiente';
   insert into public.whatsapp_events(conversation_id,evento,detalle) values(v_conv,'error_envio',jsonb_build_object('estado',p_estado,'codigo',p_error));
 end if;
end; $$;
create or replace function public.whatsapp_delivery(p_meta_id text,p_estado text) returns void language sql security definer set search_path=public as $$
 update public.whatsapp_messages set estado=p_estado where message_id_meta=p_meta_id and direccion='saliente'
 and ((p_estado='entregado' and estado in ('enviado','incierto')) or (p_estado='leido' and estado in ('enviado','entregado','incierto')) or (p_estado='fallido' and estado not in ('leido','entregado')));
$$;

create or replace function public.whatsapp_configurar(p_habilitado boolean,p_responsable uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.perfiles where id=auth.uid() and activo and rol::text='superadmin') then raise exception 'Solo superadmin';end if;
 if p_habilitado and not exists(select 1 from public.perfiles where id=p_responsable and activo and rol::text in ('admin','superadmin')) then raise exception 'Selecciona un responsable activo de recepción';end if;
 update public.whatsapp_config set habilitado=p_habilitado,responsable_recepcion=p_responsable,editado_en=now() where id;
 if not p_habilitado then update public.whatsapp_messages set estado='cancelado' where estado='pendiente';end if;
 insert into public.whatsapp_events(actor_id,evento,detalle) values(auth.uid(),'configuracion',jsonb_build_object('habilitado',p_habilitado,'responsable',p_responsable));
end; $$;
create or replace function public.whatsapp_config_publica() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 return (select jsonb_build_object('habilitado',habilitado,'responsable_recepcion',responsable_recepcion,'version_flujo','1.0') from public.whatsapp_config where id);
end; $$;

-- Explicit ACLs for each definer: service internals are never browser callable.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('whatsapp_worker_claim','whatsapp_worker_release','whatsapp_registrar_bitacora','whatsapp_process_commit','whatsapp_process_error','whatsapp_preparar_envio','whatsapp_envio_resultado','whatsapp_delivery') loop
   execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
   execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('whatsapp_accion','whatsapp_validar','whatsapp_preparar_solicitud','whatsapp_configurar','whatsapp_config_publica') loop
   execute 'revoke all on function '||f.signature||' from public,anon';
   execute 'grant execute on function '||f.signature||' to authenticated';
 end loop;
end; $$;

-- Durable cron wakes the worker even after webhook timeout. Token stays in Vault.
do $$ declare v_token text;begin
 select decrypted_secret into v_token from vault.decrypted_secrets where name='whatsapp_worker_token' order by created_at desc limit 1;
 if v_token is null then v_token:=encode(extensions.gen_random_bytes(32),'hex');perform vault.create_secret(v_token,'whatsapp_worker_token','Autenticación interna del worker WhatsApp');end if;
 update public.whatsapp_config set cron_token_hash=encode(extensions.digest(v_token,'sha256'),'hex') where id;
end; $$;
select cron.schedule('whatsapp-worker','* * * * *',$cron$
 select net.http_post(url:='https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/whatsapp-worker',
 headers:=jsonb_build_object('Content-Type','application/json','X-Coproactiva-Worker',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_worker_token' order by created_at desc limit 1)),body:='{}'::jsonb,timeout_milliseconds:=55000)
 where exists(select 1 from public.whatsapp_config where id and habilitado);
 $cron$);
comment on table public.whatsapp_messages is 'Solo texto y metadatos. Nunca descargar ni guardar archivos, media URLs o transcripciones.';
