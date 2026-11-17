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
 ON CONFLICT(control_id) DO NOTHING;
 RETURN QUERY SELECT c.control_id,c.autorizado_en,c.autorizado_por,c.motivo
 FROM public.control_checkin_excepciones c WHERE c.control_id=p_control_id;
END;
$$;
REVOKE ALL ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_control_sin_checkin(uuid,text) TO authenticated;

-- Se consultan únicamente excepciones de levantamientos habilitados
-- explícitamente en el portal de la cuenta cliente correspondiente.
-- La simulación administrativa exige asociación activa del cliente y permisos de admin.
CREATE OR REPLACE FUNCTION public.checkins_administrativos_visibles(
 p_comunidad_id uuid,
 p_usuario_cliente uuid DEFAULT NULL
)
RETURNS TABLE(control_id uuid,autorizado_en timestamptz,motivo text,autorizado_por_nombre text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501';
 END IF;
 IF p_usuario_cliente IS NULL THEN
   IF NOT public.cliente_puede_ver_comunidad(p_comunidad_id) THEN
     RAISE EXCEPTION 'No tienes acceso a esta comunidad' USING ERRCODE='42501';
   END IF;
 ELSE
   IF NOT public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) THEN
     RAISE EXCEPTION 'No tienes acceso a la vista de esta cuenta' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN QUERY
 SELECT e.control_id,e.autorizado_en,e.motivo,
        coalesce(nullif(btrim(p.nombre),''),'Administración')::text
 FROM public.control_checkin_excepciones e
 JOIN public.controles c ON c.id=e.control_id
 LEFT JOIN public.perfiles p ON p.id=e.autorizado_por
 WHERE c.comunidad_id=p_comunidad_id
   AND c.estado::text<>'anulado'
   AND CASE
     WHEN p_usuario_cliente IS NULL THEN
       public.cliente_puede_ver_plantilla(c.comunidad_id,c.plantilla_id)
     ELSE
       public.vista_cliente_puede_ver_plantilla(c.comunidad_id,c.plantilla_id,p_usuario_cliente)
   END
 ORDER BY e.autorizado_en DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.checkins_administrativos_visibles(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checkins_administrativos_visibles(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
