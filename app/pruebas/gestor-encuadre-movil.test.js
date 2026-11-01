import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/paginas/panel/GestorDocumental.css',import.meta.url),'utf8');

test('En móvil el Gestor Documental conserva disposición vertical original',()=>{
 assert.match(css,/\.documentos-plantilla\{min-height:0;display:grid;grid-template-columns:36px minmax\(0,1fr\) auto/);
 assert.match(css,/Corrección de encuadre móvil: conserva las tarjetas/);
 assert.doesNotMatch(css,/Pulido visual del Gestor Documental/);
});

test('Los últimos estilos de encuadre fuerzan una sola columna para biblioteca y documentos',()=>{
 const indice=css.lastIndexOf('@media(max-width:700px)');
 assert.ok(indice>=0);
 const movil=css.slice(indice);
 assert.match(movil,/\.documentos-layout,\.documentos-principal/);
 assert.match(movil,/\.documentos-plantillas\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(movil,/\.documentos-lateral\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(movil,/\.documentos-filtros\{max-width:100%;min-width:0;overflow-x:auto/);
 assert.match(css,/max-width:1180px\)\{\s*\.documentos-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
});