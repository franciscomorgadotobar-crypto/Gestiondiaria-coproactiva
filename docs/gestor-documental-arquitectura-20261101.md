# Gestor documental de Coproactiva - diseño funcional y visual (01-11-2026)

## Decisión de arquitectura
Mantener **Gestor documental** como módulo propio de Gestión Diaria. Es dueño de las plantillas, los documentos generados, las versiones y su repositorio. Los demás módulos **consumen sus servicios desde su contexto**: CRM, editor de correos, Proveedores, Comunidades, Operaciones y Portal Cliente donde los permisos lo autoricen. No duplicar un editor por cada módulo. No convertir el correo en centro de documentos. Preservar el motor único TÉCNICO de correos con interfaces contextuales independientes.

La PR #89 integra inicialmente el **generador de propuestas** (tomado de main/sitio/propuestas). Esta integración es solo la primera plantilla funcional y NO equivale a tener implementado todo el gestor documental.

## Referencias visuales entregadas (archivos aportados por el usuario, no publicar ni subir a repositorio)
1. `Coproactiva - Las Palmeras.pdf` y `Coproactiva - Propuesta Arturo Prat 407.pdf`: plantilla **Propuesta comercial / Administración integral**. Tres páginas, introducción, valor de la administración, alcance, plazos, tiempos de respuesta, honorarios y condiciones.
2. `Seguimiento Coproactiva - Plaza Nos.pdf`: plantilla **Seguimiento de antecedentes**. Siete páginas A4, antecedentes recibidos/solicitados, revisión preliminar de reglamento, información faltante, materias a coordinar, proceso y responsables.
3. `Puesta en marcha - Etapa 1.pdf`: plantilla **Primera administración / Puesta en marcha**. Dos páginas, datos de proyecto, hitos normativos, antecedentes por recabar, entregables y firma/responsable.
4. `Informe 1 - Gestion Reserva Santa Clara 30-10.pdf`: plantilla **Informe de gestión / Avances**. Dos páginas, gestiones con fecha/resultado, próximos pasos con responsables/condiciones y hitos del periodo.

**Cuatro familias, cinco documentos de referencia.** Reusar su lenguaje visual, no codificar nombres/montos/leyes como textos inmutables en el motor. Las cifras, plazos y afirmaciones legales son datos de cada instancia y se deben revisar antes de emitir.

## Identidad visual de documentos
- Logo oficial Coproactiva, sin reconstrucciones tipográficas ni marcas de agua.
- Espacios blancos amplios y ritmo editorial. Títulos y etiquetas sobrias con tonos grafito, acentos naranjos y líneas de separación finas.
- Identidad principal del producto: `#ed7130` (naranja), `#d0a207` (dorado), `#696969` (gris); en PDF mantener el aspecto de las referencias: grafito `#2b3138`, naranja editorial cercano a `#c9792a` para subtítulos, fondos cálidos neutros.
- Tipografía legible con jerarquía de títulos, párrafos, subtítulos, notas y tablas; preferir familia de estilo Montserrat y Source Sans 3 donde estén licenciadas/disponibles dentro de la app; no distribuir fuentes externas.
- Encabezados de tabla grafito oscuro y texto blanco, filas alternadas cálidas muy claras, numeración de sección `01`...`NN` naranja, badges de responsable donde corresponda.
- Encabezado y pie con identificación de documento/cliente, confidencialidad cuando aplique, número de página correcto.
- Papel A4 para informes tipo Plaza Nos; formato carta cuando corresponda al original. El formato debe seleccionarse por plantilla y no alterar escala arbitrariamente.
- Usar guion ASCII `-` en textos visibles, de acuerdo con estándar global; no usar raya larga.
- IMPORTANTE: los PDF de propuesta Las Palmeras y Arturo Prat presentan problemas de solapamiento de contenido en la segunda página y paginación/recuento inconsistentes en la extracción visual. **Corregir paginación y desbordes** al hacer plantillas editables; no copiar defectos del archivo.

## Estructura prevista
`Gestor documental` como módulo principal, con secciones:
- **Documentos**: buscar, filtrar por tipo, comunidad/prospecto/proveedor, creador, fecha, estado y versión.
- **Crear documento**: elegir una de las cuatro familias, seleccionar contexto o crear desde cero, completar campos y secciones opcionales, previsualizar.
- **Plantillas**: catálogo con versión y edición restringida. No confundir plantilla de documento con plantilla de correo.
- **Biblioteca y Drive**: originales y PDFs generados, archivo físico, carpetas, permanencia y enlaces a contextos.

Estados recomendados por documento: `borrador`, `en_revision`, `aprobado`, `emitido`, `archivado`. Guardar revisiones inmutables al emitir; una edición posterior crea nueva versión.

## Contrato de integración
- CRM: botón **Crear documento** con prospecto preseleccionado; al emitir, vínculo al historial de prospecto, sin obligar a crear lead para generar documento.
- Correo CRM/Proveedores: acciones **Adjuntar desde documentos** y **Crear desde plantilla** dentro del compositor. La selección debe traer **PDF real** a la lista de adjuntos. También permitir modalidad opcional de **documento con seguimiento** cuando esté implementada, con seguimiento de acceso/solicitud de descarga; no atribuir a una persona ni afirmar lectura.
- Operaciones/Comunidades: creación de informe de gestión, seguimiento de antecedentes y puesta en marcha, enlazados a la comunidad, con permisos y clasificación.
- Drive: la opción de **guardar copia permanente** es **por documento**; cada documento puede usar una carpeta distinta. El original del repositorio no debe ser movido ni borrado al guardar una copia.
- Portal cliente: exponer únicamente versiones emitidas y explícitamente publicadas para esa comunidad. No exponer borradores comerciales ni documentos internos.
- Motor único técnico de correo se mantiene compartido; nada de bandeja global obligatoria.
- Historial cruzado por identificadores opacos de documento, versión y contexto; no copiar contenido en múltiples tablas sin necesidad.

## Seguridad y migración
- Metadatos/RLS en Supabase; almacenamiento privado y descargas autorizadas. Links temporales o tokens revocables para destinatarios externos.
- Controles por módulo, rol, entidad y comunidad; registrar eventos de modificación/emisión/compartición.
- No eliminar `sitio/propuestas` ni `/api/propuestas` de Netlify hasta extraer, validar y migrar las propuestas históricas. La PR #89 es **DRAFT** hasta prueba de PDF, migración y permisos.
- Los PDF aportados son **referencias de estilo y contenido**; no son plantillas editables ni autorizan a inferir reglas legales o económicas universales.
- Para revisión final de calidad PDF: comprobar cabeceras, saltos de página, tamaños de tabla, pie, cantidad real de páginas, fuentes y ausencia de solapamientos tanto en escritorio como en móvil.

## Etapas
1. **Base navegable**: módulo principal propio, acceso al generador de propuestas migrado y links contextuales desde CRM/Correo, conservando la versión antigua.
2. **Biblioteca estructurada**: documentos/versiones con vínculos a contextos, creación desde plantillas, PDF reproducible y adjunto real en correos.
3. **Cuatro plantillas**: reproducir estilo y estructura de los cinco PDF, campos editables y secciones opcionales.
4. **Seguimiento, Drive y portal**: eventos trazables, visibilidad por destinatario y publicación controlada. PR #86 sobre enlaces seguros es dependencia y NO está terminada.
5. **Migración y retiro**: reconciliar propuestas Netlify y Supabase, plan de retorno y retirar solo la interfaz antigua al verificar los datos.

**No fusionar PR #89 ni afirmar gestor documental completo hasta cerrar las etapas necesarias y demostrar que la UX del correo funciona.**
