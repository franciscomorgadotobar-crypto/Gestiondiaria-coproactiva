-- Los contactos descubiertos por Gmail reciben UUID y no se convierten
-- en proveedores hasta que alguien los marque expresamente en Agenda.
CREATE OR REPLACE FUNCTION public.agenda_normalizar_contactos_json()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item jsonb; v_anterior jsonb; v_clave text; v_id text; v_flag boolean;
        v_sal jsonb:='[]'::jsonb;
BEGIN
 IF jsonb_typeof(new.contactos) IS DISTINCT FROM 'array' THEN new.contactos='[]'::jsonb; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(new.contactos) LOOP
   IF jsonb_typeof(v_item)<>'object' THEN CONTINUE; END IF;
   v_clave=lower(btrim(coalesce(nullif(v_item->>'email',''),nullif(v_item->>'telefono',''),nullif(v_item->>'nombre',''),'')));
   v_anterior=NULL;
   IF TG_OP='UPDATE' AND v_clave<>'' THEN
     SELECT c INTO v_anterior
     FROM jsonb_array_elements(old.contactos) c
     WHERE lower(btrim(coalesce(nullif(c->>'email',''),nullif(c->>'telefono',''),nullif(c->>'nombre',''),'')))=v_clave
     LIMIT 1;
   END IF;
   v_id=coalesce(nullif(v_item->>'id',''),nullif(v_anterior->>'id',''),gen_random_uuid()::text);
   v_flag=case when v_item ? 'es_proveedor'
      THEN v_item->>'es_proveedor'='true'
      WHEN v_anterior IS NOT NULL THEN v_anterior->>'es_proveedor'='true'
      ELSE false END;
   v_sal=v_sal||jsonb_build_array(v_item || jsonb_build_object('id',v_id,'es_proveedor',v_flag));
 END LOOP;
 new.contactos=v_sal;
 RETURN new;
END;$function$

DROP TRIGGER IF EXISTS agenda_contactos_normalizados ON public.proveedores;
CREATE TRIGGER agenda_contactos_normalizados BEFORE INSERT OR UPDATE OF contactos
 ON public.proveedores FOR EACH ROW EXECUTE FUNCTION public.agenda_normalizar_contactos_json();
