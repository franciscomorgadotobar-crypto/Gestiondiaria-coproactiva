import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  debePrepararHistorialSelector, prepararHistorialSelector,
  registrarIndiceSelector, pasosHastaSelector
} from '../src/lib/historialSelector.js';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

function simular(ruta='/seo',search='',indice=0,hash='') {
  const acciones=[];
  const navegar=(destino,opciones={})=>acciones.push({destino,opciones});
  const ubicacion={pathname:ruta,search,hash};
  return {acciones,navegar,ubicacion,indice};
}

test('SEO abierto directamente: Atrás Android llega al selector y el siguiente Atrás sale',()=>{
  const x=simular('/seo','?vista=consultas',0);
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,x.indice,true),true);
  assert.equal(x.acciones.length,2);
  assert.equal(x.acciones[0].destino,'/');
  assert.equal(x.acciones[0].opciones.replace,true);
  assert.deepEqual(x.acciones[0].opciones.state,{selectorCoproactiva:true});
  assert.equal(x.acciones[1].destino,'/seo?vista=consultas');
  assert.equal(x.acciones[1].opciones.replace,undefined);
  assert.deepEqual(x.acciones[1].opciones.state,{desdeSelectorCoproactiva:true});
  assert.equal(pasosHastaSelector({idx:1,usr:{desdeSelectorCoproactiva:true}}),-1);
  // Al volver al selector (idx=0), el próximo Atrás lo controla Android.
  assert.equal(pasosHastaSelector({idx:0,usr:{selectorCoproactiva:true}}),null);
});

test('redirigido a un área guardada: prepara selector sólo en el primer índice',()=>{
  for (const ruta of ['/seo','/pipeline','/inicio','/contabilidad','/whatsapp','/propiedades','/proveedores','/configuracion']) {
    assert.equal(debePrepararHistorialSelector(ruta,0,true),true,ruta);
  }
  assert.equal(debePrepararHistorialSelector('/seo',1,true),false);
  assert.equal(debePrepararHistorialSelector('/seo',0,false),false);
  assert.equal(debePrepararHistorialSelector('/portal',0,true),false);
  assert.equal(debePrepararHistorialSelector('/control/1',0,true),false);
  assert.equal(debePrepararHistorialSelector('/ingreso',0,true),false);
});

test('preserva parámetros de SEO, funciona con basename del router y no duplica índices',()=>{
  const x=simular('/seo','?vista=seguimiento&comunidad=456',0,'#ejemplo');
  assert.equal(prepararHistorialSelector(x.navegar,x.ubicacion,x.indice,true),true);
  assert.equal(x.acciones[1].destino,'/seo?vista=seguimiento&comunidad=456#ejemplo');
  // React Router añade su propio basename a destinos absolutos.
  assert.doesNotMatch(x.acciones[1].destino,/Gestiondiaria-coproactiva/);
  const yaTieneHistorial=simular('/seo','',1);
  assert.equal(prepararHistorialSelector(yaTieneHistorial.navegar,yaTieneHistorial.ubicacion,1,true),false);
  assert.equal(yaTieneHistorial.acciones.length,0);
  const cliente=simular('/seo','',0);
  assert.equal(prepararHistorialSelector(cliente.navegar,cliente.ubicacion,0,false),false);
  assert.equal(cliente.acciones.length,0);
});

test('Volver superior desde SEO usa el selector existente, no añade copias',()=>{
  registrarIndiceSelector(2);
  assert.equal(pasosHastaSelector({idx:5,usr:null}),-3);
  assert.equal(pasosHastaSelector({idx:2,usr:null}),null);
  registrarIndiceSelector(0);
  assert.equal(pasosHastaSelector({idx:1,usr:{desdeSelectorCoproactiva:true}}),-1);
  const nav=read('lib/navegacion.jsx');
  const panel=read('componentes/PanelEscritorio.jsx');
  const selector=read('paginas/SeleccionArea.jsx');
  const historial=read('lib/historialSelector.js');
  assert.match(nav,/const pasos = pasosHastaSelector\(window\.history\.state\)/);
  assert.match(nav,/if \(pasos !== null\) return navegar\(pasos\)/);
  assert.match(panel,/prepararHistorialSelector\(\s*navegar/);
  assert.match(selector,/registrarIndiceSelector\(window\.history\.state\?\.idx\)/);
  assert.match(selector,/desdeSelectorCoproactiva: true/);
  assert.doesNotMatch(historial,/\.pushState\(|\.replaceState\(/);
});
