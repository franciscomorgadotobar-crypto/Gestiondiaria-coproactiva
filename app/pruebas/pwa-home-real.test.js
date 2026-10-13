import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepararArranqueConHome } from '../src/lib/arranqueHistorialPWA.js';

function historialSimulado(url, estado = { idx: 9, usr: { anterior: 'recordado' } }) {
  const urls = [{url,estado}];
  let activo = 0;
  const api = {
    get state() { return urls[activo].estado; },
    replaceState(s, _t, u) { urls[activo]={url:u,estado:s}; },
    pushState(s, _t, u) { urls.splice(++activo,urls.length-activo,{url:u,estado:s}); },
    retroceder() { if(activo>0) activo--; return urls[activo]; }
  };
  return {api,urls,retroceder:api.retroceder};
}

test('PWA restaurada en SEO: un Atrás nativo muestra Home y otro sale',()=>{
  const h=historialSimulado('/seo?vista=seguimiento#detalle',{idx:7,usr:null});
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/seo',search:'?vista=seguimiento',hash:'#detalle'},'/'),true);
  assert.equal(h.urls.length,2);
  assert.equal(h.urls[0].url,'/');
  assert.equal(h.urls[0].estado.idx,0);
  assert.deepEqual(h.urls[0].estado.usr,{selectorCoproactiva:true});
  assert.equal(h.urls[1].url,'/seo?vista=seguimiento#detalle');
  assert.equal(h.urls[1].estado.idx,1);
  assert.equal(h.urls[1].estado.usr.desdeSelectorCoproactiva,true);
  assert.equal(h.retroceder().url,'/');
  assert.equal(h.retroceder().url,'/');
});

test('el Home real también se garantiza desde fichas y submódulos',()=>{
  for(const ruta of [
    '/pipeline','/inicio','/comunidades/abc','/control/321/editar',
    '/proveedores/comunicaciones','/contabilidad/reportes','/whatsapp',
    '/propiedades/13','/mantenciones','/configuracion','/notificaciones'
  ]) {
    const h=historialSimulado(ruta);
    assert.equal(prepararArranqueConHome(h.api,{pathname:ruta,search:'',hash:''},'/'),
      true,'ruta protegida '+ruta);
    assert.equal(h.urls[0].url,'/','home de módulos para '+ruta);
    assert.equal(h.urls[1].url,ruta);
  }
});

test('portal cliente dispone de su propio Home sin módulos administrativos',()=>{
  const h=historialSimulado('/portal/comunidades/21');
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/portal/comunidades/21',search:'',hash:''},'/'),true);
  assert.equal(h.urls[0].url,'/portal');
  assert.deepEqual(h.urls[0].estado.usr,{homePortalCoproactiva:true});
  assert.equal(h.urls[1].estado.usr.desdePortalCoproactiva,true);
});

test('no toca el inicio, ingreso, enlaces públicos ni las rutas desconocidas',()=>{
  for(const ruta of ['/','/ingreso','/clave','/portal','/otro-sitio']) {
    const h=historialSimulado(ruta);
    assert.equal(prepararArranqueConHome(h.api,{
      pathname:ruta,search:'',hash:''},'/'),false);
    assert.equal(h.urls.length,1);
    assert.equal(h.urls[0].url,ruta);
  }
});

test('mantiene basename de GitHub Pages cuando se publica bajo subcarpeta',()=>{
  const h=historialSimulado('/coproactiva/seo?vista=analytics');
  assert.equal(prepararArranqueConHome(h.api,{
    pathname:'/coproactiva/seo',search:'?vista=analytics',hash:''},'/coproactiva/'),true);
  assert.equal(h.urls[0].url,'/coproactiva/');
  assert.equal(h.urls[1].url,'/coproactiva/seo?vista=analytics');
});

test('arranque inicial precede a BrowserRouter; restauración no reemplaza Home',()=>{
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.ok(main.indexOf('prepararArranqueConHome(window.history')<
    main.indexOf('createRoot(document.getElementById('));
  assert.match(app,/function RestaurarAreaGuardada/);
  assert.match(app,/restauracionAutomaticaEjecutada = true/);
  assert.match(app,/navegar\(destino, \{/);
  assert.match(app,/if \(destino && !restauracionAutomaticaEjecutada\)/);
  assert.doesNotMatch(app,/<Navigate to="\/seo" replace \/>/);
  assert.doesNotMatch(app,/<Navigate to="\/pipeline" replace \/>/);
});
