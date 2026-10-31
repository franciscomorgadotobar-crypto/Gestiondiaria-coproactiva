-- Motor único de correo para CRM y Proveedores, 2026-10-31.
-- Misma función registra señales de apertura, por contexto, y crea
-- UNA notificación de primera apertura al remitente. No almacena IP ni UA.
ALTER TABLE public.proveedor_comunicacion_destinatarios
 ADD COLUMN IF NOT EXISTS seguimiento_activo boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS seguimiento_token_hash text,
 ADD COLUMN IF NOT EXISTS primera_apertura timestamptz,
 ADD COLUMN IF NOT EXISTS ultima_apertura timestamptz,
 ADD COLUMN IF NOT EXISTS aperturas_total integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS proveedor_destinatarios_seguimiento_hash_idx
 ON public.proveedor_comunicacion_destinatarios(seguimiento_token_hash)
 WHERE seguimiento_token_hash IS NOT NULL;
ALTER TABLE public.notificaciones
 ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS correo_origen text,
 ADD COLUMN IF NOT EXISTS correo_registro_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_correo_primera_apertura_idx
 ON public.notificaciones(correo_origen,correo_registro_id)
 WHERE tipo='correo_apertura' AND correo_registro_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.registrar_apertura_correo(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 v_id uuid;v_primera boolean;v_enviado_por uuid;
 v_prospecto_id uuid;v_proveedor_id uuid;v_asunto text;v_nombre text;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 UPDATE public.prospecto_correos c
 SET primera_apertura=coalesce(c.primera_apertura,now()),
     ultima_apertura=now(),aperturas_total=least(c.aperturas_total+1,2147483647)
 WHERE c.seguimiento_token_hash=p_token_hash AND c.seguimiento_activo AND c.estado='enviado'
 AND (c.ultima_apertura IS NULL OR c.ultima_apertura<now()-interval '90 seconds')
 RETURNING c.id,(c.aperturas_total=1),c.enviado_por,c.prospecto_id,c.asunto
 INTO v_id,v_primera,v_enviado_por,v_prospecto_id,v_asunto;
 IF v_id IS NOT NULL THEN
  IF v_primera THEN
   SELECT nombre_condominio INTO v_nombre FROM public.prospectos WHERE id=v_prospecto_id;
   INSERT INTO public.notificaciones(destinatario_id,tipo,titulo,mensaje,prospecto_id,correo_origen,correo_registro_id)
   VALUES(v_enviado_por,'correo_apertura','Apertura detectada',
   coalesce(nullif(v_nombre,''),'Un prospecto')||
   ' · Se detectó carga de imágenes del correo: '||left(coalesce(v_asunto,'Sin asunto'),120),
   v_prospecto_id,'crm',v_id)
   ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
 END IF;
 UPDATE public.proveedor_comunicacion_destinatarios d
 SET primera_apertura=coalesce(d.primera_apertura,now()),
     ultima_apertura=now(),aperturas_total=least(d.aperturas_total+1,2147483647)
 WHERE d.seguimiento_token_hash=p_token_hash AND d.seguimiento_activo AND d.estado='enviado'
 AND (d.ultima_apertura IS NULL OR d.ultima_apertura<now()-interval '90 seconds')
 RETURNING d.id,(d.aperturas_total=1),d.proveedor_id,d.comunicacion_id,d.empresa,d.asunto
 INTO v_id,v_primera,v_proveedor_id,v_prospecto_id,v_nombre,v_asunto;
 IF v_id IS NOT NULL THEN
  IF v_primera THEN
   SELECT creado_por INTO v_enviado_por FROM public.proveedor_comunicaciones WHERE id=v_prospecto_id;
   IF v_enviado_por IS NOT NULL THEN
    INSERT INTO public.notificaciones(destinatario_id,tipo,titulo,mensaje,proveedor_id,correo_origen,correo_registro_id)
    VALUES(v_enviado_por,'correo_apertura','Apertura detectada',
    coalesce(nullif(v_nombre,''),'Proveedor')||
    ' · Se detectó carga de imágenes del correo: '||left(coalesce(v_asunto,'Sin asunto'),120),
    v_proveedor_id,'proveedores',v_id)
    ON CONFLICT DO NOTHING;
   END IF;
  END IF;
  RETURN true;
 END IF;
 RETURN false;
END
$body$;
REVOKE ALL ON FUNCTION public.registrar_apertura_correo(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_apertura_correo(text) TO service_role;

-- Plantillas seguras para iniciar correos de proveedor sin campos pendientes.
INSERT INTO public.plantillas_correo_crm(nombre,asunto,cuerpo,categoria,uso,activa)
SELECT t.nombre,t.asunto,t.cuerpo,'Proveedores',t.uso,true
FROM (VALUES
 ('Solicitud de cotización','Solicitud de cotización | Coproactiva',
  'Junto con saludar, solicitamos una cotización por los servicios requeridos para una de nuestras comunidades administradas. Agradeceremos indicar disponibilidad, condiciones comerciales, plazos de respuesta y antecedentes que necesiten para preparar la propuesta.',
  'Para iniciar una solicitud de cotización a uno o varios proveedores.'),
 ('Consulta de disponibilidad','Consulta de disponibilidad de servicios | Coproactiva',
  'Junto con saludar, estamos revisando alternativas de proveedores para nuestras comunidades. ¿Podrían indicarnos su disponibilidad, zonas de cobertura y servicios que actualmente ofrecen? Quedamos atentos a sus comentarios.',
  'Para consultar cobertura y capacidad de atención.'),
 ('Seguimiento de solicitud','Seguimiento de solicitud anterior | Coproactiva',
  'Junto con saludar, escribimos para consultar si han podido revisar nuestra solicitud anterior. Agradeceremos informarnos el estado de su respuesta y cualquier antecedente adicional que necesiten.',
  'Para dar seguimiento a una solicitud pendiente.')
) AS t(nombre,asunto,cuerpo,uso)
WHERE NOT EXISTS(
 SELECT 1 FROM public.plantillas_correo_crm p
 WHERE p.categoria='Proveedores' AND p.nombre=t.nombre AND p.codigo IS NULL
);
