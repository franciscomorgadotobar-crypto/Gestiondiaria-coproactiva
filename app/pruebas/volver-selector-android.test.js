import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  debePrepararHistorialSelector, prepararHistorialSelector, registrarIndiceSelector,
  pasosHastaSelector, vieneDeSelectorPreparado
} from '../src/lib/historialSelector.js';

function contexto(ruta='/seo',search='',idx=0,raiz='/') {
  const entradas = [{ url: ruta + search, estado: { idx, key: 'actual', usr: null } }];
  const historial = {
    get state() { return entradas.at(-1).estado; },
    replaceState(estado, _t, url) { entradas[entradas.length-1] = {url,estado}; },
    pushState(estado, _t, url) { entradas.push({url,estado}); }
  };
  return {historial,entradas,ubicacion:{
    pathname: ruta,search,hash: '', href: 'https://app.coproactiva.cl' + ruta + search
  },raiz};
}

test('SEO abierto directamente: Atrás Android llega al selector y siguiente Atrás sale',()=>{
  const x=contexto('/seo','?vista=consultas');
  assert.equal(prepararHistorialSelector(x.historial,x.ubicacion,x.raiz,true),true);
  assert.equal(x.entradas.length,2);
  assert.equal(x.entradas[0].url,'/');
  assert.deepEqual(x.entradas[0].estado.usr,{selectorCoproactiva:true});
  assert.equal(x.entradas[1].url,'/seo?vista=consultas');
  assert.equal(x.historial.state.idx,1);
  assert.equal(vieneDeSelectorPreparado(x.historial.state),true);
  assert.equal(pasosHastaSelector(x.historial.state),-1);
  assert.equal(prepararHistorialSelector(x.historial,x.ubicacion,x.raiz,true),false,
    'StrictMode nunca debe duplicar el selector');
});

test('redirigido al área guardada: crea selector sólo cuando índice inicial es cero',()=>{
  for (const ruta of ['/seo','/pipeline','/inicio','/contabilidad','/whatsapp','/propiedades','/proveedores','/configuracion']) {
    assert.equal(debePrepararHistorialSelector(ruta,0,true),true,ruta);
  }
  assert.equal(debePrepararHistorialSelector('/seo',1,true),false);
  assert.equal(debePrepararHistorialSelector('/seo',0,false),false);
  assert.equal(debePrepararHistorialSelector('/portal',0,true),false);
  assert.equal(debePrepararHistorialSelector('/control/1',0,true),false);
  assert.equal(debePrepararHistorialSelector('/ingreso',0,true),false);
});

test('respeta basename GitHub Pages, parámetros y permisos',()=>{
  const x=contexto('/Gestiondiaria-coproactiva/seo','?vista=seguimiento',0,'/Gestiondiaria-coproactiva/');
  assert.equal(prepararHistorialSelector(x.historial,x.ubicacion,x.raiz,true),true);
  assert.equal(x.entradas[0].url,'/Gestiondiaria-coproactiva/');
  assert.equal(x.entradas[1].url,'/Gestiondiaria-coproactiva/seo?vista=seguimiento');
  const cliente=contexto('/seo','',0);
  assert.equal(prepararHistorialSelector(cliente.historial,cliente.ubicacion,cliente.raiz,false),false);
  assert.equal(cliente.entradas.length,1);
});

test('Volver de la pantalla SEO usa selector real sin crear páginas duplicadas',()=>{
  registrarIndiceSelector(2);
  assert.equal(pasosHastaSelector({idx:5,usr:null}),-3);
  assert.equal(pasosHastaSelector({idx:2,usr:null}),null);
  registrarIndiceSelector(0);
  assert.equal(pasosHastaSelector({idx:1,usr:{desdeSelectorCoproactiva:true}}),-1);
  const nav=readFileSync(new URL('../src/lib/navegacion.jsx',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../src/componentes/PanelEscritorio.jsx',import.meta.url),'utf8');
  const selector=readFileSync(new URL('../src/paginas/SeleccionArea.jsx',import.meta.url),'utf8');
  assert.match(nav,/const pasos = pasosHastaSelector\(window\.history\.state\)/);
  assert.match(nav,/if \(pasos !== null\) return navegar\(pasos\)/);
  assert.match(panel,/prepararHistorialSelector\(/);
  assert.match(selector,/registrarIndiceSelector\(window\.history\.state\?\.idx\)/);
  assert.match(selector,/desdeSelectorCoproactiva: true/);
});
