\set ON_ERROR_STOP on
DO $$
DECLARE n text;
BEGIN
 IF has_function_privilege('anon','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: anon todavía puede invocar nombre_de_perfil'; END IF;
 IF NOT has_function_privilege('authenticated','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: se dañó el permiso de nombre_de_perfil para usuarios activos'; END IF;
 IF NOT has_function_privilege('service_role','public.nombre_de_perfil(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: service_role perdió permiso'; END IF;
 FOREACH n IN ARRAY ARRAY['bitacora_asignar_correlativo','contabilidad_actualizar_padre','contabilidad_proteger_cuenta','crear_alerta_base_mantenimiento','proteger_email_perfil','proteger_email_perfil_propio'] LOOP
   IF has_function_privilege('anon',format('public.%I()',n),'EXECUTE')
      OR has_function_privilege('authenticated',format('public.%I()',n),'EXECUTE')
   THEN RAISE EXCEPTION 'FAIL: trigger % sigue invocable directamente',n; END IF;
 END LOOP;
 RAISE NOTICE 'PASS: 7 revocaciones sin suprimir permisos internos';
END $$;

BEGIN READ ONLY;
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 DO $$
 BEGIN
   IF (SELECT COUNT(*) FROM public.controles_con_avance) <> 1
   THEN RAISE EXCEPTION 'FAIL: vista autorizada deja de funcionar'; END IF;
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000001')
      IS DISTINCT FROM 'Nombre ficticio prueba'
   THEN RAISE EXCEPTION 'FAIL: nombre autorizado deja de funcionar'; END IF;
   RAISE NOTICE 'PASS: vista invoker y acceso autenticado conservados';
 END $$;
ROLLBACK;

BEGIN;
 SET LOCAL ROLE authenticated;
 INSERT INTO public.auditoria_eventos(id) VALUES (1);
COMMIT;
DO $$
BEGIN
 IF (SELECT paso FROM public.auditoria_eventos WHERE id=1) <> 6 THEN
   RAISE EXCEPTION 'FAIL: alguno de los seis triggers dejó de ejecutarse';
 END IF;
 RAISE NOTICE 'PASS: los seis triggers se ejecutan sin permiso EXECUTE de authenticated';
END $$;

BEGIN READ ONLY;
 SET LOCAL ROLE anon;
 DO $$
 BEGIN
  BEGIN
    PERFORM public.nombre_de_perfil('00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: anon recupera nombre';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: llamada anon bloqueada por privilegios';
  END;
 END $$;
ROLLBACK;
