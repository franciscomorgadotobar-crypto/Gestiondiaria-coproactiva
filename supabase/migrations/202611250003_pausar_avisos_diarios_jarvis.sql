-- Pausa reversible: conserva configuración, historial y motor de Jarvis.
select cron.alter_job(jobid, active := false) from cron.job where jobname='jarvis-avisos-diarios' and active;
