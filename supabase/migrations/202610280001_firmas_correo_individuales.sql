-- Firmas de correo individuales y logos. Aplicada a producción el 28-10-2026.
-- Un usuario solo puede administrar su propia firma; los logos se publican como
-- imagen corporativa para que los clientes de correo puedan mostrarlos.
CREATE TABLE IF NOT EXISTS public.firmas_correo (
 usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 nombre text NOT NULL DEFAULT '',
 cargo text NOT NULL DEFAULT '',
 empresa text NOT NULL DEFAULT 'Coproactiva Administración SpA',
 telefono text NOT NULL DEFAULT '',
 correo text NOT NULL DEFAULT 'contacto@coproactiva.cl',
 web text NOT NULL DEFAULT 'www.coproactiva.cl',
 texto_adicional text NOT NULL DEFAULT '',
 logo_path text,
 activa boolean NOT NULL DEFAULT true,
 actualizada_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT firmas_correo_nombre_len CHECK(length(nombre)<=120),
 CONSTRAINT firmas_correo_cargo_len CHECK(length(cargo)<=120),
 CONSTRAINT firmas_correo_empresa_len CHECK(length(empresa)<=140),
 CONSTRAINT firmas_correo_telefono_len CHECK(length(telefono)<=60),
 CONSTRAINT firmas_correo_correo_len CHECK(length(correo)<=150),
 CONSTRAINT firmas_correo_web_len CHECK(length(web)<=150),
 CONSTRAINT firmas_correo_texto_len CHECK(length(texto_adicional)<=750),
 CONSTRAINT firmas_correo_logo_seguro CHECK(
  logo_path IS NULL OR logo_path ~ ('^'||usuario_id::text||'/logo[.](png|jpg|webp)$'))
);
ALTER TABLE public.firmas_correo ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firmas_correo TO authenticated;
DROP POLICY IF EXISTS firmas_correo_propietario_lectura ON public.firmas_correo;
DROP POLICY IF EXISTS firmas_correo_propietario_insertar ON public.firmas_correo;
DROP POLICY IF EXISTS firmas_correo_propietario_editar ON public.firmas_correo;
DROP POLICY IF EXISTS firmas_correo_propietario_borrar ON public.firmas_correo;
CREATE POLICY firmas_correo_propietario_lectura ON public.firmas_correo FOR SELECT TO authenticated USING(usuario_id=(select auth.uid()));
CREATE POLICY firmas_correo_propietario_insertar ON public.firmas_correo FOR INSERT TO authenticated WITH CHECK(usuario_id=(select auth.uid()));
CREATE POLICY firmas_correo_propietario_editar ON public.firmas_correo FOR UPDATE TO authenticated USING(usuario_id=(select auth.uid())) WITH CHECK(usuario_id=(select auth.uid()));
CREATE POLICY firmas_correo_propietario_borrar ON public.firmas_correo FOR DELETE TO authenticated USING(usuario_id=(select auth.uid()));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('firmas-correo','firmas-correo',true,500000,ARRAY['image/png','image/jpeg','image/webp']::text[])
ON CONFLICT(id) DO UPDATE SET public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS firmas_correo_logo_insertar ON storage.objects;
DROP POLICY IF EXISTS firmas_correo_logo_leer ON storage.objects;
DROP POLICY IF EXISTS firmas_correo_logo_actualizar ON storage.objects;
DROP POLICY IF EXISTS firmas_correo_logo_eliminar ON storage.objects;
CREATE POLICY firmas_correo_logo_insertar ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='firmas-correo' AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND name ~ ('^'||(select auth.uid())::text||'/logo[.](png|jpg|webp)$'));
CREATE POLICY firmas_correo_logo_leer ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='firmas-correo' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY firmas_correo_logo_actualizar ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='firmas-correo' AND (storage.foldername(name))[1]=(select auth.uid())::text)
 WITH CHECK(bucket_id='firmas-correo' AND name ~ ('^'||(select auth.uid())::text||'/logo[.](png|jpg|webp)$'));
CREATE POLICY firmas_correo_logo_eliminar ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='firmas-correo' AND (storage.foldername(name))[1]=(select auth.uid())::text);
