import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirCapsula } from '../src/lib/conocimientos.js';
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
