-- Propuesta de seguridad revisada el 22-10-2026.
-- NO desplegar antes de comprobar los flujos de la aplicación en entorno aislado.
-- Este archivo no se ha aplicado a Supabase de producción.
--
-- Hallazgo confirmado: nombre_de_perfil(uuid) devuelve nombres al rol anon.
-- Se conserva EXECUTE para authenticated y service_role, pues la vista
-- controles_con_avance usa esa función.
REVOKE EXECUTE ON FUNCTION public.nombre_de_perfil(uuid) FROM PUBLIC, anon;

-- Funciones RETURNS trigger: solamente deben invocarse mediante sus triggers.
-- PostgreSQL comprueba EXECUTE al crear el trigger, no al ejecutarse por DML.
-- Conservar EXECUTE para postgres y service_role.
REVOKE EXECUTE ON FUNCTION public.bitacora_asignar_correlativo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contabilidad_actualizar_padre() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contabilidad_proteger_cuenta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_alerta_base_mantenimiento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proteger_email_perfil() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proteger_email_perfil_propio() FROM PUBLIC, anon, authenticated;
