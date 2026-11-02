import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearContenidoBaseDocumental,tieneDatosPorConfirmar,REFERENCIAS_MODELO} from '../src/lib/contenidoBaseDocumental.js';
import {CAMPOS_POR_TIPO} from '../src/lib/plantillasDocumentales.js';
import {analizarBloquesDocumento} from '../src/lib/bloquesDocumento.js';
import {generarPdfDocumento} from '../src/lib/documentosPdf.js';

const fuente=readFileSync(new URL('../src/paginas/panel/DocumentoEditor.jsx',import.meta.url),'utf8');
const nombres=['seguimiento_documental','primera_administracion','informe_gestion'];

for(const tipo of nombres){
 test('Plantilla '+tipo+' abre seis apartados completos y editables',()=>{
  const modelo=crearContenidoBaseDocumental(tipo,'2026-11-02');
  assert.equal(modelo.fecha,'2026-11-02');
  assert.equal(modelo.responsable,'Coproactiva Administración SpA');
  assert.ok(REFERENCIAS_MODELO[tipo].endsWith('.pdf'));
  assert.equal(CAMPOS_POR_TIPO[tipo].length,6);
  for(const [clave] of CAMPOS_POR_TIPO[tipo]){
   assert.equal(typeof modelo[clave],'string');
   assert.ok(modelo[clave].length>90,clave+' no debe estar en blanco');
   assert.doesNotMatch(modelo[clave],/^Escribe la información/);
  }
  assert.ok(tieneDatosPorConfirmar(modelo),'avisar campos que requieren verificación');
 });
 test('Modelo '+tipo+' es independiente, no reusa mutaciones',()=>{
  const a=crearContenidoBaseDocumental(tipo),b=crearContenidoBaseDocumental(tipo);
  a.resumen='MODIFICADO';
  assert.notEqual(b.resumen,a.resumen);
 });
 test('PDF '+tipo+' incluye contenido tabular en un archivo real',async()=>{
  const modelo=crearContenidoBaseDocumental(tipo,'2026-11-02');
  const tablas=Object.values(modelo).flatMap(s=>analizarBloquesDocumento(s).filter(b=>b.tipo==='tabla'));
  assert.ok(tablas.length>=2,'debe incluir matrices del PDF de referencia');
  assert.ok(tablas.some(t=>t.filas.length>=4));
  const pdf=generarPdfDocumento({tipo,titulo:'Modelo de prueba',contenido:modelo,estado:'borrador'});
  const bytes=Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0,4).toString('ascii'),'%PDF');
  assert.ok(bytes.length>3500);
 });
}
test('No se repueblan ni modifican documentos guardados al abrir su historial',()=>{
 assert.match(fuente,/esNuevo\?crearContenidoBaseDocumental/);
 assert.match(fuente,/setContenido\(d\.contenido\|\|\{\}\)/);
 assert.match(fuente,/if\(!esNuevo\)return/);
 assert.match(fuente,/if\(!window\.confirm\(/);
 assert.match(fuente,/p_contenido:contenido/);
});
test('La aprobación no permite datos por verificar, el borrador sí',()=>{
 assert.ok(tieneDatosPorConfirmar({resumen:'[Por verificar]'}));
 assert.ok(!tieneDatosPorConfirmar({resumen:'Texto confirmado',fecha:'2026-11-02'}));
 assert.match(fuente,/estado\)&&pendientesModelo/);
 assert.match(fuente,/guardar el borrador mientras tanto/);
});
test('Modelos y visualización incluyen listas y tablas interpretables',()=>{
 const modelo=crearContenidoBaseDocumental('primera_administracion');
 const secciones=analizarBloquesDocumento(modelo.resumen+'\n\n'+modelo.hitos);
 assert.ok(secciones.some(b=>b.tipo==='tabla'));
 assert.ok(secciones.some(b=>b.tipo==='parrafo'));
 assert.ok(analizarBloquesDocumento('1. Uno\n2. Dos').some(b=>b.tipo==='lista'));
});
