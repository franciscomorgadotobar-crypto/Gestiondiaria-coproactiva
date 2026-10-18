import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepararArranqueConHome, esContinuacionDocumento } from '../src/lib/arranqueHistorialPWA.js';

function simularHistorial(url, estado = { idx: 9, usr: { anterior: 'recordado' } }) {
  const entradas = [{url,estado}];
  const api = {
    get state() { return entradas.at(-1).estado; },
    replaceState(s, _t, u) { entradas[entradas.length-1] = {url:u,estado:s}; },
    pushState(s, _t, u) { entradas.push({url:u,estado:s}); }
  };
  return {api,entradas};
}

test('una PWA restaurada desde SEO empieza directamente en el Home sin apilar SEO detrás',()=>{
  const h=simularHistorial('/seo?vista=seguimiento#detalle',{idx:7,usr:null});
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/seo',search:'?vista=seguimiento',hash:'#detalle'},'/'),true);
  assert.equal(h.entradas.length,1);
  assert.equal(h.entradas[0].url,'/');
  assert.equal(h.api.state.idx,0);
  assert.deepEqual(h.api.state.usr,{selectorCoproactiva:true});
});

test('CRM, operación y pantallas profundas también vuelven al Home de acceso',()=>{
  for(const ruta of [
    '/pipeline','/inicio','/comunidades/abc','/control/321/editar',
    '/proveedores/comunicaciones','/contabilidad/reportes','/whatsapp',
    '/propiedades/13','/mantenciones','/configuracion','/notificaciones',
    '/seo'
  ]) {
    const h=simularHistorial(ruta);
    assert.equal(prepararArranqueConHome(h.api,{pathname:ruta,search:'',hash:''},'/'),true,ruta);
    assert.equal(h.entradas.length,1,'sin vista antigua en el historial');
    assert.equal(h.entradas[0].url,'/',ruta);
  }
});

test('portal cliente restaurado inicia en la raíz que resuelve el perfil',()=>{
  const h=simularHistorial('/portal/comunidades/21');
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/portal/comunidades/21',search:'',hash:''},'/'),true);
  assert.equal(h.entradas.length,1);
  assert.equal(h.entradas[0].url,'/');
});

test('no toca Home, ingreso, recuperación ni rutas ajenas a Coproactiva',()=>{
  for(const ruta of ['/','/ingreso','/clave','/otro-sitio']) {
    const h=simularHistorial(ruta);
    assert.equal(prepararArranqueConHome(h.api,{
      pathname:ruta,search:'',hash:''},'/'),false);
    assert.equal(h.entradas.length,1);
    assert.equal(h.entradas[0].url,ruta);
  }
});

test('basename de GitHub Pages conserva el Home en subcarpeta',()=>{
  const h=simularHistorial('/coproactiva/seo?vista=analytics');
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/coproactiva/seo',search:'?vista=analytics',hash:''},'/coproactiva/'),true);
  assert.equal(h.entradas.length,1);
  assert.equal(h.entradas[0].url,'/coproactiva/');
});

test('recargar SEO conserva ruta, pestaña, período, filtros e índice del historial',()=>{
  const url='/seo?vista=business&dias=90&comunidad=42#indicador';
  const original={idx:4,usr:{desdeSelectorCoproactiva:true}};
  const h=simularHistorial(url,original);
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/seo',search:'?vista=business&dias=90&comunidad=42',hash:'#indicador'
  },'/',{continuar:true}),false);
  assert.equal(h.entradas.length,1);
  assert.equal(h.entradas[0].url,url);
  assert.equal(h.api.state,original,'no reescribe ni el índice ni el estado');
});

test('recargar pantallas de cualquier módulo y portal no fuerza el selector',()=>{
  for(const ruta of ['/pipeline','/control/123/editar','/proveedores/correos',
    '/propiedades/42','/portal/comunidades/21','/seo']){
    const h=simularHistorial(ruta+'?vista=detalle');
    assert.equal(prepararArranqueConHome(h.api,{
      pathname:ruta,search:'?vista=detalle',hash:''
    },'/',{continuar:true}),false,ruta);
    assert.equal(h.entradas[0].url,ruta+'?vista=detalle');
  }
});

test('tipo de navegación distingue nueva apertura de recarga y restauración Android',()=>{
  const nav=(type)=>({getEntriesByType:(nombre)=>nombre==='navigation'?[{type}]:[]});
  assert.equal(esContinuacionDocumento(nav('navigate')),false);
  assert.equal(esContinuacionDocumento(nav('reload')),true);
  assert.equal(esContinuacionDocumento(nav('back_forward')),true);
  assert.equal(esContinuacionDocumento(nav('navigate'),true),true,'pestaña descartada por Android');
  assert.equal(esContinuacionDocumento({navigation:{type:1}}),true);
  assert.equal(esContinuacionDocumento({navigation:{type:0}}),false);
  assert.equal(esContinuacionDocumento(null),false);
});

test('el inicio siempre usa perfil actual, no la preferencia recordada',()=>{
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.ok(main.indexOf('prepararArranqueConHome(window.history')<
    main.indexOf('createRoot(document.getElementById('));
  assert.match(app,/if \(perfil\?\.rol === 'cliente'\) return <Navigate to="\/portal" replace \/>/);
  assert.match(app,/if \(!tieneCRM\(perfil\)\) return <PanelEscritorio><Inicio \/><\/PanelEscritorio>/);
  assert.match(app,/return <SeleccionArea \/>/);
  assert.match(app,/if \(idUsuario && !esContinuacionDocumento\(/);
  assert.doesNotMatch(app,/RestaurarAreaGuardada|restauracionAutomaticaEjecutada/);
  assert.doesNotMatch(app,/areaGuardada\(\)/);
  assert.match(app,/\['superadmin', 'admin', 'jefatura'\]\.includes\(perfil\.rol\)/);
});
