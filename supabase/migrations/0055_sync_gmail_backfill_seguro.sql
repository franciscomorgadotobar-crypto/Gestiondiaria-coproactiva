create or replace function public.programar_sync_proveedores_gmail(p_modo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job bigint;
  v_schedule text;
  v_limite int;
begin
  if p_modo not in ('backfill','diario') then
    raise exception 'Modo inválido';
  end if;

  select jobid into v_job
  from cron.job
  where jobname = 'proveedores-gmail-diario'
  limit 1;

  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;

  if p_modo = 'backfill' then
    v_schedule := '*/15 * * * *';
    v_limite := 6;
  else
    v_schedule := '0 9 * * *';
    v_limite := 6;
  end if;

  perform cron.schedule(
    'proveedores-gmail-diario',
    v_schedule,
    format($cmd$
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
        body := %L::jsonb,
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$,
      jsonb_build_object('origen','cron','limite_backfill',v_limite)::text
    )
  );
end;
$$;

revoke all on function public.programar_sync_proveedores_gmail(text) from public, anon, authenticated;
grant execute on function public.programar_sync_proveedores_gmail(text) to service_role;

select public.programar_sync_proveedores_gmail('backfill');
