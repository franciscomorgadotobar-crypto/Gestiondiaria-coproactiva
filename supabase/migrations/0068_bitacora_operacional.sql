-- Bitácora transversal de novedades de comunidad.

create table if not exists public.bitacora_tipos (
  codigo text primary key,
  nombre text not null,
  titulo_sugerido text not null,
  ayuda_descripcion text not null,
  orden integer not null default 0,
  activa boolean not null default true
);

insert into public.bitacora_tipos(codigo,nombre,titulo_sugerido,ayuda_descripcion,orden) values
('acceso_porteria','Acceso / portería','Novedad en acceso o portería','Describe qué ocurrió, en qué acceso y cualquier medida adoptada.',10),
('aseo','Aseo','Observación de aseo','Describe el sector, la condición observada y cualquier antecedente relevante.',20),
('areas_comunes','Áreas comunes','Novedad en área común','Indica el lugar exacto, qué observaste y cualquier detalle útil.',30),
('ascensores','Ascensores','Novedad en ascensor','Indica ascensor o ubicación, qué ocurrió y cualquier señal o falla observada.',40),
('electricidad','Electricidad / iluminación','Novedad eléctrica o de iluminación','Describe el punto afectado, ubicación y comportamiento observado.',50),
('emergencia','Emergencia','Situación de emergencia','Describe qué ocurrió, dónde y cualquier medida adoptada de inmediato.',60),
('infraestructura','Infraestructura','Observación de infraestructura','Describe el elemento, ubicación, condición y cualquier daño visible.',70),
('seguridad','Seguridad','Situación de seguridad','Describe qué ocurrió, dónde, personas involucradas si corresponde y cualquier medida adoptada.',80),
('estacionamientos','Estacionamientos','Novedad en estacionamiento','Indica sector, ubicación y situación observada.',90),
('jardines_exterior','Jardines / exterior','Observación en exterior','Describe el sector exterior, condición y cualquier antecedente relevante.',100),
('residente','Residente / copropietario','Novedad de residente o copropietario','Resume la situación informada y los datos necesarios para dejar constancia.',110),
('comite','Comité','Novedad de comité','Resume el antecedente, acuerdo, solicitud u observación del comité.',120),
('proveedor','Proveedor','Novedad relacionada con proveedor','Indica proveedor, servicio involucrado y situación observada.',130),
('administracion','Administración','Novedad administrativa','Describe el antecedente administrativo y cualquier contexto necesario.',140),
('documento_tramite','Documento / trámite','Novedad de documento o trámite','Indica documento o trámite, estado actual y antecedente relevante.',150),
('visita','Visita','Registro de visita','Indica quién visitó, motivo y cualquier novedad observada.',160),
('otro','Otro','Nueva novedad','Describe claramente qué ocurrió, dónde y cualquier antecedente relevante.',999)
on conflict (codigo) do update set
  nombre=excluded.nombre,
  titulo_sugerido=excluded.titulo_sugerido,
  ayuda_descripcion=excluded.ayuda_descripcion,
  orden=excluded.orden,
  activa=true;

create table if not exists public.bitacora_registros (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  tipo_codigo text not null references public.bitacora_tipos(codigo),
  tipo_otro text,
  nivel text not null check (nivel in ('registro','atencion','urgente')),
  titulo text not null,
  descripcion text not null,
  registrado_por uuid not null references public.perfiles(id) on delete restrict,
  registrado_en timestamptz not null default now(),
  correo_enviado_en timestamptz,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now(),
  constraint bitacora_otro_detalle check (
    tipo_codigo <> 'otro' or nullif(btrim(coalesce(tipo_otro,'')),'') is not null
  )
);

create index if not exists bitacora_registros_comunidad_fecha
  on public.bitacora_registros(comunidad_id, registrado_en desc);
create index if not exists bitacora_registros_nivel_fecha
  on public.bitacora_registros(nivel, registrado_en desc);

create table if not exists public.bitacora_adjuntos (
  id uuid primary key default gen_random_uuid(),
  bitacora_id uuid not null references public.bitacora_registros(id) on delete cascade,
  storage_path text not null unique,
  nombre_original text not null,
  mime text,
  bytes bigint,
  subido_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists bitacora_adjuntos_registro
  on public.bitacora_adjuntos(bitacora_id, creado_en);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensaje text,
  comunidad_id uuid references public.comunidades(id) on delete cascade,
  bitacora_id uuid references public.bitacora_registros(id) on delete cascade,
  leida boolean not null default false,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists notificaciones_destinatario
  on public.notificaciones(destinatario_id, leida, creado_en desc);

create or replace function public.bitacora_puede_ver_comunidad(p_comunidad uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.perfiles p
    join public.comunidades c on c.id=p_comunidad
    where p.id=auth.uid()
      and p.activo
      and (
        p.rol::text in ('superadmin','admin')
        or (
          p.rol::text in ('jefatura','terreno')
          and exists (
            select 1 from public.perfil_comunidades pc
            where pc.perfil_id=p.id and pc.comunidad_id=p_comunidad
          )
        )
        or (
          p.rol::text='cliente'
          and exists (
            select 1 from public.portal_cliente_comunidades pcc
            where pcc.usuario_id=p.id
              and pcc.comunidad_id=p_comunidad
              and pcc.activa
          )
        )
      )
  );
$$;

revoke all on function public.bitacora_puede_ver_comunidad(uuid) from public,anon;
grant execute on function public.bitacora_puede_ver_comunidad(uuid) to authenticated;

create or replace function public.bitacora_puede_ver_registro(p_bitacora uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.bitacora_registros b
    where b.id=p_bitacora
      and public.bitacora_puede_ver_comunidad(b.comunidad_id)
  );
$$;

revoke all on function public.bitacora_puede_ver_registro(uuid) from public,anon;
grant execute on function public.bitacora_puede_ver_registro(uuid) to authenticated;

create or replace function public.bitacora_comunidades_disponibles()
returns table(id uuid,nombre text,comuna text)
language sql
stable
security definer
set search_path=public
as $$
  select c.id,c.nombre,c.comuna
  from public.comunidades c
  where public.bitacora_puede_ver_comunidad(c.id)
  order by c.nombre;
$$;

revoke all on function public.bitacora_comunidades_disponibles() from public,anon;
grant execute on function public.bitacora_comunidades_disponibles() to authenticated;

create or replace function public.bitacora_crear(
  p_comunidad_id uuid,
  p_tipo_codigo text,
  p_tipo_otro text,
  p_nivel text,
  p_titulo text,
  p_descripcion text
)
returns public.bitacora_registros
language plpgsql
security definer
set search_path=public
as $$
declare
  v_reg public.bitacora_registros%rowtype;
  v_comunidad text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida.'; end if;

  if not public.bitacora_puede_ver_comunidad(p_comunidad_id) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  if not exists(select 1 from public.bitacora_tipos where codigo=p_tipo_codigo and activa) then
    raise exception 'Tipo de registro no válido.';
  end if;

  if p_nivel not in ('registro','atencion','urgente') then
    raise exception 'Nivel de atención no válido.';
  end if;

  if nullif(btrim(coalesce(p_titulo,'')),'') is null then
    raise exception 'El título es obligatorio.';
  end if;

  if nullif(btrim(coalesce(p_descripcion,'')),'') is null then
    raise exception 'La descripción es obligatoria.';
  end if;

  if p_tipo_codigo='otro' and nullif(btrim(coalesce(p_tipo_otro,'')),'') is null then
    raise exception 'Especifica el tipo de registro.';
  end if;

  insert into public.bitacora_registros(
    comunidad_id,tipo_codigo,tipo_otro,nivel,titulo,descripcion,registrado_por
  )
  values(
    p_comunidad_id,p_tipo_codigo,nullif(btrim(coalesce(p_tipo_otro,'')),''),
    p_nivel,btrim(p_titulo),btrim(p_descripcion),auth.uid()
  )
  returning * into v_reg;

  if p_nivel in ('atencion','urgente') then
    select nombre into v_comunidad from public.comunidades where id=p_comunidad_id;

    insert into public.notificaciones(
      destinatario_id,tipo,titulo,mensaje,comunidad_id,bitacora_id
    )
    select
      p.id,
      case when p_nivel='urgente' then 'bitacora_urgente' else 'bitacora_atencion' end,
      case when p_nivel='urgente' then 'Bitácora urgente' else 'Bitácora requiere atención' end,
      v_comunidad || ' · ' || btrim(p_titulo),
      p_comunidad_id,
      v_reg.id
    from public.perfiles p
    where p.activo and p.rol::text='superadmin';
  end if;

  return v_reg;
end;
$$;

revoke all on function public.bitacora_crear(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.bitacora_crear(uuid,text,text,text,text,text) to authenticated;

alter table public.bitacora_tipos enable row level security;
alter table public.bitacora_registros enable row level security;
alter table public.bitacora_adjuntos enable row level security;
alter table public.notificaciones enable row level security;

drop policy if exists bitacora_tipos_lectura on public.bitacora_tipos;
create policy bitacora_tipos_lectura on public.bitacora_tipos
for select to authenticated using (activa);

drop policy if exists bitacora_registros_lectura on public.bitacora_registros;
create policy bitacora_registros_lectura on public.bitacora_registros
for select to authenticated using (public.bitacora_puede_ver_comunidad(comunidad_id));

drop policy if exists bitacora_adjuntos_lectura on public.bitacora_adjuntos;
create policy bitacora_adjuntos_lectura on public.bitacora_adjuntos
for select to authenticated using (public.bitacora_puede_ver_registro(bitacora_id));

drop policy if exists bitacora_adjuntos_insertar on public.bitacora_adjuntos;
create policy bitacora_adjuntos_insertar on public.bitacora_adjuntos
for insert to authenticated with check (
  exists(
    select 1 from public.bitacora_registros b
    where b.id=bitacora_id
      and (b.registrado_por=auth.uid() or public.es_admin())
  )
);

drop policy if exists notificaciones_propias_lectura on public.notificaciones;
create policy notificaciones_propias_lectura on public.notificaciones
for select to authenticated using (destinatario_id=auth.uid());

drop policy if exists notificaciones_propias_actualizar on public.notificaciones;
create policy notificaciones_propias_actualizar on public.notificaciones
for update to authenticated
using (destinatario_id=auth.uid())
with check (destinatario_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'bitacora','bitacora',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists bitacora_storage_leer on storage.objects;
create policy bitacora_storage_leer on storage.objects
for select to authenticated using (
  bucket_id='bitacora'
  and public.bitacora_puede_ver_registro(public.portal_texto_uuid((storage.foldername(name))[1]))
);

drop policy if exists bitacora_storage_subir on storage.objects;
create policy bitacora_storage_subir on storage.objects
for insert to authenticated with check (
  bucket_id='bitacora'
  and exists(
    select 1 from public.bitacora_registros b
    where b.id=public.portal_texto_uuid((storage.foldername(name))[1])
      and (b.registrado_por=auth.uid() or public.es_admin())
  )
);

drop policy if exists bitacora_storage_borrar on storage.objects;
create policy bitacora_storage_borrar on storage.objects
for delete to authenticated using (
  bucket_id='bitacora'
  and exists(
    select 1 from public.bitacora_registros b
    where b.id=public.portal_texto_uuid((storage.foldername(name))[1])
      and (b.registrado_por=auth.uid() or public.es_admin())
  )
);
