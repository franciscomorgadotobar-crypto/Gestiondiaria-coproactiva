\set ON_ERROR_STOP on
-- Solo PostgreSQL 17 efímero. Ningún dato ni usuario de Coproactiva.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.perfiles (id uuid PRIMARY KEY,nombre text NOT NULL);
INSERT INTO public.perfiles VALUES
 ('00000000-0000-0000-0000-000000000001','Nombre ficticio prueba');
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
CREATE VIEW public.controles_con_avance WITH (security_invoker=true)
 AS SELECT p.id,public.nombre_de_perfil(p.id) AS responsable_nombre FROM public.perfiles p;
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
