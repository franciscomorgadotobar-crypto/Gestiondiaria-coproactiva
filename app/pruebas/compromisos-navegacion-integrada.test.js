import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=leer('src/App.jsx');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const comunidades=leer('src/paginas/panel/Comunidades.jsx');
const ficha=leer('src/paginas/cliente/Compromisos.jsx');
const modulos=leer('src/lib/selectorModulos.js');

test('Compromisos se gestionan dentro de Comunidades, no como submenú',()=>{
 assert.match(app,/<Route path="\/compromisos" element=\{<Navigate to="\/comunidades" replace \/>\}/);
 assert.doesNotMatch(panel,/ruta: '\/compromisos'/);
 assert.match(comunidades,/\['compromisos', 'Gestiones y avances'\]/);
 assert.match(comunidades,/seccion === 'compromisos' && <Compromisos comunidadId=\{id\}/);
});
test('El módulo visible se llama Operaciones y conserva rutas y permisos',()=>{
 assert.match(modulos,/id:'levantamientos', titulo:'Operaciones', etiqueta:'OPERACIONES'/);
 assert.match(modulos,/ruta:'\/inicio', area:'operacion'/);
});
test('Se mantiene edición, avance, seguimiento y Drive por subtarea',()=>{
 assert.match(ficha,/async function guardarTituloDirecto\(e\)/);
 assert.match(ficha,/marcarSubtarea/);
 assert.match(ficha,/cambiarProgresoSubtarea/);
 assert.match(ficha,/DriveArchivos comunidadId=\{comunidadId\} origenTipo="compromiso"/);
 assert.match(ficha,/onActualizado/);
});
