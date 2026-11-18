import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {datosDesdeProspecto,etiquetaProspecto,propuestaDelProspecto,
  conflictoAsociacion} from '../src/lib/propuestasProspectos.js';
import {lecturaOperativa,fechaHoyChile} from '../src/lib/jarvis.js';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const propuestas=leer('src/paginas/panel/Propuestas.jsx');
const jarvis=leer('src/paginas/panel/Jarvis.jsx');
const previa={comunidad:'',direccion:'',comuna:'',destinatario:'',base:'',email:''};
const prospecto={id:'p1',nombre_condominio:'Edificio Las Américas',
  direccion:'Av. Central 55',comuna:'San Bernardo',
  nombre_contacto:'Ernesto Meza',etapa:'diagnostico'};

test('Prospectos del Pipeline disponibles aunque no tengan propuestas guardadas',()=>{
  assert.match(propuestas,/supabase\.from\('prospectos'\)/);
  assert.match(propuestas,/select\('id,nombre_condominio,nombre_contacto,direccion,comuna,etapa'\)/);
  assert.match(propuestas,/prospectos\.map\(pr=><option key=\{pr\.id\} value=\{pr\.id\}>/);
  assert.match(propuestas,/Actualizar lista/);
  assert.match(propuestas,/Propuestas guardadas/);
  assert.match(propuestas,/Cargar propuesta/);
  assert.match(propuestas,/Ver ficha comercial/);
  assert.equal(etiquetaProspecto(prospecto),'Edificio Las Américas · Ernesto Meza · Diagnostico');
});

test('Seleccionar prospecto rellena datos sin trasladar honorarios ni correo emisor',()=>{
  const datos=datosDesdeProspecto(prospecto,{...previa,base:'',pct:'9'});
  assert.equal(datos.comunidad,'Edificio Las Américas');
  assert.equal(datos.direccion,'Av. Central 55');
  assert.equal(datos.comuna,'San Bernardo');
  assert.equal(datos.destinatario,'Ernesto Meza');
  assert.equal(datos.base,'');
  assert.equal(datos.email,'');
  assert.match(propuestas,/setProspectoId\(id\)/);
  assert.match(propuestas,/setD\(datosDesdeProspecto\(p,BLANK\)\)/);
});

test('La asociación se guarda por UUID y no se reasigna otra propuesta por mismo nombre',()=>{
  const registros={
    'Nova Vida':{nombre:'Nova Vida',prospecto_id:'p1',actualizado_en:'2026-11-01'},
    'Nova Vida 2':{nombre:'Nova Vida 2',prospecto_id:'p1',actualizado_en:'2026-11-03'}
  };
  assert.equal(propuestaDelProspecto(registros,'p1').nombre,'Nova Vida 2');
  assert.equal(propuestaDelProspecto(registros,'p3'),null);
  assert.equal(conflictoAsociacion(registros,'Nova Vida','p2'),true);
  assert.equal(conflictoAsociacion(registros,'Nova Vida','p1'),false);
  assert.match(propuestas,/prospecto_id:prospectoId\|\|null/);
  assert.match(propuestas,/conflictoAsociacion\(registros,nombre,prospectoId\)/);
  assert.match(propuestas,/upsert\(payload,\{onConflict:'nombre'\}\)/);
});

test('Jarvis usa la fecha real de Santiago y ordena prioridades desde agenda, no del texto histórico',()=>{
  assert.equal(fechaHoyChile(new Date('2026-11-18T02:00:00Z')),'2026-11-17');
  assert.equal(fechaHoyChile(new Date('2026-11-18T14:00:00Z')),'2026-11-18');
  const lectura=lecturaOperativa([
    {titulo:'Compromiso futuro',urgencia:'semana',dias:2,ruta:'/a'},
    {titulo:'Atraso reciente',urgencia:'vencido',dias:-3,ruta:'/b',accion:'Cerrar compromiso'},
    {titulo:'Falta dato',urgencia:'brecha',dias:null},
    {titulo:'Atraso antiguo',urgencia:'vencido',dias:-25,ruta:'/c'}
  ],new Date('2026-11-18T14:00:00Z'));
  assert.equal(lectura.fecha,'2026-11-18');
  assert.match(lectura.resumen,/2 gestiones con atraso/);
  assert.match(lectura.resumen,/1 datos por completar/);
  assert.deepEqual(lectura.urgentes.map(x=>x.titulo),[
    'Atraso antiguo','Atraso reciente','Compromiso futuro'
  ]);
  assert.equal(lecturaOperativa(null),null);
});

test('Jarvis actualiza manualmente y al volver a la pestaña, preservando histórico con fecha',()=>{
  assert.match(jarvis,/Actualizar Jarvis/);
  assert.match(jarvis,/onClick=\{refrescarJarvis\}/);
  assert.match(jarvis,/setInterval\(alRecuperar,60000\)/);
  assert.match(jarvis,/visibilitychange/);
  assert.match(jarvis,/window\.addEventListener\('focus',alRecuperar\)/);
  assert.match(jarvis,/Lectura operativa del/);
  assert.match(jarvis,/Lectura analítica anterior del/);
  assert.match(jarvis,/Datos actuales de la agenda/);
  assert.match(jarvis,/supabase\.rpc\('jarvis_agenda'/);
  assert.match(jarvis,/supabase\.from\('jarvis_analisis'\)/);
  assert.doesNotMatch(jarvis,/supabase\.from\('jarvis_analisis'\)\.upsert/);
});
