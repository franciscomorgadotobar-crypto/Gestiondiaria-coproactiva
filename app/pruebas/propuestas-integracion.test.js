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

test('El módulo se abre desde Comercial y la ficha del prospecto',()=>{
  assert.match(app,/Route path="\/propuestas"/);
  assert.match(app,/SoloComercial/);
  assert.match(nav,/Cotizaciones y propuestas/);
  assert.match(area,/\['comercial', \['\/pipeline', '\/propuestas'/);
  assert.match(pipeline,/to=\{'\/propuestas\?prospecto='\+prospectoSeleccionado\.id\}/);
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
