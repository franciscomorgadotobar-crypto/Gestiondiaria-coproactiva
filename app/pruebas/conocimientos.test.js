import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirCapsula } from '../src/lib/conocimientos.js';
import { obtenerLeccion, GUIAS_COMPLETAS, DESGLOSE } from '../src/datos/ley21442.lecciones.js';
import { readFileSync } from 'node:fs';

const fuente=JSON.parse(readFileSync(new URL('../src/datos/ley21442.contenidos.json',import.meta.url),'utf8'));
const banco=fuente.contenidos;

test('La biblioteca tiene 202 cápsulas y permite abrir cada una con su id',()=>{
  assert.equal(banco.length,202);
  assert.equal(new Set(banco.map(x=>x.id)).size,202);
  assert.equal(banco.filter(x=>x.automatico).length,160);
  assert.ok(banco.every(x=>x.texto&&x.explicacion&&x.referencia));
});

test('La aparición tipo mascota usa solo cápsulas automáticas y evita repetir las últimas cinco',()=>{
  const ultimas=banco.filter(x=>x.automatico).slice(0,5).map(x=>x.id);
  const escogida=elegirCapsula(banco,ultimas,()=>0);
  assert.ok(escogida.automatico);
  assert.ok(!ultimas.includes(escogida.id));
  assert.equal(escogida.id,banco.filter(x=>x.automatico)[5].id);
});

test('La selección retorna null si no existe ninguna cápsula elegible',()=>{
  assert.equal(elegirCapsula([{id:'x',texto:'hola',automatico:false}],[]),null);
  assert.equal(elegirCapsula([],[]),null);
});


test('Todas las 202 cápsulas contienen contenido pedagógico ampliado y aplicable',()=>{
  const sinGuia=[];
  const sinEjemplo=[];
  const sinCautela=[];
  const demasiadoCortas=[];
  for(const item of banco) {
    const leccion=obtenerLeccion(item);
    if(!leccion) {sinGuia.push(item.id);continue;}
    if(!leccion.aplicacion || leccion.aplicacion.trim().length<60) sinEjemplo.push(item.id);
    if(!leccion.consideraciones?.length) sinCautela.push(item.id);
    const longitud=(leccion.resumen+' '+leccion.desarrollo).length;
    if(longitud<240) demasiadoCortas.push(item.id);
    assert.match(leccion.fundamento,/Ley N° 21\.442/);
    assert.equal(leccion.version,'16-02-2026');
  }
  assert.deepEqual(sinGuia,[],'Sin guía: '+sinGuia);
  assert.deepEqual(sinEjemplo,[],'Sin ejemplo: '+sinEjemplo);
  assert.deepEqual(sinCautela,[],'Sin consideraciones: '+sinCautela);
  assert.deepEqual(demasiadoCortas,[],'Guías breves: '+demasiadoCortas);
});

test('No se pierde ninguna sección legal, incluidos los transitorios',()=>{
  const cubiertos=new Set(banco.map(item=>item.articulo));
  for(let articulo=1;articulo<=102;articulo++) {
    assert.ok(cubiertos.has(String(articulo)),'Falta el artículo '+articulo);
    assert.ok(GUIAS_COMPLETAS[String(articulo)],'Falta desarrollo del artículo '+articulo);
  }
  for(let numero=1;numero<=11;numero++) {
    assert.ok(cubiertos.has('T'+numero));
    assert.ok(GUIAS_COMPLETAS['T'+numero]);
  }
  assert.ok(cubiertos.has('SEGUNDO'));
  assert.ok(GUIAS_COMPLETAS.SEGUNDO);
});

test('Artículo 2 desarrolla las catorce definiciones legales',()=>{
  assert.equal(DESGLOSE['2'].length,14);
  assert.ok(DESGLOSE['2'].some(([titulo])=>titulo.includes('Copropietario hábil')));
  assert.ok(DESGLOSE['2'].some(([titulo])=>titulo.includes('Fondo operacional inicial')));
});

test('Todas las cápsulas adicionales tienen caso específico distinto del artículo general',()=>{
  const extras=banco.filter(item=>item.id.includes('-D'));
  assert.equal(extras.length,88);
  for(const item of extras) {
    assert.notEqual(obtenerLeccion(item).aplicacion,GUIAS_COMPLETAS[item.articulo][1],item.id);
  }
});
