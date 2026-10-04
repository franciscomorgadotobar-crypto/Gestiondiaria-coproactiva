alter table public.proveedor_sync_estado
  add column if not exists token_hash text;

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'proveedores_gmail_cron_token'
  order by created_at desc
  limit 1;

  if v_token is null then
    v_token := encode(gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      v_token,
      'proveedores_gmail_cron_token',
      'Token interno para sincronizar proveedores desde Gmail'
    );
  end if;

  update public.proveedor_sync_estado
  set token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      editado_en = now()
  where clave = 'gmail_proveedores';
end $$;

do $$
declare
  v_job bigint;
begin
  select jobid into v_job from cron.job
  where jobname = 'proveedores-gmail-diario'
  limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
end $$;

select cron.schedule(
  'proveedores-gmail-diario',
  '0 9 * * *',
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
      body := '{"origen":"cron","limite_backfill":6}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
