import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compararIndicador } from '../src/lib/seoComparaciones.js';

test('sesiones, usuarios, clics y llamadas calculan variación relativa en ventanas iguales',()=>{
  const sube=compararIndicador(68,50);
  assert.deepEqual(sube,{etiqueta:'+36,0%',favorable:'sube',flecha:'↗'});
  assert.deepEqual(compararIndicador(25,50),{etiqueta:'-50,0%',favorable:'baja',flecha:'↘'});
  assert.equal(compararIndicador(0,0).etiqueta,'0,0%');
});

test('CTR se expresa en puntos porcentuales; posición más baja es favorable',()=>{
  assert.deepEqual(compararIndicador(0.017,0.013,'puntos'),{
    etiqueta:'+0,4 pp',favorable:'sube',flecha:'↗'
  });
  assert.deepEqual(compararIndicador(9.1,11.2,'posicion'),{
    etiqueta:'-2,1 posiciones',favorable:'sube',flecha:'↘'
  });
  assert.equal(compararIndicador(12,10,'posicion').favorable,'baja');
});

test('no inventa porcentajes sin base anterior válida ni con valor incompleto',()=>{
  for(const entrada of [[18,0],[undefined,3],[1,null],[NaN,8],[-1,9],[Infinity,3]]) {
    assert.equal(compararIndicador(...entrada),null,String(entrada));
  }
  assert.equal(compararIndicador(0.02,0,'puntos')?.etiqueta,'+2,0 pp');
  assert.equal(compararIndicador(9.1,0,'posicion'),null);
});

test('GA4 y Business Profile consultan período anterior real y conservan actual ante fallo',()=>{
  const servidor=readFileSync(new URL('../../supabase/functions/seo-analitica/index.ts',import.meta.url),'utf8');
  const dashboard=readFileSync(new URL('../src/paginas/panel/SEODashboard.jsx',import.meta.url),'utf8');
  assert.match(servidor,/startDate: String\(dias \* 2\) \+ 'daysAgo'/);
  assert.match(servidor,/endDate: String\(dias \+ 1\) \+ 'daysAgo'/);
  assert.match(servidor,/const anteriorInicio=daysBefore\(dias\*2\), anteriorFin=daysBefore\(dias\+1\)/);
  assert.match(servidor,/eventosAnteriores: eventosPrevios \? gaRows\(eventosPrevios\) : null/);
  assert.match(servidor,/anteriorMetricas\?\{/);
  assert.match(dashboard,/compararIndicador\(indicador.valor,perfilEmpresa.anterior\?\.resumen\?\.\[indicador.campo\]\)/);
  assert.match(dashboard,/cambio=\{cambioCTR\}/);
  assert.match(dashboard,/cambioPosicion/);
  assert.match(dashboard,/Sin comparación disponible/);
});
