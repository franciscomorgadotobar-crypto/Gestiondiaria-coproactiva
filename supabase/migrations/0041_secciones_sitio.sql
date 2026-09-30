-- 0041 — Interruptor de secciones del sitio.
--
-- Administración muestra u oculta desde la app una sección completa de
-- www.coproactiva.cl (hoy, Propiedades) sin volver a publicar el sitio. El
-- sitio lee esta tabla con la clave pública: si la sección está apagada no
-- muestra su enlace en el menú y la página avisa que no está disponible.
--
-- Apagada también cierra la API: anon deja de leer propiedades aunque haya
-- publicadas. Así "oculta" significa oculta, no solo fuera del menú.

create table secciones_sitio (
  seccion     text primary key,
  visible     boolean not null default false,
  editado_por uuid default auth.uid() references perfiles (id) on delete set null,
  editado_en  timestamptz not null default now()
);

comment on table secciones_sitio is
  'Secciones de www.coproactiva.cl que administración muestra u oculta desde la app.';

-- Parte apagada: el sitio no cambia hasta que alguien la encienda.
insert into secciones_sitio (seccion, visible) values ('propiedades', false);

-- Quién y cuándo la cambió: lo fija la base, no lo que mande el navegador.
create or replace function marcar_edicion_seccion()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.editado_en = now();
  new.editado_por = auth.uid();
  return new;
end;
$fn$;

create trigger secciones_sitio_edicion
  before update on secciones_sitio
  for each row execute function marcar_edicion_seccion();

alter table secciones_sitio enable row level security;

create policy secciones_sitio_lectura on secciones_sitio for select to anon, authenticated
  using (true);

-- Encender o apagar una sección del sitio es de administración, como
-- eliminar una propiedad. Las filas las crea una migración: no hay alta ni
-- baja desde la app.
create policy secciones_sitio_edicion on secciones_sitio for update to authenticated
  using (usuario_puede_gestionar_operacion() and es_admin())
  with check (usuario_puede_gestionar_operacion() and es_admin());

revoke all on table secciones_sitio from anon;
grant select (seccion, visible) on table secciones_sitio to anon;
revoke insert, delete, truncate on table secciones_sitio from authenticated;
revoke all on function marcar_edicion_seccion() from public, anon;

-- Propiedades: el sitio lee solo las publicadas y solo con la sección encendida.
drop policy propiedades_sitio on propiedades;
create policy propiedades_sitio on propiedades for select to anon
  using (
    publicada
    and exists (select 1 from secciones_sitio s where s.seccion = 'propiedades' and s.visible)
  );
