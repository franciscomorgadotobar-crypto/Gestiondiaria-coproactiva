import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=r=>readFileSync(new URL('../src/'+r,import.meta.url),'utf8');
const tokens=read('estilos/tokens.css');
const base=read('estilos/base.css');
const modulos=read('estilos/modulos.css');
const seo=read('paginas/panel/SEO.jsx');
const contabilidad=read('paginas/panel/Contabilidad.jsx');
const proveedores=read('componentes/ProveedoresNavegacion.jsx');
const whatsapp=read('paginas/panel/WhatsApp.jsx');

function rgb(hex) {
  return hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255)
    .map(n=>n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4));
}
function luminosidad(hex) {
  const [r,g,b]=rgb(hex);return 0.2126*r+0.7152*g+0.0722*b;
}
function contraste(a,b) {
  const x=luminosidad(a),y=luminosidad(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
function valor(name) {
  const found=tokens.match(new RegExp(name.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,'\\$&')+'\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;'));
  assert.ok(found,'Falta token '+name);
  return found[1];
}

test('color corporativo permanece distinto al color de enlaces legibles',()=>{
  assert.equal(valor('--naranja').toLowerCase(),'#d5863b');
  assert.ok(contraste(valor('--enlace'),'#ffffff')>=4.5);
  assert.ok(contraste(valor('--enlace'),'#f7f4f0')>=4.5);
  assert.ok(contraste(valor('--texto-tenue'),'#ffffff')>=4.5);
  assert.ok(contraste(valor('--texto-apagado'),'#ffffff')>=4.5);
  assert.match(base,/a \{ color: var\(--enlace\)/);
  assert.match(base,/\.boton-texto\s*\{[^}]*color: var\(--enlace\)/);
});
test('pestañas estandarizadas en SEO, Contabilidad, Proveedores y WhatsApp',()=>{
  for(const src of [seo,contabilidad,proveedores,whatsapp]) {
    assert.match(src,/ui-pestanas/);
  }
  assert.match(modulos,/\.modulo-unificado \.ui-pestanas/);
  assert.match(modulos,/\[aria-current="page"\]/);
  assert.match(modulos,/\[aria-selected="true"\]/);
  assert.match(modulos,/min-height: var\(--tactil\)/);
});
test('WhatsApp marca vista activa sin destacar todas las pestañas',()=>{
  assert.match(whatsapp,/<NavLink to="\/whatsapp" end>/);
  assert.match(whatsapp,/<NavLink to="\/whatsapp\/configuracion">/);
  assert.match(whatsapp,/<NavLink to="\/whatsapp\/automatizaciones">/);
});
test('configuración SEO sigue funcionando y tiene nombre accesible en móvil',()=>{
  assert.match(seo,/aria-label="Configuración SEO"/);
  assert.match(seo,/onClick=\{\(\) => irVista\('conexiones'\)\}/);
});
test('foco, estados y movimiento reducido se conservan',()=>{
  assert.match(modulos,/:focus-visible/);
  assert.match(modulos,/prefers-reduced-motion: reduce/);
  for(const token of ['--ok-texto','--critico-texto','--alerta-texto','--radio-control','--radio-tarjeta','--tactil'])
    assert.ok(tokens.includes(token));
  assert.match(modulos,/\.ui-estado--ok/);
  assert.match(modulos,/\.ui-estado--critico/);
});
