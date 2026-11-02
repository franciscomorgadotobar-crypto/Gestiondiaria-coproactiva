# Instrucciones para asistentes de código en Coproactiva

Antes de modificar cualquier frontend de Gestión Diaria, leer docs/CONTRATO_DISENO_COPROACTIVA.md.
Para nombrar ramas y organizar carpetas, leer docs/ORGANIZACION_CODIGO_Y_RAMAS.md.

- No rediseñar interfaces aprobadas salvo petición explícita.
- Reutilizar tokens.css, identidad-app.css, modulos.css y comercial-homologado.css.
- Móvil: margen lateral real 16 px (mínimo 12), sin scroll horizontal general. Revisar 320/360/390/412/768/1280 px.
- Gestor Documental: tarjetas horizontales en una columna y Biblioteca y Drive debajo; nunca márgenes negativos compensatorios.
- Pipeline, Propiedades y SEO usan el mismo encabezado, escala de botones y sistema de tarjetas.
- Si la petición es visual, no modificar Home, barra inferior, datos, tablas, correo ni lógica operativa.
- En cada PR visual, ejecutar desde app/ la prueba estática con node --test pruebas/contrato-diseno-estatico.test.js y la prueba renderizada con node pruebas/ui-contrato-diseno.mjs sobre Vite.
- No afirmar que se validó el diseño solo porque coincida un patrón de texto CSS: verificar getBoundingClientRect, scrollWidth y capturas de Chromium.
- No eliminar, relajar ni saltar los tests para hacer que la PR sea verde. Corregir las causas.
- Excepciones al contrato visual solo con aprobación explícita.
