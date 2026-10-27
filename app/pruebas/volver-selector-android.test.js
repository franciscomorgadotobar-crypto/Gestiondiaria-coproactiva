import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RAICES_CON_SELECTOR, esRutaInterna, homePermitido,
  debePrepararHistorialSelector, prepararHistorialSelector,
  consumirRegresoPendiente, reiniciarHistorialSelector,
  registrarIndiceSelector, pasosHastaSelector
} from '../src/lib/historialSelector.js';

const read = path => readFileSync(new URL('../src/' + path,import.meta.url),'utf8');

function simular(ruta='/seo',search='',indice=0,hash='') {
  const acciones=[];
  const navegar=(destino,opciones={})=>acciones.push({destino,opciones});
  return {acciones,navegar,ubicacion:{pathname:ruta,search,hash},indice};
}

test('todos los módulos y pantallas profundas comparten Home autorizado',()=>{
  for (const ruta of [
    '/seo', '/seo?vista=consultas', '/pipeline',
    '/propiedades/abc', '/proveedores/comunicaciones',
    '/whatsapp/conversaciones', '/contabilidad/reportes',
    '/comunidades/123', '/plantillas/importar', '/plantillas/abc',
    '/bitacora/234', '/control/123', '/control/123/editar',
    '/ayuda/practica-levantamiento', '/mantenciones', '/mapa',
    '/notificaciones', '/mi-cuenta', '/configuracion', '/equipo', '/clientes'
  ]) {
    const path=ruta.split('?')[0];
    assert.ok(esRutaInterna(path),ruta);
    assert.equal(debePrepararHistorialSelector(path,0,true,true),true,ruta);
  }
  assert.ok(RAICES_CON_SELECTOR.length>=20);
  assert.equal(homePermitido(true),'/');
  assert.equal(homePermitido(false),'/');
});

test('entrada sin historial en SEO: primero Home de módulos y luego SEO con push',()=>{
  reiniciarHistorialSelector();
  const x=simular('/seo','?vista=consultas&comunidad=42',0,'#metrica');
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,x.indice,true,true),true);
  assert.equal(x.acciones.length,1,'primero solo replace: nunca dos navigate en el mismo tick');
  assert.equal(x.acciones[0].destino,'/');
  assert.equal(x.acciones[0].opciones.replace,true);
  assert.deepEqual(x.acciones[0].opciones.state,{selectorCoproactiva:true});
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,0,true,true),false,
    'StrictMode no duplica la entrada');
  const pendiente=consumirRegresoPendiente('/');
  assert.equal(pendiente.destino,'/seo?vista=consultas&comunidad=42#metrica');
  assert.equal(pendiente.home,'/');
  assert.equal(consumirRegresoPendiente('/'),null,'el retorno se consume una única vez');
  assert.equal(pasosHastaSelector({idx:1,usr:{desdeSelectorCoproactiva:true}}),-1);
});

test('abriendo un levantamiento directamente la última página será el selector',()=>{
  reiniciarHistorialSelector();
  const x=simular('/control/123/editar','?comunidad=7',0);
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,0,true,true),true);
  assert.equal(x.acciones[0].destino,'/');
  assert.equal(consumirRegresoPendiente('/control/123'),null);
  assert.equal(consumirRegresoPendiente('/').destino,'/control/123/editar?comunidad=7');
});

test('perfil de terreno: el Home único también está antes del detalle',()=>{
  reiniciarHistorialSelector();
  const x=simular('/comunidades/123','',0);
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,0,true,false),true);
  assert.equal(x.acciones[0].destino,'/');
  assert.deepEqual(x.acciones[0].opciones.state,{homeAreaCoproactiva:true});
  assert.equal(consumirRegresoPendiente('/').destino,'/comunidades/123');
  assert.equal(debePrepararHistorialSelector('/inicio',0,true,false),true);
  assert.equal(debePrepararHistorialSelector('/inicio',0,true,true),true);
});

test('sin sesión, cliente o desde un historial válido no se altera navegación Android',()=>{
  reiniciarHistorialSelector();
  for(const ruta of ['/', '/portal','/portal/comunidades/123','/ingreso','/clave','/desconocida']){
    assert.equal(debePrepararHistorialSelector(ruta,0,true,true),false,ruta);
  }
  assert.equal(debePrepararHistorialSelector('/seo',1,true,true),false);
  assert.equal(debePrepararHistorialSelector('/seo',0,false,true),false);
  assert.equal(debePrepararHistorialSelector('/inicio',0,true,false),true);
});

test('si ya se visitó Home no añade entradas; Volver usa el índice real registrado',()=>{
  reiniciarHistorialSelector();
  registrarIndiceSelector(2);
  assert.equal(pasosHastaSelector({idx:5,usr:null}),-3);
  assert.equal(pasosHastaSelector({idx:2,usr:null}),null);
  registrarIndiceSelector(0);
  assert.equal(pasosHastaSelector({idx:1,usr:{desdeSelectorCoproactiva:true}}),-1);
  reiniciarHistorialSelector();
  assert.equal(pasosHastaSelector({idx:5,usr:null}),null);
});

test('guardia global no depende de SEO ni del panel y respeta permisos',()=>{
  const app=read('App.jsx');
  const panel=read('componentes/PanelEscritorio.jsx');
  const selector=read('paginas/SeleccionArea.jsx');
  const nav=read('lib/navegacion.jsx');
  const historial=read('lib/historialSelector.js');
  assert.match(app,/function ProtegerHomeFinal\(\)/);
  assert.match(app,/<ProtegerHomeFinal \/>/);
  assert.match(app,/perfil\.rol === 'cliente'/);
  assert.match(app,/true, tieneCRM\(perfil\)/);
  assert.match(app,/consumirRegresoPendiente\(pathname\)/);
  assert.match(app,/desdeSelectorCoproactiva: true/);
  assert.match(app,/desdeHomeAreaCoproactiva: true/);
  assert.doesNotMatch(panel,/prepararHistorialSelector\(/);
  assert.match(selector,/registrarIndiceSelector\(window\.history\.state\?\.idx\)/);
  assert.match(nav,/const pasos = pasosHastaSelector\(window\.history\.state\)/);
  assert.match(nav,/if \(pasos !== null\) return navegar\(pasos\)/);
  assert.doesNotMatch(historial,/\.pushState\(|\.replaceState\(/);
  assert.match(app,/idAnterior\.current !== idUsuario/);
});

test('el Home se determina por permisos, no por la última vista guardada',()=>{
 const app=read('App.jsx');
 assert.match(app,/if \(perfil\?\.rol === 'cliente'\) return <Navigate to="\/portal" replace \/>/);
 assert.match(app,/return <PanelEscritorio><HomeGeneral \/><\/PanelEscritorio>/);
 assert.doesNotMatch(app,/<SeleccionArea/);
 assert.match(app,/if \(idUsuario && !esContinuacionDocumento\(/);
 assert.doesNotMatch(app,/RestaurarAreaGuardada|restauracionAutomaticaEjecutada/);
});

test('perfil cliente: detalle del portal vuelve al inicio del portal, sin selector administrativo',()=>{
  reiniciarHistorialSelector();
  const x=simular('/portal/comunidades/123','?seccion=documentos',0);
  assert.equal(homePermitido(false,true),'/portal');
  assert.equal(debePrepararHistorialSelector('/portal/comunidades/123',0,true,false,true),true);
  assert.equal(debePrepararHistorialSelector('/portal',0,true,false,true),false);
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,0,true,false,true),true);
  assert.equal(x.acciones[0].destino,'/portal');
  assert.deepEqual(x.acciones[0].opciones.state,{homePortalCoproactiva:true});
  const regreso=consumirRegresoPendiente('/portal');
  assert.equal(regreso.esCliente,true);
  assert.equal(regreso.destino,'/portal/comunidades/123?seccion=documentos');
  const app=read('App.jsx');
  assert.match(app,/desdePortalCoproactiva: true/);
});
