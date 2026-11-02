import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {porcentajeSubtareas,resumenGlobalCompromisos} from '../src/lib/progresoCompromisos.js';
const leer=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=leer('../supabase/migrations/202611020002_compromisos_subtareas_progreso_adjuntos.sql');
const ui=leer('src/paginas/cliente/Compromisos.jsx');
const css=leer('src/paginas/cliente/Compromisos.css');
const inicio=leer('src/paginas/panel/Inicio.jsx');
const general=leer('src/paginas/panel/CompromisosGeneral.jsx');

test('Compromisos: promedio de subtareas parciales y check terminado',()=>{
 assert.equal(porcentajeSubtareas([]),0);
 assert.equal(porcentajeSubtareas([{avance:50},{completada:true,avance:100},{avance:0}]),50);
 assert.equal(porcentajeSubtareas([{completada:true},{completada:false}]),50);
 assert.equal(porcentajeSubtareas([{avance:10},{avance:90}]),50);
});
test('Global: compromisos sin subtareas mantienen progreso histórico',()=>{
 const r=resumenGlobalCompromisos([
  {estado:'completado',avance:100},
  {estado:'en_curso',avance:50},
  {estado:'pendiente',avance:0}
 ]);
 assert.deepEqual(r,{total:3,completados:1,abiertos:2,porcentaje:50});
 assert.equal(resumenGlobalCompromisos([]).porcentaje,0);
});
test('Estado se calcula en Postgres desde subtareas en vez de escribir porcentaje desde React',()=>{
 assert.match(sql,/after insert or update of avance,completada,compromiso_id or delete/);
 assert.match(sql,/coalesce\(round\(avg\(avance\)\),0\)/);
 assert.match(sql,/v_total>0 and v_cerradas=v_total then v_estado='completado'/);
 assert.match(sql,/elsif v_actual.estado='completado' then v_estado='en_curso'/);
 assert.match(sql,/v_porcentaje>0 and v_actual.estado='pendiente'/);
 assert.match(sql,/compromisos_transiciones/);
 assert.match(ui,/\.update\(\{completada,avance:completada\?100:0\}\)/);
 assert.match(ui,/\.update\(\{avance:Math\.min\(90/);
 assert.match(ui,/if\(!subt\.length\)/);
 assert.doesNotMatch(ui,/Math\.round\(items\.filter\(s=>s\.completada\)\.length/);
});
test('La subtarea se cierra solo mediante check, progreso parcial sin teclear',()=>{
 assert.match(ui,/aria-label=\{'Cerrar subtarea: '\+x\.titulo\}/);
 assert.match(ui,/<select value=\{x\.avance\|\|0\}/);
 assert.match(ui,/\[0,10,20,30,40,50,60,70,80,90\]/);
 assert.match(ui,/compromisos-subtarea-porcentaje/);
 assert.match(ui,/administrador&&!x\.completada/);
 assert.match(css,/compromisos-subtarea-progreso/);
});
test('Adjuntos por subtarea tienen metadatos, RLS, bucket privado, enlace firmado y eliminación',()=>{
 assert.match(sql,/create table if not exists public\.compromisos_subtareas_adjuntos/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/compromisos_subtareas_adjuntos_leer/);
 assert.match(sql,/archivo_subtareas_compromisos_select/);
 assert.match(sql,/grant select,insert,delete/);
 assert.match(ui,/\.from\('compromisos_subtareas_adjuntos'\)/);
 assert.match(ui,/subtarea_id:sub\.id/);
 assert.match(ui,/storage\.from\('compromisos-adjuntos'\)/);
 assert.match(ui,/abrirAdjunto\(doc\)/);
 assert.match(ui,/eliminarAdjuntoSubtarea/);
});
test('Tableros muestran avance global sin confundir levantamientos con compromisos',()=>{
 assert.match(inicio,/Levantamientos pendientes/);
 assert.match(inicio,/avanceCompromisos\.abiertos/);
 assert.match(general,/Avance global de compromisos/);
 assert.match(general,/global\.porcentaje/);
 assert.match(ui,/resumenGlobalCompromisos\(compromisos\)/);
});

test('Checks enviados por versiones antiguas de la PWA siguen funcionando',()=>{
 const sqlLegacy=leer('../supabase/migrations/202611020003_compromisos_subtareas_compatibilidad_check.sql');
 assert.match(sqlLegacy,/before insert or update of completada,avance/);
 assert.match(sqlLegacy,/new\.completada then/);
 assert.match(sqlLegacy,/new\.avance=100/);
 assert.match(sqlLegacy,/old\.completada and not new\.completada/);
 assert.match(sqlLegacy,/new\.avance=0/);
 assert.match(sqlLegacy,/security invoker/);
});
