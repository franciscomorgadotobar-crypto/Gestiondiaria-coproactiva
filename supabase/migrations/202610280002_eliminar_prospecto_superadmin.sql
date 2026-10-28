-- Eliminación definitiva de prospectos limitada al rol superadmin.
-- Migración aplicada a producción el 28-10-2026.
CREATE TABLE IF NOT EXISTS public.prospectos_eliminaciones_auditoria (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 prospecto_id uuid NOT NULL,
 nombre_prospecto text NOT NULL,
 eliminado_por uuid NOT NULL REFERENCES auth.users(id),
 eliminado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prospectos_eliminaciones_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prospectos_eliminaciones_auditoria FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.eliminar_prospecto_superadmin(p_prospecto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.prospectos%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.mi_rol()::text IS DISTINCT FROM 'superadmin' THEN
   RAISE EXCEPTION 'Solo un superadministrador puede eliminar prospectos' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM public.prospectos WHERE id=p_prospecto_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'El prospecto ya no existe' USING ERRCODE='P0002';
 END IF;
 IF p.comunidad_id IS NOT NULL OR p.etapa::text = 'ganado'
 OR EXISTS(SELECT 1 FROM public.controles WHERE prospecto_id=p.id)
 OR EXISTS(SELECT 1 FROM public.whatsapp_conversations WHERE prospecto_id=p.id) THEN
   RAISE EXCEPTION 'Este prospecto tiene una comunidad o gestión operacional asociada y no se puede eliminar directamente' USING ERRCODE='23503';
 END IF;
 INSERT INTO public.prospectos_eliminaciones_auditoria(prospecto_id,nombre_prospecto,eliminado_por)
 VALUES(p.id,p.nombre_condominio,auth.uid());
 DELETE FROM public.prospectos WHERE id=p.id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_prospecto_superadmin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eliminar_prospecto_superadmin(uuid) TO authenticated;
REVOKE DELETE ON TABLE public.prospectos FROM anon,authenticated;
