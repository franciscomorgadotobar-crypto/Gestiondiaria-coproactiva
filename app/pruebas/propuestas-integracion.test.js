import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=leer('src/App.jsx');
const propuestas=leer('src/paginas/panel/Propuestas.jsx');
const document=leer('src/componentes/PropuestaDocumento.jsx');
const pipeline=leer('src/paginas/panel/Pipeline.jsx');
const nav=leer('src/componentes/PanelEscritorio.jsx');
const area=leer('src/lib/area.js');
const sql=leer('../supabase/migrations/202611010002_propuestas_comerciales.sql');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const catalogo=leer('src/lib/plantillasDocumentales.js');
const adjuntos=leer('src/componentes/AdjuntosCorreo.jsx');
const selector=leer('src/lib/selectorModulos.js');

test('El módulo interno se conserva sin anunciarlo en la navegación comercial',()=>{
  assert.match(app,/Route path="\/propuestas"/);
  assert.match(app,/SoloComercial/);
  assert.match(app,/Route path="\/documentos"/);
  assert.match(selector,/titulo:'Gestión documental'/);
  // El módulo interno se conserva, pero no figura como opción operativa del menú.
  assert.doesNotMatch(selector,/ruta:'\/propuestas',etiqueta:'Cotizaciones y propuestas'/);
  assert.match(area,/\['comercial', \['\/pipeline', '\/propuestas'/);
  assert.match(area,/\['documental', \['\/documentos'/);
  assert.match(pipeline,/to=\{'\/documentos\?prospecto='\+prospectoSeleccionado\.id\}/);
});
test('Se conserva el generador comercial y su documento',()=>{
  for(const texto of ['Base mensual GG.CC.','Porcentaje (%)','Honorario neto','IVA (19%)','Imprimir / PDF','Cargar propuesta'])
    assert.ok(propuestas.includes(texto),texto);
  assert.match(document,/function PropuestaDoc/);
  assert.match(document,/export default PropuestaDoc/);
  assert.doesNotMatch(document,/Object\.assign\(window/);
});
test('Las propuestas se guardan en la base y no se depende de la API antigua de Netlify',()=>{
  assert.match(propuestas,/supabase\.from\('propuestas_comerciales'\)/);
  assert.match(propuestas,/\.insert\(payload\)/);
  assert.match(propuestas,/\.update\(payload\)\.eq\('id',guardadaActual\.id\)/);
  assert.doesNotMatch(propuestas,/upsert\(payload/);
  assert.match(propuestas,/\.delete\(\)\.eq\('id',registros\[sel\]\.id\)/);
  assert.doesNotMatch(propuestas,/fetch\(API_CLIENTES|\/api\/propuestas/);
  assert.match(propuestas,/localStorage\.getItem\(KEY_ACTUAL\+':'\+perfil\.id\)/);
});
test('La tabla solo admite roles comerciales y permite enlazar el CRM',()=>{
  assert.match(sql,/create table if not exists public\.propuestas_comerciales/);
  assert.match(sql,/prospecto_id uuid references public\.prospectos/);
  assert.match(sql,/alter table public\.propuestas_comerciales enable row level security/);
  assert.match(sql,/p\.rol::text in \('superadmin','admin','jefatura'\)/);
  assert.doesNotMatch(sql,/drop table|truncate table/i);
});

test('Gestor documental independiente reutilizable desde correos y CRM',()=>{
 assert.match(gestor,/function GestorDocumental/);
 assert.match(gestor,/TIPOS_DOCUMENTO\.map/);
 assert.match(gestor,/propuestas_comerciales/);
 assert.match(gestor,/TIPOS_DOCUMENTO.map/);
 assert.match(gestor,/Crear documento/);
 assert.match(gestor,/documentos_gestion/);
 assert.match(gestor,/documentos-layout/);
 assert.match(adjuntos,/Abrir gestor documental para crear un documento/);
 assert.match(adjuntos,/target="_blank" rel="noopener noreferrer"/);
 assert.match(adjuntos,/prospectoId/);
 assert.match(propuestas,/busqueda\.get\('documento'\)/);
});
test('Cuatro familias tipográficas desde cinco PDF preservan marca Coproactiva',()=>{
 for(const tipo of ['propuesta_comercial','seguimiento_documental','primera_administracion','informe_gestion'])
  assert.ok(catalogo.includes(tipo),tipo);
 for(const tono of ['#ed7130','#d0a207','#696969','#2b3138'])
  assert.ok(catalogo.includes(tono),tono);
 assert.match(catalogo,/disponible:true,ruta:'\/documentos/);
});

const editor=leer('src/paginas/panel/DocumentoEditor.jsx');
const styles=leer('src/paginas/panel/GestorDocumental.css');
const sqlVersiones=leer('../supabase/migrations/202611010003_gestor_documental_versiones.sql');
const comunidad=leer('src/paginas/panel/Comunidades.jsx');
const proveedores=leer('src/paginas/panel/Proveedores.jsx');
const inicio=leer('src/paginas/panel/Inicio.jsx');

test('El mockup se implementa con búsqueda, filtros, tarjetas, tabla y panel lateral',()=>{
 for(const criterio of ['documentos-caja-busqueda','documentos-filtros','documentos-plantillas','documentos-tabla','documentos-lateral','documentos-biblioteca-boton'])
  assert.match(gestor,new RegExp(criterio));
 assert.match(styles,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(styles,/@media\(max-width:700px\)/);
 assert.match(gestor,/TIPOS_DOCUMENTO\.map/);
 assert.match(gestor,/archivosFiltrados/);
 assert.match(gestor,/supabase\.functions\.invoke\('correo-archivos'/);
});
test('El editor permite tres tipos, vista previa, PDF e historial con versión optimista',()=>{
 assert.match(app,/Route path="\/documentos\/nuevo"/);
 assert.match(app,/Route path="\/documentos\/:id"/);
 assert.match(editor,/CAMPOS_POR_TIPO/);
 assert.match(editor,/supabase\.rpc\('guardar_documento_con_relaciones'/);
 assert.match(editor,/p_version_esperada:version/);
 assert.match(editor,/supabase\.from\('documentos_versiones'\)/);
 assert.match(editor,/window\.print\(\)/);
 assert.match(editor,/doc-editor-hoja/);
});
test('Versiones inmutables y guardado transaccional protegido por permiso',()=>{
 assert.match(sqlVersiones,/create table if not exists public\.documentos_versiones/);
 assert.match(sqlVersiones,/unique\(documento_id,version\)/);
 assert.match(sqlVersiones,/security definer/);
 assert.match(sqlVersiones,/version=version\+1/);
 assert.match(sqlVersiones,/where id=p_id and tipo=p_tipo and version=p_version_esperada/);
 assert.match(sqlVersiones,/revoke insert,update,delete on public\.documentos_gestion/);
 assert.match(sqlVersiones,/p\.rol::text in \('superadmin','admin','jefatura'\)/);
});
test('Accesos contextuales desde CRM, Correo, Comunidades, Proveedores y Operaciones',()=>{
 assert.match(comunidad,/Ver en gestor documental/);
 assert.match(comunidad,/Nuevo informe de gestión/);
 assert.match(proveedores,/Ver documentos en gestor/);
 assert.match(proveedores,/abrir el gestor documental/);
 assert.doesNotMatch(inicio,/ruta: '\/documentos', titulo: 'Gestor documental'/);
 assert.match(selector,/id:'documental'/);
 assert.match(inicio,/<Link key=\{h\.ruta\} to=\{h\.ruta\}/);
 assert.match(pipeline,/to=\{'\/documentos\?prospecto='\+prospectoSeleccionado\.id\}/);
 assert.match(adjuntos,/Abrir gestor documental para crear un documento/);
});

const pdfPropuesta=leer('src/lib/propuestaPdf.js');
const drive=leer('src/lib/drive.js');
const vinculados=leer('src/componentes/DocumentosVinculados.jsx');
const correoArchivos=leer('../supabase/functions/correo-archivos/index.ts');
test('Guardar propuesta archiva el PDF real y solo confirma cuando el vínculo persistió',()=>{
 assert.match(propuestas,/archivarPdfPropuesta\(await generarPdfPropuesta\(vista,cliente\),data\.id\)/);
 assert.match(propuestas,/pdfArchivado:\{id:archivo\.id/);
 assert.match(propuestas,/\.eq\('actualizado_en',data\.actualizado_en\)/);
 assert.match(propuestas,/PDF no quedó vinculado/);
 assert.match(propuestas,/bloqueoGuardado\.current/);
 assert.match(pdfPropuesta,/doc\.output\('blob'\)/);
 assert.match(pdfPropuesta,/nombreArchivoDePlantilla\('propuesta_comercial',cliente\)/);
 assert.match(pdfPropuesta,/while\(offset<r\.lines\)/);
 assert.match(drive,/fd\.append\('propuesta_id',propuestaId\)/);
 assert.match(drive,/fd\.append\('archivo',archivo\)/);
});
test('El PDF archivado se descarga en la ficha del CRM sin crear enlace público',()=>{
 assert.match(vinculados,/p\.datos\?\.pdfArchivado/);
 assert.match(vinculados,/descargarPdfPropuestaArchivado\(d\.pdfArchivado\)/);
 assert.match(correoArchivos,/accion==='descargar'/);
 assert.match(correoArchivos,/PERSONAL\.has\(perfil\.rol\)/);
 assert.match(correoArchivos,/\.is\('eliminado_en',null\)/);
 assert.match(correoArchivos,/private, no-store/);
 assert.match(drive,/action:'descargar',id:archivo\.id/);
});

test('Carpeta CRM identificada por UUID y movida según etapa real, no por nombre',()=>{
 assert.match(correoArchivos,/buscarPorPropiedad\(db,'coproactiva_prospecto_id',id\)/);
 assert.match(correoArchivos,/ETAPAS_CRM\[p\.etapa\]/);
 assert.match(correoArchivos,/params\.set\('addParents',destino\)/);
 assert.match(correoArchivos,/params\.set\('removeParents',remover\.join\(','\)\)/);
 assert.match(correoArchivos,/sincronizarCarpetaProspecto\(db,propuesta\.prospecto_id\)/);
 assert.match(correoArchivos,/vigente\.etapa===p\.etapa/);
 assert.match(propuestas,/await sincronizarCarpetaProspecto\(prospectoId\)/);
 assert.match(pipeline,/setEtapa\(nuevaEtapa,\{replace:true\}\);\s*await sincronizarDriveProspecto\(p\.id\)/);
 assert.match(pipeline,/if \(data\.comunidad_id\) prepararCarpetasDrive\(data\.comunidad_id\);\s*await sincronizarDriveProspecto\(p\.id\)/);
 assert.match(pipeline,/Reintentar sincronización/);
});

test('La ficha comercial permite completar y reagendar sin borrar el historial',()=>{
 const gestiones=leer('src/componentes/GestionesProspecto.jsx');
 const rpc=leer('../supabase/migrations/202611250001_registrar_gestion_prospecto.sql');
 assert.match(pipeline,/<GestionesProspecto key=\{prospectoSeleccionado\.id\}/);
 assert.match(gestiones,/Completar acción/);
 assert.match(gestiones,/Reagendar/);
 assert.match(gestiones,/Historial comercial/);
 assert.match(gestiones,/\.from\('prospecto_historial'\)/);
 assert.match(gestiones,/\.rpc\('registrar_gestion_prospecto'/);
 assert.match(rpc,/security invoker/);
 assert.match(rpc,/for update/);
 assert.match(rpc,/anterior\.editado_en is distinct from p_editado_en/);
 assert.match(rpc,/insert into public\.prospecto_historial/);
});

test('Eliminar acción requiere confirmación y conserva prospecto e historial',()=>{
 const gestiones=leer('src/componentes/GestionesProspecto.jsx');
 const rpc=leer('../supabase/migrations/202611250002_eliminar_accion_prospecto.sql');
 assert.match(gestiones,/Eliminar acción/);
 assert.match(gestiones,/Confirmar eliminación/);
 assert.match(gestiones,/p_proxima_accion:modo==='eliminar'\?null/);
 assert.match(gestiones,/p_fecha_proxima_accion:modo==='eliminar'\?null/);
 assert.match(rpc,/when 'eliminar' then 'Acción eliminada'/);
 assert.match(rpc,/insert into public\.prospecto_historial/);
 assert.doesNotMatch(rpc,/delete from public\.prospectos/i);
});
