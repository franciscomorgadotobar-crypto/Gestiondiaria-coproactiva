import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SEO_ACCESOS_DIRECTOS, SEO_MENU_PARAMETRO,
  abrirMenuSEO, cerrarMenuSEO, seleccionarSeccionSEO
} from '../src/lib/seoNavegacion.js';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const seo = read('paginas/panel/SEO.jsx');
const barra = read('componentes/BarraNavegacionSEO.jsx');
const estilos = read('paginas/panel/SEO.css');
const validadas = ['resumen','consultas','analytics','business','oportunidades','seguimiento',
  'tecnico','velocidad','tagmanager','conexiones','diagnostico'];

test('los cuatro accesos prioritarios SEO se visualizan como barra de cinco botones', () => {
  assert.deepEqual(SEO_ACCESOS_DIRECTOS, ['resumen','consultas','oportunidades','seguimiento']);
  assert.match(barra, /className="barra-inferior-movil seo-barra-inferior"/);
  assert.match(barra, /principales\.map\(item =>/);
  assert.match(barra, /<span>Más<\/span>/);
  assert.match(barra, /<IconoSEO tipo=\{item\.id\}/);
  assert.match(barra, /aria-current=\{vista === item\.id \? 'page' : undefined\}/);
});

test('Más ofrece todas las secciones restantes e incluye Diagnóstico', () => {
  assert.match(barra, /secciones\.map\(\(\[id, etiqueta\]\)/);
  assert.match(barra, /id: 'diagnostico', etiqueta: 'Diagnóstico'/);
  assert.match(barra, /opciones\.filter\(item => !SEO_ACCESOS_DIRECTOS\.includes\(item\.id\)\)/);
  assert.match(barra, /adicionales\.map\(item =>/);
  assert.match(barra, /role="dialog" aria-modal="true"/);
  assert.match(barra, /aria-expanded=\{menuAbierto\}/);
  assert.match(barra, /e\.key === 'Escape'/);
  assert.match(barra, /e\.key !== 'Tab'/);
});

test('menú Más conserva el historial y al elegir una vista se elimina su entrada temporal', () => {
  const original = new URLSearchParams('dias=28&comunidad=456&vista=consultas');
  const abierto = abrirMenuSEO(original);
  assert.equal(abierto.get(SEO_MENU_PARAMETRO), 'mas');
  assert.equal(abierto.get('comunidad'), '456');
  const cambiado = seleccionarSeccionSEO(abierto, 'seguimiento', validadas);
  assert.equal(cambiado.get('vista'), 'seguimiento');
  assert.equal(cambiado.has(SEO_MENU_PARAMETRO), false);
  assert.equal(cambiado.get('comunidad'), '456');
  assert.equal(seleccionarSeccionSEO(abierto,'resumen',validadas).has('vista'),false);
  assert.equal(seleccionarSeccionSEO(abierto,'vista-inexistente',validadas).has('vista'),true);
  assert.equal(cerrarMenuSEO(abierto).get('vista'),'consultas');
  assert.match(barra, /replace: menuAbierto, preventScrollReset: true/);
  assert.match(barra, /navegar\(-1\)/);
});

test('no se duplican tabs móviles y el escritorio conserva las secciones SEO', () => {
  assert.match(seo, /id="seo-navegacion" className="seo-pestanas ui-pestanas"/);
  assert.match(seo, /<BarraNavegacionSEO/);
  assert.match(estilos, /@media \(max-width: 899px\)/);
  assert.match(estilos, /#seo-navegacion\.seo-pestanas \{ display: none; \}/);
  assert.match(estilos, /max-height: calc\(100dvh/);
  assert.match(seo, /if \(window\.matchMedia\('\(max-width: 899px\)'\)\.matches\)/);
});
