import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ESTADOS_GESTION, TIPOS_REGISTRO, resumenGestiones, vistaGestiones,
 normalizarTareasModelo, normalizarDocumentosModelo, ordenCronologico, informeGestionHtml
} from '../src/lib/gestiones.js';
const leer=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const ui=leer('src/paginas/cliente/Compromisos.jsx');
const repo=leer('src/paginas/cliente/GestionesRepositorio.jsx');
const backend=leer('../supabase/migrations/202611060001_gestiones_y_avances.sql');
const rollback=leer('../supabase/rollbacks/202611060001_gestiones_reversion_segura.sql');
const backup=leer('../docs/reversion-gestiones-20261106.md');

test('Clasificar trabajo activo e histórico sin confundir porcentaje y estado',()=>{
 const items=[
  {id:1,estado:'pendiente',avance:100},
  {id:2,estado:'en_curso',avance:50},
  {id:3,estado:'en_pausa',avance:85},
  {id:4,estado:'bloqueado',avance:90},
  {id:5,estado:'en_espera',avance:99},
  {id:6,estado:'completado',avance:20}
 ];
 assert.deepEqual(resumenGestiones(items),{pendientes:1,enProceso:4,completadas:1,bloqueadas:3,archivadas:0});
 assert.deepEqual(vistaGestiones(items).map(x=>x.id),[1,2,3,4,5]);
 assert.deepEqual(vistaGestiones(items,'completadas').map(x=>x.id),[6]);
 assert.equal(vistaGestiones(items,'todas').length,6);
 assert.equal(ESTADOS_GESTION.bloqueado,'Bloqueada');
 assert.equal(TIPOS_REGISTRO.observacion,'Observación');
});
test('Un tipo copia tareas y documentos, sin contaminar plantillas o instancias',()=>{
 assert.deepEqual(normalizarTareasModelo('RUT\nCuenta bancaria\n\nSeguros'),
  [{titulo:'RUT'},{titulo:'Cuenta bancaria'},{titulo:'Seguros'}]);
 assert.deepEqual(normalizarDocumentosModelo('TE1\n RUT \n'),['TE1','RUT']);
 assert.match(backend,/insert into public.compromisos_subtareas/);
 assert.match(backend,/modelo\.documentos_esperados/);
 assert.match(backend,/modelo\.tareas/);
 assert.match(backend,/where id=p_tipo_id and activo/);
 assert.match(repo,/Guardar modelo/);
 assert.match(repo,/onActualizado/);
 assert.match(repo,/supabase\.rpc\('gestiones_crear_desde_tipo'/);
});
test('La línea de tiempo se ordena y el reporte escapa HTML',()=>{
 const avances=[{id:'a',registrado_en:'2026-11-03T12:00:00Z',descripcion:'Visita <script>alert(1)</script>',tipo_registro:'avance'}];
 const cambios=[{id:'s',cambiado_en:'2026-11-05T12:00:00Z',observacion:'Revisión',estado_anterior:'pendiente',estado_nuevo:'en_curso'}];
 assert.deepEqual(ordenCronologico(avances,cambios).map(x=>x.id),['s','a']);
 const html=informeGestionHtml({gestion:{titulo:'<img src=x>',estado:'en_curso',avance:35},
  subtareas:[{titulo:'Certificado',completada:true}],avances,transiciones:cambios,
  documentos:[{nombre:'TE1.pdf'}]});
 assert.ok(html.includes('&lt;img src=x&gt;'));
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.match(html,/TE1\.pdf/);
});
test('La UX unifica registrar, documentar, cerrar y generar informe',()=>{
 assert.match(ui,/Gestiones y avances/);
 assert.match(ui,/GestionesRepositorio/);
 assert.match(ui,/gestiones-acciones-rapidas/);
 assert.match(ui,/gestiones-control/);
 assert.match(ui,/gestiones_cambiar_estado/);
 assert.match(ui,/resultado.*item\.resultado/);
 assert.match(ui,/ordenCronologico\(historico,movimientos\)/);
 assert.match(ui,/imprimirGestion\(item,sub,historico,movimientos\)/);
 assert.match(ui,/tipo_registro:tipoRegistro/);
 assert.match(ui,/publicado:publicar/);
 assert.match(ui,/Guardar registro/);
 assert.doesNotMatch(ui,/supabase\.rpc\('compromisos_cambiar_etapa'/);
});
test('La base desacopla el motor de avance y conserva estados y documentos',()=>{
 assert.match(backend,/create or replace function public.compromisos_recalcular_desde_subtareas/);
 assert.match(backend,/if v_total=0 then return/);
 assert.match(backend,/avance=v_porcentaje, actualizado_en=now/);
 assert.doesNotMatch(backend,/v_cerradas=v_total then v_estado='completado'/);
 assert.match(backend,/p_estado='completado'.*resultado_final/is);
 assert.match(backend,/resultad.*antes de completar la gestión/);
 assert.match(backend,/gestiones_tipos.*enable row level security/);
 assert.match(backend,/public\.puede_gestionar_compromisos\(\)/);
 assert.match(backend,/grant execute on function public.gestiones_cambiar_estado/);
 assert.match(backend,/alter column registrado_por set default auth\.uid\(\)/);
 assert.match(backend,/add column if not exists documentos_esperados/);
});
test('Rollback conserva datos históricos y restaura solo el comportamiento previo',()=>{
 assert.match(backup,/8e9edfd8dead410f2edcbd5e635e452293760e32/);
 assert.match(backup,/copro_reversion_20261106/);
 assert.match(rollback,/for v in select definicion from copro_reversion_20261106\.funciones/);
 assert.doesNotMatch(rollback,/drop table|truncate|delete from public/i);
 assert.match(rollback,/revoke all on function public.gestiones_cambiar_estado/);
});
