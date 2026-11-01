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

test('El módulo se abre desde Comercial y la ficha del prospecto',()=>{
  assert.match(app,/Route path="\/propuestas"/);
  assert.match(app,/SoloComercial/);
  assert.match(app,/Route path="\/documentos"/);
  assert.match(nav,/Gestor documental/);
  assert.match(selector,/id:'documentos', titulo:'Gestor documental'/);
  assert.match(area,/\['comercial', \['\/pipeline', '\/documentos', '\/propuestas'/);
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
  assert.match(propuestas,/upsert\(payload,\{onConflict:'nombre'\}\)/);
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
 assert.match(catalogo,/disponible:true,ruta:\/documentos/);
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
 assert.match(editor,/supabase\.rpc\('guardar_documento_gestion'/);
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
 assert.match(inicio,/to="\/documentos"/);
 assert.match(pipeline,/to=\{'\/documentos\?prospecto='\+prospectoSeleccionado\.id\}/);
 assert.match(adjuntos,/Abrir gestor documental para crear un documento/);
});
