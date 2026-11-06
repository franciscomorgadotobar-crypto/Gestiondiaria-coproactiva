import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ordenarAvances,resumenAvances,primerPendienteAvances,bloqueadoPorSecuencia,
  agruparAvances,estadoVisualAvance
} from '../src/lib/motorAvances.js';
import {porcentajeSubtareas,resumenGlobalCompromisos} from '../src/lib/progresoCompromisos.js';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('El orden del checklist es estable y no muta los registros',()=>{
 const items=[{id:'b',grupo:'G',orden:2},{id:'a',grupo:'G',orden:1},{id:'c',grupo:'G',orden:2}];
 assert.deepEqual(ordenarAvances(items).map(x=>x.id),['a','b','c']);
 assert.deepEqual(items.map(x=>x.id),['b','a','c']);
});
test('Avance normalizado y primer pendiente conservan comportamiento de terreno',()=>{
 const items=[{completada:true},{completada:false},{completada:false}];
 assert.deepEqual(resumenAvances(items),{total:3,completados:1,pendientes:2,porcentaje:33});
 assert.equal(primerPendienteAvances(items),1);
 assert.equal(primerPendienteAvances([{completada:true}]),-1);
 assert.equal(bloqueadoPorSecuencia({secuencial:true,indice:2,primerPendiente:1}),true);
 assert.equal(bloqueadoPorSecuencia({secuencial:false,indice:2,primerPendiente:1}),false);
});
test('Categorías conservan el orden y el conteo de críticos',()=>{
 const items=[
  {grupo:'Acceso',orden:2,completada:false,estado:'critico'},
  {grupo:'Acceso',orden:1,completada:true},
  {grupo:'Cubierta',orden:3,completada:false}
 ];
 const grupos=agruparAvances(items);
 assert.deepEqual(grupos.map(x=>x.nombre),['Acceso','Cubierta']);
 assert.deepEqual(grupos[0].items.map(x=>x.orden),[1,2]);
 assert.equal(grupos[0].evaluados,1);
 assert.equal(grupos[0].criticos,1);
});
test('Colores semánticos y estados del motor compartido',()=>{
 assert.equal(estadoVisualAvance({completada:true}),'completado');
 assert.equal(estadoVisualAvance({avance:50}),'en_curso');
 assert.equal(estadoVisualAvance({espera:true}),'en_espera');
 assert.equal(estadoVisualAvance({critico:true}),'critico');
 assert.equal(estadoVisualAvance({avance:0}),'pendiente');
});
test('Los compromisos conservan su redondeo y compatibilidad histórica',()=>{
 assert.equal(porcentajeSubtareas([{completada:true},{avance:50},{avance:0}]),50);
 assert.deepEqual(resumenGlobalCompromisos([
  {estado:'completado',avance:100},{estado:'pendiente',avance:50}
 ]),{total:2,completados:1,abiertos:1,porcentaje:75});
});
test('El mismo componente y reglas llegan a Control y Compromisos',()=>{
 const terreno=leer('src/paginas/terreno/Control.jsx');
 const compromisos=leer('src/paginas/cliente/Compromisos.jsx');
 const interfaz=leer('src/componentes/MotorAvances.jsx');
 const css=leer('src/componentes/MotorAvances.css');
 for(const modulo of [terreno,compromisos])assert.match(modulo,/import MotorAvances/);
 assert.match(terreno,/agruparAvances\(items/);
 assert.match(terreno,/bloqueadoPorSecuencia/);
 assert.match(compromisos,/ordenarAvances\(subtareas\.filter/);
 assert.match(compromisos,/estadoVisualAvance/);
 assert.match(compromisos,/motor-avances-numero/);
 assert.match(interfaz,/role="progressbar"/);
 assert.match(css,/var\(--ok-fondo\)/);
 assert.match(css,/var\(--alerta-fondo\)/);
 assert.match(css,/var\(--critico-fondo\)/);
});
