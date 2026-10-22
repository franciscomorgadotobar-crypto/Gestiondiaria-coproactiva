# Auditoría de funciones privilegiadas — Coproactiva
**Fecha:** 22 de octubre de 2026  
**Estado:** propuesta para revisión y prueba; NO aplicada a Supabase de producción.

## Alcance y evidencia
En la base real se identificaron 99 funciones SECURITY DEFINER en public,
11 ejecutables por anon y 74 ejecutables por authenticated (grupos solapados).

**Hallazgo confirmado:** `public.nombre_de_perfil(uuid)` es SECURITY DEFINER,
no valida `auth.uid()` y devuelve un nombre para cualquier perfil existente cuyo UUID
conozca el llamador. Una transacción READ ONLY con SET LOCAL ROLE anon confirmó
que devuelve un nombre sin iniciar sesión. No se extrajeron nombres en el reporte.

**Dependencia:** la vista `public.controles_con_avance` usa
`nombre_de_perfil(c.responsable_id)` y está configurada con
`security_invoker=true`. Conservamos ejecución por `authenticated`.
La vista tiene permiso SELECT para anon, pero la lectura efectiva de datos
sigue sujeta a RLS del invocador.

**Alertas de higiene:** seis funciones SECURITY DEFINER con RETURNS trigger
tenían EXECUTE otorgado a anon y authenticated. No pueden invocarse como
RPC ordinarias porque PostgreSQL solo permite ejecutarlas como trigger; aun
así, la superficie de permisos se puede reducir.

## Propuesta
1. Revocar EXECUTE a `anon` para `nombre_de_perfil(uuid)`, dejando el permiso
   de `authenticated` y `service_role`.
2. Revocar EXECUTE a `PUBLIC`, `anon` y `authenticated` en seis funciones
   `RETURNS trigger`, manteniendo permisos de roles internos.
3. No modificar el cuerpo de las funciones, vistas ni datos.
4. Mantener el resto de funciones privilegiadas en un inventario de auditoría
   y continuar con análisis individual; las advertencias no son equivalentes
   automáticamente a vulnerabilidades.

## Archivos
- `supabase/pendientes/auditoria_funciones_definer_20261022.sql`: propuesta,
  **NO es una migración de producción ni altera su historial**.
- `supabase/pendientes/auditoria_funciones_definer_20261022_rollback.sql`.
- `supabase/tests/auditoria_funciones_definer_20261022_*.sql` y CI efímero.

## Condiciones para autorizar despliegue
- CI PostgreSQL temporal aprobado (anon denegado, autenticados conservan acceso,
  triggers continúan disparándose, rollback validado).
- Verificación de la vista y permisos reales en un entorno de pruebas apropiado.
- Autorización para convertir el SQL propuesto en una migración versionada.
- Comprobación posterior con `pg_proc` y asesores de Supabase.
- No crear ramas pagadas, no generar costos, no fusionar ni desplegar esta PR
  sin revisión expresa.
