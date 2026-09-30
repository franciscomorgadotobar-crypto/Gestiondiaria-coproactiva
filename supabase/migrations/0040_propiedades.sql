-- 0040 — Propiedades en arriendo y venta.
--
-- Se administran desde la app (área Propiedades) y las publica el sitio
-- www.coproactiva.cl/propiedades. El sitio es estático, sin servidor: lee esta
-- tabla directo con la clave pública. Por eso toda la protección vive acá:
--
--   · anon solo ve las filas publicadas (RLS) y solo las columnas públicas
--     (permiso por columna). El propietario, su contacto, la dirección exacta
--     y las notas internas nunca salen de la app, aunque alguien consulte la
--     API a mano con la clave pública.
--   · Ver, crear y editar: superadmin, admin y jefatura activos, los mismos que
--     gestionan la operación. Eliminar: solo administración.
--   · Las fotos van a un bucket público para que el sitio las muestre sin
--     firmar URLs. Listar, subir, reemplazar y borrar queda para quienes
--     gestionan. Las rutas llevan un uuid, así que una foto no se adivina.

create type operacion_propiedad as enum ('arriendo', 'venta');

create type tipo_propiedad as enum (
  'departamento', 'casa', 'oficina', 'local', 'bodega', 'estacionamiento', 'terreno', 'parcela', 'otro'
);

-- Reservada, arrendada o vendida pueden seguir publicadas con su etiqueta; sacarla
-- del sitio es otra decisión (`publicada`).
create type estado_propiedad as enum ('disponible', 'reservada', 'arrendada', 'vendida');

create type moneda_propiedad as enum ('CLP', 'UF');

create sequence propiedades_codigo_seq;

create table propiedades (
  id                   uuid primary key default gen_random_uuid(),
  -- Código corto para hablar de la propiedad por WhatsApp o teléfono ("la P0012").
  -- Es también el identificador de la ficha en la URL pública del sitio.
  codigo               text not null unique
                         default 'P' || lpad(nextval('propiedades_codigo_seq')::text, 4, '0'),
  operacion            operacion_propiedad not null,
  tipo                 tipo_propiedad not null default 'departamento',
  estado               estado_propiedad not null default 'disponible',
  publicada            boolean not null default false,
  destacada            boolean not null default false,
  titulo               text not null check (char_length(trim(titulo)) between 3 and 120),
  descripcion          text,
  comuna               text,
  -- Referencia pública (barrio, calle cercana). La dirección exacta es privada.
  sector               text,
  direccion            text,
  -- En UF lleva decimales; en pesos se guarda sin ellos.
  precio               numeric(14, 2) check (precio >= 0),
  moneda               moneda_propiedad not null default 'CLP',
  gastos_comunes       integer check (gastos_comunes >= 0),
  dormitorios          smallint check (dormitorios between 0 and 50),
  banos                smallint check (banos between 0 and 50),
  superficie_util      numeric(10, 2) check (superficie_util >= 0),
  superficie_total     numeric(10, 2) check (superficie_total >= 0),
  estacionamientos     smallint check (estacionamientos between 0 and 50),
  bodegas              smallint check (bodegas between 0 and 50),
  amoblada             boolean not null default false,
  -- null: no se informa. No es lo mismo que "no se aceptan".
  mascotas             boolean,
  caracteristicas      text[] not null default '{}',
  -- [{ "ruta": "<propiedad>/<foto>.jpg", "mini": "<propiedad>/<foto>-m.jpg",
  --    "ancho": 1600, "alto": 1200 }]. La primera es la portada.
  fotos                jsonb not null default '[]'::jsonb check (jsonb_typeof(fotos) = 'array'),
  propietario_nombre   text,
  propietario_telefono text,
  propietario_email    text,
  notas_internas       text,
  publicada_en         timestamptz,
  creado_por           uuid default auth.uid() references perfiles (id) on delete set null,
  creado_en            timestamptz not null default now(),
  editado_en           timestamptz not null default now()
);

alter sequence propiedades_codigo_seq owned by propiedades.codigo;

comment on table propiedades is
  'Propiedades en arriendo o venta. Las publicadas las muestra www.coproactiva.cl/propiedades.';

-- El sitio pide siempre las publicadas de una operación, destacadas primero.
create index propiedades_sitio_idx on propiedades (operacion, destacada desc, publicada_en desc)
  where publicada;

-- ------------------------------------------------------------------ Triggers

-- La fecha de publicación ordena el sitio ("lo más nuevo primero"). Se marca
-- cada vez que la propiedad vuelve a publicarse, no al editar un texto.
create or replace function marcar_publicacion_propiedad()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.publicada and (tg_op = 'INSERT' or not old.publicada) then
    new.publicada_en = now();
  end if;
  return new;
end;
$fn$;

create trigger propiedades_publicacion
  before insert or update on propiedades
  for each row execute function marcar_publicacion_propiedad();

create trigger propiedades_editado_en
  before update on propiedades
  for each row execute function tocar_editado_en();

-- ----------------------------------------------------------------------- RLS

alter table propiedades enable row level security;

create policy propiedades_sitio on propiedades for select to anon
  using (publicada);

create policy propiedades_lectura on propiedades for select to authenticated
  using (usuario_puede_gestionar_operacion());

create policy propiedades_alta on propiedades for insert to authenticated
  with check (usuario_puede_gestionar_operacion());

create policy propiedades_edicion on propiedades for update to authenticated
  using (usuario_puede_gestionar_operacion())
  with check (usuario_puede_gestionar_operacion());

-- es_admin() no mira si el perfil está activo; la otra función sí.
create policy propiedades_borrado on propiedades for delete to authenticated
  using (usuario_puede_gestionar_operacion() and es_admin());

-- Supabase entrega todo a anon por defecto. Se quita y se devuelve solo la
-- lectura de lo que muestra el sitio: pedir una columna privada con la clave
-- pública responde "permission denied", no la columna vacía.
revoke all on table propiedades from anon;
grant select (
  id, codigo, operacion, tipo, estado, publicada, destacada, titulo, descripcion, comuna, sector,
  precio, moneda, gastos_comunes, dormitorios, banos, superficie_util, superficie_total,
  estacionamientos, bodegas, amoblada, mascotas, caracteristicas, fotos, publicada_en, editado_en
) on table propiedades to anon;

revoke all on sequence propiedades_codigo_seq from anon;
revoke all on function marcar_publicacion_propiedad() from public, anon;

-- -------------------------------------------------------------------- Fotos

-- 5 MB por archivo: la app las comprime antes de subir (1600 px, ~300 KB), el
-- tope solo ataja una subida que se saltó ese paso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propiedades', 'propiedades', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- El bucket público sirve cada archivo por su URL sin pasar por estas
-- políticas. Listar y reemplazar sí pasan por acá (subir con upsert y borrar
-- piden además lectura).
create policy propiedades_fotos_lectura on storage.objects for select to authenticated
  using (bucket_id = 'propiedades' and usuario_puede_gestionar_operacion());

create policy propiedades_fotos_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'propiedades' and usuario_puede_gestionar_operacion());

create policy propiedades_fotos_edicion on storage.objects for update to authenticated
  using (bucket_id = 'propiedades' and usuario_puede_gestionar_operacion())
  with check (bucket_id = 'propiedades' and usuario_puede_gestionar_operacion());

create policy propiedades_fotos_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'propiedades' and usuario_puede_gestionar_operacion());
