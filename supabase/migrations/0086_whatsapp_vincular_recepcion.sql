alter table public.whatsapp_conversations add column postulante_id uuid references public.postulantes(id);
alter table public.whatsapp_conversations add column proveedor_id uuid references public.proveedores(id);
create index whatsapp_conversation_postulante on public.whatsapp_conversations(postulante_id) where postulante_id is not null;
create index whatsapp_conversation_proveedor on public.whatsapp_conversations(proveedor_id) where proveedor_id is not null;

create or replace function public.whatsapp_clasificar_correo(p_correo uuid,p_clase text,p_nombre text,p_destino uuid default null,p_conversacion uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare c public.whatsapp_conversations;v_id uuid;v_tel text;begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 if p_conversacion is not null then
   select * into c from public.whatsapp_conversations where id=p_conversacion for update;
   if c.id is null or not ((p_clase='postulante' and c.motivo='postulacion') or (p_clase='proveedor' and c.motivo='proveedor')) then raise exception 'El motivo de WhatsApp no coincide con la clasificación';end if;
   select telefono into v_tel from public.whatsapp_contacts where id=c.contacto_id;
 end if;
 v_id:=public.clasificar_correo_contacto(p_correo,p_clase,p_nombre,p_destino);
 if p_conversacion is not null then
   if p_clase='postulante' then
     update public.postulantes set telefono=coalesce(telefono,v_tel),comuna=coalesce(comuna,c.datos->>'comuna'),cargo_propuesto=coalesce(cargo_propuesto,c.datos->>'area'),origen='whatsapp',editado_en=now() where id=v_id;
     update public.whatsapp_conversations set postulante_id=v_id where id=c.id;
   else
     update public.proveedores set telefono=coalesce(telefono,v_tel),origen='whatsapp',editado_en=now() where id=v_id;
     update public.whatsapp_conversations set proveedor_id=v_id where id=c.id;
     insert into public.proveedor_interacciones(proveedor_id,canal,detalle,realizado_por) values(v_id,'whatsapp','Presentación por correo vinculada a conversación WhatsApp '||c.id::text,auth.uid());
   end if;
   insert into public.whatsapp_events(conversation_id,actor_id,evento,detalle) values(c.id,auth.uid(),'correo_clasificado',jsonb_build_object('correo_id',p_correo,'clase',p_clase,'destino_id',v_id));
 end if;
 return v_id;
end;$$;
revoke all on function public.whatsapp_clasificar_correo(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.whatsapp_clasificar_correo(uuid,text,text,uuid,uuid) to authenticated;

-- Include reception links in the paginated inbox, without WhatsApp-specific core columns.
create or replace function public.whatsapp_bandeja(p_estado text default 'todas',p_busqueda text default '',p_pagina integer default 0) returns setof jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 return query select to_jsonb(x) from (
  select c.*,jsonb_build_object('telefono',t.telefono,'nombre_whatsapp',t.nombre_whatsapp) contacto,
   jsonb_build_object('nombre',co.nombre) comunidad,jsonb_build_object('numero',u.numero) unidad,
   jsonb_build_object('nombre',p.nombre) responsable,count(*) over() total
  from public.whatsapp_conversations c join public.whatsapp_contacts t on t.id=c.contacto_id
  left join public.comunidades co on co.id=c.comunidad_id left join public.unidades u on u.id=c.unidad_id
  left join public.perfiles p on p.id=c.asignado_a
  where (p_estado='todas' or (p_estado='bot' and c.estado in ('bot','esperando_usuario')) or c.estado=p_estado)
   and concat_ws(' ',t.nombre_whatsapp,t.telefono,c.datos->>'nombre',co.nombre,c.datos->>'comunidad') ilike '%'||left(coalesce(p_busqueda,''),100)||'%'
  order by c.ultima_interaccion desc,c.id limit 50 offset greatest(0,p_pagina)*50
 ) x;
end;$$;
