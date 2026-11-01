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

test('cada documento seleccionado tiene su propio checkbox y carpeta',()=>{
 assert.match(adjuntos,/seleccion\.map\(ref=><article className="correo-adjuntos-tarjeta" key=\{ref\}>/);
 assert.match(adjuntos,/checked=\{Boolean\(guardadosDrive\[ref\]\?\.carpeta_id\)\}/);
 assert.match(adjuntos,/setSeleccionandoCarpeta\(ref\)/);
 assert.match(adjuntos,/delete siguiente\[ref\]/);
 assert.match(adjuntos,/onGuardarChange\(siguiente\)/);
 assert.match(adjuntos,/Carpeta: \{guardadosDrive\[ref\]\.ruta/);
 assert.match(adjuntos,/Guardar copia permanente en Google Drive/);
 assert.doesNotMatch(adjuntos,/checked=\{Boolean\(guardadoDrive\?\.carpeta_id\)\}/);
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

test('cada referencia transmite únicamente su carpeta y operación, y se limpia por documento',()=>{
 assert.match(pipeline,/const \[guardadosDriveCorreo,setGuardadosDriveCorreo\] = useState\(\{\}\)/);
 assert.match(pipeline,/guardar_drive:adjuntosCorreo\.filter\(ref=>guardadosDriveCorreo\[ref\]\?\.carpeta_id\)\.map\(ref=>\(\{/);
 assert.match(pipeline,/ref,carpeta_id:guardadosDriveCorreo\[ref\]\.carpeta_id/);
 assert.match(pipeline,/operacion_id:guardadosDriveCorreo\[ref\]\.operacion_id/);
 assert.match(pipeline,/setGuardadosDriveCorreo\(\{\}\)/);
 assert.match(adjuntos,/\[seleccionandoCarpeta\]:\{\.\.\.carpeta,operacion_id:crypto\.randomUUID\(\)\}/);
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

test('el servidor rechaza destinos globales, duplicados o archivos ajenos al mensaje',()=>{
 assert.match(remitente,/body\.guardar_drive!=null && !Array\.isArray\(body\.guardar_drive\)/);
 assert.match(remitente,/guardarDrive\.length>MAX_ARCHIVOS/);
 assert.match(remitente,/!referencias\.includes\(x\.ref\)/);
 assert.match(remitente,/referenciasGuardadas\.has\(x\.ref\)/);
 assert.match(remitente,/for\(const destino of guardarDrive\)/);
 assert.match(remitente,/archivos:\[archivo\]/);
 assert.match(remitente,/carpetaId:seleccion\.carpeta_id/);
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
