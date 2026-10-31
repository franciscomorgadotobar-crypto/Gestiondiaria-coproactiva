-- Seguimiento de carga de imágenes de correos comerciales (31-10-2026).
-- Registro agregado; no se almacenan IP, ubicación ni agente de usuario.
ALTER TABLE public.firmas_correo
  ADD COLUMN IF NOT EXISTS seguimiento_aperturas boolean NOT NULL DEFAULT true;
ALTER TABLE public.prospecto_correos
  ADD COLUMN IF NOT EXISTS seguimiento_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seguimiento_token_hash text,
  ADD COLUMN IF NOT EXISTS primera_apertura timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_apertura timestamptz,
  ADD COLUMN IF NOT EXISTS aperturas_total integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS prospecto_correos_seguimiento_token_hash_idx
 ON public.prospecto_correos(seguimiento_token_hash)
 WHERE seguimiento_token_hash IS NOT NULL;
ALTER TABLE public.prospecto_correos
 ADD CONSTRAINT prospecto_correos_token_formato_chk
 CHECK (seguimiento_token_hash IS NULL OR seguimiento_token_hash ~ '^[a-f0-9]{64}$'),
 ADD CONSTRAINT prospecto_correos_aperturas_no_negativas_chk CHECK (aperturas_total >= 0);

CREATE OR REPLACE FUNCTION public.registrar_apertura_correo(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_id uuid;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
   RETURN false;
 END IF;
 UPDATE public.prospecto_correos AS c
 SET primera_apertura=coalesce(c.primera_apertura,now()),
     ultima_apertura=now(),
     aperturas_total=least(c.aperturas_total+1,2147483647)
 WHERE c.seguimiento_token_hash=p_token_hash
   AND c.seguimiento_activo=true
   AND c.estado='enviado'
   AND (c.ultima_apertura IS NULL OR c.ultima_apertura < now()-interval '90 seconds')
 RETURNING c.id INTO v_id;
 RETURN v_id IS NOT NULL;
END
$body$;
REVOKE ALL ON FUNCTION public.registrar_apertura_correo(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_apertura_correo(text) TO service_role;
