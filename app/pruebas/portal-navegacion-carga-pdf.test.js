import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const panel = leer('src/componentes/PanelEscritorio.jsx');
const portal = leer('src/paginas/cliente/PortalCliente.jsx');
const informe = leer('src/lib/informe.js');
const informeCliente = leer('src/lib/informeClienteLevantamiento.js');
const css = leer('src/estilos/identidad-app.css');

test('La barra navega entre secciones aunque todas compartan pathname', () => {
  assert.match(panel, /const ubicacionActual = pathname \+ search \+ hash/);
  assert.match(panel, /ubicacionActual !== item\.ruta/);
  assert.match(panel, /navegar\(item\.ruta, \{ replace: desdeMas, preventScrollReset: false \}\)/);
  assert.match(panel, /seccion === 'compromisos' \? '' : '\?seccion=' \+ seccion/);
  assert.match(portal, /tabInicial = TABS\.some/);
});

test('Compromisos vuelve a aparecer con el nombre Avances en menú inferior', () => {
  assert.match(panel, /etiquetaMovil: seccion === 'compromisos' \? 'Avances' : etiqueta/);
  assert.match(panel, /item\.etiquetaMovil \|\| item\.etiqueta/);
  assert.match(css, /-webkit-tap-highlight-color:transparent/);
});

test('Nuevo tab del PDF tiene carga visible antes del RPC', () => {
  assert.match(portal, /Preparando tu informe/);
  assert.match(portal, /Estamos reuniendo los datos y las fotografías del levantamiento/);
  assert.match(portal, /ventana\.document\.close\(\)/);
  assert.match(portal, /await abrirInformeClienteLevantamiento\(\{controlId:id,clienteId,ventana\}\)/);
  assert.match(portal, /prefers-reduced-motion:reduce/);
});

test('Pantalla de carga permanece hasta fotos y tipografías y luego imprime', () => {
  assert.match(informeCliente, /imprimirInforme\(html,ventana,\{pantallaCarga:true\}\)/);
  assert.match(informe, /export function imprimirInforme\(html, ventanaExistente = null, \{ pantallaCarga = false \} = \{\}\)/);
  assert.match(informe, /ventana\.document\.fonts\?\.ready/);
  assert.match(informe, /Promise\.race\(\[recursos, tope\]\)/);
  assert.match(informe, /aviso\.remove\(\)/);
  assert.match(informe, /ventana\.print\(\)/);
  assert.match(informe, /@media print \{ #aviso-impresion-coproactiva \{ display: none !important; \} \}/);
});
