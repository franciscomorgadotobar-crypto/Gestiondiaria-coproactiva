-- Regla editorial Coproactiva: guion ASCII en plantillas existentes.
-- No modifica correos enviados, prospectos ni comunicaciones históricas.
update public.plantillas_correo_crm
set
  nombre = translate(nombre, chr(8212) || chr(8211), '--'),
  asunto = translate(asunto, chr(8212) || chr(8211), '--'),
  cuerpo = translate(cuerpo, chr(8212) || chr(8211), '--'),
  categoria = translate(categoria, chr(8212) || chr(8211), '--'),
  uso = translate(uso, chr(8212) || chr(8211), '--'),
  etapa_crm = translate(etapa_crm, chr(8212) || chr(8211), '--'),
  adjunto_sugerido = translate(adjunto_sugerido, chr(8212) || chr(8211), '--'),
  variantes = translate(variantes::text, chr(8212) || chr(8211), '--')::jsonb
where (nombre || coalesce(asunto,'') || coalesce(cuerpo,'') || coalesce(categoria,'') ||
  coalesce(uso,'') || coalesce(etapa_crm,'') || coalesce(adjunto_sugerido,'') ||
  coalesce(variantes::text,'')) ~ (chr(8212) || '|' || chr(8211));
