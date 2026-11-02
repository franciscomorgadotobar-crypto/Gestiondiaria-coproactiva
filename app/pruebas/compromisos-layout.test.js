import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer=r=>readFileSync(new URL('../'+r,import.meta.url),'utf8');
const css=leer('src/paginas/panel/CompromisosGeneral.css');
const jsx=leer('src/paginas/panel/CompromisosGeneral.jsx');
const browser=leer('pruebas/ui-compromisos-escritorio.mjs');

test('Contenido usa filas de altura intrínseca en lugar de ocupar todo el alto de escritorio',()=>{
 assert.match(css,/\.pantalla\.compromisos-general > \.cuerpo\.compromisos-general-cuerpo\{/);
 assert.match(css,/grid-auto-rows:max-content/);
 assert.match(css,/align-content:start/);
 assert.match(css,/align-items:start/);
 assert.match(css,/\.compromisos-general-lista\{[\s\S]*?grid-auto-rows:max-content/);
 assert.match(css,/\.compromisos-general-grupo\{[\s\S]*?height:auto/);
});

test('Los filtros ocupan 44px, mantienen legibilidad y se apilan en móvil',()=>{
 assert.match(css,/grid-template-rows:auto 44px/);
 assert.match(css,/height:44px/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/font-size:16px/);
 assert.match(browser,/widths=\[390,768,1280,1556\]/);
 assert.match(browser,/geo\.filters\.height<\(width<=640\?180:105\)/);
 assert.match(browser,/geo\.button\.height<110/);
 assert.match(browser,/geo\.overview\.y-geo\.filters\.bottom<45/);
 assert.match(browser,/geo\.group\.y-geo\.overview\.bottom<45/);
});

test('Comunidad única se expande automáticamente sin perder el botón de colapsar',()=>{
 assert.match(jsx,/if\(idsComunidad\.size===1\)setAbiertos\(new Set\(idsComunidad\)\)/);
 assert.match(jsx,/onClick=\{\(\)=>setAbiertos/);
 assert.match(jsx,/aria-expanded=\{abierto\}/);
 assert.match(jsx,/compromisos-general-estado/);
 assert.match(jsx,/compromisos-general-avance/);
 assert.match(jsx,/compromisos-general-fecha/);
 assert.match(jsx,/\.order\('orden'/);
 assert.match(browser,/selectOption\('completado'\)/);
});
