# Coproactiva · Plan de retorno para Gestiones y avances v1

**Punto anterior**: `8e9edfd8dead410f2edcbd5e635e452293760e32`
**Rama de resguardo**: `backup/antes-gestiones-20261106`
**Rama de implementación**: `feat/gestiones-avances-v1-20261106`
**Migración**: `supabase/migrations/202611060001_gestiones_y_avances.sql`
**Rollback funcional**: `supabase/rollbacks/202611060001_gestiones_reversion_segura.sql`

## Punto de recuperación de datos

Supabase proyecto `vnjqzpbtcccpnxngoqfx`, esquema **no expuesto** `copro_reversion_20261106`, con acceso revocado a `anon` y `authenticated`.

Snapshot creado antes de desplegar migración:
- 25 registros de `compromisos_administracion`.
- 20 `compromisos_subtareas`.
- 3 `compromisos_avances`.
- 22 `compromisos_transiciones`.
- 26 `drive_archivos_comunidad`.
- Definiciones de 3 funciones originales de estados y avance.

La copia NO está en el bucket de documentos ni en el frontend; no se ha exportado información privada al repositorio.

## Procedimiento de retorno sin pérdida de información

1. Detener nuevas escrituras de gestiones durante la ventana de retorno (avisar a administradores, detener sesiones de edición). Verificar cambios registrados después del snapshot; NO restaurar tablas indiscriminadamente porque borraría avances nuevos.
2. Revertir el merge de la funcionalidad en `develop` (o publicar el contenido de `backup/antes-gestiones-20261106`). Verificar que el workflow de Pages finalice.
3. Ejecutar `supabase/rollbacks/202611060001_gestiones_reversion_segura.sql` desde un contexto administrativo si también hay que restaurar el comportamiento antiguo del motor. El rollback deshabilita las nuevas RPC, restaura la función de progreso anterior, pero conserva los registros nuevos y el modelo de datos ampliado.
4. Verificar que los compromisos originales continúen accesibles, los documentos sigan en Drive y la selección de clientes permanezca restringida a su comunidad.
5. Si hubo gestiones con estados `en_pausa` o `bloqueado`, decidir si se conservan en DB para volver a la versión nueva o se traducen explícitamente a `en_espera` para UI antigua. No cambiar su estado automáticamente sin revisar el historial.
6. Para volver a Gestiones v1, publicar otra vez el código de la funcionalidad, conceder permisos de ejecución a las nuevas RPC y restaurar valores por defecto de `publicado` y `registrado_por` (la migración original es referencia). NO ejecutar una segunda vez inserciones de modelos a ciegas, aunque hay controles contra duplicados.

## Verificación SQL de conservación de datos

```sql
select count(*) from public.compromisos_administracion;
select count(*) from public.compromisos_subtareas;
select count(*) from public.compromisos_avances;
select count(*) from public.compromisos_transiciones;
select count(*) from public.drive_archivos_comunidad;

select count(*) from copro_reversion_20261106.compromisos_administracion; -- 25
select count(*) from copro_reversion_20261106.compromisos_subtareas; -- 20
select count(*) from copro_reversion_20261106.compromisos_avances; -- 3
select count(*) from copro_reversion_20261106.compromisos_transiciones; -- 22
select count(*) from copro_reversion_20261106.drive_archivos_comunidad; -- 26
```

## Diseño de compatibilidad

- No renombramos las tablas `compromisos_*`, rutas históricas ni IDs, para preservar aplicaciones existentes.
- Las nuevas columnas son opcionales salvo defaults compatibles y la biblioteca usa una tabla nueva protegida por RLS.
- El porcentaje continúa calculándose con el mismo motor y trigger, pero el estado se modifica de manera explícita en Gestiones v1.
- El historial de avances sigue en `compromisos_avances`; los documentos permanecen en Google Drive.
- Al revertir frontend, nuevas columnas y registros quedan conservados para una eventual restauración posterior.

## Advertencias

- Restaurar el snapshot completo después de que los usuarios hayan registrado avances nuevos puede provocar pérdida de información. Evitarlo salvo recuperación de desastre con comparación fila a fila.
- No eliminar `gestiones_tipos` ni los campos nuevos en una reversión de emergencia. La reversión de código es suficiente en el escenario normal.
- No crear políticas de lectura anónima para los modelos ni para documentos de cliente.
