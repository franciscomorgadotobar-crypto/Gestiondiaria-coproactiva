import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearContenidoBaseDocumental,tieneDatosPorConfirmar} from '../src/lib/contenidoBaseDocumental.js';
import {CAMPOS_POR_TIPO} from '../src/lib/plantillasDocumentales.js';
import {normalizarSeccionVerificable,actualizarVerificacion,verificacionMarcada,etiquetasVerificacion,resumenVerificaciones} from '../src/lib/verificacionesDocumentales.js';
import {generarPdfDocumento} from '../src/lib/documentosPdf.js';

const fuente=(ruta)=>readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const editor=fuente('src/paginas/panel/DocumentoEditor.jsx');
const form=fuente('src/componentes/SeccionChecklist.jsx');
const vista=fuente('src/componentes/BloquesDocumento.jsx');
const pdf=fuente('src/lib/documentosPdf.js');

for(const tipo of Object.keys(CAMPOS_POR_TIPO)){
 test('Todos los apartados de '+tipo+' ofrecen casillas',async()=>{
  let contenido=crearContenidoBaseDocumental(tipo,'2026-11-02');
  assert.ok(Object.hasOwn(contenido,'_verificaciones'));
  const campos=CAMPOS_POR_TIPO[tipo];
  assert.equal(campos.length,6);
  for(const [clave] of campos){
   const {items}=normalizarSeccionVerificable(contenido[clave]);
   assert.ok(items.length>=1,tipo+' / '+clave+' sin ítems verificables');
   assert.ok(!verificacionMarcada(contenido,clave,items[0].id));
   const anterior=contenido;
   contenido=actualizarVerificacion(contenido,clave,items[0].id,true);
   assert.ok(verificacionMarcada(contenido,clave,items[0].id));
   assert.ok(!verificacionMarcada(anterior,clave,items[0].id),'no debe mutar versión anterior');
   assert.ok(resumenVerificaciones(contenido,clave).completados>=1);
   assert.ok(Array.isArray(etiquetasVerificacion(clave)));
   contenido=actualizarVerificacion(contenido,clave,items[0].id,false);
   assert.ok(!verificacionMarcada(contenido,clave,items[0].id));
  }
  const guardado=JSON.parse(JSON.stringify(contenido));
  assert.deepEqual(guardado._verificaciones,contenido._verificaciones);
  const blob=generarPdfDocumento({tipo,titulo:'Documento de prueba',contenido,estado:'borrador'});
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0,4).toString('ascii'),'%PDF');
  assert.ok(bytes.length>3000);
 });
}

test('Los ítems mantienen su orden y su descripción base',()=>{
 const base=crearContenidoBaseDocumental('seguimiento_documental');
 const items=normalizarSeccionVerificable(base.pendientes).items;
 assert.ok(items.length>=7);
 assert.equal(items[0].id,'0');
 assert.match(items[0].titulo,/Permiso de edificación/i);
 assert.doesNotMatch(items[0].descripcion,/\[Por verificar\]/i);
 assert.ok(items.every(it=>it.tipo==='tabla'));
 const pasos=normalizarSeccionVerificable(base.proximos_pasos).items;
 assert.ok(pasos.length>=5&&pasos.every(it=>it.tipo==='lista'));
});

test('El editor usa la misma interfaz marcable en los tres documentos',()=>{
 assert.match(editor,/campos\.map\(\(\[clave,nombre\]\)=><SeccionChecklist/);
 assert.match(editor,/onChange=\{setContenido\}/);
 assert.match(editor,/p_contenido:contenido/);
 assert.match(form,/type="checkbox"/);
 assert.match(form,/disabled=\{disabled\}/);
 assert.match(form,/Editar redacción y detalles \(opcional\)/);
 assert.match(vista,/normalizarSeccionVerificable/);
 assert.match(vista,/doc-bloques-estado/);
 assert.match(pdf,/normalizarSeccionVerificable/);
 assert.match(pdf,/tabla\(filas\)/);
});

test('Un documento histórico sin checklist se sigue exportando sin alterar datos',async()=>{
 const modelo=crearContenidoBaseDocumental('seguimiento_documental');
 const {_verificaciones,...contenidoHistorico}=modelo;
 assert.ok(!Object.hasOwn(contenidoHistorico,'_verificaciones'));
 const bytes=Buffer.from(await generarPdfDocumento({
  tipo:'seguimiento_documental',titulo:'Documento anterior',contenido:contenidoHistorico,
  estado:'borrador'
 }).arrayBuffer());
 assert.ok(bytes.length>3000);
 assert.match(editor,/setContenido\(d\.contenido\|\|\{\}\)/);
});

test('Basta marcar estados; los pendientes de tabla no obligan a reescribir textos',()=>{
 const d=crearContenidoBaseDocumental('seguimiento_documental');
 assert.equal(tieneDatosPorConfirmar({pendientes:d.pendientes,_verificaciones:{}}),false);
 assert.equal(tieneDatosPorConfirmar({resumen:'Seguimiento de [nombre del condominio]',_verificaciones:{}}),true);
 assert.equal(tieneDatosPorConfirmar({resumen:'Seguimiento de Condominio Uno',_verificaciones:{}}),false);
});
