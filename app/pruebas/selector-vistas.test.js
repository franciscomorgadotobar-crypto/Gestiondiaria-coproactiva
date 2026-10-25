import test from 'node:test';
import assert from 'node:assert/strict';
import {modulosDisponibles, leerOrganizacion, guardarOrganizacion} from '../src/lib/selectorModulos.js';

test('Catálogo no agrega rutas inexistentes y evita duplicados',()=>{
  const modulos=modulosDisponibles({id:'admin-qa',rol:'superadmin',activo:true});
  const rutas=new Set(modulos.map(x=>x.ruta));
  assert.equal(rutas.size,modulos.length);
  assert.ok(rutas.has('/pipeline'));
  assert.ok(rutas.has('/seo'));
  assert.ok(rutas.has('/inicio'));
  assert.ok(rutas.has('/contabilidad'));
  assert.ok(rutas.has('/configuracion'));
  assert.equal(modulos.length,8,'Los ocho módulos originales, sin submódulos como tarjetas');
  assert.deepEqual(modulos.map(m=>m.titulo),[
    'Gestión comercial','Levantamientos','Arriendos y ventas','Red de proveedores',
    'Recepción y atención','Gestión contable','SEO y Analítica','Configuración'
  ]);
  assert.ok(!rutas.has('/mi-cuenta'),'Mi cuenta es transversal, no módulo');
});

test('Roles preservan autorizaciones del menú',()=>{
  const modulos=rol=>modulosDisponibles({id:rol,rol,activo:true}).map(x=>x.id);
  const jefatura=modulos('jefatura');
  assert.ok(jefatura.includes('crm') && jefatura.includes('propiedades'));
  assert.ok(jefatura.includes('levantamientos'));
  assert.equal(jefatura.length,3);
  for(const id of ['seo','contabilidad','configuracion','whatsapp','proveedores'])
    assert.ok(!jefatura.includes(id),'No visible para jefatura: '+id);
  assert.ok(modulos('admin').includes('contabilidad'));
  assert.ok(!modulos('admin').includes('clientes'));
  assert.ok(modulos('superadmin').includes('configuracion'));
  assert.equal(modulos('admin').length,8);
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
