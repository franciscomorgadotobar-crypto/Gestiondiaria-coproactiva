import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const doc=leer('src/paginas/panel/DocumentoEditor.jsx');
const css=leer('src/paginas/panel/DocumentoEditor.css');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const catalogo=leer('src/lib/plantillasDocumentales.js');
const ui=leer('pruebas/ui-contrato-diseno.mjs');

test('Los documentos usan fecha local y no conversión ISO UTC',()=>{
 assert.match(doc,/fecha:fechaLocalInput\(\)/);
 assert.doesNotMatch(doc,/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
 const result=spawnSync(process.execPath,['--input-type=module','-e',
  "import {fechaLocalInput} from './src/lib/plantillasDocumentales.js'; console.log(fechaLocalInput(new Date('2026-11-02T00:34:00.000Z')));"
 ],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ:'America/Santiago'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.trim(),'2026-11-01');
});

test('Cada familia tiene ejemplo de título coherente',()=>{
 for(const label of [
  'Ej.: Seguimiento documental - Plaza Nos',
  'Ej.: Puesta en marcha - Reserva Santa Clara',
  'Ej.: Informe de gestión - Reserva Santa Clara'
 ])assert.ok(catalogo.includes(label),label);
 assert.match(doc,/placeholder=\{EJEMPLOS_TITULO_DOCUMENTO\[tipo\]/);
});

test('El editor y sus controles respetan un inset móvil real y vista previa sin zoom de formulario',()=>{
 assert.match(css,/--editor-inset:16px/);
 assert.match(css,/padding:18px var\(--editor-inset\)/);
 assert.match(css,/\.doc-editor-form input,\.doc-editor-form select,\.doc-editor-form textarea\{/);
 assert.match(css,/font-size:16px/);
 assert.match(css,/\.doc-editor-vistas-movil button\{min-height:44px\}/);
 assert.match(css,/@media print\{/);
 assert.match(ui,/contrato-editor-/);
 assert.match(ui,/item.nombre\+' '+key\+' fuera del margen/);
});

test('Barra de filtros controla y muestra el chip completo, nunca recorta uno seleccionado',()=>{
 assert.match(gestor,/barraFiltros=useRef\(null\)/);
 assert.match(gestor,/useLayoutEffect\(\(\)=>/);
 assert.match(gestor,/barra\.scrollLeft=Math\.max\(0,destino\)/);
 assert.match(gestor,/ref=\{barraFiltros\}/);
 assert.match(ui,/Filtro seleccionado cortado/);
 assert.match(ui,/Al volver a Todos, el filtro debe iniciar visible/);
});
