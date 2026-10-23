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

-- Un cliente no debe acceder al nombre de un admin fuera de su RLS.
BEGIN READ ONLY;
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
 SELECT set_config('request.jwt.claim.role','authenticated',true);
 DO $$
 BEGIN
   IF (SELECT COUNT(*) FROM public.perfiles WHERE id='00000000-0000-0000-0000-000000000003') <> 0 THEN
     RAISE EXCEPTION 'FAIL: modelo RLS permite al cliente leer admin directamente';
   END IF;
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000003') IS NOT NULL THEN
     RAISE EXCEPTION 'FAIL: cliente accede al nombre del administrador via RPC';
   END IF;
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000004')
     IS DISTINCT FROM 'Cliente prueba' THEN
     RAISE EXCEPTION 'FAIL: cliente perdio su propio nombre';
   END IF;
   IF (SELECT COUNT(*) FROM public.controles_con_avance) <> 0 THEN
     RAISE EXCEPTION 'FAIL: cliente ve controles internos';
   END IF;
   RAISE NOTICE 'PASS: cliente solo consulta su nombre, no admin ajeno ni controles';
 END $$;
ROLLBACK;

-- Terreno ve responsables de controles de la comunidad que tiene asignada.
BEGIN READ ONLY;
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 SELECT set_config('request.jwt.claim.role','authenticated',true);
 DO $$
 BEGIN
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000002')
     IS DISTINCT FROM 'Otro técnico prueba' THEN
     RAISE EXCEPTION 'FAIL: terreno no puede ver al responsable autorizado';
   END IF;
   IF (SELECT COUNT(*) FROM public.controles_con_avance
       WHERE responsable_nombre='Otro técnico prueba') <> 1 THEN
     RAISE EXCEPTION 'FAIL: vista de controles pierde el nombre del responsable';
   END IF;
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000003') IS NOT NULL THEN
     RAISE EXCEPTION 'FAIL: terreno ve nombre de admin sin relacion';
   END IF;
   RAISE NOTICE 'PASS: control conserva nombres autorizados sin exponer perfiles ajenos';
 END $$;
ROLLBACK;

-- Administrador activo conserva la lectura autorizada de perfiles.
BEGIN READ ONLY;
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 SELECT set_config('request.jwt.claim.role','authenticated',true);
 DO $$
 BEGIN
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000002')
      IS DISTINCT FROM 'Otro técnico prueba' THEN
      RAISE EXCEPTION 'FAIL: admin activo perdió acceso a nombre de usuario';
   END IF;
   RAISE NOTICE 'PASS: administrador activo mantiene nombres autorizados';
 END $$;
ROLLBACK;

-- Un perfil desactivado pierde acceso al nombre incluso si conoce el UUID.
BEGIN READ ONLY;
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
 SELECT set_config('request.jwt.claim.role','authenticated',true);
 DO $$
 BEGIN
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000005') IS NOT NULL THEN
      RAISE EXCEPTION 'FAIL: usuario inactivo obtiene nombre via RPC';
   END IF;
   RAISE NOTICE 'PASS: usuario inactivo sin nombres via RPC';
 END $$;
ROLLBACK;

-- La clave privilegiada de servidor conserva su función de soporte.
BEGIN READ ONLY;
 SET LOCAL ROLE service_role;
 SELECT set_config('request.jwt.claim.role','service_role',true);
 DO $$
 BEGIN
   IF public.nombre_de_perfil('00000000-0000-0000-0000-000000000003')
      IS DISTINCT FROM 'Administrador prueba' THEN
      RAISE EXCEPTION 'FAIL: service_role no puede consultar nombre';
   END IF;
   RAISE NOTICE 'PASS: service_role conserva acceso operativo';
 END $$;
ROLLBACK;
