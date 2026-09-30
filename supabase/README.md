# Base de datos — CoproActiva

Esquema de Supabase (PostgreSQL) para la app de administración de comunidades.

## Qué hay acá

| Archivo | Contenido |
|---|---|
| `migrations/0001_nucleo.sql` | Perfiles y roles, comunidades, unidades, copropietarios, residentes, comité |
| `migrations/0002_crm.sql` | Leads, prospectos e historial del embudo comercial |
| `migrations/0003_terreno.sql` | Plantillas de checklist, controles, hallazgos, órdenes de trabajo y adjuntos |
| `migrations/0004_rls.sql` | Políticas de acceso por rol y por comunidad |
| `migrations/0005_vistas_security_invoker.sql` | Hace que las vistas respeten RLS |
| `migrations/0006_endurecer_funciones.sql` | search_path fijo y cierre del acceso anónimo a las funciones |
| `migrations/0040_propiedades.sql` | Propiedades en arriendo y venta que publica el sitio: anon lee solo las publicadas y sus columnas públicas; bucket público `propiedades` |
| `seed/0001_prospectos.sql` | Los 9 prospectos reales migrados desde la planilla |
| `seed/0002_plantilla_estandar.sql` | Checklist mensual estándar y comunidad de prueba |

## Proyecto en uso

El esquema está aplicado en el proyecto `vnjqzpbtcccpnxngoqfx`
(`https://vnjqzpbtcccpnxngoqfx.supabase.co`), con los 9 prospectos cargados, un
perfil `admin` y la comunidad de prueba.

## De dónde sale el modelo

El núcleo y el CRM salen de la estructura real de `coproactivAPP`, la planilla de
Google Sheets que opera hoy. El módulo de control en terreno es nuevo y sale del
diseño en `figma/`.

De la planilla se tomó el **modelo de dominio** —qué entidades existen y qué
campos importan—, no el código de Apps Script: ese arrastra el diseño original
de modal sobre Sheets, que no se traduce a una app web.

Cuatro cosas cambian respecto de la planilla:

**Los identificadores pasan a uuid.** El id anterior (`COM-MQ4CVAEH-8XF0`,
`PROS_F38F2331BB8F`) queda en `id_legacy` para poder rastrear un registro hasta
la planilla mientras dure la transición.

**Los valores calculados dejan de guardarse.** El semáforo de un prospecto y el
avance de un control eran columnas; ahora son vistas. Una columna almacenada se
desincroniza: una acción vencida seguía apareciendo en verde porque nadie
recalculó la fila.

**Los estados pasan a enums.** `tipoServicio` mezclaba "administración",
"Administración de comunidades" y "Auditoría y asesoría" para lo mismo.

**El control de acceso pasa a la base de datos.** En la planilla vivía en dos
columnas de la hoja Usuarios y lo aplicaba el Apps Script; cualquiera con acceso
a la planilla veía todo. Ahora lo hace Postgres: aunque alguien consulte directo
con la clave pública, solo recibe lo que su rol permite.

## Una trampa que conviene recordar

Una vista de Postgres se ejecuta con los permisos de su dueño, no de quien
consulta. Con RLS activo en todas las tablas, `prospectos_con_semaforo` y
`controles_con_avance` igual devolvían todo: bastaba consultar la vista en vez de
la tabla. Por eso las tres vistas llevan `security_invoker = true`
(`0005`). Cualquier vista nueva sobre datos con RLS necesita lo mismo.

## Roles

| Rol | Alcance |
|---|---|
| `superadmin` | Todo. Es el rol de Osmar Meza en el sistema actual |
| `admin` | Todas las comunidades, incluido crear y dar de baja |
| `jefatura` | Solo sus comunidades asignadas; el embudo comercial completo; puede corregir controles ajenos |
| `terreno` | Solo sus comunidades asignadas, solo sus propios controles, sin acceso al CRM |

Las asignaciones van en `perfil_comunidades`. `superadmin` y `admin` no necesitan
filas ahí: ven todo por rol.

Dos restricciones que importan y están probadas:

- **Terreno no puede completar el control de otra persona.** Si alguien pudiera
  llenar el control de un colega, el check-in geolocalizado dejaría de ser prueba
  de que esa persona estuvo en el lugar.
- **Terreno no puede borrar adjuntos.** Una foto de evidencia solo la elimina
  administración.

## Levantar el esquema

En un proyecto nuevo de Supabase, correr en orden desde el editor SQL:

```
0001_nucleo.sql → 0002_crm.sql → 0003_terreno.sql → 0004_rls.sql
              → 0005_vistas_security_invoker.sql → 0006_endurecer_funciones.sql
```

Después los seeds. El `0002` necesita que exista un perfil con rol `admin`, así
que primero hay que crear el usuario en *Authentication → Users* y su fila en
`perfiles`:

```
seed/0001_prospectos.sql → seed/0002_plantilla_estandar.sql
```

Con la CLI de Supabase:

```bash
supabase db push
supabase db execute --file supabase/seed/0001_prospectos.sql
```

## Probar los cambios antes de subirlos

Las migraciones se validaron contra PostgreSQL 16 local, no solo por lectura.
Para repetirlo:

```bash
# Postgres no corre como root
useradd -m postgres 2>/dev/null
export PATH=/usr/lib/postgresql/16/bin:$PATH
mkdir -p /tmp/pgval && chown postgres /tmp/pgval
su postgres -c "initdb -D /tmp/pgval -U postgres --auth=trust"
su postgres -c "pg_ctl -D /tmp/pgval -o '-p 55432 -k /tmp' -l /tmp/pgval/log start"

# Supabase provee auth.users y auth.uid(); acá se simulan
psql -h /tmp -p 55432 -U postgres -c "create database cop;"
psql -h /tmp -p 55432 -U postgres -d cop <<'SQL'
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL

for f in supabase/migrations/*.sql; do
  psql -h /tmp -p 55432 -U postgres -d cop -v ON_ERROR_STOP=1 -f "$f"
done
```

Para probar RLS hay que consultar con un rol sin privilegios (RLS no aplica al
superusuario) y fijar el usuario simulado:

```sql
set role autenticado;               -- en Supabase el rol se llama `authenticated`
set request.jwt.claim.sub = '<uuid del perfil>';
select * from comunidades;
```

Contra el proyecto real, lo mismo con `set local` dentro de una transacción.

## Qué falta

Estos módulos existen en la planilla y siguen vigentes, pero no están en este
primer corte:

- **Diagnósticos con score** — evaluación por categorías (legal, financiero,
  laboral, técnico, seguridad, documental) con puntaje y conclusión. Hoy el
  cálculo del score vive en el Apps Script y hay que rescatar esa fórmula.
- **Gastos comunes y morosidad** — emisión, cobro, deuda acumulada y gestión de
  cobranza por unidad.
- **Nómina de trabajadores** — liquidaciones con AFP, salud, seguro de cesantía,
  mutual e impuesto de segunda categoría. Es el más normado: antes de modelarlo
  hay que fijar de dónde salen los indicadores previsionales de cada mes.

También quedan fuera contratos con proveedores, mantenciones, documentos con
vencimiento y comunicaciones, todos presentes en la planilla.
