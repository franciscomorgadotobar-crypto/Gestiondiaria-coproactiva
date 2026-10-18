import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INDICADORES_PERFIL_GOOGLE, indicadorPerfilGoogle, datosPerfilGoogle } from '../src/lib/seoGoogleMaps.js';
import { SEO_ACCESOS_DIRECTOS, seleccionarSeccionSEO, abrirMenuSEO, SEO_MENU_PARAMETRO } from '../src/lib/seoNavegacion.js';

const leer = ruta => readFileSync(new URL('../src/' + ruta, import.meta.url), 'utf8');
const dashboard = leer('paginas/panel/SEODashboard.jsx');
const seo = leer('paginas/panel/SEO.jsx');
const estilos = leer('paginas/panel/SEODashboard.css');
const barra = leer('componentes/BarraNavegacionSEO.jsx');

test('Google Maps queda visible en el menú de 5 opciones sin tapar Más', () => {
  assert.deepEqual(SEO_ACCESOS_DIRECTOS, ['resumen','consultas','analytics','business']);
  assert.equal(SEO_ACCESOS_DIRECTOS.length,4);
  assert.match(barra,/principales\.map\(item =>/);
  assert.match(barra,/<span>Más<\/span>/);
  assert.match(barra,/if \(tipo === 'business'\)/);
  assert.match(seo,/\['business', 'Google Maps'\]/);
  for(const id of ['oportunidades','seguimiento','tecnico','velocidad','tagmanager','conexiones'])
    assert.ok(!SEO_ACCESOS_DIRECTOS.includes(id));
});

test('Google Maps desde la barra y desde Más preserva navegación y filtros', () => {
  const vistas=['resumen','consultas','analytics','business','oportunidades','seguimiento','tecnico'];
  const original = new URLSearchParams('dias=28&comunidad=36&vista=analytics');
  const maps = seleccionarSeccionSEO(original,'business',vistas);
  assert.equal(maps.get('vista'),'business');
  assert.equal(maps.get('dias'),'28');
  assert.equal(maps.get('comunidad'),'36');
  const desdeMas = seleccionarSeccionSEO(abrirMenuSEO(original),'seguimiento',vistas);
  assert.equal(desdeMas.has(SEO_MENU_PARAMETRO),false);
  assert.equal(desdeMas.get('vista'),'seguimiento');
});

test('cinco indicadores GBP distintos de Search Console y GA4 están definidos', () => {
  assert.deepEqual(INDICADORES_PERFIL_GOOGLE.map(i=>i.campo),[
    'impresionesMaps','impresionesBusqueda','clicsWeb','clicsTelefono','indicaciones'
  ]);
  assert.equal(INDICADORES_PERFIL_GOOGLE.length,5);
  assert.equal(new Set(INDICADORES_PERFIL_GOOGLE.map(i=>i.campo)).size,5);
  assert.ok(INDICADORES_PERFIL_GOOGLE.every(i=>i.titulo&&i.detalle));
  assert.doesNotMatch(dashboard,/<h3>Google Maps · Perfil de Empresa<\/h3>/);
  assert.doesNotMatch(dashboard,/<h2>Así va coproactiva\.cl<\/h2>/);
  assert.match(dashboard,/seo-exec-kpi-fuente/);
  assert.match(dashboard,/datosPerfilGoogle\(perfilEmpresa\)\.map/);
  assert.match(dashboard,/nombre=\{indicador.titulo\}/);
  assert.match(dashboard,/onClick=\{\(\)=>onNavigate\('business'\)\}/);
  const posMaps=dashboard.indexOf('datosPerfilGoogle(perfilEmpresa).map');
  const posGrafico=dashboard.indexOf('<SerieInteractiva');
  assert.ok(posMaps>=0&&posMaps<posGrafico,'Maps aparece antes de los gráficos largos');
});

test('sin integración ni campo, el dashboard nunca reporta cero falso', () => {
  const muestra = { disponible:true, resumen:{
    impresionesMaps:78,impresionesBusqueda:130,clicsWeb:0,clicsTelefono:null
  }};
  assert.equal(indicadorPerfilGoogle(null,'impresionesMaps'),null);
  assert.equal(indicadorPerfilGoogle({disponible:false,resumen:{impresionesMaps:300}},'impresionesMaps'),null);
  assert.equal(indicadorPerfilGoogle(muestra,'impresionesMaps'),78);
  assert.equal(indicadorPerfilGoogle(muestra,'clicsWeb'),0,'cero real se conserva');
  assert.equal(indicadorPerfilGoogle(muestra,'clicsTelefono'),null);
  assert.equal(indicadorPerfilGoogle(muestra,'indicaciones'),null);
  assert.equal(indicadorPerfilGoogle({disponible:true,resumen:{indicaciones:'NaN'}},'indicaciones'),null);
  assert.deepEqual(datosPerfilGoogle(muestra).map(x=>x.valor),[78,130,0,null,null]);
  assert.match(dashboard,/indicador.valor == null \? '—' : numero\(indicador.valor\)/);
  assert.match(dashboard,/!perfil && <div className="seo-exec-maps-pendiente"/);
});

test('responde a móviles y evita duplicar presencia Maps en el pie', () => {
  assert.match(estilos,/\.seo-exec-kpi-fuente-business/);
  assert.match(estilos,/\.seo-exec-kpi-superior/);
  assert.match(estilos,/@media\(max-width:345px\)/);
  assert.doesNotMatch(dashboard,/<h3>Presencia en Google Maps<\/h3>/);
  assert.match(seo,/perfilEmpresa=\{perfilEmpresa\}/);
  assert.match(seo,/Datos de Search Console, GA4 y Business Profile/);
});
