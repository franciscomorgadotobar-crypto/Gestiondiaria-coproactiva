import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const inicio=leer('src/paginas/panel/Inicio.jsx');
const home=leer('src/paginas/SeleccionArea.jsx');
const despacho=leer('src/paginas/terreno/Despacho.jsx');
const campana=leer('src/componentes/Campana.jsx');
const css=leer('src/componentes/Campana.css');

test('campana disponible globalmente sin duplicarla en Inicio',()=>{
  assert.match(panel,/import Campana from '\.\/Campana'/);
  assert.match(panel,/className="barra-area-derecha">\s*<Campana/);
  assert.match(panel,/className="barra-contextual-cuenta">\s*<Campana/);
  assert.match(panel,/usuario-lateral-identidad con-campana/);
  assert.match(home,/seleccion-home__saludo-campana/);
  assert.match(home,/<Campana miId=\{perfil\?\.id\}/);
  assert.doesNotMatch(inicio,/<Campana/);
  assert.match(despacho,/campana-control-encabezado/);
});

test('panel flotante permanece dentro del viewport y fuera de contenedores con overflow',()=>{
  assert.match(campana,/createPortal\(<section/);
  assert.match(campana,/,document\.body\)/);
  assert.match(campana,/Math\.min\(390,Math\.max\(0,window\.innerWidth-margen\*2\)\)/);
  assert.match(campana,/Math\.max\(margen,Math\.min\(ancla\.right-ancho,window\.innerWidth-margen-ancho\)\)/);
  assert.match(campana,/window\.addEventListener\('resize',ajustar\)/);
  assert.match(campana,/window\.addEventListener\('scroll',ajustar,true\)/);
  assert.match(css,/\.campana-panel\{position:fixed;/);
  assert.doesNotMatch(css,/right:-8px/);
});
