// Núcleo compartido de Google Drive (OAuth 2.0 de contacto@coproactiva.cl).
// Reglas: ningún token sale de las Edge Functions; el refresh token se guarda
// cifrado (AES-256-GCM) en Supabase Vault y la clave proviene de secretos Edge.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.48.1';

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';
export const CARPETA = 'application/vnd.google-apps.folder';
export const MAX_BYTES = 25 * 1024 * 1024;

export const CATS = {
  administracion: '01 Administración',
  finanzas: '02 Finanzas',
  operaciones: '03 Operaciones',
  seguimiento: '04 Seguimiento e informes',
} as const;
export type Categoria = keyof typeof CATS;

// Módulo de origen → categoría fija y subcarpeta. "general" exige categoría explícita.
export const ORIGENES: Record<string, { categoria: Categoria | null; carpeta: string; requiereId: boolean }> = {
  levantamiento: { categoria: 'operaciones', carpeta: 'Levantamientos', requiereId: true },
  mantencion: { categoria: 'operaciones', carpeta: 'Mantenciones', requiereId: true },
  incidencia: { categoria: 'operaciones', carpeta: 'Incidencias', requiereId: true },
  compromiso: { categoria: 'seguimiento', carpeta: 'Compromisos y avances', requiereId: true },
  administrativo: { categoria: 'administracion', carpeta: 'Documentos administrativos', requiereId: false },
  contabilidad: { categoria: 'finanzas', carpeta: 'Contabilidad', requiereId: false },
  informe: { categoria: 'seguimiento', carpeta: 'Informes', requiereId: false },
  general: { categoria: null, carpeta: 'Documentos', requiereId: false },
};

export class DriveNoConectado extends Error {
  constructor(m = 'Google Drive no está conectado. Un administrador debe autorizarlo en Comunidades → Configuración.') { super(m); }
}
export class DriveRevision extends Error {}
export class DriveOcupado extends Error {
  constructor() { super('Otra operación de Drive está en curso para esta comunidad. Reintenta en unos segundos.'); }
}
export class DriveError extends Error {
  status: number;
  constructor(status: number, m: string) { super(m); this.status = status; }
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- utilidades criptográficas ----------
const te = new TextEncoder();
export const b64url = (v: Uint8Array) =>
  btoa(Array.from(v, (x) => String.fromCharCode(x)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeB64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
export const aleatorio = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256Hex(v: string | Uint8Array) {
  const datos = typeof v === 'string' ? te.encode(v) : v;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', datos as BufferSource)), (x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256B64url(v: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(v))));
}

let claveCache: CryptoKey | null = null;
async function claveCifrado(): Promise<CryptoKey> {
  if (claveCache) return claveCache;
  const material = Deno.env.get('DRIVE_TOKEN_KEY') || Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!material) throw new DriveNoConectado('Falta configurar el secreto del cliente OAuth en Supabase.');
  const base = await crypto.subtle.importKey('raw', te.encode(material), 'HKDF', false, ['deriveKey']);
  claveCache = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: te.encode('coproactiva-drive-v1'), info: te.encode('oauth-refresh-token') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  return claveCache;
}
export async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await claveCifrado(), te.encode(texto)));
  return 'v1.' + b64url(iv) + '.' + b64url(ct);
}
export async function descifrar(valor: string) {
  const [v, iv, ct] = valor.split('.');
  if (v !== 'v1' || !iv || !ct) throw new DriveNoConectado('El token guardado no es válido. Reconecta Google Drive.');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desdeB64url(iv) }, await claveCifrado(), desdeB64url(ct));
    return new TextDecoder().decode(pt);
  } catch {
    throw new DriveNoConectado('No fue posible descifrar la autorización guardada. Reconecta Google Drive.');
  }
}

// ---------- configuración ----------
export type Config = { raiz_id: string; comunidades_id: string; cuenta_esperada: string; oauth_client_id: string | null; worker_token_hash: string | null };
export async function leerConfig(db: SupabaseClient): Promise<Config> {
  const { data, error } = await db.from('drive_configuracion')
    .select('raiz_id,comunidades_id,cuenta_esperada,oauth_client_id,worker_token_hash').eq('id', true).single();
  if (error || !data) throw new Error('Falta la configuración base de Drive');
  return data as Config;
}
export function credencialesCliente(cfg: Config) {
  const id = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || cfg.oauth_client_id || '';
  const secreto = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
  return { id, secreto, listo: Boolean(id && secreto) };
}
export const redirectUri = () => Deno.env.get('SUPABASE_URL')!.replace(/\/$/, '') + '/functions/v1/drive-oauth';

// ---------- tokens ----------
let accesoCache: { token: string; exp: number } | null = null;
export function olvidarAcceso() { accesoCache = null; }

export async function tokenAcceso(db: SupabaseClient): Promise<string> {
  if (accesoCache && accesoCache.exp > Date.now() + 60_000) return accesoCache.token;
  const { data: conexion } = await db.from('drive_conexion').select('estado').eq('id', true).single();
  if (conexion?.estado !== 'conectada') throw new DriveNoConectado();
  const { data: cifrado, error } = await db.rpc('drive_leer_token');
  if (error || !cifrado) throw new DriveNoConectado();
  const refresh = await descifrar(String(cifrado));
  const cfg = await leerConfig(db);
  const cli = credencialesCliente(cfg);
  if (!cli.listo) throw new DriveNoConectado('Falta configurar el cliente OAuth en Supabase.');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cli.id, client_secret: cli.secreto, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant' || j.error === 'unauthorized_client') {
      await db.from('drive_conexion').update({
        estado: 'revocada', ultimo_error: 'Google revocó o expiró la autorización. Un administrador debe reconectar Google Drive.',
        editado_en: new Date().toISOString(),
      }).eq('id', true);
      accesoCache = null;
      throw new DriveNoConectado('La autorización de Google Drive fue revocada o expiró. Reconecta Google Drive.');
    }
    throw new DriveError(502, 'Google no renovó el acceso (' + (j.error || r.status) + ')');
  }
  if (j.refresh_token) await db.rpc('drive_guardar_token', { p_cifrado: await cifrar(j.refresh_token) });
  accesoCache = { token: j.access_token, exp: Date.now() + Math.max(300, Number(j.expires_in || 3600)) * 1000 };
  await db.from('drive_conexion').update({ ultimo_refresco: new Date().toISOString() }).eq('id', true);
  return accesoCache.token;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function driveFetch(db: SupabaseClient, ruta: string, init: RequestInit = {}, intento = 0): Promise<Response> {
  const token = await tokenAcceso(db);
  const headers = new Headers(init.headers || {});
  headers.set('authorization', 'Bearer ' + token);
  const res = await fetch('https://www.googleapis.com' + ruta, { ...init, headers });
  const reintentable = !init.body || typeof init.body === 'string';
  if (res.status === 401 && intento === 0) { accesoCache = null; await res.body?.cancel(); return driveFetch(db, ruta, init, 1); }
  if (reintentable && (res.status === 429 || res.status >= 500) && intento < 2) {
    await res.body?.cancel(); await espera(600 * (intento + 1)); return driveFetch(db, ruta, init, intento + 1);
  }
  return res;
}

export async function driveJson(db: SupabaseClient, ruta: string, init: RequestInit = {}) {
  const r = await driveFetch(db, ruta, init);
  const t = await r.text();
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { msg = JSON.parse(t)?.error?.message || msg; } catch { /* sin detalle */ }
    throw new DriveError(r.status, 'Drive: ' + msg.slice(0, 200));
  }
  return t ? JSON.parse(t) : {};
}

// ---------- carpetas ----------
const q = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const CAMPOS = 'id,name,mimeType,trashed,parents,appProperties,createdTime';

export async function obtener(db: SupabaseClient, id: string) {
  try {
    return await driveJson(db, '/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=' + CAMPOS);
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return null;
    throw e;
  }
}

export async function buscarCarpeta(db: SupabaseClient, padre: string, nombre: string) {
  const p = new URLSearchParams({
    q: `'${q(padre)}' in parents and name = '${q(nombre)}' and mimeType = '${CARPETA}' and trashed = false`,
    fields: 'files(' + CAMPOS + ')', pageSize: '10', orderBy: 'createdTime',
    supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
  });
  const r = await driveJson(db, '/drive/v3/files?' + p);
  return r.files?.[0] ?? null;
}

export async function buscarPorPropiedad(db: SupabaseClient, clave: string, valor: string) {
  const p = new URLSearchParams({
    q: `appProperties has { key='${q(clave)}' and value='${q(valor)}' } and mimeType = '${CARPETA}' and trashed = false`,
    fields: 'files(' + CAMPOS + ')', pageSize: '10', orderBy: 'createdTime',
    supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
  });
  const r = await driveJson(db, '/drive/v3/files?' + p);
  return r.files?.[0] ?? null;
}

export async function listarCarpetas(db: SupabaseClient, padre: string) {
  const p = new URLSearchParams({
    q: `'${q(padre)}' in parents and mimeType = '${CARPETA}' and trashed = false`,
    fields: 'files(id,name)', pageSize: '200', orderBy: 'name',
    supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
  });
  const r = await driveJson(db, '/drive/v3/files?' + p);
  return (r.files ?? []) as { id: string; name: string }[];
}

export async function crearCarpeta(db: SupabaseClient, padre: string, nombre: string, props: Record<string, string>) {
  return await driveJson(db, '/drive/v3/files?supportsAllDrives=true&fields=' + CAMPOS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre], appProperties: { coproactiva: '1', ...props } }),
  });
}

// Comprueba que una carpeta vive dentro de COPROACTIVA/Comunidades (sin mover nada).
export async function esDescendiente(db: SupabaseClient, id: string, ancestro: string, niveles = 6) {
  let actual = id;
  for (let i = 0; i < niveles; i++) {
    const m = await obtener(db, actual);
    const padres: string[] = m?.parents ?? [];
    if (!padres.length) return false;
    if (padres.includes(ancestro)) return true;
    actual = padres[0];
  }
  return false;
}

export const nombreSeguro = (v: string, respaldo = 'Sin nombre') => {
  const x = String(v || '').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (x || respaldo).slice(0, 180);
};
export const enlaceCarpeta = (id?: string | null) => id ? 'https://drive.google.com/drive/folders/' + encodeURIComponent(id) : null;

// ---------- validación de archivos ----------
const TIPOS: Record<string, { mime: string; firma: (b: Uint8Array) => boolean }> = {};
const empieza = (b: Uint8Array, ...xs: number[]) => xs.every((x, i) => b[i] === x);
const ascii = (b: Uint8Array, desde: number, hasta: number) => String.fromCharCode(...b.slice(desde, hasta));
const esPdf = (b: Uint8Array) => ascii(b, 0, 5) === '%PDF-';
const esZip = (b: Uint8Array) => empieza(b, 0x50, 0x4b, 0x03, 0x04);
const esOle = (b: Uint8Array) => empieza(b, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const esFtyp = (b: Uint8Array) => ascii(b, 4, 8) === 'ftyp';
const esTexto = (b: Uint8Array) => !b.slice(0, 8192).includes(0);
for (const [ext, mime, firma] of [
  ['pdf', 'application/pdf', esPdf],
  ['jpg', 'image/jpeg', (b: Uint8Array) => empieza(b, 0xff, 0xd8, 0xff)],
  ['jpeg', 'image/jpeg', (b: Uint8Array) => empieza(b, 0xff, 0xd8, 0xff)],
  ['png', 'image/png', (b: Uint8Array) => empieza(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
  ['webp', 'image/webp', (b: Uint8Array) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP'],
  ['gif', 'image/gif', (b: Uint8Array) => ascii(b, 0, 4) === 'GIF8'],
  ['heic', 'image/heic', esFtyp],
  ['heif', 'image/heif', esFtyp],
  ['mp4', 'video/mp4', esFtyp],
  ['mov', 'video/quicktime', (b: Uint8Array) => esFtyp(b) || ['moov', 'wide', 'mdat', 'free'].includes(ascii(b, 4, 8))],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', esZip],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', esZip],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', esZip],
  ['odt', 'application/vnd.oasis.opendocument.text', esZip],
  ['ods', 'application/vnd.oasis.opendocument.spreadsheet', esZip],
  ['doc', 'application/msword', esOle],
  ['xls', 'application/vnd.ms-excel', esOle],
  ['ppt', 'application/vnd.ms-powerpoint', esOle],
  ['csv', 'text/csv', esTexto],
  ['txt', 'text/plain', esTexto],
] as [string, string, (b: Uint8Array) => boolean][]) TIPOS[ext] = { mime, firma };
export const EXTENSIONES = Object.keys(TIPOS);

export function validarArchivo(nombre: string, bytes: Uint8Array) {
  if (!bytes.length) throw new DriveError(400, 'El archivo está vacío.');
  if (bytes.length > MAX_BYTES) throw new DriveError(413, 'El archivo supera el máximo de 25 MB.');
  const limpio = nombreSeguro(nombre, 'archivo');
  const ext = (limpio.match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) throw new DriveError(415, 'Tipo de archivo no permitido. Usa PDF, imágenes, Word, Excel, PowerPoint, CSV, TXT o video MP4/MOV.');
  if (!tipo.firma(bytes)) throw new DriveError(415, 'El contenido del archivo no corresponde a su extensión .' + ext + '.');
  return { nombre: limpio, ext, mime: tipo.mime };
}

export async function subirArchivo(db: SupabaseClient, a: { bytes: Uint8Array; nombre: string; mime: string; padre: string; props: Record<string, string> }) {
  const limite = 'copro_' + crypto.randomUUID().replace(/-/g, '');
  const meta = JSON.stringify({ name: a.nombre, mimeType: a.mime, parents: [a.padre], appProperties: { coproactiva: '1', ...a.props } });
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${a.mime}\r\n\r\n`,
    a.bytes as BlobPart,
    `\r\n--${limite}--\r\n`,
  ]);
  return await driveJson(db, '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,parents', {
    method: 'POST',
    headers: { 'content-type': 'multipart/related; boundary=' + limite },
    body: cuerpo,
  });
}

export async function aPapelera(db: SupabaseClient, id: string) {
  try {
    await driveJson(db, '/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=id,trashed', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return;
    throw e;
  }
}

// ---------- CORS ----------
const ORIGENES_PERMITIDOS = new Set([
  'https://app.coproactiva.cl', 'https://localhost', 'http://localhost', 'capacitor://localhost',
  'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173',
]);
export function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'content-disposition, x-coproactiva-mime, x-coproactiva-nombre',
    'Vary': 'Origin',
  };
  if (ORIGENES_PERMITIDOS.has(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}

export function mensajeSeguro(e: unknown) {
  if (e instanceof DriveNoConectado || e instanceof DriveRevision || e instanceof DriveOcupado) return e.message;
  if (e instanceof DriveError) return e.message;
  return 'No se pudo completar la operación con Google Drive.';
}
export function estadoHttp(e: unknown) {
  if (e instanceof DriveNoConectado) return 503;
  if (e instanceof DriveOcupado) return 409;
  if (e instanceof DriveRevision) return 409;
  if (e instanceof DriveError) return e.status >= 400 && e.status < 600 ? (e.status === 401 ? 502 : e.status) : 502;
  return 500;
}
