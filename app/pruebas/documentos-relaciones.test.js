import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=leer('../supabase/migrations/202611020001_documentos_relaciones_crm_comunidad.sql');
const editor=leer('src/paginas/panel/DocumentoEditor.jsx');
const selector=leer('src/componentes/VinculacionDocumento.jsx');
const relacionados=leer('src/componentes/DocumentosVinculados.jsx');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const crm=leer('src/paginas/panel/Pipeline.jsx');
const comunidad=leer('src/paginas/panel/Comunidades.jsx');

test('Dos relaciones simultáneas, índices y backfill histórico aditivo',()=>{
 assert.match(sql,/add column if not exists prospecto_id uuid references public\.prospectos\(id\) on delete set null/);
 assert.match(sql,/add column if not exists comunidad_id uuid references public\.comunidades\(id\) on delete set null/);
 assert.match(sql,/documentos_gestion_prospecto_idx/);
 assert.match(sql,/documentos_gestion_comunidad_idx/);
 assert.match(sql,/contexto_tipo='prospecto' and prospecto_id is null/);
 assert.match(sql,/contexto_tipo='comunidad' and comunidad_id is null/);
 assert.doesNotMatch(sql,/drop table|truncate|delete from public\.documentos_gestion/i);
});

test('RPC atómica y autenticada para asociación y guardado del documento',()=>{
 assert.match(sql,/create or replace function public\.guardar_documento_con_relaciones/);
 assert.match(sql,/v_doc:=public\.guardar_documento_gestion\(/);
 assert.match(sql,/prospecto_id=p_prospecto_id/);
 assert.match(sql,/comunidad_id=p_comunidad_id/);
 assert.match(sql,/revoke all on function public\.guardar_documento_con_relaciones/);
 assert.match(sql,/grant execute on function public\.guardar_documento_con_relaciones/);
 assert.match(sql,/revoke insert,update,delete on public\.documentos_gestion from anon,authenticated/);
});

test('Editor selecciona ambas relaciones y guarda junto con el documento',()=>{
 assert.match(editor,/import VinculacionDocumento/);
 assert.match(editor,/<VinculacionDocumento prospectoId=\{prospectoId\} comunidadId=\{comunidadId\}/);
 assert.match(editor,/guardar_documento_con_relaciones/);
 assert.match(editor,/p_prospecto_id:prospectoId\|\|null,p_comunidad_id:comunidadId\|\|null/);
 assert.match(editor,/setProspectoId\(d\.prospecto_id/);
 assert.match(editor,/setComunidadId\(d\.comunidad_id/);
 assert.match(editor,/setVersion\(d\.version\)/);
});

test('Selector con búsqueda y asociación independiente, y comunidad derivada de CRM',()=>{
 assert.match(selector,/Buscar lead o prospecto \(CRM\)/);
 assert.match(selector,/Buscar comunidad/);
 assert.match(selector,/Sin lead asociado/);
 assert.match(selector,/Sin comunidad asociada/);
 assert.match(selector,/onProspecto\(id,seleccionado\|\|null\)/);
 assert.match(selector,/onComunidad\(seleccionado\.comunidad_id/);
 assert.match(selector,/Abrir ficha CRM/);
 assert.match(selector,/Abrir comunidad/);
});

test('CRM y Comunidad recuperan la misma tabla vinculada y permiten abrir documento',()=>{
 assert.match(relacionados,/\.eq\(columna,id\)/);
 assert.match(relacionados,/tipo==='comunidad'\?'comunidad_id':'prospecto_id'/);
 assert.match(relacionados,/Abrir documento/);
 assert.match(relacionados,/Nuevo documento/);
 assert.match(crm,/<DocumentosVinculados tipo="prospecto" id=\{prospectoSeleccionado\.id\}/);
 assert.match(comunidad,/<DocumentosVinculados tipo="comunidad" id=\{id\}/);
});

test('Gestor puede filtrar documentos asociados por CRM y comunidad sin duplicar documentos',()=>{
 assert.match(gestor,/prospecto_id,comunidad_id,actualizado_en/);
 assert.match(gestor,/d\.prospecto_id===contextoId/);
 assert.match(gestor,/d\.comunidad_id===contextoId/);
 assert.match(gestor,/CRM \+ Comunidad/);
 assert.match(gestor,/&prospecto=/);
 assert.match(gestor,/&comunidad=/);
});
