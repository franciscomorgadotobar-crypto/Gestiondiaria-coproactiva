# Auditoría de funciones privilegiadas — Coproactiva

**22 de octubre de 2026 · PR #45 · Estado: propuesta, NO aplicada a producción.**

## 1. Inventario (consulta de solo lectura)
- **99** funciones `SECURITY DEFINER` en el esquema `public`.
- **11** con permiso `EXECUTE` para `anon`.
- **74** con permiso `EXECUTE` para `authenticated`.
- Estas categorías se superponen y son **advertencias de exposición**, no 85 vulnerabilidades.
- No se detectó permiso `CREATE` en el esquema `public` para `anon` ni `authenticated`.

## 2. Exposiciones efectivamente demostradas
La función `public.nombre_de_perfil(uuid)` es `SECURITY DEFINER`,
acepta un UUID de cualquier perfil y no verifica los permisos del invocador.

En la base de producción, con transacciones `BEGIN READ ONLY` y
`SET LOCAL ROLE`, y sin devolver nombres personales:

- **Anónimo:** se comprobó que podía recuperar un nombre asociado a un UUID
  existente sin autenticación.
- **Cliente autenticado:** una cuenta cliente no veía el perfil del
  administrador por `SELECT` y RLS (0 filas), pero sí podía obtener su
  nombre mediante esta función.

## 3. Dependencias y propuesta de corrección
`public.controles_con_avance` invoca
`nombre_de_perfil(c.responsable_id)` y utiliza `security_invoker=true`.
Revocar la función a todos los usuarios autenticados rompería esa vista.

El SQL propuesto:
1. Revoca `EXECUTE` de `nombre_de_perfil(uuid)` a `anon`.
2. Reemplaza su cuerpo: `authenticated` solo recibe nombres cuando tiene
   perfil activo y se trata del propio usuario, un administrador autorizado,
   un perfil con comunidad compartida visible mediante `ve_comunidad`,
   o un responsable de control visible mediante `ve_control`.
3. Conserva los accesos del rol interno `service_role` y de administradores.
4. Revoca la ejecución directa para `anon` y `authenticated` de seis
   funciones internas `RETURNS trigger`; los triggers del motor PostgreSQL
   permanecen habilitados.
5. No modifica estructuras, vistas ni datos. Cuenta con rollback de
   definición y permisos.

## 4. Pruebas automatizadas
Las pruebas de la PR en PostgreSQL 17 efímero comprueban:
- La exposición anterior en datos ficticios.
- Prohibición de invocación anónima.
- Aislamiento de cliente activo frente al nombre de un administrador.
- Lectura permitida del nombre del propio cliente.
- Acceso del personal de terreno a responsables de controles visibles y
  conservación del nombre en la vista `controles_con_avance`.
- Acceso de administrador activo y del rol `service_role`.
- Denegación para perfiles inactivos.
- Funcionamiento de seis triggers pese a la revocación de `EXECUTE`.
- Restauración de definición y privilegios mediante rollback.

**La prueba sobre la base PostgreSQL temporal no reemplaza la validación
integral en la base real antes de desplegar.**

## 5. Otros resultados por investigar
Se identificaron funciones cuya autorización se delega a otras funciones
(`bitacora_puede_ver_comunidad`, etc.), así como funciones que devuelven
metadatos según UUID sin que su propio cuerpo verifique `auth.uid()`
(`bitacora_iniciales_usuario`,
`contabilidad_entidad_tiene_movimientos`,
`es_control_diagnostico`). Deben evaluarse individualmente antes de revocar
permisos por el posible impacto en las consultas internas y políticas RLS.

## 6. Archivos y despliegue
- `supabase/pendientes/auditoria_funciones_definer_20261022.sql`: propuesta
  pendiente, **NO** incluida aún en `supabase/migrations/`.
- `supabase/pendientes/auditoria_funciones_definer_20261022_rollback.sql`.
- `supabase/tests/auditoria_funciones_definer_20261022_*.sql`:
  escenarios de integración.
- `.github/workflows/validar-funciones-privilegiadas.yml`: CI aislado.

Antes de instalar:
- Obtener autorización explícita para promover y aplicar a producción.
- Validar la compatibilidad real de la vista y operaciones de perfiles.
- Confirmar el estado de funciones, ACL, RLS y CI, y registrar la migración.
- Mantener costos adicionales en cero; no crear ramas Supabase de pago.
