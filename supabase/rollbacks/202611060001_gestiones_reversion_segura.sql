-- ROLLBACK FUNCIONAL de Gestiones v1. Conserva TODOS los nuevos datos.
-- USAR SOLO TRAS VOLVER EL FRONTEND AL COMMIT ANTERIOR.
-- Copia previa privada: copro_reversion_20261106
begin;
do $$
declare v record;
begin
 if not exists (select 1 from pg_namespace where nspname='copro_reversion_20261106') then
   raise exception 'No hay respaldo previo. No ejecutar reversión automática.';
 end if;
 -- Reponer la función original de porcentaje/etapas: evita dejar la
 -- aplicación anterior con un motor cuyo contrato cambió.
 for v in select definicion from copro_reversion_20261106.funciones
   where proname='compromisos_recalcular_desde_subtareas'
 loop
   execute v.definicion;
 end loop;
end $$;
revoke all on function public.gestiones_crear_desde_tipo(uuid,uuid,text,date,date) from public,anon,authenticated;
revoke all on function public.gestiones_cambiar_estado(uuid,text,date,text,text) from public,anon,authenticated;
alter table public.compromisos_avances alter column publicado set default false;
alter table public.compromisos_avances alter column registrado_por drop default;
-- NO borramos modelos, bitácoras, documentos, campos añadidos ni movimientos:
-- así se permite volver a Gestiones v1 sin restaurar copias antiguas.
commit;
