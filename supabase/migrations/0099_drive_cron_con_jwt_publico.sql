-- drive-comunidad mantiene verify_jwt=true en la puerta de enlace. El reintento
-- automático envía la clave pública anon (la misma que usa la app y que ya está
-- publicada en el flujo de compilación) solo para pasar la puerta; la autorización
-- real es el token interno X-Coproactiva-Worker, cuyo hash valida la función.
select cron.unschedule(jobid) from cron.job where jobname = 'drive-carpetas-pendientes';
select cron.schedule('drive-carpetas-pendientes', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/drive-comunidad',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuanF6cGJ0Y2NjcG54bmdvcWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTAyNDcsImV4cCI6MjEwNDE2NjI0N30.7-vPmb-MhVvc-gdwJnHNVDitpG7sXVSSbClxLXl6OtQ',
      'X-Coproactiva-Worker', (select decrypted_secret from vault.decrypted_secrets
                               where name = 'drive_worker_token' order by created_at desc limit 1)),
    body := '{"action":"procesar_pendientes"}'::jsonb,
    timeout_milliseconds := 55000);
$cron$);

-- Los enlaces temporales GET no se usan: las descargas pasan por la sesión de la app.
drop function if exists public.drive_consumir_descarga(text);
drop table if exists public.drive_descargas;
