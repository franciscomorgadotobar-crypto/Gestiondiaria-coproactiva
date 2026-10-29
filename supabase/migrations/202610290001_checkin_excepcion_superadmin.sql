-- Excepción administrativa de check-in (sin falsificar GPS ni hora de visita).
-- Aplicada en Supabase; solo un superadministrador puede autorizarla.
CREATE TABLE IF NOT EXISTS public.control_checkin_excepciones (
 control_id uuid PRIMARY KEY REFERENCES public.controles(id) ON DELETE CASCADE,
 autorizado_por uuid NOT NULL REFERENCES auth.users(id),
 autorizado_en timestamptz NOT NULL DEFAULT now(),
 motivo text NOT NULL,
 CONSTRAINT control_checkin_excepciones_motivo_valido
 CHECK(char_length(btrim(motivo)) BETWEEN 12 AND 500)
);
ALTER TABLE public.control_checkin_excepciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.control_checkin_excepciones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.control_checkin_excepciones TO authenticated;
DROP POLICY IF EXISTS control_checkin_excepciones_lectura ON public.control_checkin_excepciones;
CREATE POLICY control_checkin_excepciones_lectura ON public.control_checkin_excepciones
 FOR SELECT TO authenticated
 USING (public.mi_rol() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.controles c WHERE c.id=control_id
 ));
CREATE OR REPLACE FUNCTION public.autorizar_control_sin_checkin(p_control_id uuid,p_motivo text)
RETURNS TABLE(control_id uuid,autorizado_en timestamptz,autorizado_por uuid,motivo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_control public.controles%ROWTYPE;
        v_motivo text:=btrim(coalesce(p_motivo,''));
BEGIN
 IF auth.uid() IS NULL OR public.mi_rol()::text IS DISTINCT FROM 'superadmin' THEN
  RAISE EXCEPTION 'Solo un superadministrador puede autorizar esta excepción' USING ERRCODE='42501';
 END IF;
 IF length(v_motivo)<12 OR length(v_motivo)>500 THEN
  RAISE EXCEPTION 'El motivo debe contener entre 12 y 500 caracteres' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_control FROM public.controles c WHERE c.id=p_control_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'El levantamiento no existe' USING ERRCODE='P0002';
 END IF;
 IF v_control.estado::text IN ('enviado','anulado') THEN
  RAISE EXCEPTION 'No se puede autorizar un levantamiento cerrado' USING ERRCODE='22023';
 END IF;
 IF v_control.es_diagnostico THEN
  RAISE EXCEPTION 'Esta excepción es solo para levantamientos de terreno' USING ERRCODE='22023';
 END IF;
 IF v_control.checkin_en IS NOT NULL THEN
  RAISE EXCEPTION 'Este levantamiento ya tiene un check-in real' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.control_checkin_excepciones(control_id,autorizado_por,motivo)
 VALUES(p_control_id,auth.uid(),v_motivo)
 ON CONFLICT(control_id) DO NOTHING;
 RETURN QUERY SELECT c.control_id,c.autorizado_en,c.autorizado_por,c.motivo
 FROM public.control_checkin_excepciones c WHERE c.control_id=p_control_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) TO authenticated;
