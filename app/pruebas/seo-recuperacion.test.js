import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarConReintentosSEO, esErrorTransitorioSEO } from '../src/lib/seoRecuperacion.js';
import { readFileSync } from 'node:fs';

const transient = status => Object.assign(new Error('servicio ocupado'),{status});

test('reintenta un error 503 breve y recupera el resumen sin perder datos',async()=>{
  let llamadas=0,pausas=[];
  const resultado=await ejecutarConReintentosSEO(async()=>{
    llamadas++;
    if(llamadas<3)throw transient(503);
    return {searchConsole:{disponible:true,totales:{clics:12}}};
  },{espera:async ms=>{pausas.push(ms)}});
  assert.equal(llamadas,3);
  assert.deepEqual(pausas,[400,1100]);
  assert.equal(resultado.searchConsole.totales.clics,12);
});

test('no reintenta errores de autorización 401/403 ni solicitudes inválidas',async()=>{
  for(const status of [400,401,403,404]){
    let llamadas=0;
    await assert.rejects(ejecutarConReintentosSEO(async()=>{
      llamadas++;throw transient(status);
    },{espera:async()=>{}}));
    assert.equal(llamadas,1);
  }
});
test('no realiza bucles infinitos ante 503 persistente',async()=>{
  let llamadas=0;
  await assert.rejects(ejecutarConReintentosSEO(async()=>{
    llamadas++;throw transient(503);
  },{espera:async()=>{}}),/servicio ocupado/);
  assert.equal(llamadas,3);
});
test('reconoce errores temporales del objeto HTTP de Supabase',()=>{
  assert.equal(esErrorTransitorioSEO({context:{status:503}}),true);
  assert.equal(esErrorTransitorioSEO({status:429}),true);
  assert.equal(esErrorTransitorioSEO({status:500}),false);
});
test('Home no vuelve a mostrar KPIs vacíos si la API principal no respondió',()=>{
  const s=readFileSync(new URL('../src/paginas/panel/SEO.jsx',import.meta.url),'utf8');
  assert.match(s,/if \(resumenOk\) setDatos\(resumen\)/);
  assert.match(s,/!datos && !cargando/);
  assert.match(s,/Reintentar<\/button>/);
  assert.doesNotMatch(s,/if \(resultados\[1\].status !== 'fulfilled'\) throw/);
  assert.doesNotMatch(s,/Sin conexión a ' \+/);
});
