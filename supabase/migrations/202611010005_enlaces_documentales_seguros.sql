-- Enlaces revocables a PDFs privados de la biblioteca documental.
-- No se almacena el token sin procesar ni datos de navegación del destinatario.
create table if not exists public.enlaces_documentales (
  id uuid primary key default gen_random_uuid(),
  archivo_id uuid not null references public.correo_archivos_drive(id) on delete restrict,
  token_hash text not null unique check (length(token_hash)=64),
  creado_por uuid not null references auth.users(id),
  destinatario_previsto text,
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null,
  revocado_en timestamptz,
  accesos_total integer not null default 0 check (accesos_total>=0),
  primera_solicitud timestamptz,
  ultima_solicitud timestamptz,
  constraint enlaces_documentales_vigencia_valida check
   (vence_en>creado_en and vence_en<=creado_en+interval '31 days')
);
create index if not exists enlaces_documentales_archivo
  on public.enlaces_documentales(archivo_id,creado_en desc);
create index if not exists enlaces_documentales_creador
  on public.enlaces_documentales(creado_por,creado_en desc);
alter table public.enlaces_documentales enable row level security;
revoke all on public.enlaces_documentales from anon,authenticated;
grant select,insert,update on public.enlaces_documentales to service_role;

-- Incremento atómico, solo accesible con service_role a través de Edge Function.
-- SECURITY INVOKER: no eleva permisos ni crea bypass desde roles públicos.
create or replace function public.registrar_acceso_documental(p_enlace_id uuid)
returns boolean
language plpgsql
security invoker
set search_path=''
as $func$
begin
 update public.enlaces_documentales
    set accesos_total=accesos_total+1,
        primera_solicitud=coalesce(primera_solicitud,now()),
        ultima_solicitud=now()
  where id=p_enlace_id and revocado_en is null and vence_en>now();
 return found;
end;
$func$;
revoke all on function public.registrar_acceso_documental(uuid) from public,anon,authenticated;
grant execute on function public.registrar_acceso_documental(uuid) to service_role;
