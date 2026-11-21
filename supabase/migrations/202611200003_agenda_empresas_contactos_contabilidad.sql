-- Agenda: empresas y personas identificadas como proveedores de forma individual.
-- Conserva las fichas y los asientos contables previos.
ALTER TABLE public.proveedores
 ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'empresa',
 ADD COLUMN IF NOT EXISTS es_proveedor boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS contacto_id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN IF NOT EXISTS contacto_es_proveedor boolean NOT NULL DEFAULT false;
ALTER TABLE public.proveedores DROP CONSTRAINT IF EXISTS proveedores_tipo_registro_agenda_ck;
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_tipo_registro_agenda_ck
 CHECK (tipo_registro IN ('empresa','contacto'));

UPDATE public.proveedores p
 SET contactos=(
 SELECT coalesce(jsonb_agg(
 CASE WHEN jsonb_typeof(item.value)='object' THEN item.value ||
  jsonb_build_object('id',coalesce(nullif(item.value->>'id',''),gen_random_uuid()::text),
    'es_proveedor',coalesce(item.value->>'es_proveedor','false')='true')
 ELSE item.value END ORDER BY item.ordinality
 ),'[]'::jsonb)
 FROM jsonb_array_elements(p.contactos) WITH ORDINALITY item(value,ordinality))
 WHERE jsonb_array_length(p.contactos)>0 AND EXISTS (
 SELECT 1 FROM jsonb_array_elements(p.contactos) item
 WHERE jsonb_typeof(item)='object' AND
 (coalesce(item->>'id','')='' OR NOT item ? 'es_proveedor')
 );
CREATE INDEX IF NOT EXISTS proveedores_agenda_proveedor_idx ON public.proveedores(es_proveedor) WHERE es_proveedor=true;
ALTER TABLE public.contabilidad_asientos
 ADD COLUMN IF NOT EXISTS proveedor_contacto_id uuid,
 ADD COLUMN IF NOT EXISTS proveedor_etiqueta text;
ALTER TABLE public.contabilidad_asientos DROP CONSTRAINT IF EXISTS contabilidad_proveedor_contacto_padre_ck;
ALTER TABLE public.contabilidad_asientos ADD CONSTRAINT contabilidad_proveedor_contacto_padre_ck
 CHECK (proveedor_contacto_id IS NULL OR proveedor_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.agenda_marcar_proveedor(p_registro_id uuid, p_contacto_id uuid DEFAULT NULL::uuid, p_marcar boolean DEFAULT true)
 RETURNS proveedores
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE p public.proveedores; v_contactos jsonb;
BEGIN
 IF NOT public.es_admin() THEN
   RAISE EXCEPTION 'No tienes permiso para actualizar la agenda.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM public.proveedores WHERE id=p_registro_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro no encontrado.'; END IF;
 IF p.lista_negra AND p_marcar THEN
   RAISE EXCEPTION 'No puedes habilitar un registro en lista negra como proveedor.';
 END IF;

 IF p_contacto_id IS NULL THEN
   UPDATE public.proveedores
      SET es_proveedor=coalesce(p_marcar,false), editado_en=now(),editado_por=auth.uid()
    WHERE id=p_registro_id RETURNING * INTO p;
 ELSIF p_contacto_id=p.contacto_id AND p.tipo_registro='empresa' THEN
   IF btrim(coalesce(p.contacto_nombre,''))='' AND p_marcar THEN
     RAISE EXCEPTION 'El contacto principal no tiene nombre.';
   END IF;
   UPDATE public.proveedores
      SET contacto_es_proveedor=coalesce(p_marcar,false),editado_en=now(),editado_por=auth.uid()
    WHERE id=p_registro_id RETURNING * INTO p;
 ELSE
   IF NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(p.contactos) c
     WHERE c->>'id'=p_contacto_id::text
   ) THEN RAISE EXCEPTION 'El contacto no existe en esta empresa.'; END IF;
   SELECT coalesce(jsonb_agg(
     CASE WHEN c->>'id'=p_contacto_id::text
       THEN jsonb_set(c,'{es_proveedor}',to_jsonb(coalesce(p_marcar,false)),true)
       ELSE c END ORDER BY pos
   ),'[]'::jsonb)
   INTO v_contactos
   FROM jsonb_array_elements(p.contactos) WITH ORDINALITY AS t(c,pos);
   UPDATE public.proveedores
      SET contactos=v_contactos,editado_en=now(),editado_por=auth.uid()
    WHERE id=p_registro_id RETURNING * INTO p;
 END IF;
 RETURN p;
END;
$function$

REVOKE ALL ON FUNCTION public.agenda_marcar_proveedor(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agenda_marcar_proveedor(uuid,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.contabilidad_registrar_asiento_agenda(p_entidad_id uuid, p_fecha date, p_glosa text, p_lineas jsonb, p_referencia text DEFAULT NULL::text, p_proveedor_id uuid DEFAULT NULL::uuid, p_contacto_id uuid DEFAULT NULL::uuid, p_numero integer DEFAULT NULL::integer, p_recurrente boolean DEFAULT false)
 RETURNS contabilidad_asientos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE p public.proveedores; a public.contabilidad_asientos; v_etiqueta text;
BEGIN
 IF NOT public.es_admin() THEN
   RAISE EXCEPTION 'No tienes permiso para contabilizar asientos.' USING ERRCODE='42501';
 END IF;
 IF p_contacto_id IS NOT NULL AND p_proveedor_id IS NULL THEN
   RAISE EXCEPTION 'El contacto necesita una ficha de Agenda asociada.';
 END IF;
 IF p_proveedor_id IS NOT NULL THEN
   SELECT * INTO p FROM public.proveedores WHERE id=p_proveedor_id;
   IF NOT FOUND OR p.lista_negra THEN
     RAISE EXCEPTION 'El proveedor seleccionado no está disponible.';
   END IF;
   IF p_contacto_id IS NULL THEN
     IF NOT p.es_proveedor THEN
       RAISE EXCEPTION 'Marca la empresa o persona como proveedor en Agenda.';
     END IF;
     v_etiqueta=coalesce(nullif(btrim(p.empresa),''),'Proveedor');
   ELSIF p_contacto_id=p.contacto_id AND p.tipo_registro='empresa' THEN
     IF NOT p.contacto_es_proveedor OR btrim(coalesce(p.contacto_nombre,''))='' THEN
       RAISE EXCEPTION 'El contacto principal no está marcado como proveedor.';
     END IF;
     v_etiqueta=p.contacto_nombre || ' · ' || p.empresa;
   ELSE
     SELECT coalesce(nullif(btrim(c->>'nombre'),''),nullif(btrim(c->>'email'),''),nullif(btrim(c->>'telefono'),'')) || ' · ' || p.empresa
       INTO v_etiqueta FROM jsonb_array_elements(p.contactos) c
      WHERE c->>'id'=p_contacto_id::text
        AND c->>'es_proveedor'='true'
      LIMIT 1;
     IF v_etiqueta IS NULL THEN
       RAISE EXCEPTION 'El contacto no está marcado como proveedor.';
     END IF;
   END IF;
 END IF;

 SELECT * INTO a FROM public.contabilidad_registrar_asiento_con_recurrencia(
  p_entidad_id=>p_entidad_id,p_fecha=>p_fecha,p_glosa=>p_glosa,
  p_lineas=>p_lineas,p_referencia=>p_referencia,p_proveedor_id=>p_proveedor_id,
  p_numero=>p_numero,p_recurrente=>p_recurrente);
 IF p_proveedor_id IS NOT NULL THEN
   UPDATE public.contabilidad_asientos
   SET proveedor_contacto_id=p_contacto_id,proveedor_etiqueta=v_etiqueta
   WHERE id=a.id RETURNING * INTO a;
 END IF;
 RETURN a;
END;
$function$

REVOKE ALL ON FUNCTION public.contabilidad_registrar_asiento_agenda(uuid,date,text,jsonb,text,uuid,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contabilidad_registrar_asiento_agenda(uuid,date,text,jsonb,text,uuid,uuid,integer,boolean) TO authenticated;
