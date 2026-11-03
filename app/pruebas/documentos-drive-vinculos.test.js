import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const links=leer('src/componentes/DocumentosVinculados.jsx');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const editor=leer('src/paginas/panel/DocumentoEditor.jsx');
const cliente=leer('src/lib/drive.js');
const carpeta=leer('src/componentes/CarpetaDriveComercial.jsx');
const compromiso=leer('src/paginas/cliente/Compromisos.jsx');
const driveFn=leer('../supabase/functions/drive-comunidad/index.ts');
const correoFn=leer('../supabase/functions/correo-archivos/index.ts');
const sql=leer('../supabase/migrations/202611020004_copias_drive_documentos_comerciales.sql');

test('CRM incluye propuestas comerciales realmente asociadas al lead',()=>{
 assert.match(links,/\.from\('propuestas_comerciales'\)/);
 assert.match(links,/\.eq\('prospecto_id',id\)/);
 assert.match(links,/\.from\('documentos_gestion'\)/);
 assert.match(links,/\/propuestas\?documento=/);
 assert.match(links,/d\.origen==='propuestas'/);
});
test('Crear documento abre Home de plantillas y mantiene el contexto',()=>{
 assert.match(links,/const url='\/documentos\?'/);
 assert.doesNotMatch(links,/const url='\/documentos\/nuevo\?tipo=informe_gestion/);
 assert.match(gestor,/id="documentos-plantillas"/);
 assert.match(gestor,/\+ Crear documento<\/a>/);
 assert.match(gestor,/rutaPlantilla\(t\.id\)/);
 assert.match(gestor,/encodeURIComponent\(prospecto\)/);
});
test('PDF de documento archiva en Drive según comunidad o carpeta comercial',()=>{
 assert.match(editor,/generarPdfDocumento\(/);
 assert.match(editor,/guardarPdfDocumentoDrive/);
 assert.match(editor,/Reintentar archivo en Drive/);
 assert.match(editor,/CarpetaDriveComercial/);
 assert.match(cliente,/origenTipo:'informe'/);
 assert.match(cliente,/clave:'documento-'/);
 assert.match(cliente,/documento_id/);
 assert.match(correoFn,/carpetaAutorizada/);
 assert.match(correoFn,/version_documento/);
 assert.match(sql,/correo_archivos_drive_documento_version_unica/);
 assert.match(carpeta,/crear_carpeta/);
});
test('Evidencias de subtarea residen en Drive corporativo, no en nuevos blobs Supabase',()=>{
 assert.match(compromiso,/detalleId=\{x\.id\}/);
 assert.match(compromiso,/origenTipo="compromiso"/);
 assert.match(compromiso,/Adjuntos de esta subtarea/);
 assert.doesNotMatch(compromiso,/async function adjuntarASubtarea/);
 assert.doesNotMatch(compromiso,/from\('compromisos_subtareas_adjuntos'\)/);
 assert.match(driveFn,/db\.from\('compromisos_subtareas'\)/);
 assert.match(driveFn,/La subtarea o el avance no pertenecen al compromiso/);
 assert.match(compromiso,/Conecta Google Drive/);
});
