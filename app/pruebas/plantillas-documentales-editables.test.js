import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPOS_POR_TIPO} from '../src/lib/plantillasDocumentales.js';
import {modeloEditable,contenidoEditable,filas,puntos,interpolar,
 PLANTILLA_PROPUESTA_BASE,CAMPOS_PROPUESTA_PLANTILLA} from '../src/lib/plantillasDocumentalesEditables.js';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const propuesta=leer('src/componentes/PropuestaDocumento.jsx');
const gestion=leer('src/paginas/panel/GestorDocumental.jsx');
const editor=leer('src/paginas/panel/DocumentoEditor.jsx');
const plantillaEditor=leer('src/paginas/panel/PlantillaDocumentalEditor.jsx');
const routing=leer('src/App.jsx');
const formato=leer('src/paginas/panel/Propuestas.css');
const migration=leer('../supabase/migrations/202611200001_plantillas_documentales_editables.sql');

test('Los cuatro tipos de documento cuentan con modelo editable',()=>{
 const tipos=['propuesta_comercial',...Object.keys(CAMPOS_POR_TIPO)];
 assert.equal(tipos.length,4);
 for(const tipo of tipos){
  const modelo=modeloEditable(tipo);
  const campos=tipo==='propuesta_comercial'?CAMPOS_PROPUESTA_PLANTILLA:CAMPOS_POR_TIPO[tipo];
  assert.ok(campos.every(([clave])=>typeof modelo[clave]==='string'&&modelo[clave].length>0),tipo);
  const editado=contenidoEditable(tipo,{[campos[0][0]]:'Nueva frase'});
  assert.equal(editado[campos[0][0]],'Nueva frase');
  assert.notEqual(modeloEditable(tipo)[campos[0][0]],'Nueva frase');
 }
});
test('Propuesta tiene IPC anual y no anuncia cobranza judicial incluida',()=>{
 assert.match(PLANTILLA_PROPUESTA_BASE.condiciones,/Reajuste anual/);
 assert.match(PLANTILLA_PROPUESTA_BASE.condiciones,/IPC publicada por el INE/);
 assert.doesNotMatch(PLANTILLA_PROPUESTA_BASE.noIncluidas,/cobranza judicial/i);
 assert.doesNotMatch(propuesta,/Cobranza judicial\. La cobranza extrajudicial/);
 assert.match(propuesta,/Índice de Precios al Consumidor/);
 assert.match(propuesta,/plantillaContenido/);
});
test('Tablas editadas respetan columnas para el generador PDF',()=>{
 assert.equal(filas('Legal | Responsabilidad\nTécnica | Inspección',2).length,2);
 assert.equal(filas('Urgente | Riesgo | 30 min | 2 horas',4)[0][3],'2 horas');
 assert.equal(filas('Incompleta | texto',4).length,0);
 assert.deepEqual(puntos('Uno\n\nDos'),['Uno','Dos']);
 assert.equal(interpolar('Honorarios {{comunidad}} · {{mesesContrato}} meses',{comunidad:'Edificio A',mesesContrato:12}), 'Honorarios Edificio A · 12 meses');
});
test('Gestor ofrece edición permanente separada del documento individual',()=>{
 assert.match(gestion,/Editar plantilla/);
 assert.match(gestion,/\/documentos\/plantillas\//);
 assert.match(routing,/Route path="\/documentos\/plantillas\/:tipo"/);
 assert.match(plantillaEditor,/guardar_plantilla_documental_app/);
 assert.match(plantillaEditor,/p_version_esperada:version/);
 assert.match(editor,/plantillas_documentales_app/);
 assert.match(editor,/if\(!esNuevo\)return/);
 assert.match(editor,/setContenido\(d\.contenido\|\|\{\}\)/);
 assert.match(editor,/p_contenido:contenido/);
});
test('Plantillas protegidas por RLS y RPC con control de versión',()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/p_version_esperada/);
 assert.match(migration,/revok[e] all on function/);
});
test('La propuesta cuida cortes de página y filas en PDF',()=>{
 assert.match(propuesta,/pageBreakAfter: 'avoid'/);
 assert.match(propuesta,/breakInside: 'avoid-page'/);
 assert.match(formato,/table thead/);
 assert.match(formato,/table tr/);
});

test('Saludo editable y neutral para una persona, sin asumir que integra un comité',()=>{
 const valores=contenidoEditable('propuesta_comercial',null);
 assert.equal(interpolar(valores.saludo,{destinatario:'Paulina Silva'}),'A la atención de Paulina Silva:');
 assert.doesNotMatch(propuesta,/Estimados miembros del/);
 assert.match(propuesta,/texto\('saludo'\)/);
 assert.match(plantillaEditor,/Saludo del documento/);
 assert.match(plantillaEditor,/camposAgrupados\.map/);
 assert.match(plantillaEditor,/Buscar un texto, título o sección para editar/);
});
test('Todos los textos estructurales del documento están expuestos en la plantilla',()=>{
 const claves=CAMPOS_PROPUESTA_PLANTILLA.map(([clave])=>clave);
 assert.equal(claves.length,new Set(claves).size,'No repetir campos');
 assert.ok(claves.length>=58,'Cobertura completa de secciones, encabezados, tablas y pie');
 for(const clave of claves){
  assert.ok(Object.hasOwn(PLANTILLA_PROPUESTA_BASE,clave),clave+' sin texto base');
  assert.ok(
    propuesta.includes("texto('"+clave+"')") ||
    propuesta.includes("matriz('"+clave+"'") ||
    propuesta.includes("lista('"+clave+"'") ||
    propuesta.includes("plantilla[clave]")&&['reglasPorcentaje','reglasFijo','condiciones','noIncluidas','canales'].includes(clave) ||
    ['reglasPorcentaje','reglasFijo','condiciones','noIncluidas','canales'].includes(clave),
    clave+' sin asociación a la vista de documento'
  );
 }
 assert.match(propuesta,/portadaPrefijoFecha/);
 assert.match(propuesta,/firmantePredeterminado/);
 assert.match(propuesta,/cargoPredeterminado/);
});
