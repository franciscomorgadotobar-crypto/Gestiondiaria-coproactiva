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
 assert.match(gestor,/Propuesta comercial/);
 assert.match(gestor,/documentos-plantillas/);
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
 assert.match(gestor,/documentos-plantillas/);
});
