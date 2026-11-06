import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compromisos=leer('src/paginas/cliente/Compromisos.jsx');
const estilos=leer('src/paginas/cliente/Compromisos.css');
const drive=leer('src/componentes/DriveArchivos.css');
const archivos=leer('src/componentes/DriveArchivos.jsx');
const motor=leer('src/paginas/terreno/Control.jsx');
const browser=leer('pruebas/ui-compromisos-escritorio.mjs');
const repo=JSON.parse(leer('src/datos/repositorioCompromisosSantaClara.json'));

test('Mismo patrón visual de Levantamientos: categoría, índice y detalle por actividad',()=>{
 for(const clase of ['categoria-titulo','indice-preguntas','pregunta-indice','numero-pregunta','texto-pregunta','volver-indice','pasos']){
  assert.ok(motor.includes(clase),'Falta patrón en levantamiento: '+clase);
  assert.ok(compromisos.includes(clase),'Falta patrón en compromisos: '+clase);
 }
 assert.match(compromisos,/pasoSubtarea/);
 assert.match(compromisos,/sub\.filter\(x=>x\.id===pasoSubtarea\[item\.id\]\)/);
 assert.match(compromisos,/setPasoSubtarea/);
 assert.match(compromisos,/Volver a la lista/);
 assert.match(compromisos,/Anterior/);
 assert.match(compromisos,/Siguiente/);
 assert.match(compromisos,/aria-label=\{'Abrir actividad '/);
 assert.match(compromisos,/compromisos-icono-eliminar/);
 assert.match(estilos,/\.compromisos-indice \.pregunta-indice/);
 assert.match(estilos,/\.compromisos-indice-item/);
});
test('La lista compacta muestra los documentos y controles en una línea',()=>{
 assert.match(drive,/grid-template-columns:minmax\(0,1\.5fr\)/);
 assert.match(drive,/flex-wrap:nowrap/);
 assert.match(drive,/overflow-x:auto/);
 assert.match(archivos,/Sin publicar/);
 assert.match(compromisos,/soloVistaCliente=\{soloVistaCliente\}/);
});
test('Repositorio conserva los 24 compromisos de Santa Clara del 23 de octubre',()=>{
 assert.equal(repo.fechaReferencia,'2026-10-23');
 assert.equal(repo.items.length,24);
 assert.equal(new Set(repo.items.map(i=>i.codigo)).size,24);
 assert.deepEqual(repo.items.map(i=>i.orden),Array.from({length:24},(_,i)=>i+1));
 assert.equal(repo.items.find(i=>i.orden===23).titulo,'Acta de Condiciones Etapa II');
 assert.equal(repo.items.find(i=>i.orden===24).titulo,'Informe de gestión al término');
 assert.match(compromisos,/agregarDesdeRepositorio/);
 assert.match(compromisos,/compromisos\.some\(x=>x\.titulo/);
});
test('Chromium prueba los dos estados del recorrido',()=>{
 assert.match(browser,/compromisos-indice-item/);
 assert.match(browser,/Solo una actividad en detalle/);
 assert.match(browser,/Abrir actividad 1/);
 assert.match(browser,/compromisos-lista-/);
 assert.match(browser,/compromisos-detalle-/);
});
