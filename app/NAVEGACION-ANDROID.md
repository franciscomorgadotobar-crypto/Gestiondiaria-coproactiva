# Navegación con Atrás Android · Coproactiva App Diaria

## Objetivo

El botón físico o gesto Atrás debe utilizar el historial real de React Router, tanto en Chrome Android como en PWA instalada. No se bloquea el botón del sistema ni se crean pantallas fantasma para impedir salir.

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
- Las entradas autenticadas directas a un **inicio de área** de perfiles con selector reciben una entrada de selector previa. Los enlaces externos a otras rutas y el portal cliente mantienen el comportamiento normal del navegador.
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
8. Abrir la app directamente en `/seo`: Atrás llega al selector de módulos; un segundo Atrás deja la app en PWA o vuelve al navegador anterior. En rutas profundas sin selector no se crea un bucle de salida.

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

## Corrección de entrada y salida desde SEO / PWA (12-10-2026)

**Problema:** al abrir SEO como área recordada, la redirección `/ → /seo`
utilizaba replace y podía eliminar del historial la pantalla inicial.
En Android, el primer Atrás desde el Dashboard SEO cerraba la PWA.

**Solución:** en los inicios de área de perfiles internos con selector, cuando
el historial React Router comienza en `idx=0`, se registra una única
entrada real para `/` (con `selectorCoproactiva: true`) inmediatamente
antes de la vista. La pantalla SEO conserva sus parámetros URL.
Se hace después de validar sesión y perfil. No afecta Portal Cliente,
Ingreso ni a usuarios con una sola área y no bloquea el botón físico.

El botón **‹ Volver** usa la entrada del selector cuando está disponible,
en vez de duplicarlo con un `replace`. La secuencia deseada es:

1. Abrir SEO como área guardada → **Atrás**: selector de módulos.
2. En selector → **Atrás**: salir de PWA de forma natural (o volver a la página anterior del navegador si hay una).
3. Si hay pestañas SEO visitadas, **Atrás** recorre su historial real;
   el botón superior **‹ Volver** lleva directamente al selector conocido.
4. **Cambiar de área** conserva su función; **Salir** del selector sigue
   cerrando la sesión, que es distinto de cerrar la ventana de una PWA.

**Limitación:** los navegadores móviles controlan el cierre físico de la
ventana; no existe una API web confiable para cerrar programáticamente
una pestaña que no abrió la aplicación.
