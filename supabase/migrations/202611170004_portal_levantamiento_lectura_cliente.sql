-- Portal: informe de levantamiento en solo lectura, aun sin PDF pre-generado.
-- Solo cliente con acceso a comunidad Y plantilla, o simulación administrativa autorizada.
-- No comparte los motivos/identidad de las excepciones de check-in.
CREATE OR REPLACE FUNCTION public.portal_levantamiento_detalle(
  p_control_id uuid, p_usuario_cliente uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $func$
DECLARE
  v_control record;
  v_items jsonb := '[]'::jsonb;
  v_adjuntos jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501';
  END IF;

  SELECT c.id, c.comunidad_id, c.plantilla_id, p.nombre AS plantilla_nombre,
         c.estado::text AS estado, c.periodo, c.creado_en, c.enviado_en,
         c.programado_para, c.observaciones
    INTO v_control
    FROM public.controles c
    JOIN public.plantillas_control p ON p.id=c.plantilla_id
   WHERE c.id=p_control_id AND c.estado::text <> 'anulado';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Levantamiento no disponible' USING ERRCODE='P0002';
  END IF;

  IF p_usuario_cliente IS NULL THEN
    IF public.mi_rol()::text IS DISTINCT FROM 'cliente'
       OR NOT public.cliente_puede_ver_plantilla(v_control.comunidad_id,v_control.plantilla_id) THEN
      RAISE EXCEPTION 'No tienes acceso a este levantamiento' USING ERRCODE='42501';
    END IF;
  ELSE
    IF public.mi_rol()::text NOT IN ('superadmin','admin','jefatura')
       OR NOT public.vista_cliente_puede_ver_plantilla(
          v_control.comunidad_id,v_control.plantilla_id,p_usuario_cliente
       ) THEN
      RAISE EXCEPTION 'No puedes simular esta cuenta o plantilla' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',i.id, 'grupo',i.grupo, 'texto',i.texto,
      'orden',i.orden, 'estado',i.estado::text,
      'nota',i.nota, 'tipo_ingreso',i.tipo_ingreso::text, 'respuesta',i.respuesta
    ) ORDER BY i.grupo,i.orden,i.id
  ),'[]'::jsonb)
  INTO v_items
  FROM public.control_items i WHERE i.control_id=p_control_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',a.id,'control_item_id',a.control_item_id,
      'storage_path',a.storage_path,'nombre',a.nombre_original,
      'mime',a.mime,'descripcion',a.descripcion,
      'clase',a.clase::text,'criterio_id',a.criterio_id,'orden',a.orden
    ) ORDER BY a.orden NULLS LAST,a.creado_en,a.id
  ),'[]'::jsonb)
  INTO v_adjuntos
  FROM public.adjuntos a
  WHERE a.control_id=p_control_id AND a.storage_path IS NOT NULL;

  RETURN jsonb_build_object(
    'levantamiento', jsonb_build_object(
       'id',v_control.id,'comunidad_id',v_control.comunidad_id,
       'plantilla_nombre',v_control.plantilla_nombre,
       'estado',v_control.estado,'periodo',v_control.periodo,
       'creado_en',v_control.creado_en,'enviado_en',v_control.enviado_en,
       'programado_para',v_control.programado_para,
       'observaciones',v_control.observaciones
    ),
    'items',v_items,'adjuntos',v_adjuntos
  );
END
$func$;
REVOKE ALL ON FUNCTION public.portal_levantamiento_detalle(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_levantamiento_detalle(uuid,uuid) TO authenticated;

-- Solo permite firmar URLs del bucket evidencia para adjuntos asociados
-- a una plantilla específicamente visible para la cuenta de cliente.
-- No habilita lectura directa de tablas de operación internas.
CREATE OR REPLACE FUNCTION public.cliente_puede_ver_evidencia_levantamiento(p_ruta text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$
  SELECT auth.uid() IS NOT NULL
     AND public.mi_rol()::text = 'cliente'
     AND EXISTS (
       SELECT 1 FROM public.adjuntos a
       JOIN public.controles c ON c.id=a.control_id
       WHERE a.storage_path=p_ruta
         AND c.estado::text<>'anulado'
         AND public.cliente_puede_ver_plantilla(c.comunidad_id,c.plantilla_id)
     );
$func$;
REVOKE ALL ON FUNCTION public.cliente_puede_ver_evidencia_levantamiento(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cliente_puede_ver_evidencia_levantamiento(text) TO authenticated;

DROP POLICY IF EXISTS evidencia_cliente_plantilla_visible ON storage.objects;
CREATE POLICY evidencia_cliente_plantilla_visible
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='evidencia' AND public.cliente_puede_ver_evidencia_levantamiento(name));

-- Compatibilidad con clientes que conservan temporalmente la PWA anterior:
-- nunca exponer motivos o autorizadores de excepciones al perfil cliente.
-- La función heredada puede seguir usándose solo para simulación administrativa.
CREATE OR REPLACE FUNCTION public.checkins_administrativos_visibles(
 p_comunidad_id uuid, p_usuario_cliente uuid DEFAULT NULL
)
RETURNS TABLE(control_id uuid,autorizado_en timestamptz,motivo text,autorizado_por_nombre text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $func$
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501';
 END IF;
 IF p_usuario_cliente IS NULL THEN
   RETURN; -- No se divulgan excepciones administrativas al portal cliente.
 END IF;
 IF public.mi_rol()::text NOT IN ('superadmin','admin','jefatura')
    OR NOT public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) THEN
   RAISE EXCEPTION 'No tienes acceso a esta vista' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT e.control_id,e.autorizado_en,e.motivo,
        COALESCE(NULLIF(btrim(p.nombre),''),'Administración')::text
 FROM public.control_checkin_excepciones e
 JOIN public.controles c ON c.id=e.control_id
 LEFT JOIN public.perfiles p ON p.id=e.autorizado_por
 WHERE c.comunidad_id=p_comunidad_id AND c.estado::text<>'anulado'
   AND public.vista_cliente_puede_ver_plantilla(
     c.comunidad_id,c.plantilla_id,p_usuario_cliente
   )
 ORDER BY e.autorizado_en DESC;
END
$func$;
REVOKE ALL ON FUNCTION public.checkins_administrativos_visibles(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checkins_administrativos_visibles(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
