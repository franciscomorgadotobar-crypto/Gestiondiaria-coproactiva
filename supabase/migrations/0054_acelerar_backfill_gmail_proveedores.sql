do $$
declare
  v_job bigint;
begin
  select jobid into v_job
  from cron.job
  where jobname = 'proveedores-gmail-diario'
  limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
end $$;

select cron.schedule(
  'proveedores-gmail-diario',
  '5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/sincronizar-proveedores-gmail',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Coproactiva-Sync',
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'proveedores_gmail_cron_token'
         order by created_at desc
         limit 1)
      ),
      body := '{"origen":"cron","limite_backfill":12}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
