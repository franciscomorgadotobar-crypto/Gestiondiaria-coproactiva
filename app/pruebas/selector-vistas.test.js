import test from 'node:test';
import assert from 'node:assert/strict';
import {modulosDisponibles, leerOrganizacion, guardarOrganizacion} from '../src/lib/selectorModulos.js';

test('Catálogo no agrega rutas inexistentes y evita duplicados',()=>{
  const modulos=modulosDisponibles({id:'admin-qa',rol:'superadmin',activo:true});
  const navegables=modulos.filter(x=>x.tipo!=='popup');
  const rutas=new Set(navegables.map(x=>x.ruta));
  assert.equal(rutas.size,navegables.length);
  assert.deepEqual(modulos.filter(x=>x.tipo==='popup').map(x=>x.id),['conocimientos']);
  assert.ok(rutas.has('/pipeline'));
  assert.ok(rutas.has('/seo'));
  assert.ok(rutas.has('/inicio'));
  assert.ok(rutas.has('/contabilidad'));
  assert.ok(rutas.has('/configuracion'));
  assert.equal(navegables.length,8,'Se mantienen los ocho módulos originales');
  assert.equal(modulos.length,9,'Se agrega solo el acceso al popup educativo');
  assert.deepEqual(modulos.map(m=>m.titulo),[
    'Gestión comercial','Levantamientos','Arriendos y ventas','Red de proveedores',
    'Recepción y atención','Gestión contable','SEO y Analítica','Configuración','Base de conocimientos'
  ]);
  assert.ok(!rutas.has('/mi-cuenta'),'Mi cuenta es transversal, no módulo');
});

test('Roles preservan autorizaciones del menú',()=>{
  const modulos=rol=>modulosDisponibles({id:rol,rol,activo:true}).map(x=>x.id);
  const jefatura=modulos('jefatura');
  assert.ok(jefatura.includes('crm') && jefatura.includes('propiedades'));
  assert.ok(jefatura.includes('levantamientos'));
  assert.equal(jefatura.length,4);
  assert.ok(jefatura.includes('conocimientos'));
  for(const id of ['seo','contabilidad','configuracion','whatsapp','proveedores'])
    assert.ok(!jefatura.includes(id),'No visible para jefatura: '+id);
  assert.ok(modulos('admin').includes('contabilidad'));
  assert.ok(!modulos('admin').includes('clientes'));
  assert.ok(modulos('superadmin').includes('configuracion'));
  assert.equal(modulos('admin').length,9);
  assert.deepEqual(modulos('cliente'),[]);
  assert.deepEqual(modulosDisponibles({id:'s',rol:'superadmin',activo:false}),[]);
});

test('La organización es local por usuario y se mantiene tras volver al Home',()=>{
  const values=new Map();
  globalThis.localStorage={
    getItem(key){return values.has(key)?values.get(key):null},
    setItem(key,value){values.set(key,value)}
  };
  try{
    assert.equal(leerOrganizacion('persona-a'),'areas');
    guardarOrganizacion('persona-a','modulos');
    assert.equal(leerOrganizacion('persona-a'),'modulos');
    assert.equal(leerOrganizacion('persona-b'),'areas');
    guardarOrganizacion('persona-a','areas');
    assert.equal(leerOrganizacion('persona-a'),'areas');
    guardarOrganizacion('persona-a','no-valido');
    assert.equal(leerOrganizacion('persona-a'),'areas');
  }finally{delete globalThis.localStorage;}
});

test('La biblioteca conserva 202 fichas con referencias y 160 cápsulas automáticas', async()=>{
  const { readFileSync } = await import('node:fs');
  const datos=JSON.parse(readFileSync(new URL('../src/datos/ley21442.contenidos.json',import.meta.url),'utf8'));
  assert.equal(datos.contenidos.length,202);
  assert.equal(datos.contenidos.filter(x=>x.automatico).length,160);
  assert.equal(new Set(datos.contenidos.map(x=>x.id)).size,202);
  for(const item of datos.contenidos) {
    assert.ok(item.referencia && item.texto && item.explicacion && item.categoria,'Cápsula incompleta: '+item.id);
  }
});
