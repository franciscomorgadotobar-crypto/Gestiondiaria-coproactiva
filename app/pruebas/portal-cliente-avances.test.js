import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const componente=leer('src/paginas/cliente/EstadoMaterias.jsx');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const administracion=leer('src/paginas/panel/Comunidades.jsx');
const vistaCliente=leer('src/paginas/panel/VistaCliente.jsx');

test('Una única cabecera de informe para todas las comunidades: sin puesta en marcha',()=>{
  assert.match(componente,/const titulo='Estado de avances y compromisos - '\+\(nombreComunidad\|\|'Comunidad'\)/);
  assert.match(componente,/<h2>\{titulo\}<\/h2>/);
  assert.doesNotMatch(componente,/Estado de avance de la puesta en marcha/);
  assert.doesNotMatch(componente,/esSantaClara/);
  assert.match(administracion,/<EstadoMaterias comunidadId=\{id\}/);
});

test('Portal real y simulación utilizan el mismo EstadoMaterias publicado en solo lectura',()=>{
  assert.match(portal,/import EstadoMaterias from '\.\/EstadoMaterias'/);
  assert.doesNotMatch(portal,/import Compromisos from '\.\/Compromisos'/);
  assert.match(portal,/tab === 'compromisos' && <EstadoMaterias comunidadId=\{id\}/);
  assert.match(portal,/nombreComunidad=\{vista\?\.comunidad\?\.nombre\|\|'Comunidad'\}/);
  assert.match(portal,/administrador=\{false\} soloLecturaCliente=\{true\}/);
  assert.match(componente,/if\(soloLecturaCliente\)consulta=consulta\.eq\('publicado',true\)/);
  assert.match(componente,/if\(!administrador\)return/);
  assert.match(vistaCliente,/vistaPrevia=\{\{comunidadId,clienteId\}\}/);
  assert.match(componente,/if\(!administrador\|\|guardando\)return/);
});

test('El informe abre primero; Resumen sigue navegable y tiene URL explícita',()=>{
  assert.match(portal,/TABS\.some\(\(\[x\]\) => x === params\.get\('seccion'\)\) \? params\.get\('seccion'\) : 'compromisos'/);
  assert.match(portal,/if \(nuevo === 'compromisos'\) siguientes\.delete\('seccion'\)/);
  assert.match(portal,/else siguientes\.set\('seccion', nuevo\)/);
  assert.match(panel,/get\('seccion'\) \|\| 'compromisos'/);
  assert.match(panel,/seccion === 'compromisos' \? '' : '\?seccion=' \+ seccion/);
  assert.match(portal,/\['resumen', 'Resumen'\]/);
  assert.match(portal,/\['compromisos', 'Gestiones y avances'\]/);
});
