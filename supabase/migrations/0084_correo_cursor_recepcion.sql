-- New mail remains pending until classified; a cursor avoids losing a busy inbox batch.
alter table public.proveedor_sync_estado add column if not exists correo_cursor_uid bigint;
alter table public.proveedor_sync_estado add column if not exists correo_uid_validity text;
create or replace function public.proveedor_correo_sync_claim() returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.proveedor_sync_estado set ultima_revision=now(),en_ejecucion_desde=now(),ultimo_error=null,editado_en=now()
 where clave='gmail_proveedores' and (en_ejecucion_desde is null or en_ejecucion_desde<now()-interval '3 minutes');
 return found;
end;$$;
revoke all on function public.proveedor_correo_sync_claim() from public,anon,authenticated;
grant execute on function public.proveedor_correo_sync_claim() to service_role;
