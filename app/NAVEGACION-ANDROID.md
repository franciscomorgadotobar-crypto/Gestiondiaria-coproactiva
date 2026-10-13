# Navegación con Atrás Android · Coproactiva App Diaria

## Objetivo

El botón físico o gesto Atrás debe utilizar el historial real de React Router, tanto en Chrome Android como en PWA instalada. No se bloquea el botón del sistema. Se prepara una sola entrada real del Home autorizado únicamente cuando se abre directamente una ruta interna sin historial.

## Cobertura implementada

- Navegación entre rutas ya existentes: módulos, listados, fichas, usuarios, proveedores, contabilidad, mantenciones, bitácora y otras pantallas que usan `<Link>` o `navigate` de React Router.
- SEO y Analítica: cada pestaña genera entrada real `/seo?vista=...`. Atrás recupera Dashboard, Búsquedas, Seguimiento u otra pestaña anterior. Enlaces mantienen filtros y otros parámetros.
- Detalle de Comunidades: las secciones `?seccion=...` ya no sobrescriben el historial. El botón Atrás recupera la sección anterior.
- Portal Cliente: secciones `?seccion=...` con la misma regla.
- CRM / Pipeline: la etapa seleccionada `?etapa=...` se restaura al retroceder.
- Menú móvil «Más»: abrir crea una entrada de historial; Atrás lo cierra sin abandonar el módulo. Elegir un enlace lo cierra y navega a su destino sin dejar un menú abierto en la historia.
- Diálogos comunes de confirmación, entrada de datos y registro de mantenciones: se utiliza un marcador en el estado de React Router para que el primer Atrás cancele el diálogo antes de salir. Se limpia el marcador al cerrar mediante controles.
- Se eliminó un uso manual de `history.replaceState(null,...)` al ir a Levantamientos, porque borraba metadatos del historial de React Router.

## Reglas de seguridad

- La navegación Atrás **no guarda ni elimina datos por sí sola**. Un diálogo de confirmación se cancela, no confirma la operación.
- Los formularios con cambios sin guardar conservan sus propios avisos, pero cada pantalla puede requerir pruebas de negocio adicionales.
- Las entradas autenticadas directas a **cualquier ruta interna** (inicios, fichas, reportes, levantamientos, configuración, notificaciones) se redirigen al Home de acceso autorizado cuando el documento se abre. El portal cliente y el login no se alteran.
- No se registran scrolls, contraseñas ni contenido de formularios en parámetros URL. Solo IDs de pestaña/etapa/menú.
- Se respetan parámetros existentes, por ejemplo `?comunidad=...`.

## Prueba manual Android / PWA

1. Entrar en SEO → Búsquedas → Seguimiento → pulsar Atrás dos veces: Búsquedas, luego Dashboard.
2. Ir a Comunidades → ficha → Activos → Agenda → Atrás: Activos → Atrás: Resumen/ficha o listado según historial real.
3. Ir al CRM → elegir etapas → Atrás: regresar a etapa anterior sin salir del CRM.
4. Abrir «Más» en navegación inferior → Atrás: solo se cierra el menú.
5. Abrir un `Confirmar` o `DialogoCampos` → Atrás: cancelar diálogo sin confirmar borrado/acción.
6. En Portal Cliente, alternar Incidencias/Documentos → Atrás restaura pestaña.
7. Navegar de un módulo a otro mediante un enlace y pulsar Atrás: vuelve al módulo previo.
8. Abrir directamente `/seo` o `/control/123` como administrador: la app muestra de inmediato el selector de módulos. Como rol de una sola área, un enlace a `/comunidades/123` regresa a `/inicio` y luego sale.

Los tests unitarios verifican lectura/escritura de parámetros URL y que no se borren parámetros ajenos. Los recorridos completos deben validarse en Android real o emulador PWA para todos los componentes de terceros.

## Selector de áreas

Cuando se selecciona un área desde la pantalla de selección, React Router conserva esa pantalla en el historial antes de abrir CRM, Operación, Propiedades, Proveedores, WhatsApp, Contabilidad o SEO. El gesto Atrás desde el primer nivel del área regresa a la selección y permite elegir otra, aunque exista un área guardada previamente. Esto evita el bucle anterior que redirigía inmediatamente a la misma área al volver a `/`. El portal cliente y entradas externas directas conservan su comportamiento normal.

## Volver dentro de la aplicación: jerarquía reforzada (12-10-2026)

El control **«‹ Volver» de la barra de la app** aplica un recorrido funcional predecible:
**detalle/edición → listado o módulo → inicio del área → selector de área**.
Esto incluye controles de levantamientos, postulantes y comunicaciones de proveedores,
fichas de comunidades y propiedades, reportes contables y secciones de ayuda.
Desde Mi cuenta y Notificaciones regresa al inicio del **área elegida** (CRM,
SEO, Contabilidad, WhatsApp u Operación), y no salta incorrectamente a Operación.

El selector es el último retroceso **solo si el perfil tiene acceso a varias áreas**.
Usuarios con una sola área permanecen en el inicio de su área.
El último paso limpia únicamente la **preferencia de área** guardada; no cierra
sesión ni modifica datos de las comunidades. Se marca el selector explícitamente
en el estado de navegación para evitar redirecciones inmediatas.

**Diferencia importante:** el gesto físico Atrás de Android conserva el historial
real de React Router y cierra previamente pestañas o diálogos registrados en ese
historial. Al entrar desde el selector, ese historial lo conserva como destino
de regreso. Las entradas externas directas sin historial conservan la salida
normal de Android (no se bloquea ni se crea un historial artificial).

## Política vigente de apertura de PWA

**Cada apertura o recarga del documento empieza en el Home determinado por el perfil autenticado**, y nunca restaura automáticamente SEO ni el último módulo.

- **Superadmin / admin / jefatura:** selector principal de módulos con tarjetas según permisos.
- **Rol interno de área única:** inicio de Operación, sin selector de administración.
- **Cliente:** portal propio, sin acceso al selector interno.
- **Sin sesión:** ingreso.

La función Entrada dejó de consultar la preferencia antigua de área. Al iniciar una sesión de documento se limpia la selección local anterior, sin borrar sesiones, comunidades ni datos. Las preferencias todavía se utilizan mientras se navega en esa sesión.

Si Android restaura una URL interna (por ejemplo, /seo o /control/123), antes de montar React Router el arranque reemplaza esa misma entrada del historial por /. No se apila la página antigua: Atrás no puede devolverla como efecto de nuestra navegación.

Una vez abierto el Home, la elección explícita de un módulo conserva el historial normal. Atrás puede volver del módulo al Home; otro Atrás puede salir de la PWA o retornar al navegador, según Android. El botón Salir cierra sesión y no equivale a Atrás.

Pruebas: Node verifica el arranque y Chromium móvil con perfil simulado prueba superadmin, jefatura, terreno y cliente; SEO guardado no se autoselecciona y solo abre tras pulsar su tarjeta.

Nota: no se reinicia la pantalla al alternar brevemente entre aplicaciones (por ejemplo, al usar la cámara durante un levantamiento) para evitar perder trabajos sin guardar. La regla se ejecuta al abrir o recargar realmente el documento.
