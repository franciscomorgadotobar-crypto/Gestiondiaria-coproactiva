\set ON_ERROR_STOP on
DO $$
DECLARE n text;
BEGIN
 IF NOT has_function_privilege('anon','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: rollback no restablece anon'; END IF;
 FOREACH n IN ARRAY ARRAY['bitacora_asignar_correlativo','contabilidad_actualizar_padre','contabilidad_proteger_cuenta','crear_alerta_base_mantenimiento','proteger_email_perfil','proteger_email_perfil_propio'] LOOP
   IF NOT has_function_privilege('anon',format('public.%I()',n),'EXECUTE')
     OR NOT has_function_privilege('authenticated',format('public.%I()',n),'EXECUTE')
   THEN RAISE EXCEPTION 'FAIL: rollback permisos de trigger %',n; END IF;
 END LOOP;
 RAISE NOTICE 'PASS: rollback recupera ACL originales en entorno ficticio';
END $$;
