-- Activar evaluación detallada SOLO en la plantilla Primera visita Santa Clara.
-- No toca control_items ni respuestas/fotografías de levantamientos ya creados.
WITH puntos AS (
  SELECT pi.id, pi.grupo,
    jsonb_agg(jsonb_build_object(
      'id', substr(md5(pi.id::text || ':' || linea.orden::text), 1, 16),
      'texto', btrim(linea.texto)
    ) ORDER BY linea.orden) AS criterios
  FROM public.plantilla_items pi
  JOIN public.plantillas_control p ON p.id = pi.plantilla_id
  CROSS JOIN LATERAL regexp_split_to_table(
    coalesce(nullif(btrim(pi.ayuda), ''), pi.texto), E'\\r?\\n'
  ) WITH ORDINALITY AS linea(texto, orden)
  WHERE p.nombre = 'Primera visita Santa Clara'
    AND pi.tipo_ingreso::text = 'opciones'
    AND NOT (coalesce(pi.config, '{}'::jsonb) ? 'criterios')
    AND btrim(linea.texto) <> ''
  GROUP BY pi.id, pi.grupo
)
UPDATE public.plantilla_items pi
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(coalesce(pi.config,'{}'::jsonb), '{criterios}', puntos.criterios, true),
    '{descripcion_categoria}',
    to_jsonb(CASE puntos.grupo
      WHEN 'Accesos y Seguridad' THEN 'Revisión de accesos peatonales y vehiculares, funcionamiento de portones, apertura manual, sensores y elementos asociados a seguridad.'
      WHEN 'Instalaciones Sanitarias' THEN 'Revisión de redes de agua potable, alcantarillado, aguas lluvias, estanques, salas de bombas y llaves de corte.'
      WHEN 'Instalaciones eléctricas y luminarias' THEN 'Inspección de empalmes, medidores, tableros, luminarias comunes y redes eléctricas visibles.'
      WHEN 'Gas y otras instalaciones' THEN 'Verificación visual de estanques, accesorios y condiciones generales de seguridad de las instalaciones de gas.'
      WHEN 'Seguridad contra incendios' THEN 'Comprobación de extintores, grifos, señalética, accesibilidad y vías de evacuación.'
      WHEN 'Telecomunicaciones' THEN 'Revisión visual de salas y cajas de telecomunicaciones, protección, orden y condiciones de acceso.'
      WHEN 'Áreas comunes' THEN 'Revisión de circulaciones, estacionamientos, áreas verdes, equipamiento común, recintos del personal y terminaciones visibles.'
      ELSE ''
    END), true),
  '{opciones}',
  (
    SELECT jsonb_agg(
      CASE WHEN op.valor->>'texto' = 'Cumple con observaciones'
        THEN jsonb_set(op.valor, '{evidencia}', '"comentario_foto"'::jsonb, true)
        ELSE op.valor END
      ORDER BY op.orden
    )
    FROM jsonb_array_elements(coalesce(pi.config->'opciones','[]'::jsonb))
      WITH ORDINALITY AS op(valor, orden)
  ), true)
FROM puntos
WHERE pi.id = puntos.id;
