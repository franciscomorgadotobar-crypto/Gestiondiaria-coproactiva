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

test('El informe abre un visor real con URL propia y autorización por RPC', () => {
  const visor=leer('public/informe-visor.html');
  assert.match(portal, /window\.open\(import\.meta\.env\.BASE_URL\+'informe-visor\.html','_blank'\)/);
  assert.match(portal, /await prepararInformeClienteLevantamiento\(\{controlId:id,clienteId\}\)/);
  assert.match(portal, /window\.location\.origin/);
  assert.match(visor, /Preparando tu informe/);
  assert.match(visor, /Estamos reuniendo los datos y las fotografías del levantamiento/);
  assert.match(visor, /coproactiva:visor-listo/);
  assert.match(visor, /coproactiva:visor-html/);
  assert.match(visor, /Guardar PDF/);
  assert.match(visor, /marco\.contentWindow\.print\(\)/);
});

test('El informe sigue conservando el método de impresión anterior y el A4', () => {
  assert.match(informeCliente, /imprimirInforme\(html,ventana,\{pantallaCarga:true\}\)/);
  assert.match(informeCliente, /export async function prepararInformeClienteLevantamiento/);
  assert.match(informe, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(informe, /@media screen and \(max-width: 720px\)/);
  assert.match(informe, /@media print \{ \.hoja \{ padding: 0; \} \}/);
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
