import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const css=leer('src/paginas/cliente/PortalCliente.css');
const menu=leer('src/componentes/PanelEscritorio.jsx');

test('Pendientes, próximas actividades y realizados son botones accesibles que filtran su lista',()=>{
  assert.match(portal,/function Kpi\(\{ valor, etiqueta, tono = 'neutro', onClick = null, activo = false \}\)/);
  assert.match(portal,/<button type="button" className=\{clase\} onClick=\{onClick\} aria-pressed=\{activo\}/);
  assert.match(portal,/seleccionarFiltro\('atencion'\)/);
  assert.match(portal,/seleccionarFiltro\('proximos'\)/);
  assert.match(portal,/seleccionarFiltro\('realizados'\)/);
  assert.match(portal,/ListaFiltradaResumen filtro=\{filtroActivo\}/);
  assert.match(portal,/realizadosMes: realizados\.filter\(x => esEsteMes\(x\.fecha\)\)/);
  assert.match(portal,/setParams\(siguiente,\{preventScrollReset:true\}\)/);
  assert.match(css,/\.portal-kpi-clickeable:focus-visible/);
});

test('Últimos movimientos y sus fichas llevan al registro específico, tanto en cliente como en vista real',()=>{
  assert.match(portal,/function rutaActividad\(item,\{vistaPrevia=false,clienteId=null\}=\{\}\)/);
  assert.match(portal,/\?comunidad=.*cliente=/);
  assert.match(portal,/registro='\+encodeURIComponent\(registro\)/);
  assert.match(portal,/className="portal-actividad-enlace-principal" to=\{destino\}/);
  assert.match(portal,/className="portal-timeline-enlace"/);
  assert.match(portal,/portal-registro-inc-'\+incidencia\.id/);
  assert.match(portal,/portal-registro-lev-'\+l\.id/);
  assert.match(portal,/portal-registro-req-'\+r\.id/);
  assert.match(portal,/portal-registro-man-'\+m\.actividad_id/);
  assert.match(portal,/elemento\.scrollIntoView\(/);
  assert.match(css,/\.portal-registro-destacado/);
});

test('Todas las tarjetas de documentos son pulsables sin interferir con Abrir PDF',()=>{
  assert.match(portal,/className="portal-documento-destino"/);
  assert.match(portal,/rutaDocumentoPortal\(documento,contexto\)/);
  assert.match(portal,/portal-registro-doc-'\+documento\.id/);
  assert.match(portal,/className="portal-acciones portal-acciones-adjuntos"/);
  assert.match(css,/\.portal-actividad-enlace-principal::after/);
  assert.match(css,/\.portal-documento-destino::after/);
  assert.match(css,/\.portal-documento \.portal-acciones\{position:relative;z-index:2\}/);
  assert.match(portal,/informes:\s*'Informes publicados'/);
  assert.match(portal,/filtro==='movimientos'\|\|filtro==='informes'/);
});

test('Ley 21.442 se muestra en la barra inferior; Incidencias permanece disponible desde Más',()=>{
  assert.match(menu,/\['cliente-resumen', 'cliente-compromisos', 'cliente-documentos', 'cliente-conocimientos'\]/);
  assert.match(menu,/enlacePortal\('incidencias', 'Incidencias'\)/);
  assert.match(menu,/menuMasOperacion = enOperacion \? \[\] : opcionesBarra\.filter/);
  assert.match(menu,/id: 'cliente-conocimientos', ruta: rutaBibliotecaCliente/);
  assert.doesNotMatch(portal,/portal-acceso-ley/);
});
