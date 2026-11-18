-- Reusar el informe existente del equipo en el portal, solo lectura.
-- Añade metadatos de presentación después de validar rol, comunidad y plantilla.
-- Sin ampliar los permisos ni devolver excepciones internas de GPS.
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
         c.programado_para, c.observaciones,
         co.nombre AS comunidad_nombre, co.direccion AS comunidad_direccion,
         co.comuna AS comunidad_comuna, per.nombre AS responsable_nombre
    INTO v_control
    FROM public.controles c
    JOIN public.plantillas_control p ON p.id=c.plantilla_id
    JOIN public.comunidades co ON co.id=c.comunidad_id
    LEFT JOIN public.perfiles per ON per.id=c.responsable_id
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
      'nota',i.nota, 'tipo_ingreso',i.tipo_ingreso::text,
      'respuesta',i.respuesta, 'ayuda',i.ayuda, 'config',i.config
    ) ORDER BY i.grupo,i.orden,i.id
  ),'[]'::jsonb)
  INTO v_items
  FROM public.control_items i WHERE i.control_id=p_control_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',a.id,'control_item_id',a.control_item_id,
      'storage_path',a.storage_path,'nombre',a.nombre_original,
      'mime',a.mime,'descripcion',a.descripcion,
      'clase',a.clase::text,'criterio_id',a.criterio_id,'orden',a.orden,
      'firmante_nombre',a.firmante_nombre,'firmante_rut',a.firmante_rut
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
       'observaciones',v_control.observaciones,
       'comunidad_nombre',v_control.comunidad_nombre,
       'comunidad_direccion',v_control.comunidad_direccion,
       'comunidad_comuna',v_control.comunidad_comuna,
       'responsable_nombre',v_control.responsable_nombre
    ),
    'items',v_items,'adjuntos',v_adjuntos
  );
END
$func$;
REVOKE ALL ON FUNCTION public.portal_levantamiento_detalle(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_levantamiento_detalle(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
