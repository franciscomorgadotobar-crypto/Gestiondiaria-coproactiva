# Auditoría transversal de interfaz y navegación — CoproActiva Gestión Diaria
**Fecha:** 24 de octubre de 2026  
**Alcance:** presentación y experiencia de navegación del frontend PWA/Android.  
**Sin modificaciones:** permisos, funciones de negocio, bases de datos, autenticación, integraciones, persistencia o datos de producción.

## Principio de diseño
Una única jerarquía: (1) área de trabajo; (2) navegación principal del área; (3) secciones internas del módulo; (4) acciones contextualizadas. «Cuenta y navegación» es una categoría transversal, no un módulo de trabajo.

Las áreas operativas son **Comercial, Operaciones y Finanzas**. **Administración y ajustes** es un acceso secundario con la descripción: «Equipo, usuarios, permisos, accesos de clientes y configuración general».

## Inventario técnico revisado
Inspección de la ruta y marco compartido en `App.jsx`, `PanelEscritorio.jsx`, `SeleccionArea.jsx`, `tokens.css`, `base.css`, `modulos.css`, `identidad-app.css`, y los archivos principales de:

- **Comercial:** Pipeline, Propiedades y nueva propiedad, Diagnóstico Comercial, SEO y sus vistas de dashboard, oportunidades, recomendaciones e impacto.
- **Operaciones:** Inicio, Comunidades y detalle, Levantamientos, Plantillas, Programar, Bitácora, Mantenciones, Mapa, Proveedores, Correos, Postulantes, Comunicaciones, WhatsApp y Notificaciones.
- **Finanzas:** Contabilidad, asientos, reportes, plan de cuentas, entidades y ajustes contables.
- **Administración:** Configuración general, Equipo, Clientes y accesos, Mi cuenta y Ayuda.
- **Otros roles:** Portal Cliente y compromisos, Inicio de Terreno, Control y Despacho.

Se respetan los subcomponentes incrustados que NO constituyen pantallas autónomas (por ejemplo, widgets de SEO y editor de compromisos).

## Hallazgos y acciones
| Severidad | Hallazgo comprobado en código | Acción de esta rama |
|---|---|---|
| Alta | En escritorio el padding horizontal de la cabecera (18–34 px) no coincidía con la columna centrada del contenido (40 px o más). | Calcular la misma columna mediante `--ca-margen-contenido` según el ancho máximo de cada pantalla. |
| Alta | SEO sustituía la cabecera estándar por una tarjeta flotante, márgenes propios y botón primario cobrizo. | Volver a la cabecera integrada, al margen y botón principal compartidos. |
| Media | En móviles de 391–899 px había discrepancia de 2 px entre cabeceras y cuerpos compartidos. | Margen lateral común de 16 px. |
| Media | Clientes y accesos utilizaba margen móvil de 14 px frente a 16 px en encabezado. | Ajustar margen del cuerpo a 16 px. |
| Media | El menú «Más» mezclaba acciones del módulo y elementos de cuenta en una sola lista. | Secciones semánticas independientes: «Módulos y acciones» / «Cuenta y navegación», manteniendo rutas y permisos. |
| Media | Menú «Más» sin límite vertical claro para pantallas pequeñas. | Máxima altura en función del viewport, scroll interno y cabecera fija. |
| Media | Etiquetas de navegación inferior de 8,5 px, difíciles de leer. | Tamaño mínimo en esa barra elevado a 11 px, manteniendo cinco destinos. |

## Validación automática
- **Pruebas unitarias y compilación:** GitHub Actions `Validar correcciones CoproActiva`; abarca navegación, UI base, estados, SEO, seguridad del flujo de acceso y compilación Vite.
- **Navegación en navegador simulado (sesión de QA):** Comercial / SEO / Arriendos, Operaciones / Proveedores, Finanzas, Administración / Clientes y acceso transversal.
- **Alineación visual medida:** cabecera versus contenedor del módulo en 390 px y 1280 px, para ocho destinos principales.
- **Detalle de pantallas internas:** prueba existente de 14 vistas en 360, 390, 768 y 1280 px, incluido desbordamiento horizontal y controles principales.
- **Altura móvil reducida:** prueba de menú «Más» en 360 × 550 px, sin cubrir la barra inferior y manteniendo «Cambiar de área» accesible.
- **Pruebas estructurales ampliadas:** también cubren Portal Cliente, Terreno, Propiedades, Diagnóstico Comercial y submódulos de Proveedores.

Los navegadores de QA usan respuestas simuladas. Pasar esas pruebas **no demuestra** que cada estado de datos reales, archivo subido, cuenta externa, dispositivo físico o flujo de negocio haya sido verificado manualmente.

## Pendientes o riesgos sin alterar
1. **CSS heredado:** `base.css` aún contiene estilos antiguos por módulo y `identidad-app.css` los complementa; conviene depurar duplicidades con una comparación visual completa, en una fase separada para evitar regresiones.
2. **Estados dependientes de producción:** validación de datos reales, errores de integraciones, permisos específicos e historiales; requieren cuentas de prueba autorizadas, no simulaciones.
3. **Dispositivos reales:** además del emulador, se recomienda comprobar Android con teclado abierto, fuentes ampliadas, modo horizontal, accesibilidad y PWA instalada.
4. **Módulos de alta densidad:** edición avanzada de Comunidad, Contabilidad, tablas de Proveedores y reportes de SEO requieren pruebas de contenido extremo y textos largos.
5. **WhatsApp:** conserva un encabezado adaptado al chat por necesidad funcional; usa identidad cromática y tipográfica compartida, pero no se fuerza a una plantilla de pantalla convencional.

## Criterios de aceptación
- Menús principales estables según área y rol; sin acciones de otros módulos en «Más».
- Botones y filtros mantienen jerarquía, tamaño táctil y contraste adecuados.
- Encabezados y contenido con eje horizontal común; sin desbordamiento global en viewport móvil.
- No se pierde navegación, secciones, permisos ni datos por cambios de estilos.
- CI verde antes de integrar; desplegar exclusivamente tras validar los cambios.
