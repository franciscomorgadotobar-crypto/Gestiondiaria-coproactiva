import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fuente=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const adjuntos=fuente('app/src/componentes/AdjuntosCorreo.jsx');
const selector=fuente('app/src/componentes/SelectorCarpetaDrive.jsx');
const pipeline=fuente('app/src/paginas/panel/Pipeline.jsx');
const archivos=fuente('supabase/functions/correo-archivos/index.ts');
const remitente=fuente('supabase/functions/correo-prospecto/index.ts');
const drive=fuente('supabase/functions/_compartido/drive-correo.ts');

test('el checkbox de guardado es opcional y solo abre selector con adjuntos',()=>{
 assert.match(adjuntos,/checked=\{Boolean\(guardadoDrive\?\.carpeta_id\)\}/);
 assert.match(adjuntos,/disabled=\{!seleccion\.length\}/);
 assert.match(adjuntos,/setSeleccionandoCarpeta\(true\)/);
 assert.match(adjuntos,/onGuardarChange\(null\)/);
 assert.match(adjuntos,/Guardar copia permanente en Google Drive/);
});

test('el selector permite carpetas reales, última ubicación y crear nuevas',()=>{
 assert.match(selector,/action:'carpetas'/);
 assert.match(selector,/action:'crear_carpeta'/);
 assert.match(selector,/Guardar en esta carpeta/);
 assert.match(selector,/Nueva carpeta/);
 assert.match(selector,/localStorage\.setItem/);
 assert.match(selector,/role="dialog" aria-modal="true"/);
 assert.doesNotMatch(selector,/window\.open\(['"]https:\/\/drive/);
});

test('el cliente transmite carpeta elegida solo con consentimiento y conserva la operación en reintentos',()=>{
 assert.match(pipeline,/\.\.\.\(guardadoDriveCorreo\?\.carpeta_id\s*\?/);
 assert.match(pipeline,/guardar_drive:\{carpeta_id:guardadoDriveCorreo\.carpeta_id,operacion_id:guardadoDriveCorreo\.operacion_id\}/);
 assert.match(pipeline,/setGuardadoDriveCorreo\(null\)/);
 assert.match(adjuntos,/operacion_id:crypto\.randomUUID\(\)/);
});

test('servidor comprueba autenticación, rol y árbol comercial antes de consultar o crear',()=>{
 assert.match(archivos,/auth\.getUser\(jwt\)/);
 assert.match(archivos,/PERSONAL\.has\(perfil\.rol\)/);
 assert.match(archivos,/if\(accion==='carpetas'\)/);
 assert.match(archivos,/if\(accion==='crear_carpeta'\)/);
 assert.match(drive,/esDescendiente\(db,destino,raiz\.id,12\)/);
 assert.match(drive,/metadatos\.mimeType!==CARPETA/);
 assert.match(drive,/nombre\.length>64/);
});

test('guarda copias físicas en Drive con idempotencia, sin cambiar adjuntos SMTP',()=>{
 assert.match(drive,/\/copy\?supportsAllDrives=true/);
 assert.match(drive,/appProperties:\{coproactiva:'1',coproactiva_guardado:hash\}/);
 assert.match(drive,/sha256Hex\(args\.usuarioId/);
 assert.match(drive,/existente\.files\?\.\[0\]/);
 assert.match(remitente,/guardarAdjuntosEnCarpeta\(admin,/);
 assert.ok(remitente.indexOf('guardarAdjuntosEnCarpeta(admin,')<remitente.indexOf('enviarLoteMotor([{'));
 assert.match(remitente,/auditoriaAdjuntos\.find/);
 assert.match(remitente,/adjuntos:auditoriaAdjuntos/);
 assert.match(remitente,/adjuntos:adjuntosSMTP/);
});
