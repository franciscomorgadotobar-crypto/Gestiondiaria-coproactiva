import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { obtenerValorNavegable, cambiarValorNavegable } from '../src/lib/pestanasHistorial.js';

const leer = ruta => readFileSync(new URL('../src/' + ruta, import.meta.url), 'utf8');
const seo = leer('paginas/panel/SEO.jsx');
const selector = leer('componentes/BarraNavegacionSEO.jsx');
const estilos = leer('paginas/panel/SEO.css');
const panel = leer('componentes/PanelEscritorio.jsx');
const vistas = ['resumen','consultas','analytics','business','oportunidades',
  'seguimiento','tecnico','velocidad','tagmanager','conexiones','diagnostico'];

test('SEO mantiene barra principal de Comercial también en teléfono', () => {
  assert.match(panel, /const mostrarBarraMovil = enOperacion \|\| enFinanzas \|\| enConfiguracion \|\| enComercial/);
  assert.match(panel, /\{ id: 'seo', etiqueta: 'SEO', ruta: '\/seo'/);
  assert.match(panel, /\{ id: 'pipeline', etiqueta: 'Pipeline', ruta: '\/pipeline'/);
  assert.match(panel, /aria-current=\{itemMovilActivo\(item\) \? 'page'/);
  assert.doesNotMatch(seo, /seo-barra-inferior/);
});

test('SEO usa selector interno accesible con todas las secciones, sin otra barra fija', () => {
  assert.match(selector, /useId\(\)/);
  assert.match(selector, /htmlFor=\{id\}/);
  assert.match(selector, /aria-label="Sección de SEO"/);
  assert.match(selector, /<select/);
  assert.match(selector, /opciones\.map/);
  assert.match(selector, /\['diagnostico', 'Diagnóstico'\]/);
  assert.match(seo, /<BarraNavegacionSEO/);
  assert.match(seo, /onSeleccionar=\{irVista\}/);
  assert.match(estilos, /\.seo-selector-secciones \{ display: none; \}/);
  assert.match(estilos, /\.seo-selector-secciones \{[\s\S]*?position: sticky;/);
  assert.match(estilos, /#seo-navegacion\.seo-pestanas \{ display: none; \}/);
  assert.doesNotMatch(selector, /className="barra-inferior-movil/);
});

test('la vista y el período siguen en URL y se conservan al cambiar de sección', () => {
  const inicio = new URLSearchParams('dias=90&comunidad=36&vista=analytics');
  const maps = cambiarValorNavegable(inicio,'vista','business','resumen',vistas);
  assert.equal(obtenerValorNavegable(maps,'vista',vistas,'resumen'),'business');
  assert.equal(maps.get('dias'),'90');
  assert.equal(maps.get('comunidad'),'36');
  const dashboard = cambiarValorNavegable(maps,'vista','resumen','resumen',vistas);
  assert.equal(dashboard.has('vista'),false);
  assert.equal(dashboard.get('dias'),'90');
});

test('Volver en SEO pasa por Dashboard antes de regresar a Comercial', () => {
  assert.match(seo, /useVolverGlobal\(\(\) =>/);
  assert.match(seo, /vista !== 'resumen'\) setVista\('resumen', \{ replace: true \}\)/);
  assert.match(seo, /else navegar\('\/pipeline'\)/);
  assert.match(panel, /replace: desdeMas/);
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /evento\.key === 'Escape'/);
});
