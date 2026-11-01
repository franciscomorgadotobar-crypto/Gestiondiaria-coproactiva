import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('src/main.jsx');
const css=read('src/estilos/comercial-homologado.css');
const docsCss=read('src/paginas/panel/GestorDocumental.css');
const doc=read('src/paginas/panel/GestorDocumental.jsx');
const pipeline=read('src/paginas/panel/Pipeline.jsx');
const seo=read('src/paginas/panel/SEO.jsx');
const propiedades=read('src/paginas/propiedades/Propiedades.jsx');
const contrato=read('../docs/CONTRATO_DISENO_COPROACTIVA.md');
const agents=read('../AGENTS.md');
const workflow=read('../.github/workflows/validar-correcciones.yml');

test('Existe contrato de diseño y regla permanente para asistentes',()=>{
 assert.match(contrato,/320, 360, 390 y 412 px/);
 assert.match(contrato,/margen lateral real/);
 assert.match(contrato,/mínimo real de 12 px/);
 assert.match(agents,/CONTRATO_DISENO_COPROACTIVA.md/);
 assert.match(agents,/No rediseñar interfaces aprobadas/);
 assert.match(contrato,/REQUIRED/);
});
test('El CSS corporativo se aplica después de identidad y a las cuatro pantallas',()=>{
 assert.ok(main.indexOf("import './estilos/comercial-homologado.css';")>
  main.indexOf("import './estilos/identidad-app.css';"));
 for(const code of [doc,pipeline,seo,propiedades])assert.match(code,/comercial-ui/);
 for(const clase of ['comercial-documentos','comercial-seo','comercial-pipeline','comercial-propiedades']){
  assert.match(css,new RegExp('\\.'+clase+'\\b'));
 }
});
test('El Gestor no puede volver a introducir una cabecera compensada con márgenes negativos',()=>{
 assert.doesNotMatch(css,/margin\s*:\s*0\s+calc\s*\(\s*-1\s*\*\s*var\(--comercial-gutter/);
 assert.match(css,/\.comercial-documentos\s*>\s*:not\(\.documentos-gestor-cabecera\)/);
 assert.match(css,/max-width:calc\(100% - 2 \* var\(--doc-inset\)\)/);
 assert.match(css,/\.comercial-documentos\{--doc-inset:16px\}/);
 assert.match(css,/margin-left:16px;/);
 assert.match(css,/margin-right:16px;/);
 assert.doesNotMatch(docsCss,/\.documentos-gestor\{[^}]*overflow-x:(?:hidden|clip)/);
});
test('Composición móvil aprobada y scroll contenido',()=>{
 assert.match(css,/\.comercial-documentos \.documentos-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.comercial-documentos \.documentos-plantilla\{grid-template-columns:36px minmax\(0,1fr\) auto\}/);
 assert.match(css,/\.comercial-documentos \.documentos-lateral\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.comercial-documentos \.documentos-filtros\{[\s\S]*?overflow-x:auto/);
 assert.match(css,/\.comercial-pipeline \.tablero\.pipeline-indicadores\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('CI ejecuta controles tanto estáticos como mediciones de Chromium real',()=>{
 assert.match(workflow,/run: node --test pruebas\/contrato-diseno-estatico\.test\.js/);
 assert.match(workflow,/run: node pruebas\/ui-contrato-diseno\.mjs/);
 assert.match(workflow,/name: UX móvil en navegador real/);
});
