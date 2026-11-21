import test from 'node:test';
import assert from 'node:assert/strict';
import {calcularHonorarios,montoNoNegativo} from '../src/lib/calculoHonorarios.js';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/paginas/panel/Propuestas.jsx');
const doc=read('src/componentes/PropuestaDocumento.jsx');

test('porcentajes históricos y porcentajes con decimales',()=>{
  const v=calcularHonorarios({base:'4500000',pct:'9.5'});
  assert.equal(v.tipoHonorarios,'porcentaje');
  assert.deepEqual([v.neto,v.iva,v.total],[427500,81225,508725]);
  assert.equal(montoNoNegativo(''),null);
  assert.equal(montoNoNegativo('-200'),null);
});
test('monto fijo neto genera IVA del 19% y total',()=>{
  const v=calcularHonorarios({tipoHonorarios:'fijo',montoFijoTipo:'neto',montoFijo:'450000',base:'5000000',pct:'9'});
  assert.deepEqual([v.neto,v.iva,v.total],[450000,85500,535500]);
});
test('monto fijo bruto conserva el total y calcula el neto',()=>{
  const v=calcularHonorarios({tipoHonorarios:'fijo',montoFijoTipo:'bruto',montoFijo:'535500'});
  assert.deepEqual([v.neto,v.iva,v.total],[450000,85500,535500]);
});
test('sin valor o con valor inválido no calcula montos',()=>{
  assert.equal(calcularHonorarios({tipoHonorarios:'fijo',montoFijo:''}).total,null);
  assert.equal(calcularHonorarios({tipoHonorarios:'fijo',montoFijo:'abc'}).neto,null);
});
test('propuesta y documento excluyen autorizaciones de gasto de emergencia',()=>{
  assert.match(app,/Modalidad de cobro/);
  assert.match(app,/Bruto \(IVA incluido\)/);
  assert.match(app,/datos:datosPropuesta\(/);
  assert.doesNotMatch(app,/Gasto autónomo urgencias|value=\{d\.urgencia\}/);
  assert.doesNotMatch(doc,/Gasto autónomo urgencias|d\.urgencia|calc\.urgencia/);
  assert.match(doc,/calc\.tipoHonorarios==='porcentaje'/);
});
test('asociación de prospectos tiene un solo indicador sin alertas redundantes',()=>{
  assert.doesNotMatch(app,/Prospecto asociado\. Completa los honorarios/);
  assert.doesNotMatch(app,/Vinculado al prospecto seleccionado/);
  assert.match(app,/propuesta-prospecto-asociado/);
  assert.match(app,/Ver ficha/);
});
