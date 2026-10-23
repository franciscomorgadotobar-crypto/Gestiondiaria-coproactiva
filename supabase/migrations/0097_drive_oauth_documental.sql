-- Google Drive corporativo (contacto@coproactiva.cl) mediante OAuth 2.0.
-- * Los tokens NUNCA quedan en tablas legibles por la API: el refresh token se
--   guarda cifrado con AES-GCM (clave derivada de un secreto de Edge Functions)
--   y además dentro de Supabase Vault. Solo service_role puede leerlo.
-- * Los archivos se guardan en Drive; Supabase conserva metadatos e historial.
-- * Idempotente: puede re-ejecutarse sin duplicar filas ni tareas programadas.

-- 1. Configuración de la estructura existente en Drive (no son secretos).
create table if not exists public.drive_configuracion (
  id boolean primary key default true check (id),
  raiz_id text not null,
  comunidades_id text not null,
  cuenta_esperada text not null default 'contacto@coproactiva.cl',
  worker_token_hash text,
  editado_en timestamptz not null default now()
);
insert into public.drive_configuracion(id, raiz_id, comunidades_id)
values (true, '1FFnlodc0Zbwe7jWqW1mEpEz6OwKy8Xgl', '1LytfaZOMESwb1C0svNAE8FNqCO7tJFTx')
on conflict (id) do nothing;

-- 2. Estado de la conexión OAuth (solo metadatos, nunca tokens).
create table if not exists public.drive_conexion (
  id boolean primary key default true check (id),
  estado text not null default 'desconectada'
    check (estado in ('desconectada','conectada','revocada','error')),
  cuenta_email text,
  cuenta_nombre text,
  scopes text[],
  conectada_por uuid references auth.users(id) on delete set null,
  conectada_en timestamptz,
  ultimo_refresco timestamptz,
  ultima_verificacion timestamptz,
  ultimo_error text,
  editado_en timestamptz not null default now()
);
insert into public.drive_conexion(id) values (true) on conflict (id) do nothing;

-- 3. Estados OAuth de un solo uso (protección CSRF). Se guarda el hash, no el valor.
create table if not exists public.drive_oauth_estados (
  estado_hash text primary key,
  perfil_id uuid not null references auth.users(id) on delete cascade,
  verificador_cifrado text not null,
  volver text,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usado_en timestamptz
);
create index if not exists drive_oauth_estados_expira_idx on public.drive_oauth_estados(expira_en);

-- 4. Enlaces de descarga temporales (un uso, 2 minutos). Nunca enlaces públicos de Drive.
create table if not exists public.drive_descargas (
  token_hash text primary key,
  documento_id uuid not null,
  perfil_id uuid not null references auth.users(id) on delete cascade,
  disposicion text not null default 'attachment' check (disposicion in ('attachment','inline')),
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usado_en timestamptz
);
create index if not exists drive_descargas_expira_idx on public.drive_descargas(expira_en);

-- 5. Carpetas por comunidad: agrupación (cliente/inmobiliaria), verificación y bloqueo.
alter table public.drive_carpetas_comunidad
  add column if not exists agrupacion_id text,
  add column if not exists agrupacion_nombre text,
  add column if not exists carpeta_nombre text,
  add column if not exists verificado_en timestamptz,
  add column if not exists ultimo_intento timestamptz,
  add column if not exists siguiente_intento timestamptz,
  add column if not exists bloqueado_hasta timestamptz;
alter table public.drive_carpetas_comunidad drop constraint if exists drive_carpetas_comunidad_estado_check;
alter table public.drive_carpetas_comunidad add constraint drive_carpetas_comunidad_estado_check
  check (estado in ('pendiente','en_proceso','lista','error','revision','sin_configurar'));

-- Una carpeta de Drive no puede quedar vinculada a dos comunidades.
create unique index if not exists comunidades_carpeta_drive_unica
  on public.comunidades(carpeta_drive_id) where carpeta_drive_id is not null;

-- 6. Subcarpetas creadas o reutilizadas (Levantamientos/[ID], Mantenciones/[ID], …).
create table if not exists public.drive_subcarpetas (
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  clave text not null,
  drive_id text not null,
  creado_en timestamptz not null default now(),
  primary key (comunidad_id, clave)
);

-- 7. Metadatos de archivos: más módulos, eliminación lógica, integridad e idempotencia.
alter table public.drive_archivos_comunidad drop constraint if exists drive_archivos_comunidad_origen_tipo_check;
alter table public.drive_archivos_comunidad add constraint drive_archivos_comunidad_origen_tipo_check
  check (origen_tipo in ('levantamiento','mantencion','incidencia','compromiso','administrativo','contabilidad','informe','general'));
alter table public.drive_archivos_comunidad
  add column if not exists detalle_id text,
  add column if not exists drive_folder_id text,
  add column if not exists descripcion text,
  add column if not exists sha256 text,
  add column if not exists md5_drive text,
  add column if not exists clave_idempotencia text,
  add column if not exists eliminado_en timestamptz,
  add column if not exists eliminado_por uuid references auth.users(id) on delete set null,
  add column if not exists visibilidad_por uuid references auth.users(id) on delete set null,
  add column if not exists visibilidad_en timestamptz;
create unique index if not exists drive_archivos_idempotencia_unica
  on public.drive_archivos_comunidad(clave_idempotencia) where clave_idempotencia is not null;
create index if not exists drive_archivos_detalle_idx on public.drive_archivos_comunidad(origen_tipo, detalle_id);

-- 8. Historial (trazabilidad) de cada documento.
create table if not exists public.drive_archivos_eventos (
  id bigint generated always as identity primary key,
  documento_id uuid references public.drive_archivos_comunidad(id) on delete cascade,
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  accion text not null check (accion in ('subido','descargado','visto','eliminado','publicado_cliente','retirado_cliente')),
  perfil_id uuid references auth.users(id) on delete set null,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists drive_archivos_eventos_idx on public.drive_archivos_eventos(comunidad_id, creado_en desc);
create index if not exists drive_archivos_eventos_doc_idx on public.drive_archivos_eventos(documento_id, creado_en desc);

-- 9. Seguridad: sin acceso directo a configuración interna, tokens, estados ni enlaces.
alter table public.drive_configuracion enable row level security;
alter table public.drive_conexion enable row level security;
alter table public.drive_oauth_estados enable row level security;
alter table public.drive_descargas enable row level security;
alter table public.drive_subcarpetas enable row level security;
alter table public.drive_archivos_eventos enable row level security;
revoke all on public.drive_configuracion, public.drive_conexion, public.drive_oauth_estados,
  public.drive_descargas, public.drive_subcarpetas, public.drive_archivos_eventos from anon, authenticated;
grant select, insert, update, delete on public.drive_configuracion, public.drive_conexion, public.drive_oauth_estados,
  public.drive_descargas, public.drive_subcarpetas, public.drive_archivos_eventos to service_role;

-- Personal interno con acceso a la comunidad (superadmin ve todas; el resto, asignadas).
create or replace function public.drive_personal_ve_comunidad(p_comunidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.mi_rol()::text in ('superadmin','admin','jefatura'), false)
     and public.ve_comunidad(p_comunidad);
$$;
revoke all on function public.drive_personal_ve_comunidad(uuid) from public, anon;
grant execute on function public.drive_personal_ve_comunidad(uuid) to authenticated, service_role;

-- Reemplaza la política anterior: jefatura/admin ya no ven comunidades no asignadas.
drop policy if exists drive_carpeta_lectura on public.drive_carpetas_comunidad;
create policy drive_carpeta_lectura on public.drive_carpetas_comunidad for select to authenticated
  using (public.drive_personal_ve_comunidad(comunidad_id));

drop policy if exists drive_archivos_lectura on public.drive_archivos_comunidad;
create policy drive_archivos_lectura on public.drive_archivos_comunidad for select to authenticated
  using (
    public.drive_personal_ve_comunidad(comunidad_id)
    or (
      eliminado_en is null and origen_tipo = 'levantamiento'
      and public.mi_rol()::text = 'terreno'
      and exists (select 1 from public.controles co
                  where co.id::text = drive_archivos_comunidad.origen_id
                    and co.comunidad_id = drive_archivos_comunidad.comunidad_id
                    and co.responsable_id = auth.uid())
    )
    or (eliminado_en is null and visible_cliente and public.cliente_puede_ver_comunidad(comunidad_id))
  );

drop policy if exists drive_eventos_lectura on public.drive_archivos_eventos;
create policy drive_eventos_lectura on public.drive_archivos_eventos for select to authenticated
  using (public.drive_personal_ve_comunidad(comunidad_id));
grant select on public.drive_archivos_eventos to authenticated;

-- 10. Refresh token cifrado en Vault (solo service_role).
create or replace function public.drive_guardar_token(p_cifrado text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(length(p_cifrado), 0) < 20 then raise exception 'Token cifrado inválido'; end if;
  select id into v_id from vault.secrets where name = 'coproactiva_drive_refresh_token' limit 1;
  if v_id is null then
    perform vault.create_secret(p_cifrado, 'coproactiva_drive_refresh_token', 'Refresh token OAuth Google Drive (cifrado AES-GCM)');
  else
    perform vault.update_secret(v_id, p_cifrado, 'coproactiva_drive_refresh_token', 'Refresh token OAuth Google Drive (cifrado AES-GCM)');
  end if;
end $$;

create or replace function public.drive_leer_token()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'coproactiva_drive_refresh_token' order by updated_at desc nulls last limit 1;
$$;

create or replace function public.drive_borrar_token()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where name = 'coproactiva_drive_refresh_token';
end $$;

-- Consumo atómico de estado OAuth: solo una vez y antes de expirar.
create or replace function public.drive_consumir_estado(p_hash text)
returns table(perfil_id uuid, verificador_cifrado text, volver text)
language sql security definer set search_path = '' as $$
  update public.drive_oauth_estados e
     set usado_en = now()
   where e.estado_hash = p_hash and e.usado_en is null and e.expira_en > now()
  returning e.perfil_id, e.verificador_cifrado, e.volver;
$$;

create or replace function public.drive_consumir_descarga(p_hash text)
returns table(documento_id uuid, perfil_id uuid, disposicion text)
language sql security definer set search_path = '' as $$
  update public.drive_descargas d
     set usado_en = now()
   where d.token_hash = p_hash and d.usado_en is null and d.expira_en > now()
  returning d.documento_id, d.perfil_id, d.disposicion;
$$;

-- Bloqueo breve por comunidad para que reintentos simultáneos no dupliquen carpetas.
create or replace function public.drive_tomar_bloqueo(p_comunidad uuid, p_segundos integer default 60)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  insert into public.drive_carpetas_comunidad(comunidad_id) values (p_comunidad) on conflict do nothing;
  update public.drive_carpetas_comunidad
     set bloqueado_hasta = now() + make_interval(secs => greatest(5, least(p_segundos, 300)))
   where comunidad_id = p_comunidad and (bloqueado_hasta is null or bloqueado_hasta < now())
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

create or replace function public.drive_soltar_bloqueo(p_comunidad uuid)
returns void language sql security definer set search_path = '' as $$
  update public.drive_carpetas_comunidad set bloqueado_hasta = null where comunidad_id = p_comunidad;
$$;

revoke all on function public.drive_guardar_token(text), public.drive_leer_token(), public.drive_borrar_token(),
  public.drive_consumir_estado(text), public.drive_consumir_descarga(text),
  public.drive_tomar_bloqueo(uuid, integer), public.drive_soltar_bloqueo(uuid) from public, anon, authenticated;
grant execute on function public.drive_guardar_token(text), public.drive_leer_token(), public.drive_borrar_token(),
  public.drive_consumir_estado(text), public.drive_consumir_descarga(text),
  public.drive_tomar_bloqueo(uuid, integer), public.drive_soltar_bloqueo(uuid) to service_role;

-- 11. Estado visible para la interfaz (sin datos sensibles).
create or replace function public.drive_estado()
returns table(conectada boolean, estado text, cuenta_email text, conectada_en timestamptz,
              ultima_verificacion timestamptz, ultimo_error text, puede_autorizar boolean)
language sql stable security definer set search_path = '' as $$
  select c.estado = 'conectada',
         c.estado,
         case when public.mi_rol()::text in ('superadmin','admin','jefatura') then c.cuenta_email end,
         c.conectada_en,
         c.ultima_verificacion,
         case when public.mi_rol()::text in ('superadmin','admin','jefatura') then c.ultimo_error end,
         coalesce(public.mi_rol()::text in ('superadmin','admin'), false)
    from public.drive_conexion c
   where c.id and public.mi_rol()::text in ('superadmin','admin','jefatura','terreno');
$$;
revoke all on function public.drive_estado() from public, anon;
grant execute on function public.drive_estado() to authenticated;

-- 12. Listado con autor y fecha, respetando el rol (personal, terreno o cliente).
create or replace function public.drive_listar_documentos(
  p_comunidad_id uuid, p_origen_tipo text default null, p_origen_id text default null,
  p_incluir_eliminados boolean default false)
returns table(id uuid, nombre text, mime text, tamano bigint, categoria text, origen_tipo text,
              origen_id text, detalle_id text, descripcion text, visible_cliente boolean,
              creado_en timestamptz, registrado_por_nombre text, eliminado_en timestamptz,
              eliminado_por_nombre text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.nombre, d.mime, d.tamano, d.categoria, d.origen_tipo, d.origen_id, d.detalle_id,
         d.descripcion, d.visible_cliente, d.creado_en,
         case when public.drive_personal_ve_comunidad(d.comunidad_id) or public.mi_rol()::text = 'terreno'
              then pr.nombre else null end,
         d.eliminado_en,
         case when public.drive_personal_ve_comunidad(d.comunidad_id) then pe.nombre else null end
    from public.drive_archivos_comunidad d
    left join public.perfiles pr on pr.id = d.registrado_por
    left join public.perfiles pe on pe.id = d.eliminado_por
   where d.comunidad_id = p_comunidad_id
     and (p_origen_tipo is null or d.origen_tipo = p_origen_tipo)
     and (p_origen_id is null or d.origen_id = p_origen_id)
     and (
       (public.drive_personal_ve_comunidad(d.comunidad_id) and (p_incluir_eliminados or d.eliminado_en is null))
       or (d.eliminado_en is null and d.origen_tipo = 'levantamiento' and public.mi_rol()::text = 'terreno'
           and exists (select 1 from public.controles co where co.id::text = d.origen_id
                       and co.comunidad_id = d.comunidad_id and co.responsable_id = auth.uid()))
       or (d.eliminado_en is null and d.visible_cliente and public.cliente_puede_ver_comunidad(d.comunidad_id))
     )
   order by d.creado_en desc;
$$;
revoke all on function public.drive_listar_documentos(uuid, text, text, boolean) from public, anon;
grant execute on function public.drive_listar_documentos(uuid, text, text, boolean) to authenticated;

create or replace function public.drive_historial(p_comunidad_id uuid, p_documento_id uuid default null, p_limite integer default 100)
returns table(id bigint, documento_id uuid, documento_nombre text, accion text, perfil_nombre text,
              detalle jsonb, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, e.documento_id, d.nombre, e.accion, p.nombre, e.detalle, e.creado_en
    from public.drive_archivos_eventos e
    left join public.drive_archivos_comunidad d on d.id = e.documento_id
    left join public.perfiles p on p.id = e.perfil_id
   where e.comunidad_id = p_comunidad_id
     and (p_documento_id is null or e.documento_id = p_documento_id)
     and public.drive_personal_ve_comunidad(p_comunidad_id)
   order by e.creado_en desc
   limit greatest(1, least(coalesce(p_limite, 100), 500));
$$;
revoke all on function public.drive_historial(uuid, uuid, integer) from public, anon;
grant execute on function public.drive_historial(uuid, uuid, integer) to authenticated;

-- 13. Reintento automático de carpetas pendientes (cada 10 minutos, sin costo adicional).
do $do$
declare v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets
   where name = 'drive_worker_token' order by created_at desc limit 1;
  if v_token is null then
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(v_token, 'drive_worker_token', 'Autenticación interna del reintento de carpetas Drive');
  end if;
  update public.drive_configuracion set worker_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex') where id;
end $do$;

select cron.unschedule(jobid) from cron.job where jobname = 'drive-carpetas-pendientes';
select cron.schedule('drive-carpetas-pendientes', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/drive-comunidad',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'X-Coproactiva-Worker', (select decrypted_secret from vault.decrypted_secrets
                               where name = 'drive_worker_token' order by created_at desc limit 1)),
    body := '{"action":"procesar_pendientes"}'::jsonb,
    timeout_milliseconds := 55000);
$cron$);

comment on table public.drive_conexion is 'Estado de la autorización OAuth de Google Drive. Sin tokens: el refresh token cifrado vive en Vault.';
comment on table public.drive_archivos_eventos is 'Trazabilidad de documentos Drive: carga, descarga, publicación y eliminación.';
