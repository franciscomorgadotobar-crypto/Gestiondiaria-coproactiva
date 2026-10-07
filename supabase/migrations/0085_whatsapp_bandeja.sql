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
revoke all on function public.whatsapp_bandeja(text,text,integer) from public,anon;
grant execute on function public.whatsapp_bandeja(text,text,integer) to authenticated;
