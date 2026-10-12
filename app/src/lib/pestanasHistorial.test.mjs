import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { obtenerValorNavegable, cambiarValorNavegable } from './pestanasHistorial.js';

const seccionesSEO=['resumen','consultas','oportunidades','seguimiento','conexiones'];

test('pestañas SEO se guardan en URL y Atrás puede restaurar la anterior',()=>{
  const inicial=new URLSearchParams('dias=28');
  const primera=cambiarValorNavegable(inicial,'vista','consultas','resumen',seccionesSEO);
  const segunda=cambiarValorNavegable(primera,'vista','seguimiento','resumen',seccionesSEO);
  assert.equal(obtenerValorNavegable(primera,'vista',seccionesSEO,'resumen'),'consultas');
  assert.equal(obtenerValorNavegable(segunda,'vista',seccionesSEO,'resumen'),'seguimiento');
  assert.equal(segunda.get('dias'),'28');
});

test('volver a resumen limpia solo parámetro vista',()=>{
  const anterior=new URLSearchParams('vista=seguimiento&dias=7');
  const nuevo=cambiarValorNavegable(anterior,'vista','resumen','resumen',seccionesSEO);
  assert.equal(nuevo.has('vista'),false);
  assert.equal(nuevo.get('dias'),'7');
});

test('estado externo inválido retorna a vista inicial sin manipular otros datos',()=>{
  const parametros=new URLSearchParams('vista=admin-inexistente&comunidad=123');
  assert.equal(obtenerValorNavegable(parametros,'vista',seccionesSEO,'resumen'),'resumen');
  const nuevo=cambiarValorNavegable(parametros,'vista','invalida','resumen',seccionesSEO);
  assert.equal(nuevo.get('comunidad'),'123');
});

test('menú Más puede abrirse y Atrás recupera la URL de cerrado',()=>{
  const validos=['cerrado','mas'];
  const original=new URLSearchParams('vista=seguimiento');
  const abierta=cambiarValorNavegable(original,'menu','mas','cerrado',validos);
  assert.equal(abierta.get('menu'),'mas');
  assert.equal(obtenerValorNavegable(original,'menu',validos,'cerrado'),'cerrado');
  assert.equal(abierta.get('vista'),'seguimiento');
});

test('al navegar entre secciones de una comunidad preserva sus filtros',()=>{
  const secciones=['resumen','levantamientos','activos','plan','agenda','configuracion'];
  const previa=new URLSearchParams('comunidad=abc&seccion=activos');
  const proxima=cambiarValorNavegable(previa,'seccion','agenda','resumen',secciones);
  assert.equal(proxima.get('comunidad'),'abc');
  assert.equal(proxima.get('seccion'),'agenda');
});
