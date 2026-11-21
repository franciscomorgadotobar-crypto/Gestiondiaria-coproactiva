import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  tituloDePlantilla,nombreDocumentoDePlantilla,nombreArchivoDePlantilla
} from '../src/lib/nombresDocumentales.js';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const propuestas=leer('src/paginas/panel/Propuestas.jsx');
const plantilla=leer('src/componentes/PropuestaDocumento.jsx');
const css=leer('src/paginas/panel/Propuestas.css');
const editor=leer('src/paginas/panel/DocumentoEditor.jsx');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const pdf=leer('src/lib/documentosPdf.js');

test('Título de la plantilla más cliente, no nombre genérico de la aplicación',()=>{
  assert.equal(tituloDePlantilla('propuesta_comercial'),'Propuesta comercial');
  assert.equal(nombreDocumentoDePlantilla('propuesta_comercial','Comunidad edificio Centorbe'),
    'Propuesta comercial - Comunidad edificio Centorbe');
  assert.equal(nombreArchivoDePlantilla('propuesta_comercial','Comunidad edificio Centorbe'),
    'Propuesta comercial - Comunidad edificio Centorbe.pdf');
  assert.equal(nombreDocumentoDePlantilla('seguimiento_documental','Reserva Santa Clara'),
    'Seguimiento documental - Reserva Santa Clara');
  assert.equal(nombreDocumentoDePlantilla('primera_administracion','Edificio A'),
    'Primera administración - Edificio A');
  assert.equal(nombreDocumentoDePlantilla('informe_gestion','Edificio B'),
    'Informe de gestión - Edificio B');
  assert.equal(nombreArchivoDePlantilla('informe_gestion','  Cliente / Especial  '),
    'Informe de gestión - Cliente Especial.pdf');
});

test('Descarga comercial establece título del PDF antes de abrir el diálogo de impresión',()=>{
  assert.match(propuestas,/prepararTituloImpresion\('propuesta_comercial',d\.comunidad\)/);
  assert.match(propuestas,/onClick=\{imprimirPdf\}>Imprimir \/ PDF/);
  assert.match(propuestas,/window\.addEventListener\('afterprint',finalizar\)/);
  assert.match(propuestas,/nombreDocumentoDePlantilla\('propuesta_comercial',cliente\)/);
  assert.match(propuestas,/\.update\(payload\)\.eq\('id',guardadaActual\.id\)/);
  assert.match(gestor,/titulo:nombreDocumentoDePlantilla\('propuesta_comercial'/);
});

test('Documentos genéricos incluyen título del modelo y cliente en la exportación',()=>{
  assert.match(editor,/nombreArchivoDePlantilla\(tipo,entidad\)/);
  assert.match(editor,/p_titulo:entidad\?nombreDocumentoDePlantilla\(tipo,entidad\)/);
  assert.match(editor,/onClick=\{imprimirDocumento\}>Imprimir/);
  assert.match(pdf,/documento\.nombreArchivo\|\|nombrePdfDocumento\(documento\.titulo\)/);
});

test('Impresión comercial mantiene tablas, filas, títulos y secciones completas',()=>{
  for(const cls of ['propuesta-enfoque','propuesta-servicio','propuesta-plan',
    'propuesta-entregables','propuesta-atencion','propuesta-honorarios',
    'propuesta-exclusiones']){
    assert.ok(plantilla.includes(cls),cls+' no tiene agrupación editorial');
  }
  assert.match(plantilla,/propuesta-bloque-tabla/);
  assert.match(plantilla,/breakInside:'avoid-page'/);
  assert.match(css,/\.propuesta-docwrap \.propuesta-seccion\{/);
  assert.match(css,/page-break-inside:avoid!important/);
  assert.match(css,/table thead\{/);
  assert.match(css,/display:table-header-group!important/);
  assert.match(css,/\.propuesta-docwrap \.propuesta-bloque-tabla\{/);
});

test('PDF genérico mantiene cabeceras al reanudar tablas multipágina',()=>{
  assert.match(pdf,/dibujar\(limite\[0\],true\)/);
  assert.match(pdf,/const siguiente=esPrimera&&limite\.length>1/);
  assert.match(pdf,/asegurar\(39\)/);
});
