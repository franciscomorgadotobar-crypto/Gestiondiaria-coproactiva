import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { clasificarOportunidadesSEO } from './seoEstadoOportunidades.js';

const propuestas=[{
  estado:'publicada',ruta:'/',consulta_principal:'administracion de edificios',
  consultas:['administracion de edificios','administracion de condominios',
    'administradores de edificios','listado de administradores de edificios en santiago'],
  verificada_en:'2026-10-12T11:52:55Z'
}];
const lista=[
  ...propuestas[0].consultas.map((c,i)=>({
    id:String(i),clase:'consulta',consulta:c,
    titulo:'Revisar: '+c,prioridad:'Alta'
  })),
  {id:'nuevo',clase:'consulta',consulta:'auditoría de condominios'},
  {id:'tecnico',clase:'tecnico',titulo:'Falta atributo alt'}
];

test('oculta recomendaciones ya trabajadas en el Home, pero conserva oportunidades diferentes',()=>{
  const d=clasificarOportunidadesSEO(lista,propuestas);
  assert.equal(d.disponibles,true);
  assert.equal(d.coincidencias.length,4);
  assert.deepEqual(d.nuevas.map(x=>x.id),['nuevo','tecnico']);
  assert.equal(d.enGestion.length,1);
});

test('normaliza tildes y espacios antes de cruzar consultas',()=>{
  const d=clasificarOportunidadesSEO([
    {clase:'consulta',consulta:'  Administración   DE CONDOMINIOS  '}
  ],propuestas);
  assert.equal(d.nuevas.length,0);
});

test('con historial no disponible no informa nuevas recomendaciones',()=>{
  const d=clasificarOportunidadesSEO(lista,null);
  assert.equal(d.disponibles,false);
  assert.equal(d.nuevas.length,0);
});

test('descartes no bloquean una oportunidad nueva',()=>{
  const d=clasificarOportunidadesSEO(lista,[{...propuestas[0],estado:'descartada'}]);
  assert.equal(d.coincidencias.length,0);
  assert.equal(d.nuevas.length,lista.length);
});

test('una propuesta aprobada pendiente tampoco se duplica',()=>{
  const d=clasificarOportunidadesSEO(lista,[{...propuestas[0],estado:'aprobada'}]);
  assert.equal(d.coincidencias.length,4);
});
