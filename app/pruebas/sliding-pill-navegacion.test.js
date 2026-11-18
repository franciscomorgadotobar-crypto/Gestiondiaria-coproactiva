import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const panel = leer('src/componentes/PanelEscritorio.jsx');
const estilos = leer('src/estilos/identidad-app.css');

test('Sliding Pill tiene una sola cápsula compartida y conserva los botones', () => {
  assert.match(panel, /usePillCorredera\(/);
  assert.match(panel, /ref=\{barraRef\}/);
  assert.match(panel, /ref=\{pillRef\} className="barra-pill-indicador" aria-hidden="true"/);
  assert.match(panel, /data-pill-tab=\{item\.id\}/);
  assert.match(panel, /data-pill-tab="mas"/);
  assert.match(panel, /aria-current=\{itemMovilActivo\(item\) \? 'page' : undefined\}/);
});

test('La pastilla se estira, rebota y se ajusta a cambios de tamaño', () => {
  assert.match(panel, /const estiramiento = Math\.min\(/);
  assert.match(panel, /const rebote = direccion \* Math\.min\(/);
  assert.match(panel, /pill\.animate\(\[/);
  assert.match(panel, /ResizeObserver/);
  assert.match(panel, /Math\.min\(132, Math\.max\(24, botonRect\.width - 8\)\)/);
});

test('El naranja mantiene contraste y respeta movimiento reducido', () => {
  assert.match(estilos, /\.barra-inferior-pill \.barra-pill-indicador/);
  assert.match(estilos, /background: linear-gradient\(115deg, #c45b1b, #a44712\)/);
  assert.match(estilos, /\.barra-inferior-pill \.nav-movil-item\.activo[\s\S]*?color: #fff/);
  assert.match(panel, /prefers-reduced-motion: reduce/);
  assert.match(estilos, /@media \(prefers-reduced-motion: reduce\)/);
});

test('El cliente mantiene sus secciones y Más con etiqueta correcta', () => {
  assert.match(panel, /cliente-resumen', 'cliente-compromisos', 'cliente-incidencias', 'cliente-documentos'/);
  assert.match(panel, /masSeleccionado/);
  assert.match(panel, /esCliente \? 'Secciones de la comunidad'/);
  assert.match(panel, /perfil\?\.rol !== 'cliente'/);
});
