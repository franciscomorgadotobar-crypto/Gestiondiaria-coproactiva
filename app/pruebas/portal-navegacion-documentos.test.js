import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const nav=leer('src/componentes/PanelEscritorio.jsx');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const materias=leer('src/paginas/cliente/EstadoMaterias.jsx');
const sql=leer('../supabase/migrations/202611170006_estado_materias_documentos_drive.sql');
const informe=leer('src/lib/informe.js');

test('Barra móvil del cliente reemplaza por completo chips horizontales',()=>{
 assert.match(nav,/const enPortalCliente = esCliente/);
 assert.match(nav,/const opcionesPortalCliente = comunidadPortalId/);
 for(const id of ['resumen','compromisos','levantamientos','documentos','incidencias','mantencion']){
   assert.match(nav,new RegExp("id:'"+id+"'"));
 }
 assert.match(nav,/const opcionesBarra = enPortalCliente \? opcionesPortalCliente/);
 assert.match(nav,/const mostrarBarraMovil = enPortalCliente \|\|/);
 assert.match(nav,/menuMasOperacion\.length>0/);
 assert.match(portal,/esVistaPrevia && <nav className="pestanas portal-pestanas-movil/);
 assert.doesNotMatch(portal,/\bDetalleCliente\b[\s\S]*?return \([^]*?<nav className=\{\x60pestanas portal-pestanas-movil/);
});

test('Los tres KPI filtran los registros y dan acceso al detalle',()=>{
 assert.match(portal,/portal-kpi-enlace/);
 assert.match(portal,/const agrupados=\{atencion,proximos,realizadosMes\}/);
 assert.match(portal,/seleccionado=\{filtro==='atencion'\}/);
 assert.match(portal,/seleccionado=\{filtro==='proximos'\}/);
 assert.match(portal,/seleccionado=\{filtro==='realizadosMes'\}/);
 assert.match(portal,/portal-kpi-detalle/);
 assert.match(portal,/alDetalle=\{cambiarTab\}/);
});

test('Adjuntos Drive enlazados a materias preservan privacidad y edición restringida',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.estado_materia_documentos/);
 assert.match(sql,/d\.visible_cliente IS TRUE/);
 assert.match(sql,/public\.cliente_puede_ver_comunidad\(m\.comunidad_id\)/);
 assert.match(sql,/public\.puede_gestionar_compromisos\(\)/);
 assert.match(sql,/d\.comunidad_id=m\.comunidad_id/);
 assert.match(materias,/drive_listar_documentos/);
 assert.match(materias,/estado_materia_documentos/);
 assert.match(materias,/descargarDeDrive\(comunidadId,doc\)/);
 assert.match(materias,/verEnDrive\(comunidadId,doc\)/);
 assert.match(materias,/!soloLecturaCliente\|\|d\.visible_cliente/);
 assert.match(materias,/if\(!administrador\|\|!idDoc\|\|ocupadoArchivo\)return/);
});

test('Fecha del informe corresponde al levantamiento, no al cierre administrativo',()=>{
 assert.match(informe,/Fecha del levantamiento/);
 assert.match(informe,/fecha\(control\.fecha_levantamiento \?\? control\.checkin_en \?\? control\.programado_para \?\? control\.creado_en\)/);
 assert.doesNotMatch(informe,/fecha\(control\.checkin_en \?\? control\.enviado_en/);
 assert.match(portal,/l\.checkin_en \|\| l\.programado_para \|\| l\.creado_en/);
});
