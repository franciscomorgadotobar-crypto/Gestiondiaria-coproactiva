import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const leer=ruta=>readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const campana=leer('src/componentes/Campana.jsx');
const estilos=leer('src/componentes/Campana.css');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const home=leer('src/paginas/SeleccionArea.jsx');
const inicio=leer('src/paginas/panel/Inicio.jsx');
const levantamiento=leer('src/paginas/terreno/Control.jsx');
const diagnostico=leer('src/paginas/comercial/DiagnosticoComercial.jsx');

test('Campana disponible en Home, barra móvil y las variantes de escritorio',()=>{
  assert.match(home,/<Campana miId=\{perfil\?\.id\}/);
  assert.equal((panel.match(/<Campana miId=\{perfil\?\.id\}/g)||[]).length,3);
  assert.match(panel,/barra-contextual-cuenta/);
  assert.match(panel,/barra-campana-escritorio/);
  assert.match(panel,/barra-area-derecha/);
  assert.doesNotMatch(inicio,/<Campana/);
});
test('Rutas profundas de levantamiento y diagnóstico mantienen acceso',()=>{
  assert.match(levantamiento,/<Campana miId=\{perfil\?\.id\}/);
  assert.match(diagnostico,/<Campana miId=\{perfil\?\.id\}/);
});
test('Panel montado fuera del recorte de la cabecera y posicionado en viewport',()=>{
  assert.match(campana,/createPortal\(/);
  assert.match(campana,/document\.body/);
  assert.match(campana,/getBoundingClientRect\(\)/);
  assert.match(campana,/anchoViewport-ancho-margen/);
  assert.match(campana,/panelRef\.current\?\.contains/);
  assert.match(campana,/visualViewport\?\.addEventListener/);
  assert.match(estilos,/position:fixed/);
  assert.doesNotMatch(estilos,/right:-8px|position:absolute/);
});
