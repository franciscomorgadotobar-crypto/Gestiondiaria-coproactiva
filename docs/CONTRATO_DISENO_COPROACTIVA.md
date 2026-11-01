# COPROACTIVA | Contrato de diseño obligatorio

Vigencia: noviembre de 2026. Ámbito: Gestión Diaria, PWA, web y APK.

Este documento contiene restricciones comprobables, no una autorización para rediseñar en cada tarea.

## Fuentes de verdad
- Marca y dimensiones: app/src/estilos/tokens.css y app/src/estilos/identidad-app.css
- Diseño de módulos: app/src/estilos/modulos.css
- Área Comercial: app/src/estilos/comercial-homologado.css
- Ajustes excepcionales: archivo CSS propio de cada módulo, solo para necesidades no cubiertas
- Pruebas: app/pruebas/contrato-diseno-estatico.test.js y app/pruebas/ui-contrato-diseno.mjs

Si hay dos reglas contradictorias, se modifica la fuente original en lugar de añadir excepciones.

## Reglas obligatorias de construcción
1. Móvil 320, 360, 390 y 412 px: 16 px de separación lateral objetivo, **mínimo real de 12 px**. Ningún título, tarjeta, campo ni acción debe tocar el borde del dispositivo.
2. Tablet y escritorio 768 y 1280 px: alineación de cabeceras y contenidos; columnas fluidas minmax(0,1fr).
3. Un encabezado puede tener fondo de borde a borde, pero el texto no. Prohibida la combinación de padding lateral en raíz más márgenes negativos compensatorios en cabecera.
4. No debe existir scroll horizontal del documento. Únicamente chips y tablas con contenedor independiente pueden desplazarse. No esconder errores con overflow-x:hidden o clip en el módulo principal.
5. Botones de acciones principales: altura táctil mínima de 44 px en móvil. Ningún botón fuera del viewport o recortado por la tarjeta.
6. Gestor Documental: tarjetas horizontales con icono, texto y Crear; una tarjeta por fila móvil. Biblioteca y Drive debajo de las plantillas y recientes, no en segunda columna móvil.
7. Pipeline: indicadores en 2 columnas en móvil, chips desplazables; no alterar navegación, gestión ni etapas.
8. Propiedades: encabezados, tarjetas y filtros homologados; no modificar el estado de publicación.
9. SEO: encabezado y controles homologados, KPI a dos columnas en móvil, no modificar datos ni su fuente.
10. Identidad: colores existentes Coproactiva, superficies blancas, fondo cálido y controles con bordes suaves.
11. Accesibilidad: foco visible, etiquetas, contraste suficiente, navegación de teclado y estados distinguibles.
12. Sin cambios accidentales en Home, barra inferior, Netlify, migraciones o datos de negocio durante tareas visuales.

## Proceso obligatorio antes de publicar
1. Leer este contrato y localizar el componente aprobado más parecido.
2. Reutilizar las variables CSS existentes en vez de inventar estilos duplicados.
3. Ejecutar la prueba estática y **la prueba geométrica de Chromium sobre la UI renderizada**.
4. Pasar la batería completa en 320/360/390/412/768/1280 px para Pipeline, Documentos, Propiedades y SEO.
5. Si una prueba falla, corregir la causa y añadir regresión. No desactivar test ni ocultar el desborde.
6. Revisar las capturas artifacts/ui/contrato-*.png en los artifacts de GitHub Actions y confirmar legibilidad general.
7. Si se añade un módulo, incorporar su ruta a la matriz de la prueba visual.
8. Cualquier excepción requiere aprobación explícita y actualización coordinada de reglas, CSS y test.

## Alcance del filtro
Las comprobaciones automatizadas detectan ancho, alineación, desbordamientos, presencia y estructura. No garantizan criterios subjetivos de diseño ni sustituyen revisión visual. Para impedir la fusión de cambios que fallen, el repositorio debe configurar el job de GitHub Actions como REQUIRED en la protección de la rama; la existencia del test no configura por sí misma ese bloqueo.
