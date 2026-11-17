import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=leer('src/paginas/cliente/EstadoMaterias.jsx');
const css=leer('src/paginas/cliente/EstadoMaterias.css');
const comunidades=leer('src/paginas/panel/Comunidades.jsx');
const home=leer('src/paginas/SeleccionArea.jsx');
const sql=leer('../supabase/migrations/202611170001_estado_avance_materias.sql');

test('El documento Santa Clara contiene exactamente 12 materias y estados 5/3/4',()=>{
 const filas=[...sql.matchAll(/\(\d+,'([^']+)','(completado|en_curso|pendiente)','([^']*)','([^']*)'\)/g)];
 assert.equal(filas.length,12);
 const porEstado=filas.reduce((res,m)=>({...res,[m[2]]:(res[m[2]]||0)+1}),{});
 assert.deepEqual(porEstado,{completado:5,en_curso:3,pendiente:4});
 assert.deepEqual(filas.map(x=>x[1]),[
  'Designación del primer administrador','RUT de la comunidad',
  'Cuenta corriente de la comunidad','Contraparte de la inmobiliaria',
  'Contrato de administración','Observaciones al reglamento de copropiedad',
  'Visita inicial e informe de gestión del primer mes',
  'Seguridad, conserjería y fondo operacional inicial',
  'Seguro colectivo contra incendio','Plan de emergencia y evacuación',
  'Mantención de áreas verdes','Entrega de los bienes comunes de la Etapa I'
 ]);
 assert.ok(sql.includes("date '2026-11-17'"));
 assert.ok(sql.includes("53.328.255-5"));
 assert.ok(sql.includes("Scotiabank, cuenta corriente terminada en 5450"));
 assert.ok(sql.includes("Designadas Andrea Bugueño, Deyanira Flores y Nubia Hormazabal"));
 assert.ok(sql.includes("Pendiente la elección del estándar"));
});

test('Los estados son los únicos tres del informe; no se confunden con porcentajes',()=>{
 for(const valor of ['completado','en_curso','pendiente'])
   assert.match(ui,new RegExp(valor));
 for(const label of ['Completado','En curso','Pendiente','terminado','por iniciar',
  'en trámite o a la espera de respuesta'])assert.ok(ui.includes(label));
 assert.doesNotMatch(ui,/porcentajeSubtareas|resumenGlobalCompromisos/);
});

test('Cuatro columnas, responsive móvil y edición persistida con permisos',()=>{
 for(const cabecera of ['Materia','Avance','Estado','A cargo de'])
  assert.ok(ui.includes('<th scope="col">'+cabecera+'</th>'),cabecera);
 assert.match(ui,/estado-materias__movil/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/estado-materias__tabla-contenedor\{display:none\}/);
 assert.match(css,/estado-materias__estado--completado/);
 assert.match(css,/estado-materias__estado--en_curso/);
 assert.match(css,/estado-materias__estado--pendiente/);
 assert.match(ui,/supabase\.from\('estado_avance_materias'\)\.insert/);
 assert.match(ui,/supabase\.from\('estado_avance_materias'\)\.update/);
 assert.match(ui,/\.eq\('comunidad_id',comunidadId\)/);
 assert.match(ui,/if\(!administrador\|\|guardando\)return/);
 assert.match(ui,/aria-label=\{'Editar materia: '\+item\.materia\}/);
});

test('La tabla nueva queda primero y el historial anterior sigue accesible',()=>{
 assert.match(comunidades,/<EstadoMaterias comunidadId=\{id\}/);
 assert.match(comunidades,/Gestiones anteriores y biblioteca de procesos/);
 assert.match(comunidades,/<Compromisos comunidadId=\{id\}/);
 assert.match(sql,/create table if not exists public\.estado_avance_materias/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/puede_gestionar_compromisos\(\)/);
 assert.doesNotMatch(sql,/update public\.compromisos_administracion|truncate|delete from public\.compromisos_administracion/i);
});

test('Home: sin flechas en ninguna tarjeta ni en enlaces del desplegable',()=>{
 assert.match(home,/className="seleccion-home__tarjeta"/);
 assert.doesNotMatch(home,/function Flecha|<Flecha\s*\/?\s*>|seleccion-home__flecha/);
 assert.match(home,/setAreaAbierta\(v=>v===area\.id\?null:area\.id\)/);
});
