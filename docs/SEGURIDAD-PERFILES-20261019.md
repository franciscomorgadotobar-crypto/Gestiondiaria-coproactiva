# Seguridad de perfiles: primera corrección prioritaria (2026-10-19)

## Alcance
- No se modifican componentes React ni rutas.
- No se alteran datos existentes de usuarios, comunidades o controles.
- No se aplican migraciones automáticamente con un merge de este PR.
- La rama de publicación de la PWA NO recibe cambios hasta aprobación posterior.

## Hallazgo confirmado en Supabase de producción
- La política RLS de actualización propia de public.perfiles comprueba id y rol, pero no protege el campo activo ante peticiones directas.
- public.mi_rol() devuelve el rol de cuentas inactivas; es_admin() y es_superadmin() dependen de esa función.
- public.ve_comunidad(), public.ve_control() y public.puede_operar_control() permiten algunas rutas de acceso por asignación de usuario sin verificar si su perfil continúa activo.
- Las políticas restrictivas de cliente YA están configuradas como RESTRICTIVE. No se deben modificar ni confundir con políticas permisivas.

## Corrección propuesta
1. mi_rol() solo devuelve un rol si el perfil está activo.
2. ve_comunidad(), ve_control() y puede_operar_control() requieren un perfil activo.
3. Políticas RESTRICTIVE en controles y perfil_comunidades impiden la lectura directa por cuentas desactivadas con asignaciones antiguas.
4. Restricciones adicionales en notificaciones, portal_cliente_comunidades, portal_cliente_plantillas, tutorial_asignaciones y tutorial_progreso para impedir accesos residuales por titularidad de un usuario inactivo.
5. Trigger en perfiles bloquea cambiar activo de la propia cuenta y exige administración activa para modificar otra.
6. La Edge Function equipo usa service_role y conserva sus acciones autorizadas de alta/baja de otros usuarios.
7. Se retira el permiso RPC de ejecución del nuevo trigger, que se utiliza solo como trigger.

## Pruebas previas al despliegue
Los tests automáticos adjuntos verifican estructura, barreras y compatibilidad del código. **NO sustituyen pruebas de autorización reales en Postgres**.

| Caso | Esperado |
| --- | --- |
| Terreno activo accede a comunidad asignada | Permitido |
| Terreno activo accede a comunidad no asignada | Denegado |
| Terreno activo cambia su propio nombre o teléfono mediante Mi Cuenta | Permitido |
| Terreno activo intenta modificar su propio activo con la API | Denegado |
| Admin o superadmin inactivo intenta usar funciones de autorización | Denegado |
| Usuario inactivo con comunidad y control asignados intenta leerlos | Denegado |
| Usuario inactivo con control de prospecto asignado intenta leerlo | Denegado |
| Usuario inactivo intenta leer sus notificaciones o tutoriales | Denegado |
| Cliente inactivo intenta leer sus asociaciones o plantillas del portal | Denegado |
| Usuario activo sigue accediendo a notificaciones y tutoriales | Permitido |
| Cliente activo sigue accediendo a su portal | Permitido |
| Admin activo edita Mi Cuenta y conserva los triggers de fecha/correo | Permitido |
| Admin activo da de baja a otra persona desde Equipo | Permitido |
| Admin activo reactiva a otra persona desde Equipo | Permitido |
| Admin intenta modificar un superadmin | Denegado, como antes |
| Cliente activo utiliza su portal | Permitido |
| Service role reactiva una cuenta por la función Equipo | Permitido |
| Sincronización de levantamientos de usuario activo | Permitido |

## Plan de validación y publicación
1. Crear un entorno aislado de Supabase. Su creación puede tener coste; solicitar autorización si procede.
2. Aplicar la migración allí y ejecutar la matriz con cuentas de prueba de cada rol.
3. Ejecutar las pruebas de GitHub Actions y compilar la aplicación.
4. Preparar respaldo/verificación de funciones y políticas de producción antes de aplicar.
5. Una vez autorizada la producción, aplicar la migración como unidad atómica y comprobar Equipo, Mi Cuenta y las consultas de comunidad/control.
6. Mantener el archivo supabase/rollbacks/202610190001_bloquear_reactivacion_y_permisos_inactivos.sql disponible para una reversión administrativa inmediata si se detecta incompatibilidad.

## Advertencias
- La migración controla rutas prioritarias, pero no sustituye una auditoría posterior de todas las políticas RLS y RPC de public ni de todas las tablas privadas.
- Las sesiones ya emitidas pueden permanecer autenticadas temporalmente; el objetivo es negar autorización de datos, no revocar automáticamente todo JWT a nivel de autenticación.
- Revertir la migración reintroduce la vulnerabilidad, por lo que solo se usa ante un problema real de compatibilidad.
