-- Vincula materias del estado de avances con documentos YA existentes en Drive.
-- El archivo conserva su origen, versiones y visibilidad, sin copiarlo ni moverlo.
CREATE TABLE IF NOT EXISTS public.estado_materia_documentos (
  materia_id uuid NOT NULL REFERENCES public.estado_avance_materias(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.drive_archivos_comunidad(id) ON DELETE CASCADE,
  vinculado_en timestamptz NOT NULL DEFAULT now(),
  vinculado_por uuid DEFAULT auth.uid(),
  PRIMARY KEY (materia_id,documento_id)
);
CREATE INDEX IF NOT EXISTS idx_estado_materia_docs_documento
  ON public.estado_materia_documentos(documento_id);
ALTER TABLE public.estado_materia_documentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.estado_materia_documentos FROM PUBLIC,anon;
GRANT SELECT,INSERT,DELETE ON public.estado_materia_documentos TO authenticated;

DROP POLICY IF EXISTS materia_documento_lectura ON public.estado_materia_documentos;
CREATE POLICY materia_documento_lectura ON public.estado_materia_documentos
FOR SELECT TO authenticated
USING (
  public.puede_gestionar_compromisos()
  OR EXISTS (
    SELECT 1 FROM public.estado_avance_materias m
    JOIN public.drive_archivos_comunidad d
      ON d.id=estado_materia_documentos.documento_id
     AND d.comunidad_id=m.comunidad_id
    WHERE m.id=estado_materia_documentos.materia_id
      AND m.publicado IS TRUE
      AND d.visible_cliente IS TRUE
      AND d.eliminado_en IS NULL
      AND public.cliente_puede_ver_comunidad(m.comunidad_id)
  )
);
DROP POLICY IF EXISTS materia_documento_vincular ON public.estado_materia_documentos;
CREATE POLICY materia_documento_vincular ON public.estado_materia_documentos
FOR INSERT TO authenticated WITH CHECK (
  public.puede_gestionar_compromisos()
  AND EXISTS (
    SELECT 1 FROM public.estado_avance_materias m
    JOIN public.drive_archivos_comunidad d ON d.comunidad_id=m.comunidad_id
    WHERE m.id=estado_materia_documentos.materia_id
      AND d.id=estado_materia_documentos.documento_id
      AND d.eliminado_en IS NULL
  )
);
DROP POLICY IF EXISTS materia_documento_desvincular ON public.estado_materia_documentos;
CREATE POLICY materia_documento_desvincular ON public.estado_materia_documentos
FOR DELETE TO authenticated
USING (public.puede_gestionar_compromisos());

-- Asociaciones comprobables por nombre y contenido. No adivinar asociaciones
-- de certificados generales o documentos de otra materia.
INSERT INTO public.estado_materia_documentos(materia_id,documento_id)
SELECT m.id,d.id
FROM public.estado_avance_materias m
JOIN public.comunidades c ON c.id=m.comunidad_id
JOIN public.drive_archivos_comunidad d ON d.comunidad_id=m.comunidad_id
WHERE c.nombre='Reserva Santa Clara'
  AND m.materia='RUT de la comunidad'
  AND d.nombre='RUT SII Reserva Santa Clara.pdf'
  AND d.visible_cliente IS TRUE AND d.eliminado_en IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.estado_materia_documentos(materia_id,documento_id)
SELECT m.id,d.id
FROM public.estado_avance_materias m
JOIN public.comunidades c ON c.id=m.comunidad_id
JOIN public.drive_archivos_comunidad d ON d.comunidad_id=m.comunidad_id
WHERE c.nombre='Reserva Santa Clara'
  AND m.materia='Observaciones al reglamento de copropiedad'
  AND d.nombre='EP Reglamento Copropiedad RESERVA SANTA CLARA (2026).pdf'
  AND d.visible_cliente IS TRUE AND d.eliminado_en IS NULL
ON CONFLICT DO NOTHING;
NOTIFY pgrst, 'reload schema';
