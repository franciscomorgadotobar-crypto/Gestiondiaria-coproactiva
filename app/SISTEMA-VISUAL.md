# Sistema visual homologado · Coproactiva App Diaria

## Objetivo
Los módulos deben parecer partes de **una única aplicación**, sin eliminar diferencias funcionales entre Contabilidad, Comunidades, SEO, Levantamientos, Proveedores o WhatsApp. Se conserva paleta Coproactiva (naranja, pizarra, neutros), tipografías Montserrat / Source Sans Pro y estados semánticos existentes.

## Reglas comunes

| Componente | Comportamiento visual |
| --- | --- |
| Encabezado | Fondo blanco, borde inferior tenue, título Montserrat, descripción compacta, acciones alineadas; sin cambiar su disposición funcional |
| Tarjetas | Superficies blancas, borde neutro, radio 10 px y sombra muy sutil |
| Botones | Primario tinta, secundario neutro, enlace naranja; radio 7 px; en móvil mínimo 44 px táctiles |
| Filtros y formularios | Fondo blanco, bordes y foco de marca, 16 px en entradas móviles para evitar zoom involuntario |
| Tabs | Línea inferior y subrayado naranja en seleccionado, scroll horizontal en móvil |
| Indicadores | Las mismas familias de colores éxito / advertencia / error; estado siempre comunicado también con texto |
| Tablas | Separadores suaves y contenedor con desplazamiento horizontal, sin recortar celdas |
| Móvil/PWA | Anchos flexibles, sin barras horizontales involuntarias, respeta barra inferior existente |
| Accesibilidad | Focus visible, controles táctiles, soporte para reducción de movimiento |

## Arquitectura de estilos

- `app/src/estilos/tokens.css`: variables de marca y radios de componentes.
- `app/src/estilos/base.css`: estructuras generales heredadas.
- `app/src/estilos/modulos.css`: capa visual compartida, importada una sola vez en `app/src/main.jsx`.
- `modulo-unificado` en la raíz del módulo y `modulo-cabecera` en su encabezado. `modulo-contenido` solo en el cuerpo donde es apropiado.
- Cada CSS específico debe conservar diferencias operacionales (gráficos contables, expediente de comunidad, chat de WhatsApp). No volver a fijar paletas o radios contradictorios si ya existen variables comunes.

## Pantallas contempladas

Inicio, Comunidades, Levantamientos, Proveedores (listado, Recepción y Comunicaciones), Contabilidad, SEO y Analítica, Pipeline, Propiedades, Configuración, Plantillas, Bitácora, Mantenciones, Notificaciones, Mi cuenta, Equipo, Clientes, Ayuda, Programar, WhatsApp y Portal de clientes.

Las pantallas especializadas de terreno o editores de contenido ya comparten las variables globales, pero se mantienen sus diseños propios y requieren revisión visual por dispositivo antes de estandarizar sus controles internos de alta densidad.

## Pruebas de aceptación

1. Android/PWA: entrar en 5 módulos, comprobar títulos, tarjetas, separación, selectores, barra inferior y botones de 44 px.
2. SEO: Dashboard, Oportunidades, Diagnóstico y Seguimiento; tarjetas legibles sin recortar métricas.
3. Contabilidad: Balance, Libro Diario y formularios; sin cortar reportes ni filas contables.
4. Comunidades: ficha, levantamientos, activos, plan, agenda; comprobar que el checkbox horizontal siga funcional.
5. Proveedores: listado, ficha, comunicaciones, postulantes; conservar selección múltiple, filtros y adjuntos.
6. WhatsApp: historial y bandeja; conversación y controles se mantienen visibles tanto en escritorio como en móvil.
7. Portal cliente: consultas/incidencias/documentos, sin alterar autorizaciones ni permisos.
8. Navegación Atrás Android, modal y PWA instalable continúan funcionando; la homologación no intercepta eventos.

La cobertura estática se comprueba en `app/pruebas/visual.test.js` y la compilación en el CI. Validaciones visuales reales (capturas móvil/escritorio) son una comprobación independiente y no deben confundirse con pasar tests unitarios.

## Fase 1 — Accesibilidad y componentes de navegación (12-10-2026)

- Conservamos `--naranja` como acento de marca, pero el texto enlazado usa `--enlace: #955123`, que alcanza contraste AA sobre superficies claras.
- El texto secundario tenue se oscurece para permitir lectura en pantallas móviles.
- Unificamos las pestañas en `ui-pestanas`, con un único patrón de estado seleccionado para SEO, Contabilidad, Proveedores y WhatsApp. React Router marca automáticamente `aria-current="page"` en WhatsApp y Proveedores.
- Configuración de SEO tiene nombre accesible aunque su etiqueta visual esté oculta en móviles.
- `ui-estado`, `ui-estado--ok`, `ui-estado--alerta`, `ui-estado--critico` son clases compartidas para sustituir estados decorativos de futuras migraciones.
- Se incorporan pruebas de contraste y navegación como puerta de calidad del CI.

**Alcance:** Esta fase corrige estilos base y pestañas, sin modificar APIs, roles, permisos ni flujos contables/operacionales. No significa que se haya realizado una inspección visual de todas las pantallas autenticadas.

### Fase 2 — Pendiente, por área
1. Comunidades, Proveedores y formularios: sustituir estilos en línea, alinear acciones y validaciones.
2. Contabilidad: unificar tablas, KPIs y reportes en móvil sin recortar datos.
3. Levantamientos, editores, práctica y terreno: incorporar de manera segura las vistas omitidas por la primera homologación.
4. SEO y WhatsApp: migrar colores CSS específicos a tokens de marca, limpiar reglas obsoletas y simplificar cuadros informativos.
5. Portal, Propiedades, Pipeline y Configuración: revisión final del sistema y pruebas por rol.
6. Comprobación de pantallas reales Android/PWA y escritorio; accesibilidad teclado, lector de pantalla, Atrás y estado vacío/error.

**No usar selectores globales indiscriminados para forzar el aspecto de todas las entradas:** las pantallas de alta densidad y el trabajo de terreno necesitan migraciones específicas y regresiones visuales.
