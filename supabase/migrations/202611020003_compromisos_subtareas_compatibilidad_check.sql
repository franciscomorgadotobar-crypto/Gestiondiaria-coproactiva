-- Compatibilidad PWA: instalaciones antiguas enviaban solamente "completada".
-- La base debe traducir ese check en 100% / 0% ANTES de la restricción,
-- aunque el navegador esté usando JS anterior almacenado en caché.
create or replace function public.compromisos_subtareas_normalizar_check()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.completada then
   new.avance=100;
 elsif tg_op='UPDATE' and old.completada and not new.completada and new.avance=100 then
   new.avance=0;
 end if;
 return new;
end;$$;
revoke all on function public.compromisos_subtareas_normalizar_check() from public,anon,authenticated;
drop trigger if exists compromisos_subtareas_normalizar_check on public.compromisos_subtareas;
create trigger compromisos_subtareas_normalizar_check
 before insert or update of completada,avance
 on public.compromisos_subtareas
 for each row execute function public.compromisos_subtareas_normalizar_check();
