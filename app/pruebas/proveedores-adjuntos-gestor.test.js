import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=leer('src/paginas/panel/Proveedores.jsx');
const historial=leer('src/paginas/panel/ProveedoresComunicaciones.jsx');
const adjuntos=leer('src/componentes/AdjuntosCorreo.jsx');
const servidor=leer('../supabase/functions/enviar-comunicacion-proveedores/index.ts');
const sql=leer('../supabase/migrations/202611010004_proveedores_adjuntos_documentales.sql');

test('Proveedores reutiliza el mismo selector de CRM dentro de su compositor contextual',()=>{
 assert.match(ui,/import AdjuntosCorreo from/);
 assert.match(ui,/<AdjuntosCorreo seleccion=\{adjuntosCorreo\}/);
 assert.match(ui,/onGuardarChange=\{setGuardadosDriveCorreo\}/);
 assert.match(ui,/adjuntos:adjuntosCorreo/);
 assert.match(ui,/guardar_drive:adjuntosCorreo\.filter/);
 assert.match(adjuntos,/Gestor documental/);
 assert.match(adjuntos,/Adjuntar PDF/);
 assert.match(adjuntos,/new File\(\[blob\]/);
});
test('El servidor valida IDs opacos, duplicados, límite de tres archivos y 8 MB',()=>{
 assert.match(servidor,/const MAX_ARCHIVOS = 3/);
 assert.match(servidor,/const MAX_TOTAL = 8 \* 1024 \* 1024/);
 assert.match(servidor,/new Set\(referencias\)\.size/);
 assert.match(servidor,/\^\(b\|c\):/);
 assert.match(servidor,/MIME_PERMITIDOS\.has\(mime\)/);
 assert.match(servidor,/totalBytes > MAX_TOTAL/);
 assert.match(servidor,/bytes\.length !== tamano/);
 assert.match(servidor,/!UUID\.test\(id\)/);
});
test('Servidor descarga binarios de Drive y utiliza el motor SMTP común',()=>{
 assert.match(servidor,/driveFetch\(admin,/);
 assert.match(servidor,/\?alt=media&supportsAllDrives=true/);
 assert.match(servidor,/adjuntosSMTP\.push/);
 assert.match(servidor,/adjuntos: adjuntosSMTP/);
 assert.match(servidor,/await enviarLote\(correos\)/);
 assert.match(servidor,/perfil_comunidades/);
 assert.match(servidor,/guardarAdjuntosEnCarpeta\(admin,/);
 assert.ok(servidor.indexOf('guardarAdjuntosEnCarpeta(admin,') < servidor.indexOf('await enviarLote(correos)'));
});
test('Historial guarda solo referencias; no duplica archivos ni abre enlaces públicos',()=>{
 assert.match(sql,/add column if not exists adjuntos jsonb not null default/);
 assert.doesNotMatch(sql,/drop table|truncate table|delete from/i);
 assert.match(servidor,/adjuntos: adjuntosAuditoria/);
 assert.match(servidor,/guardado_drive/);
 assert.match(historial,/seleccionada\.adjuntos\.map/);
 assert.match(historial,/Adjuntos reales/);
});
