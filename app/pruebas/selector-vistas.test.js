import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areasDisponibles} from '../src/lib/selectorModulos.js';
import {grupoDeRuta} from '../src/lib/area.js';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Home principal y lateral reciben las mismas cinco áreas, sin duplicación',()=>{
  const areas=areasDisponibles({id:'admin-qa',rol:'superadmin',activo:true});
  assert.deepEqual(areas.map(x=>x.id),['comercial','operacion','finanzas','documental','aprendizaje']);
  assert.equal(new Set(areas.map(x=>x.id)).size,5);
  const rutas=areas.flatMap(x=>x.enlaces.map(e=>e.ruta));
  assert.equal(new Set(rutas).size,rutas.length,'Una ruta pertenece a una sola área');
  assert.equal(areas.find(x=>x.id==='operacion').enlaces.find(x=>x.ruta==='/comunidades').etiqueta,'Comunidades');
  assert.equal(areas.find(x=>x.id==='documental').ruta,'/documentos');
  assert.equal(areas.find(x=>x.id==='aprendizaje').ruta,'/conocimientos');
  assert.equal(grupoDeRuta('/documentos/nuevo'),'documental');
  assert.equal(grupoDeRuta('/conocimientos'),'aprendizaje');
  assert.equal(grupoDeRuta('/pipeline'),'comercial');
});
test('Permisos: ninguna opción se eleva de rol en la navegación unificada',()=>{
  const areas=rol=>areasDisponibles({id:rol,rol,activo:true});
  const nombres=rol=>areas(rol).map(x=>x.id);
  assert.deepEqual(nombres('jefatura'),['comercial','operacion','documental','aprendizaje']);
  assert.deepEqual(nombres('terreno'),['operacion','aprendizaje']);
  assert.deepEqual(nombres('cliente'),[]);
  assert.deepEqual(areasDisponibles({rol:'superadmin',activo:false}),[]);
  assert.ok(!areas('jefatura').find(x=>x.id==='operacion').enlaces.some(x=>x.ruta==='/proveedores'));
  assert.ok(!areas('jefatura').find(x=>x.id==='comercial').enlaces.some(x=>x.ruta==='/seo'));
  assert.ok(areas('admin').some(x=>x.id==='finanzas'));
});
test('No existen Cambio de vista global ni Inicio redundante en Comercial',()=>{
  const home=leer('src/paginas/SeleccionArea.jsx');
  const panel=leer('src/componentes/PanelEscritorio.jsx');
  const pipeline=leer('src/paginas/panel/Pipeline.jsx');
  assert.match(home,/areasDisponibles\(perfil\)/);
  assert.match(panel,/areasDisponibles\(perfil\)/);
  assert.doesNotMatch(home,/Cambiar vista|Por módulos|Por áreas|mostrarOpcionesVista/);
  assert.doesNotMatch(pipeline,/‹ Inicio|inicioSegunArea/);
  assert.match(panel,/Home principal/);
  assert.match(panel,/alternarGrupo\(item\.id\)/);
  assert.doesNotMatch(panel,/mostrarPanelIzquierdo = esCliente \|\| enOperacion/);
  assert.match(pipeline,/cambiarModoCRM\('lista'\)/);
  assert.match(pipeline,/pipeline-lista-tabla/);
  assert.match(pipeline,/cambiarModoCRM\('embudo'\)/);
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
