-- Registrar y reutilizar asientos recurrentes; nunca contabilizar de forma programada.
-- Migración aplicada a producción Supabase el 20-11-2026.
ALTER TABLE public.contabilidad_asientos
 ADD COLUMN IF NOT EXISTS recurrente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contabilidad_asientos_recurrentes_idx
 ON public.contabilidad_asientos(entidad_id,fecha DESC,numero DESC)
 WHERE recurrente=true AND estado='contabilizado';

CREATE OR REPLACE FUNCTION public.contabilidad_registrar_asiento_con_recurrencia(
 p_entidad_id uuid,
 p_fecha date,
 p_glosa text,
 p_lineas jsonb,
 p_referencia text DEFAULT NULL,
 p_proveedor_id uuid DEFAULT NULL,
 p_numero integer DEFAULT NULL,
 p_recurrente boolean DEFAULT false
) RETURNS public.contabilidad_asientos
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $func$
DECLARE
 v_asiento public.contabilidad_asientos;
BEGIN
 IF NOT public.es_admin() THEN
  RAISE EXCEPTION 'No tienes permiso para registrar asientos.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_asiento
 FROM public.contabilidad_registrar_asiento(
   p_entidad_id=>p_entidad_id,
   p_fecha=>p_fecha,
   p_glosa=>p_glosa,
   p_lineas=>p_lineas,
   p_origen=>'manual',
   p_referencia=>p_referencia,
   p_proveedor_id=>p_proveedor_id,
   p_origen_id=>NULL::uuid,
   p_numero=>p_numero
 );
 UPDATE public.contabilidad_asientos
 SET recurrente=COALESCE(p_recurrente,false)
 WHERE id=v_asiento.id
 RETURNING * INTO v_asiento;
 RETURN v_asiento;
END
$func$;
REVOKE ALL ON FUNCTION public.contabilidad_registrar_asiento_con_recurrencia(uuid,date,text,jsonb,text,uuid,integer,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contabilidad_registrar_asiento_con_recurrencia(uuid,date,text,jsonb,text,uuid,integer,boolean)
 TO authenticated;
