\set ON_ERROR_STOP on
-- Solo PostgreSQL 17 efímero. Ningún dato ni usuario de Coproactiva.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT nullif(current_setting('request.jwt.claim.role',true),'');
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.perfiles (
 id uuid PRIMARY KEY,nombre text NOT NULL,rol text NOT NULL,activo boolean NOT NULL DEFAULT true
);
INSERT INTO public.perfiles (id,nombre,rol,activo) VALUES
 ('00000000-0000-0000-0000-000000000001','Nombre ficticio prueba','terreno',true),
 ('00000000-0000-0000-0000-000000000002','Otro técnico prueba','terreno',true),
 ('00000000-0000-0000-0000-000000000003','Administrador prueba','admin',true),
 ('00000000-0000-0000-0000-000000000004','Cliente prueba','cliente',true),
 ('00000000-0000-0000-0000-000000000005','Técnico inactivo','terreno',false);
CREATE TABLE public.comunidades(id uuid PRIMARY KEY,nombre text);
INSERT INTO public.comunidades VALUES('10000000-0000-0000-0000-000000000001','Comunidad ficticia');
CREATE TABLE public.perfil_comunidades(perfil_id uuid,comunidad_id uuid);
INSERT INTO public.perfil_comunidades VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
CREATE TABLE public.controles(id uuid PRIMARY KEY,comunidad_id uuid,responsable_id uuid);
INSERT INTO public.controles VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000002');
CREATE OR REPLACE FUNCTION public.mi_rol() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.rol FROM public.perfiles p WHERE p.id=auth.uid() AND p.activo;
$$;
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(public.mi_rol() IN ('admin','superadmin'),false);
$$;
CREATE OR REPLACE FUNCTION public.ve_comunidad(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.mi_rol() IS NOT NULL AND
 (public.es_admin() OR EXISTS
  (SELECT 1 FROM public.perfil_comunidades pc
   WHERE pc.perfil_id=auth.uid() AND pc.comunidad_id=cid));
$$;
CREATE OR REPLACE FUNCTION public.ve_control(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.mi_rol() IS NOT NULL AND EXISTS
 (SELECT 1 FROM public.controles c
  WHERE c.id=cid AND public.ve_comunidad(c.comunidad_id));
$$;
CREATE FUNCTION public.nombre_de_perfil(pid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT nombre FROM perfiles WHERE id=pid;
$$;
REVOKE EXECUTE ON FUNCTION public.nombre_de_perfil(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nombre_de_perfil(uuid) TO anon,authenticated,service_role;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY perfiles_propias_lectura ON public.perfiles FOR SELECT
 TO authenticated USING (id=auth.uid());
GRANT SELECT ON public.perfiles TO authenticated,anon;
ALTER TABLE public.controles ENABLE ROW LEVEL SECURITY;
CREATE POLICY controles_autorizados ON public.controles FOR SELECT
 TO authenticated USING (public.ve_control(id));
GRANT SELECT ON public.controles TO authenticated,anon;
CREATE VIEW public.controles_con_avance WITH (security_invoker=true)
 AS SELECT c.id,public.nombre_de_perfil(c.responsable_id) AS responsable_nombre
 FROM public.controles c;
GRANT SELECT ON public.controles_con_avance TO authenticated,anon;
CREATE TABLE public.auditoria_eventos(id integer PRIMARY KEY,paso integer NOT NULL DEFAULT 0);
GRANT INSERT,SELECT ON public.auditoria_eventos TO authenticated;
CREATE OR REPLACE FUNCTION public.bitacora_asignar_correlativo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bitacora_asignar_correlativo() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_1 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.bitacora_asignar_correlativo();

CREATE OR REPLACE FUNCTION public.contabilidad_actualizar_padre() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.contabilidad_actualizar_padre() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_2 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.contabilidad_actualizar_padre();

CREATE OR REPLACE FUNCTION public.contabilidad_proteger_cuenta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.contabilidad_proteger_cuenta() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_3 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.contabilidad_proteger_cuenta();

CREATE OR REPLACE FUNCTION public.crear_alerta_base_mantenimiento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crear_alerta_base_mantenimiento() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_4 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.crear_alerta_base_mantenimiento();

CREATE OR REPLACE FUNCTION public.proteger_email_perfil() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.proteger_email_perfil() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_5 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.proteger_email_perfil();

CREATE OR REPLACE FUNCTION public.proteger_email_perfil_propio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.paso := NEW.paso + 1;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.proteger_email_perfil_propio() TO anon, authenticated, service_role;
CREATE TRIGGER auditoria_trigger_6 BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION public.proteger_email_perfil_propio();

DO $$
BEGIN
 IF NOT has_function_privilege('anon','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: modelo previo anon no puede leer nombre'; END IF;
 IF NOT has_function_privilege('authenticated','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: modelo previo auth no puede leer nombre'; END IF;
 RAISE NOTICE 'PASS: vulnerabilidad anon reproducida en entorno ficticio';
END;
$$;
