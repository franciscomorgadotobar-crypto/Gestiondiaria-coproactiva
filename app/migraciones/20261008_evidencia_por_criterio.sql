-- Compatibilidad con evidencia por criterio, sin alterar archivos ni respuestas existentes.
-- NULL = fotografía general del punto o fotografía histórica.
ALTER TABLE public.adjuntos
  ADD COLUMN IF NOT EXISTS criterio_id text;

CREATE INDEX IF NOT EXISTS idx_adjuntos_criterio
  ON public.adjuntos (control_item_id, criterio_id)
  WHERE criterio_id IS NOT NULL;

COMMENT ON COLUMN public.adjuntos.criterio_id IS
  'Identificador estable de condición evaluada; NULL para fotografías anteriores.';
