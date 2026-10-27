import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Correo SMTP envía adjuntos binarios MIME, nunca URLs de Drive',()=>{
 const smtp=read('supabase/functions/correo-prospecto/index.ts');
 assert.match(smtp,/attachments:adjuntosSMTP/);
 assert.match(smtp,/encoding:'binary'/);
 assert.match(smtp,/content:bytes/);
 assert.match(smtp,/driveFetch\(admin,/);
 assert.match(smtp,/MAX_ARCHIVOS=3, MAX_TOTAL=8\*1024\*1024/);
 assert.match(smtp,/const referencias=Array\.isArray\(body\?\.adjuntos\)/);
 assert.match(smtp,/perfil_comunidades/);
 assert.match(smtp,/if\(total>MAX_TOTAL\)/);
 assert.match(smtp,/adjuntos:auditoriaAdjuntos/);
 assert.match(smtp,/plantilla\.adjunto_sugerido\?\.trim\(\)&&!referencias\.length/);
 assert.doesNotMatch(smtp,/drive\.google\.com\/file\/d\/|webViewLink/);
});

test('Biblioteca requiere sesión y almacena bytes en Drive privado',()=>{
 const edge=read('supabase/functions/correo-archivos/index.ts');
 assert.match(edge,/db\.auth\.getUser\(jwt\)/);
 assert.match(edge,/perfil\?\.activo/);
 assert.match(edge,/crearCarpeta/);
 assert.match(edge,/subirArchivo\(db,/);
 assert.match(edge,/aPapelera\(db,/);
 assert.match(edge,/MAX=8\*1024\*1024/);
 assert.match(edge,/correo_archivos_drive/);
 assert.doesNotMatch(edge,/getPublicUrl|createSignedUrl/);
 const sql=read('supabase/migrations/0104_biblioteca_adjuntos_correo_drive.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/public\.puede_gestionar_compromisos/);
 assert.match(sql,/grant select on public\.correo_archivos_drive to authenticated/);
});

test('Pipeline soporta cargar desde teléfono, biblioteca y comunidad',()=>{
 const ui=read('src/componentes/AdjuntosCorreo.jsx');
 const pipeline=read('src/paginas/panel/Pipeline.jsx');
 assert.match(ui,/type="file" multiple/);
 assert.match(ui,/Documentos de comunidades/);
 assert.match(ui,/Biblioteca interna/);
 assert.match(ui,/onChange\(seleccionados\)/);
 assert.match(pipeline,/<AdjuntosCorreo seleccion=\{adjuntosCorreo\}/);
 assert.match(pipeline,/adjuntos:adjuntosCorreo/);
 assert.match(pipeline,/necesitaAdjunto&&!adjuntosCorreo\.length/);
});
