-- Telemetría de despliegue Netlify (no guarda tokens ni secretos).
ALTER TABLE public.seo_propuestas ADD COLUMN IF NOT EXISTS netlify_detalle jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.seo_propuestas ADD COLUMN IF NOT EXISTS netlify_consultado_en timestamptz;
COMMENT ON COLUMN public.seo_propuestas.netlify_detalle IS 'Estado de despliegue de Netlify: commit, rama y estado. Sin credenciales.';
