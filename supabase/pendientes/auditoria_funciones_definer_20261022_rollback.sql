-- Reversión de auditoria_funciones_definer_20261022.sql.
-- Restaura los permisos EXACTOS observados antes del cambio propuesto.
-- ADVERTENCIA: restaura el acceso anon a nombres de perfil.

GRANT EXECUTE ON FUNCTION public.nombre_de_perfil(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.bitacora_asignar_correlativo() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contabilidad_actualizar_padre() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contabilidad_proteger_cuenta() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_alerta_base_mantenimiento() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proteger_email_perfil() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proteger_email_perfil_propio() TO PUBLIC, anon, authenticated;
