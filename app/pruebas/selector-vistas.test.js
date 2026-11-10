import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areasDisponibles,enlacesAdministracion} from '../src/lib/selectorModulos.js';
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

test('Home compacto muestra solo nombre de área y despliega sus submódulos al tocar',()=>{
  const home=leer('src/paginas/SeleccionArea.jsx');
  const estilos=leer('src/paginas/SeleccionArea.css');
  assert.match(home,/useState\(null\)/);
  assert.match(home,/alternarArea\(area.id\)/);
  assert.match(home,/aria-expanded=\{areaAbierta===area.id\}/);
  assert.match(home,/hidden=\{areaAbierta!==area.id\}/);
  assert.match(home,/area.enlaces.map\(enlace=>/);
  assert.match(home,/entrar\(area,enlace.ruta\)/);
  assert.doesNotMatch(home,/<span className="seleccion-home__descripcion">\{area.descripcion\}<\/span>/);
  assert.doesNotMatch(home,/<span className="seleccion-area-etiqueta">\{area.etiqueta\}<\/span>/);
  assert.match(estilos,/\.seleccion-home-areas \.seleccion-home__submodulos\[hidden\] \{ display: none; \}/);
  assert.match(estilos,/\.seleccion-home-areas \.seleccion-area-grid\.vista-cuadricula \.seleccion-home__tarjeta \{/);
  assert.match(estilos,/min-height: 56px/);
});

test('Operaciones mantiene cuatro accesos iniciales y solo rutas reales',()=>{
  const perfil={id:'qa',rol:'superadmin',activo:true};
  const area=areasDisponibles(perfil).find(g=>g.id==='operacion');
  assert.deepEqual(area.secciones.map(s=>s.etiqueta??s.titulo),[
    'Panel de operaciones','Comunidades','Gestión y seguimiento','Terreno y recursos'
  ]);
  assert.deepEqual(area.secciones.find(s=>s.id==='seguimiento').enlaces.map(e=>e.etiqueta),[
    'Bitácora','Mantenciones'
  ]);
  assert.deepEqual(area.secciones.find(s=>s.id==='terreno').enlaces.map(e=>e.etiqueta),[
    'Nuevo levantamiento','Plantillas de levantamiento','Mapa de visitas','Red de proveedores'
  ]);
  assert.ok(!area.enlaces.some(e=>e.ruta==='/whatsapp'||e.ruta==='/vista-cliente'));
  assert.ok(!area.secciones.some(s=>s.titulo==='Recepción y atención'));
  assert.equal(new Set(area.enlaces.map(e=>e.ruta)).size,area.enlaces.length);
  assert.equal(grupoDeRuta('/vista-cliente'),'configuracion');
  assert.ok(enlacesAdministracion(perfil).some(e=>e.ruta==='/vista-cliente'));
  assert.ok(!enlacesAdministracion({rol:'jefatura',activo:true}).some(e=>e.ruta==='/vista-cliente'));
  const jefatura=areasDisponibles({rol:'jefatura',activo:true}).find(g=>g.id==='operacion');
  assert.ok(!jefatura.enlaces.some(e=>e.ruta==='/proveedores'));
  const terreno=areasDisponibles({rol:'terreno',activo:true}).find(g=>g.id==='operacion');
  assert.equal(terreno.secciones.length,4);
  assert.equal(terreno.secciones.find(s=>s.id==='terreno').enlaces.length,1);
});

test('Home y menú lateral comparten submenús independientes',()=>{
  const home=leer('src/paginas/SeleccionArea.jsx');
  const lateral=leer('src/componentes/PanelEscritorio.jsx');
  assert.match(home,/area.secciones.map\(seccion=>/);
  assert.match(home,/alternarSubmenu\(seccion.id\)/);
  assert.match(home,/hidden=\{submenuAbierto!==seccion.id\}/);
  assert.match(lateral,/item.secciones.map\(seccion=>/);
  assert.match(lateral,/alternarSubgrupo\(seccion.id\)/);
  assert.match(lateral,/hidden=\{!subgruposAbiertos.has\(seccion.id\)\}/);
  assert.match(home,/enlacesAdministracion\(perfil\)/);
  assert.match(lateral,/enlacesAdministracion\(perfil\)/);
});
