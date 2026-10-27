import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const origen = path.resolve(new URL('..', import.meta.url).pathname);
const leer = ruta => readFileSync(path.join(origen, ruta), 'utf8');
const html = leer('index.html');
const vite = leer('vite.config.js');
const app = leer('src/App.jsx');
const logo = leer('public/brand/imagologo-vertical.svg');
const iso = leer('public/iconos/iso.svg');

test('apertura reproduce diseño aprobado con logo oficial y solamente barra', () => {
  assert.match(html, /id="splash-inicial"/);
  assert.match(html, /brand\/imagologo-vertical\.svg/);
  assert.match(html, /class="splash-barra"/);
  assert.match(html, /background:#fffaf6/);
  assert.doesNotMatch(html, /Comunidades que funcionan|Cargando tu espacio/);
  assert.match(logo, /viewBox="0 0 560\.03 259\.11"/);
  assert.match(logo, /fill="#d5863b"/);
  assert.match(iso, /viewBox="0 0 254\.7 259\.11"/);
  assert.match(app, /splash\.classList\.add\('splash-finalizando'\)/);
  assert.match(app, /\[cargando\]/);
});

test('manifest referencia íconos de Android PNG con zona segura', () => {
  assert.match(vite, /icono-app-20261013-192\.png/);
  assert.match(vite, /icono-app-20261013-512\.png/);
  assert.match(vite, /icono-app-20261013-maskable-512\.png/);
  assert.match(vite, /purpose: 'maskable'/);
  assert.match(vite, /background_color: '#fffaf6'/);
  assert.match(vite, /theme_color: '#fffaf6'/);
});

test('íconos PNG generados son válidos y tienen dimensiones exactas', () => {
  const iconos = [
    ['icono-app-20261013-64.png',64],
    ['icono-app-20261013-192.png',192],
    ['icono-app-20261013-512.png',512],
    ['icono-app-20261013-maskable-512.png',512]
  ];
  for (const [nombre, dimension] of iconos) {
    const archivo = path.join(origen,'public','iconos',nombre);
    assert.ok(existsSync(archivo), 'Falta generar '+nombre);
    const png = readFileSync(archivo);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),dimension);
    assert.equal(png.readUInt32BE(20),dimension);
  }
});

test('sin alteraciones a rutas de Home ni gestión de sesión', () => {
  assert.match(app, /return <SeleccionArea \/>/);
  assert.match(app, /if \(perfil\?\.rol === 'cliente'\) return <Navigate to="\/portal" replace \/>/);
});
