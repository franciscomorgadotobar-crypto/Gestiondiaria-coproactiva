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
- No se fuerza el regreso al Home cuando la persona abre una URL directamente desde un enlace externo: el sistema conserva el comportamiento natural del navegador.
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
8. Abrir la app directamente en una ruta profunda sin historial: se permite la acción normal de Android; no se crea un bucle de salida.

Los tests unitarios verifican lectura/escritura de parámetros URL y que no se borren parámetros ajenos. Los recorridos completos deben validarse en Android real o emulador PWA para todos los componentes de terceros.
