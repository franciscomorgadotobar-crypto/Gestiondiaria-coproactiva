// Documentos por comunidad en el Drive corporativo (OAuth de contacto@coproactiva.cl).
// Acciones POST (sesión): provision, agrupaciones, asignar_agrupacion, upload,
// download, delete, visibilidad. POST con X-Coproactiva-Worker: reintento
// automático (pg_cron). verify_jwt=true en la puerta de enlace y, además, cada
// acción valida la sesión (Auth.getUser) y el rol, o el token interno del cron.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.48.1';
import {
  admin, aPapelera, buscarCarpeta, buscarPorPropiedad, CARPETA, CATS, type Categoria, cors,
  crearCarpeta, DriveError, DriveNoConectado, DriveOcupado, DriveRevision, driveFetch, enlaceCarpeta,
  esDescendiente, estadoHttp, leerConfig, listarCarpetas, mensajeSeguro, nombreSeguro, obtener, ORIGENES,
  sha256Hex, subirArchivo, validarArchivo,
} from '../_compartido/google-drive.ts';

type Perfil = { id: string; rol: string; activo: boolean };
const PERSONAL = ['superadmin', 'admin', 'jefatura'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBCARPETA_LIBRE = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;
const SENSIBLES: Categoria[] = ['administracion', 'finanzas'];
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- permisos ----------
async function veComunidad(db: SupabaseClient, p: Perfil, cid: string) {
  if (!p.activo) return false;
  if (p.rol === 'superadmin') return true;
  if (p.rol === 'cliente') {
    const { data } = await db.from('portal_cliente_comunidades').select('comunidad_id')
      .eq('usuario_id', p.id).eq('comunidad_id', cid).eq('activa', true).maybeSingle();
    return Boolean(data);
  }
  const { data } = await db.from('perfil_comunidades').select('comunidad_id')
    .eq('perfil_id', p.id).eq('comunidad_id', cid).maybeSingle();
  return Boolean(data);
}
const esPersonal = (p: Perfil) => p.activo && PERSONAL.includes(p.rol);

async function controlAsignado(db: SupabaseClient, p: Perfil, cid: string, controlId: string) {
  if (!UUID.test(controlId)) return false;
  const { data } = await db.from('controles').select('id').eq('id', controlId).eq('comunidad_id', cid)
    .eq('responsable_id', p.id).maybeSingle();
  return Boolean(data);
}

async function puedeLeerDocumento(db: SupabaseClient, p: Perfil, doc: Record<string, any>) {
  if (!p.activo || doc.eliminado_en) return false;
  if (esPersonal(p)) return await veComunidad(db, p, doc.comunidad_id);
  if (p.rol === 'terreno') return doc.origen_tipo === 'levantamiento' && await controlAsignado(db, p, doc.comunidad_id, doc.origen_id || '');
  if (p.rol === 'cliente') return Boolean(doc.visible_cliente) && await veComunidad(db, p, doc.comunidad_id);
  return false;
}

// El registro de origen debe existir y pertenecer a la misma comunidad.
async function validarOrigen(db: SupabaseClient, cid: string, tipo: string, origenId: string, detalleId: string) {
  const tabla: Record<string, string> = {
    levantamiento: 'controles', mantencion: 'mantenimiento_agendamientos',
    incidencia: 'bitacora_registros', compromiso: 'compromisos_administracion',
  };
  if (tabla[tipo]) {
    if (!UUID.test(origenId)) throw new DriveError(400, 'Registro de origen inválido.');
    const { data } = await db.from(tabla[tipo]).select('id').eq('id', origenId).eq('comunidad_id', cid).maybeSingle();
    if (!data) throw new DriveError(403, 'El registro de origen no pertenece a esta comunidad.');
  } else if (origenId && !SUBCARPETA_LIBRE.test(origenId)) {
    throw new DriveError(400, 'Nombre de subcarpeta inválido (letras, números, guion o punto).');
  }
  if (detalleId) {
    if (tipo !== 'compromiso' || !UUID.test(detalleId)) throw new DriveError(400, 'Detalle inválido.');
    const { data } = await db.from('compromisos_avances').select('id').eq('id', detalleId).eq('compromiso_id', origenId).maybeSingle();
    if (!data) throw new DriveError(403, 'El avance no pertenece al compromiso.');
  }
}

async function evento(db: SupabaseClient, e: { documento_id?: string | null; comunidad_id: string; accion: string; perfil_id?: string | null; detalle?: Record<string, unknown> }) {
  const { error } = await db.from('drive_archivos_eventos').insert({ ...e, detalle: e.detalle ?? {} });
  if (error) console.error('drive-comunidad: evento no registrado', error.message);
}

// ---------- bloqueo por comunidad ----------
async function conBloqueo<T>(db: SupabaseClient, cid: string, fn: () => Promise<T>, intentos = 10): Promise<T> {
  for (let i = 0; i < intentos; i++) {
    const { data: ok } = await db.rpc('drive_tomar_bloqueo', { p_comunidad: cid, p_segundos: 90 });
    if (ok) {
      try { return await fn(); } finally { await db.rpc('drive_soltar_bloqueo', { p_comunidad: cid }); }
    }
    await espera(700);
  }
  throw new DriveOcupado();
}

// ---------- carpetas de la comunidad (idempotente; nunca renombra, mueve ni borra) ----------
async function provisionSinBloqueo(db: SupabaseClient, cid: string) {
  const cfg = await leerConfig(db);
  const { data: com } = await db.from('comunidades').select('id,nombre,carpeta_drive_id').eq('id', cid).single();
  if (!com) throw new DriveError(404, 'Comunidad no encontrada');
  const { data: est } = await db.from('drive_carpetas_comunidad').select('*').eq('comunidad_id', cid).single();
  const ahora = new Date().toISOString();
  await db.from('drive_carpetas_comunidad').update({
    estado: 'en_proceso', ultimo_intento: ahora, intentos: (est?.intentos ?? 0) + 1, editado_en: ahora,
  }).eq('comunidad_id', cid);

  try {
    let fid: string = com.carpeta_drive_id || '';
    let nombreCarpeta = '';
    if (fid) {
      const m = await obtener(db, fid);
      if (!m || m.trashed || m.mimeType !== CARPETA) {
        throw new DriveRevision('La carpeta vinculada no existe o está en la papelera de Drive. Restáurala en Drive y vuelve a comprobar; no se creó otra para evitar duplicados.');
      }
      if (!(await esDescendiente(db, fid, cfg.comunidades_id))) {
        throw new DriveRevision('La carpeta vinculada está fuera de COPROACTIVA / Comunidades. Revísala en Drive antes de continuar.');
      }
      nombreCarpeta = m.name;
    } else {
      const padre = est?.agrupacion_id || cfg.comunidades_id;
      if (est?.agrupacion_id) {
        const g = await obtener(db, est.agrupacion_id);
        if (!g || g.trashed || g.mimeType !== CARPETA || !(g.parents ?? []).includes(cfg.comunidades_id)) {
          throw new DriveRevision('La agrupación seleccionada ya no está dentro de Comunidades. Elige otra agrupación.');
        }
      }
      let carpeta = await buscarPorPropiedad(db, 'coproactiva_comunidad', cid);
      if (!carpeta) {
        const nombre = nombreSeguro(com.nombre, 'Comunidad');
        const candidata = await buscarCarpeta(db, padre, nombre);
        if (candidata) {
          const { data: otra } = await db.from('comunidades').select('id').eq('carpeta_drive_id', candidata.id).neq('id', cid).maybeSingle();
          carpeta = otra ? await crearCarpeta(db, padre, nombre + ' · ' + cid.slice(0, 8), { coproactiva_comunidad: cid }) : candidata;
        } else {
          carpeta = await crearCarpeta(db, padre, nombre, { coproactiva_comunidad: cid });
        }
      }
      fid = carpeta.id;
      nombreCarpeta = carpeta.name;
      const { error } = await db.from('comunidades').update({ carpeta_drive_id: fid }).eq('id', cid).is('carpeta_drive_id', null);
      if (error) throw new DriveRevision('La carpeta encontrada ya está vinculada a otra comunidad.');
    }

    const anteriores: Record<string, string> = est?.carpetas ?? {};
    const carpetas: Record<string, string> = {};
    for (const [cat, nombre] of Object.entries(CATS)) {
      const guardada = anteriores[cat];
      if (guardada) {
        const m = await obtener(db, guardada);
        if (m && !m.trashed && m.mimeType === CARPETA && (m.parents ?? []).includes(fid)) { carpetas[cat] = guardada; continue; }
      }
      const existente = await buscarCarpeta(db, fid, nombre);
      carpetas[cat] = existente ? existente.id
        : (await crearCarpeta(db, fid, nombre, { coproactiva_comunidad: cid, coproactiva_categoria: cat })).id;
    }
    const fin = new Date().toISOString();
    await db.from('drive_carpetas_comunidad').update({
      estado: 'lista', carpetas, carpeta_nombre: nombreCarpeta, verificado_en: fin, ultimo_error: null,
      siguiente_intento: null, intentos: 0, editado_en: fin,
    }).eq('comunidad_id', cid);
    return { carpeta_id: fid, carpeta_nombre: nombreCarpeta, carpetas, enlace: enlaceCarpeta(fid), verificado_en: fin };
  } catch (e) {
    const intentos = (est?.intentos ?? 0) + 1;
    const estado = e instanceof DriveRevision ? 'revision' : e instanceof DriveNoConectado ? 'sin_configurar' : 'error';
    const demora = Math.min(24 * 60, 5 * 2 ** Math.min(intentos, 8)) * 60_000;
    await db.from('drive_carpetas_comunidad').update({
      estado, ultimo_error: mensajeSeguro(e),
      siguiente_intento: estado === 'revision' ? null : new Date(Date.now() + demora).toISOString(),
      editado_en: new Date().toISOString(),
    }).eq('comunidad_id', cid);
    throw e;
  }
}
const provision = (db: SupabaseClient, cid: string) => conBloqueo(db, cid, () => provisionSinBloqueo(db, cid));

async function asegurarSub(db: SupabaseClient, cid: string, padre: string, nombre: string, clave: string) {
  const { data: cache } = await db.from('drive_subcarpetas').select('drive_id').eq('comunidad_id', cid).eq('clave', clave).maybeSingle();
  if (cache?.drive_id) {
    const m = await obtener(db, cache.drive_id);
    if (m && !m.trashed && (m.parents ?? []).includes(padre)) return cache.drive_id as string;
  }
  const existente = await buscarCarpeta(db, padre, nombre);
  const id = existente ? existente.id : (await crearCarpeta(db, padre, nombre, { coproactiva_comunidad: cid, coproactiva_clave: clave })).id;
  await db.from('drive_subcarpetas').upsert({ comunidad_id: cid, clave, drive_id: id });
  return id as string;
}

// Ej.: COPROACTIVA / Comunidades / GPR / Reserva Santa Clara / 03 Operaciones / Levantamientos / [ID]
async function carpetaDestino(db: SupabaseClient, cid: string, categoria: Categoria, tipo: string, origenId: string) {
  return await conBloqueo(db, cid, async () => {
    const { data: est } = await db.from('drive_carpetas_comunidad').select('estado,carpetas').eq('comunidad_id', cid).single();
    let carpetas: Record<string, string> = est?.carpetas ?? {};
    let base = carpetas[categoria];
    const valida = base && est?.estado === 'lista' ? await obtener(db, base) : null;
    if (!valida || valida.trashed) {
      carpetas = (await provisionSinBloqueo(db, cid)).carpetas;
      base = carpetas[categoria];
    }
    const def = ORIGENES[tipo];
    const modulo = await asegurarSub(db, cid, base, def.carpeta, `${categoria}/${def.carpeta}`);
    return origenId ? await asegurarSub(db, cid, modulo, origenId, `${categoria}/${def.carpeta}/${origenId}`) : modulo;
  });
}

// ---------- descarga (la app recibe bytes; el tipo real viaja en x-coproactiva-mime) ----------
async function enviarArchivo(db: SupabaseClient, doc: Record<string, any>, h: Record<string, string>) {
  const g = await driveFetch(db, '/drive/v3/files/' + encodeURIComponent(doc.drive_file_id) + '?alt=media&supportsAllDrives=true');
  if (!g.ok) { await g.body?.cancel(); throw new DriveError(g.status === 404 ? 404 : 502, g.status === 404 ? 'El archivo ya no existe en Drive.' : 'Drive no entregó el archivo.'); }
  const headers: Record<string, string> = {
    ...h, 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(doc.nombre),
    'x-coproactiva-mime': doc.mime || 'application/octet-stream', 'x-coproactiva-nombre': encodeURIComponent(doc.nombre),
  };
  const largo = g.headers.get('content-length');
  if (largo) headers['content-length'] = largo;
  return new Response(g.body, { status: 200, headers });
}

// ---------- reintento automático ----------
async function procesarPendientes(db: SupabaseClient) {
  const { data: c } = await db.from('drive_conexion').select('estado').eq('id', true).single();
  if (c?.estado !== 'conectada') return { procesadas: 0, omitido: 'Drive sin conectar' };
  const ahora = new Date().toISOString();
  const { data: filas } = await db.from('drive_carpetas_comunidad')
    .select('comunidad_id,estado,verificado_en,siguiente_intento,intentos,comunidades!inner(estado)')
    .or(`and(estado.in.(pendiente,error,sin_configurar),or(siguiente_intento.is.null,siguiente_intento.lte."${ahora}")),and(estado.eq.lista,verificado_en.is.null)`)
    .neq('comunidades.estado', 'terminado')
    .lt('intentos', 12)
    .limit(10);
  const resultado: Record<string, string> = {};
  for (const f of filas ?? []) {
    try { await provision(db, f.comunidad_id); resultado[f.comunidad_id] = 'lista'; }
    catch (e) { resultado[f.comunidad_id] = mensajeSeguro(e); }
  }
  return { procesadas: Object.keys(resultado).length, resultado };
}

Deno.serve(async (req) => {
  const h = cors(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const db = admin();

  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  // Reintento automático desde pg_cron (token interno guardado en Vault; aquí solo su hash).
  const interno = req.headers.get('x-coproactiva-worker');
  if (interno) {
    const cfg = await leerConfig(db);
    if (!cfg.worker_token_hash || (await sha256Hex(interno)) !== cfg.worker_token_hash) return json({ ok: false, error: 'Sin permiso' }, 403);
    try { return json({ ok: true, ...(await procesarPendientes(db)) }); }
    catch (e) { return json({ ok: false, error: mensajeSeguro(e) }, 500); }
  }

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ ok: false, error: 'Sesión requerida' }, 401);
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return json({ ok: false, error: 'Sesión inválida' }, 401);
  const { data: perfilDb } = await db.from('perfiles').select('id,rol,activo').eq('id', user.id).single();
  const perfil = perfilDb as Perfil | null;
  if (!perfil?.activo) return json({ ok: false, error: 'Perfil no autorizado' }, 403);

  let action = '';
  try {
    const multipart = (req.headers.get('content-type') || '').includes('multipart/form-data');
    const input: any = multipart ? await req.formData() : await req.json().catch(() => ({}));
    const get = (k: string) => { const v = multipart ? input.get(k) : input[k]; return v == null ? '' : v; };
    action = String(get('action'));
    const cid = String(get('comunidad_id'));
    if (!UUID.test(cid)) return json({ ok: false, error: 'Comunidad inválida' }, 400);
    if (!(await veComunidad(db, perfil, cid)) && !(perfil.rol === 'terreno' && ['upload', 'download'].includes(action))) {
      return json({ ok: false, error: 'Sin acceso a esta comunidad' }, 403);
    }

    if (action === 'provision') {
      if (!esPersonal(perfil)) return json({ ok: false, error: 'Acción no autorizada' }, 403);
      return json({ ok: true, ...(await provision(db, cid)) });
    }

    if (action === 'agrupaciones') {
      if (!esPersonal(perfil)) return json({ ok: false, error: 'Acción no autorizada' }, 403);
      const cfg = await leerConfig(db);
      const { data: vinculadas } = await db.from('comunidades').select('carpeta_drive_id').not('carpeta_drive_id', 'is', null);
      const usadas = new Set((vinculadas ?? []).map((x) => x.carpeta_drive_id));
      const carpetas = (await listarCarpetas(db, cfg.comunidades_id)).filter((x) => !usadas.has(x.id));
      return json({ ok: true, agrupaciones: carpetas });
    }

    if (action === 'asignar_agrupacion') {
      if (!esPersonal(perfil)) return json({ ok: false, error: 'Acción no autorizada' }, 403);
      const { data: com } = await db.from('comunidades').select('carpeta_drive_id').eq('id', cid).single();
      if (com?.carpeta_drive_id) return json({ ok: false, error: 'La comunidad ya tiene carpeta; no se moverá para respetar la estructura existente.' }, 409);
      const cfg = await leerConfig(db);
      let agrupacionId = String(get('agrupacion_id') || '');
      let agrupacionNombre: string | null = null;
      const nueva = nombreSeguro(String(get('agrupacion_nueva') || ''), '');
      if (nueva) {
        const c = await buscarCarpeta(db, cfg.comunidades_id, nueva) ?? await crearCarpeta(db, cfg.comunidades_id, nueva, { coproactiva_agrupacion: '1' });
        agrupacionId = c.id; agrupacionNombre = c.name;
      } else if (agrupacionId) {
        const g = await obtener(db, agrupacionId);
        if (!g || g.trashed || g.mimeType !== CARPETA || !(g.parents ?? []).includes(cfg.comunidades_id)) return json({ ok: false, error: 'Agrupación inválida' }, 400);
        agrupacionNombre = g.name;
      }
      await db.from('drive_carpetas_comunidad').upsert({
        comunidad_id: cid, agrupacion_id: agrupacionId || null, agrupacion_nombre: agrupacionNombre, editado_en: new Date().toISOString(),
      });
      return json({ ok: true, agrupacion_id: agrupacionId || null, agrupacion_nombre: agrupacionNombre });
    }

    if (action === 'upload') {
      const archivo = get('archivo');
      if (!(archivo instanceof File)) return json({ ok: false, error: 'Adjunta un archivo' }, 400);
      const tipo = String(get('origen_tipo') || 'general');
      const def = ORIGENES[tipo];
      if (!def) return json({ ok: false, error: 'Módulo de origen inválido' }, 400);
      const origenId = String(get('origen_id') || '').trim();
      const detalleId = String(get('detalle_id') || '').trim();
      const categoria = (def.categoria ?? String(get('categoria'))) as Categoria;
      if (!(categoria in CATS)) return json({ ok: false, error: 'Categoría inválida' }, 400);
      if (def.requiereId && !origenId) return json({ ok: false, error: 'Falta el registro de origen' }, 400);
      if (perfil.rol === 'terreno') {
        if (tipo !== 'levantamiento' || !(await controlAsignado(db, perfil, cid, origenId))) {
          return json({ ok: false, error: 'Solo puedes adjuntar en levantamientos asignados a ti' }, 403);
        }
      } else if (!esPersonal(perfil)) return json({ ok: false, error: 'Acción no autorizada' }, 403);
      await validarOrigen(db, cid, tipo, origenId, detalleId);

      const clave = String(get('clave_idempotencia') || '').slice(0, 80);
      if (clave) {
        const { data: previo } = await db.from('drive_archivos_comunidad').select('id,nombre,categoria,origen_tipo,creado_en')
          .eq('clave_idempotencia', clave).eq('comunidad_id', cid).maybeSingle();
        if (previo) return json({ ok: true, documento: previo, repetido: true });
      }
      if (archivo.size > 25 * 1024 * 1024) return json({ ok: false, error: 'El archivo supera el máximo de 25 MB.' }, 413);
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const valido = validarArchivo(archivo.name, bytes);
      const sha = await sha256Hex(bytes);
      const destino = await carpetaDestino(db, cid, categoria, tipo, origenId);
      const docId = crypto.randomUUID();
      const subido = await subirArchivo(db, {
        bytes, nombre: valido.nombre, mime: valido.mime, padre: destino,
        props: { coproactiva_comunidad: cid, coproactiva_documento: docId },
      });
      const descripcion = String(get('descripcion') || '').trim().slice(0, 500) || null;
      const { data: doc, error } = await db.from('drive_archivos_comunidad').insert({
        id: docId, comunidad_id: cid, categoria, origen_tipo: tipo, origen_id: origenId || null,
        detalle_id: detalleId || null, drive_file_id: subido.id, drive_folder_id: destino,
        nombre: valido.nombre, mime: valido.mime, tamano: bytes.length, sha256: sha,
        md5_drive: subido.md5Checksum ?? null, descripcion, clave_idempotencia: clave || null,
        registrado_por: user.id, visible_cliente: false,
      }).select('id,nombre,categoria,origen_tipo,creado_en').single();
      if (error) {
        await aPapelera(db, subido.id).catch(() => {});
        if (clave && error.code === '23505') {
          const { data: previo } = await db.from('drive_archivos_comunidad').select('id,nombre,categoria,origen_tipo,creado_en').eq('clave_idempotencia', clave).maybeSingle();
          if (previo) return json({ ok: true, documento: previo, repetido: true });
        }
        throw error;
      }
      if (subido.size && Number(subido.size) !== bytes.length) console.error('drive-comunidad: tamaño distinto tras subir', doc.id);
      await evento(db, { documento_id: doc.id, comunidad_id: cid, accion: 'subido', perfil_id: user.id, detalle: { tamano: bytes.length, categoria, origen_tipo: tipo } });
      return json({ ok: true, documento: doc });
    }

    const docId = String(get('documento_id'));
    if (!UUID.test(docId)) return json({ ok: false, error: 'Documento inválido' }, 400);
    const { data: doc } = await db.from('drive_archivos_comunidad').select('*').eq('id', docId).eq('comunidad_id', cid).maybeSingle();
    if (!doc) return json({ ok: false, error: 'Documento no encontrado' }, 404);

    if (action === 'download') {
      if (!(await puedeLeerDocumento(db, perfil, doc))) return json({ ok: false, error: 'Sin acceso al documento' }, 403);
      const r = await enviarArchivo(db, doc, h);
      await evento(db, { documento_id: doc.id, comunidad_id: cid, accion: get('modo') === 'ver' ? 'visto' : 'descargado', perfil_id: user.id });
      return r;
    }

    if (!esPersonal(perfil)) return json({ ok: false, error: 'Acción no autorizada' }, 403);

    if (action === 'delete') {
      if (doc.eliminado_en) return json({ ok: true, ya_eliminado: true });
      await aPapelera(db, doc.drive_file_id);
      const { error } = await db.from('drive_archivos_comunidad').update({
        eliminado_en: new Date().toISOString(), eliminado_por: user.id, visible_cliente: false,
      }).eq('id', doc.id);
      if (error) throw error;
      await evento(db, { documento_id: doc.id, comunidad_id: cid, accion: 'eliminado', perfil_id: user.id, detalle: { destino: 'papelera de Drive' } });
      return json({ ok: true });
    }

    if (action === 'visibilidad') {
      if (doc.eliminado_en) return json({ ok: false, error: 'El documento está eliminado' }, 409);
      const visible = String(get('visible')) === 'true' || get('visible') === true;
      if (visible && SENSIBLES.includes(doc.categoria) && String(get('confirmar_sensible')) !== 'true' && get('confirmar_sensible') !== true) {
        return json({ ok: false, requiere_confirmacion: true, error: 'Este documento es administrativo o financiero. Confirma que puede publicarse al cliente.' }, 409);
      }
      const { error } = await db.from('drive_archivos_comunidad').update({
        visible_cliente: visible, visibilidad_por: user.id, visibilidad_en: new Date().toISOString(),
      }).eq('id', doc.id);
      if (error) throw error;
      await evento(db, { documento_id: doc.id, comunidad_id: cid, accion: visible ? 'publicado_cliente' : 'retirado_cliente', perfil_id: user.id });
      return json({ ok: true, visible_cliente: visible });
    }
    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (e) {
    console.error('drive-comunidad:', action, e instanceof Error ? e.message : 'desconocido');
    return json({ ok: false, pendiente: e instanceof DriveNoConectado, error: mensajeSeguro(e) }, estadoHttp(e));
  }
});
