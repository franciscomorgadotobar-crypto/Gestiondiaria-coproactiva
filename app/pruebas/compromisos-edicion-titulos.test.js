import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lista=leer('src/paginas/panel/CompromisosGeneral.jsx');
const listaCss=leer('src/paginas/panel/CompromisosGeneral.css');
const detalle=leer('src/paginas/cliente/Compromisos.jsx');
const detalleCss=leer('src/paginas/cliente/Compromisos.css');
const browser=leer('pruebas/ui-compromisos-escritorio.mjs');

test('Compromisos: editar título directamente en lista, sin navegar',()=>{
 assert.match(lista,/Editar título/);
 assert.match(lista,/compromisos-general-edicion-titulo/);
 assert.match(lista,/onSubmit=\{guardarTitulo\}/);
 assert.match(lista,/setItems\(actual=>/);
 assert.match(lista,/\.update\(\{titulo\}\)\.eq\('id',editandoTitulo\.id\)/);
 assert.match(lista,/\.select\('id,titulo'\)\.single\(\)/);
 assert.match(lista,/!puedeGestionar\|\|guardandoTitulo/);
 assert.match(lista,/maxLength=\{180\}/);
 assert.match(lista,/setEditandoTitulo\(null\)/);
 assert.match(browser,/no debe navegar al editar/);
 assert.match(browser,/route\.request\(\)\.method\(\)==='PATCH'/);
 assert.match(listaCss,/compromisos-general-edicion-acciones/);
});

test('Compromisos y subtareas: cambiar únicamente el nombre con controles de cancelar',()=>{
 assert.match(detalle,/async function guardarTituloDirecto\(e\)/);
 assert.match(detalle,/onSubmit=\{guardarTituloDirecto\}/);
 assert.match(detalle,/const tabla=esSubtarea\?'compromisos_subtareas':'compromisos_administracion'/);
 assert.match(detalle,/\.update\(\{titulo\}\)\.eq\('id',tituloEnEdicion\.id\)/);
 assert.match(detalle,/\.eq\('compromiso_id',tituloEnEdicion\.compromisoId\)/);
 assert.match(detalle,/\.eq\('comunidad_id',comunidadId\)/);
 assert.match(detalle,/setSubtareas\(actual=>actual\.map/);
 assert.match(detalle,/setCompromisos\(actual=>actual\.map/);
 assert.match(detalle,/Editar título del compromiso/);
 assert.match(detalle,/Título de la subtarea/);
 assert.match(detalle,/Cerrar subtarea: /);
 assert.match(detalle,/Adjuntos de esta subtarea/);
 assert.match(detalle,/x\.completada\?100:/);
 assert.match(detalleCss,/compromisos-edicion-titulo-form/);
});
