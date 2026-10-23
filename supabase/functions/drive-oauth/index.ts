// Autorización OAuth 2.0 de Google Drive para contacto@coproactiva.cl.
// POST (sesión de la app): estado | iniciar | desconectar | verificar.
// GET: callback de Google (URI de redirección registrada en Google Cloud).
// verify_jwt=false porque Google no envía JWT en el callback; las acciones POST
// validan la sesión con Auth.getUser y el rol activo del perfil.
import {
  admin, aleatorio, cifrar, cors, credencialesCliente, descifrar, DriveNoConectado, driveJson,
  leerConfig, mensajeSeguro, olvidarAcceso, redirectUri, SCOPE_DRIVE, sha256B64url, sha256Hex, CARPETA,
} from '../_compartido/google-drive.ts';

const APP_URL = (Deno.env.get('DRIVE_APP_URL') || 'https://app.coproactiva.cl').replace(/\/$/, '');
const VIGENCIA_ESTADO_MS = 10 * 60 * 1000;

function volverSeguro(v: unknown) {
  const s = String(v || '');
  return /^\/(?!\/)[A-Za-z0-9/_\-.%]*(\?[A-Za-z0-9_\-=&.%]*)?$/.test(s) && s.length <= 300 ? s : '/comunidades';
}
function redirigirApp(volver: string, resultado: string, motivo?: string) {
  const destino = new URL(APP_URL + volverSeguro(volver));
  destino.searchParams.set('drive', resultado);
  if (motivo) destino.searchParams.set('motivo', motivo);
  return new Response(null, { status: 302, headers: { location: destino.toString(), 'cache-control': 'no-store' } });
}

async function revocar(token: string) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }),
    });
  } catch { /* la revocación es de mejor esfuerzo */ }
}

async function callback(url: URL) {
  const db = admin();
  const estado = url.searchParams.get('state') || '';
  const codigo = url.searchParams.get('code') || '';
  if (!estado) return redirigirApp('/comunidades', 'error', 'estado_invalido');
  const { data: filas } = await db.rpc('drive_consumir_estado', { p_hash: await sha256Hex(estado) });
  const fila = Array.isArray(filas) ? filas[0] : filas;
  if (!fila) return redirigirApp('/comunidades', 'error', 'estado_invalido');
  const volver = fila.volver || '/comunidades';
  if (url.searchParams.get('error')) return redirigirApp(volver, 'error', 'cancelado');
  if (!codigo) return redirigirApp(volver, 'error', 'sin_codigo');

  const { data: perfil } = await db.from('perfiles').select('rol,activo').eq('id', fila.perfil_id).single();
  if (!perfil?.activo || !['superadmin', 'admin'].includes(String(perfil.rol))) return redirigirApp(volver, 'error', 'sin_permiso');

  const cfg = await leerConfig(db);
  const cli = credencialesCliente(cfg);
  if (!cli.listo) return redirigirApp(volver, 'error', 'sin_cliente');
  let verificador: string;
  try { verificador = await descifrar(fila.verificador_cifrado); } catch { return redirigirApp(volver, 'error', 'estado_invalido'); }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo, client_id: cli.id, client_secret: cli.secreto, redirect_uri: redirectUri(),
      grant_type: 'authorization_code', code_verifier: verificador,
    }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) {
    console.error('drive-oauth: intercambio rechazado', t.error || r.status);
    return redirigirApp(volver, 'error', 'intercambio');
  }
  const scopes = String(t.scope || '').split(/\s+/).filter(Boolean);
  if (!scopes.includes(SCOPE_DRIVE)) { await revocar(t.access_token); return redirigirApp(volver, 'error', 'permisos_incompletos'); }
  if (!t.refresh_token) { await revocar(t.access_token); return redirigirApp(volver, 'error', 'sin_acceso_offline'); }

  // Verifica la cuenta autorizada sin pedir scopes adicionales (Drive about.user).
  const about = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)', {
    headers: { authorization: 'Bearer ' + t.access_token },
  }).then((x) => x.json()).catch(() => ({}));
  const email = String(about?.user?.emailAddress || '').toLowerCase();
  if (!email || email !== cfg.cuenta_esperada.toLowerCase()) {
    await revocar(t.refresh_token);
    return redirigirApp(volver, 'error', 'cuenta_incorrecta');
  }

  // Comprueba acceso a COPROACTIVA y Comunidades (solo lectura de metadatos).
  let aviso: string | null = null;
  for (const id of [cfg.raiz_id, cfg.comunidades_id]) {
    const m = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=id,mimeType,trashed', {
      headers: { authorization: 'Bearer ' + t.access_token },
    }).then((x) => x.ok ? x.json() : null).catch(() => null);
    if (!m || m.trashed || m.mimeType !== CARPETA) aviso = 'La cuenta está conectada, pero no se encontró la carpeta COPROACTIVA o Comunidades configurada.';
  }

  await db.rpc('drive_guardar_token', { p_cifrado: await cifrar(t.refresh_token) });
  olvidarAcceso();
  const ahora = new Date().toISOString();
  await db.from('drive_conexion').update({
    estado: 'conectada', cuenta_email: email, cuenta_nombre: about?.user?.displayName || null, scopes,
    conectada_por: fila.perfil_id, conectada_en: ahora, ultimo_refresco: ahora,
    ultima_verificacion: aviso ? null : ahora, ultimo_error: aviso, editado_en: ahora,
  }).eq('id', true);
  // Las comunidades pendientes quedan listas para el reintento automático inmediato.
  await db.from('drive_carpetas_comunidad').update({ siguiente_intento: null })
    .in('estado', ['pendiente', 'error', 'sin_configurar']);
  return redirigirApp(volver, 'conectado');
}

Deno.serve(async (req) => {
  const h = cors(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    try { return await callback(url); } catch (e) {
      console.error('drive-oauth: callback', e instanceof Error ? e.message : 'desconocido');
      return redirigirApp('/comunidades', 'error', 'interno');
    }
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  const db = admin();
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ ok: false, error: 'Sesión requerida' }, 401);
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return json({ ok: false, error: 'Sesión inválida' }, 401);
  const { data: perfil } = await db.from('perfiles').select('rol,activo').eq('id', user.id).single();
  const rol = String(perfil?.rol || '');
  if (!perfil?.activo || !['superadmin', 'admin', 'jefatura'].includes(rol)) return json({ ok: false, error: 'Perfil no autorizado' }, 403);
  const esAdmin = ['superadmin', 'admin'].includes(rol);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const action = String(body.action || 'estado');
  try {
    const cfg = await leerConfig(db);
    const cli = credencialesCliente(cfg);
    if (action === 'estado') {
      const { data: c } = await db.from('drive_conexion')
        .select('estado,cuenta_email,cuenta_nombre,conectada_en,ultimo_refresco,ultima_verificacion,ultimo_error').eq('id', true).single();
      return json({ ok: true, conexion: c, cliente_configurado: cli.listo, cuenta_esperada: cfg.cuenta_esperada, puede_autorizar: esAdmin });
    }
    if (!esAdmin) return json({ ok: false, error: 'Solo un administrador puede autorizar o desconectar Google Drive.' }, 403);

    if (action === 'iniciar') {
      if (!cli.listo) return json({ ok: false, error: 'Falta configurar el cliente OAuth en Supabase.' }, 503);
      await db.from('drive_oauth_estados').delete().lt('expira_en', new Date(Date.now() - 86_400_000).toISOString());
      const estado = aleatorio(32), verificador = aleatorio(48);
      const expira = new Date(Date.now() + VIGENCIA_ESTADO_MS).toISOString();
      const { error } = await db.from('drive_oauth_estados').insert({
        estado_hash: await sha256Hex(estado), perfil_id: user.id, verificador_cifrado: await cifrar(verificador),
        volver: volverSeguro(body.volver), expira_en: expira,
      });
      if (error) throw error;
      const p = new URLSearchParams({
        client_id: cli.id, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPE_DRIVE,
        access_type: 'offline', prompt: 'consent', state: estado,
        code_challenge: await sha256B64url(verificador), code_challenge_method: 'S256',
        login_hint: cfg.cuenta_esperada, hd: cfg.cuenta_esperada.split('@')[1] || '',
      });
      return json({ ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?' + p, expira_en: expira });
    }

    if (action === 'desconectar') {
      const { data: cifrado } = await db.rpc('drive_leer_token');
      if (cifrado) { try { await revocar(await descifrar(String(cifrado))); } catch { /* token ilegible: igual se borra */ } }
      await db.rpc('drive_borrar_token');
      olvidarAcceso();
      await db.from('drive_conexion').update({
        estado: 'desconectada', ultimo_error: null, editado_en: new Date().toISOString(),
      }).eq('id', true);
      return json({ ok: true });
    }

    if (action === 'verificar') {
      const about = await driveJson(db, '/drive/v3/about?fields=user(emailAddress)');
      const raiz = await driveJson(db, '/drive/v3/files/' + encodeURIComponent(cfg.raiz_id) + '?supportsAllDrives=true&fields=id,name,trashed');
      const comunidades = await driveJson(db, '/drive/v3/files/' + encodeURIComponent(cfg.comunidades_id) + '?supportsAllDrives=true&fields=id,name,trashed');
      const correcto = String(about?.user?.emailAddress || '').toLowerCase() === cfg.cuenta_esperada.toLowerCase();
      const ok = correcto && !raiz.trashed && !comunidades.trashed;
      await db.from('drive_conexion').update({
        ultima_verificacion: ok ? new Date().toISOString() : null,
        ultimo_error: ok ? null : 'La verificación de la cuenta o de las carpetas base falló.',
      }).eq('id', true);
      return json({ ok, raiz: raiz.name, comunidades: comunidades.name });
    }
    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (e) {
    console.error('drive-oauth:', action, e instanceof Error ? e.message : 'desconocido');
    return json({ ok: false, error: mensajeSeguro(e) }, e instanceof DriveNoConectado ? 503 : 502);
  }
});
