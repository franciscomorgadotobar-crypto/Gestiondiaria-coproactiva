import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=leer('src/paginas/cliente/Compromisos.css');
const drive=leer('src/componentes/DriveArchivos.css');
const detalle=leer('src/paginas/cliente/Compromisos.jsx');
const browser=leer('pruebas/ui-compromisos-escritorio.mjs');

test('Subtareas compactas: controles agrupados y Drive desplegable',()=>{
 assert.match(detalle,/compromisos-subtarea-herramientas/);
 assert.match(detalle,/compromisos-subtarea-drive/);
 assert.match(detalle,/Adjuntos de esta subtarea/);
 assert.match(detalle,/onClick=\{\(\)=>eliminarSubtarea\(item,x\)\}/);
 assert.match(css,/\.compromisos-subtarea-herramientas\{display:flex/);
 assert.match(css,/\.compromisos-wrap \.compromisos-subtarea-card\{padding:8px 12px/);
 assert.match(css,/\.compromisos-subtarea-drive\[open\]\{flex-basis:100%/);
 assert.match(drive,/\.compromisos-wrap \.drive-compacto \.drive-doc/);
});
test('Los compromisos se prueban en Comunidades en resoluciones responsivas',()=>{
 assert.match(browser,/widths=\[390,768,1280,1556\]/);
 assert.match(browser,/\/compromisos/);
 assert.match(browser,/\/comunidades/);
 assert.match(browser,/scrollWidth/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(drive,/min-height:44px/);
});
