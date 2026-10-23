import { supabase } from './supabase';

/* Acceso a Google Drive corporativo a través de las Edge Functions.
 * El navegador nunca recibe tokens de Google: solo la sesión de Supabase
 * viaja a drive-comunidad / drive-oauth, que operan del lado servidor. */

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const DRIVE_MAX_BYTES = 25 * 1024 * 1024;
export const DRIVE_EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'mp4', 'mov',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'csv', 'txt'];
export const DRIVE_ACCEPT = DRIVE_EXTENSIONES.map(e => '.' + e).join(',');

export const CATEGORIAS_DRIVE = {
  administracion: '01 Administración',
  finanzas: '02 Finanzas',
  operaciones: '03 Operaciones',
  seguimiento: '04 Seguimiento e informes'
};

export const ORIGENES_DRIVE = {
  levantamiento: 'Levantamiento',
  mantencion: 'Mantención',
  incidencia: 'Incidencia',
  compromiso: 'Compromiso',
  administrativo: 'Documento administrativo',
  contabilidad: 'Contabilidad',
  informe: 'Informe',
  general: 'Documento'
};

async function cabeceras(json = true) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
  const h = { authorization: 'Bearer ' + session.access_token, apikey: ANON };
  if (json) h['content-type'] = 'application/json';
  return h;
}

async function leerRespuesta(r) {
  const tipo = r.headers.get('content-type') || '';
  const datos = tipo.includes('application/json') ? await r.json().catch(() => ({})) : {};
  if (!r.ok || datos.ok === false) {
    const e = new Error(datos.error || (r.status === 503
      ? 'Google Drive aún no está autorizado.'
      : 'No se pudo completar la operación con Google Drive.'));
    e.status = r.status;
    e.datos = datos;
    throw e;
  }
  return datos;
}

export async function llamarDrive(accion, cuerpo = {}, funcion = 'drive-comunidad') {
  const r = await fetch(BASE + funcion, {
    method: 'POST', headers: await cabeceras(), body: JSON.stringify({ action: accion, ...cuerpo })
  });
  return leerRespuesta(r);
}

export const estadoOAuthDrive = () => llamarDrive('estado', {}, 'drive-oauth');
export const desconectarDrive = () => llamarDrive('desconectar', {}, 'drive-oauth');
export const verificarConexionDrive = () => llamarDrive('verificar', {}, 'drive-oauth');

/* Redirige a Google con una URL de un solo uso generada por el servidor. */
export async function autorizarDrive(volver) {
  const { url } = await llamarDrive('iniciar', { volver }, 'drive-oauth');
  window.location.assign(url);
}

/* Creación o verificación de carpetas. Nunca bloquea el flujo que la llama. */
export function prepararCarpetasDrive(comunidadId) {
  return llamarDrive('provision', { comunidad_id: comunidadId })
    .catch(e => { console.warn('Drive pendiente:', e?.message); return null; });
}

export async function conexionDrive() {
  const { data, error } = await supabase.rpc('drive_estado');
  if (error) return { conectada: false, estado: 'desconocido' };
  return (Array.isArray(data) ? data[0] : data) || { conectada: false, estado: 'desconectada' };
}

export function validarArchivoDrive(file) {
  const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
  if (!DRIVE_EXTENSIONES.includes(ext)) return `${file.name}: tipo no permitido.`;
  if (file.size === 0) return `${file.name}: el archivo está vacío.`;
  if (file.size > DRIVE_MAX_BYTES) return `${file.name}: supera 25 MB.`;
  return null;
}

export async function subirADrive({ comunidadId, origenTipo, origenId, detalleId, categoria, archivo, descripcion, clave }) {
  const fd = new FormData();
  fd.append('action', 'upload');
  fd.append('comunidad_id', comunidadId);
  fd.append('origen_tipo', origenTipo);
  if (origenId) fd.append('origen_id', String(origenId));
  if (detalleId) fd.append('detalle_id', String(detalleId));
  if (categoria) fd.append('categoria', categoria);
  if (descripcion) fd.append('descripcion', descripcion);
  fd.append('clave_idempotencia', clave || crypto.randomUUID());
  fd.append('archivo', archivo);
  const r = await fetch(BASE + 'drive-comunidad', { method: 'POST', headers: await cabeceras(false), body: fd });
  return leerRespuesta(r);
}

async function bajar(comunidadId, documentoId, modo) {
  const r = await fetch(BASE + 'drive-comunidad', {
    method: 'POST', headers: await cabeceras(),
    body: JSON.stringify({ action: 'download', comunidad_id: comunidadId, documento_id: documentoId, modo })
  });
  if (!r.ok) await leerRespuesta(r);
  const mime = r.headers.get('x-coproactiva-mime') || 'application/octet-stream';
  const blob = new Blob([await r.arrayBuffer()], { type: mime });
  return { blob, mime };
}

export async function descargarDeDrive(comunidadId, doc) {
  const { blob } = await bajar(comunidadId, doc.id, 'descargar');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = doc.nombre; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const sePuedeVer = mime => /^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(mime || '');

/* Abre la ventana en el clic (evita bloqueos de ventanas emergentes) y luego
 * muestra el archivo; si el navegador no permite ventanas, lo descarga. */
export async function verEnDrive(comunidadId, doc) {
  const ventana = window.open('', '_blank');
  try {
    const { blob } = await bajar(comunidadId, doc.id, 'ver');
    const url = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url; a.download = doc.nombre; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

export const eliminarDeDrive = (comunidadId, documentoId) =>
  llamarDrive('delete', { comunidad_id: comunidadId, documento_id: documentoId });

export const visibilidadDrive = (comunidadId, documentoId, visible, confirmarSensible = false) =>
  llamarDrive('visibilidad', { comunidad_id: comunidadId, documento_id: documentoId, visible, confirmar_sensible: confirmarSensible });

export function tamanoLegible(b) {
  if (!Number.isFinite(Number(b))) return '';
  const n = Number(b);
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

export const fechaHoraCL = v => v ? new Date(v).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
}) : '';
