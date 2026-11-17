-- Corrección de error P42702/42702: output parameter control_id ambiguo al usar ON CONFLICT(control_id).
-- La restricción nombrada elimina la ambigüedad sin alterar la validación de acceso,
-- la trazabilidad, las coordenadas GPS ni los registros existentes.
-- Control de excepción administrativa con trazabilidad, sin suplantar GPS.
-- Compatible con levantamientos abiertos y cerrados (enviado) para regularización retrospectiva.
-- La autorización la realiza exclusivamente superadmin; no crea checkin_en ni coordenadas.

CREATE OR REPLACE FUNCTION public.autorizar_control_sin_checkin(p_control_id uuid,p_motivo text)
RETURNS TABLE(control_id uuid,autorizado_en timestamptz,autorizado_por uuid,motivo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_control public.controles%ROWTYPE;
 v_motivo text := btrim(coalesce(p_motivo,''));
BEGIN
 IF auth.uid() IS NULL OR public.mi_rol()::text IS DISTINCT FROM 'superadmin' THEN
   RAISE EXCEPTION 'Solo un superadministrador puede registrar este check-in administrativo'
     USING ERRCODE='42501';
 END IF;
 IF length(v_motivo) < 12 OR length(v_motivo) > 500 THEN
   RAISE EXCEPTION 'El motivo debe contener entre 12 y 500 caracteres' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_control FROM public.controles c WHERE c.id=p_control_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'El levantamiento no existe' USING ERRCODE='P0002';
 END IF;
 IF v_control.estado::text='anulado' THEN
   RAISE EXCEPTION 'No se puede autorizar un levantamiento anulado' USING ERRCODE='22023';
 END IF;
 IF v_control.es_diagnostico IS TRUE THEN
   RAISE EXCEPTION 'La excepción solo aplica a levantamientos de terreno' USING ERRCODE='22023';
 END IF;
 IF v_control.checkin_en IS NOT NULL THEN
   RAISE EXCEPTION 'Ya existe un check-in GPS real para este levantamiento' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.control_checkin_excepciones(control_id,autorizado_por,motivo)
 VALUES(p_control_id,auth.uid(),v_motivo)
 ON CONFLICT ON CONSTRAINT control_checkin_excepciones_pkey DO NOTHING;
 RETURN QUERY SELECT c.control_id,c.autorizado_en,c.autorizado_por,c.motivo
 FROM public.control_checkin_excepciones c WHERE c.control_id=p_control_id;
END;
$$;
REVOKE ALL ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) TO authenticated;
