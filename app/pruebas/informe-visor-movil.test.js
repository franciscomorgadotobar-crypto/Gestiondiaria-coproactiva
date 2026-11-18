import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer=ruta=>readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const visor=leer('public/informe-visor.html');
const plantilla=leer('src/lib/informe.js');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const cliente=leer('src/lib/informeClienteLevantamiento.js');

test('El visor usa URL real y no about:blank',()=>{
  assert.match(portal,/window\.open\(import\.meta\.env\.BASE_URL\+'informe-visor\.html','_blank'\)/);
  assert.doesNotMatch(portal,/window\.open\('','_blank'\)/);
  assert.match(visor,/<title>Informe de levantamiento · Coproactiva<\/title>/);
  assert.match(visor,/window\.opener\?\.postMessage/);
  assert.match(visor,/evento\.source!==window\.opener/);
});

test('La lectura es responsive y A4 se conserva solo para imprimir',()=>{
  assert.match(plantilla, /meta name="viewport" content="width=device-width,initial-scale=1"/);
  assert.match(plantilla, /@media screen and \(max-width: 720px\)/);
  assert.match(plantilla, /\.hoja \{ width: 100%; max-width: 100%; padding: 16px;/);
  assert.match(plantilla, /\.fotos \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(plantilla, /@page\s*\{\s*size: A4/);
  assert.match(plantilla, /@media print \{ \.hoja \{ padding: 0; \} \}/);
});

test('Guardar PDF se habilita únicamente tras cargar imágenes y fuentes',()=>{
  assert.match(visor, /<button type="button" id="guardar" disabled>Guardar PDF<\/button>/);
  assert.match(visor, /marco\.contentWindow\.print\(\)/);
  assert.match(visor, /contenido\?\.fonts\?\.ready/);
  assert.match(visor, /imagen\.naturalWidth===0/);
  assert.match(visor, /if\(pendientes\.length\)/);
  assert.match(visor, /guardar\.disabled=false/);
  assert.match(cliente, /supabase\.rpc\('portal_levantamiento_detalle'/);
  assert.match(cliente, /createSignedUrls\(lote,3600\)/);
});

test('La app envía el contenido desde el proceso autorizado, sin duplicar PDFs',()=>{
  assert.match(portal, /prepararInformeClienteLevantamiento\(\{controlId:id,clienteId\}\)/);
  assert.match(portal, /pendiente=\{tipo:'coproactiva:visor-html'/);
  assert.match(portal, /html\.replace\('<head>','<head>'\+base\)/);
  assert.match(visor, /marco\.srcdoc=mensaje\.html/);
});
