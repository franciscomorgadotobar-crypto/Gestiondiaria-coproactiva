-- El RPC inserta versiones en una tabla sin permisos directos de escritura.
-- Debe ejecutarse bajo propietario tras verificar explícitamente perfil y rol.
-- La implementación previa SECURITY INVOKER fallaría por permiso denegado.
alter function public.guardar_documento_gestion(uuid,text,text,text,text,uuid,jsonb,integer)
 security definer;
revoke all on function public.guardar_documento_gestion(uuid,text,text,text,text,uuid,jsonb,integer)
 from public,anon;
grant execute on function public.guardar_documento_gestion(uuid,text,text,text,text,uuid,jsonb,integer)
 to authenticated;
