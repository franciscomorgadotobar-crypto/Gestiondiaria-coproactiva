import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@2.0.6';
import PostalMime from 'npm:postal-mime@3.0.0';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USUARIO = Deno.env.get('SMTP_USUARIO') ?? 'contacto@coproactiva.cl';
const CLAVE = (Deno.env.get('SMTP_CLAVE') ?? '').replace(/\s+/g, '');
const BUCKET = 'proveedores-correo';

const ESPECIALIDADES: Array<[string, RegExp]> = [
  ['Ascensores', /\bascensor(?:es)?\b|\belevador(?:es)?\b/i],
  ['Gasfitería', /gasfiter|gasfiter[ií]a|cañer[ií]a|fuga(?:s)? de agua|sanitario/i],
  ['Electricidad', /electricidad|el[eé]ctric[oa]|luminaria|tablero el[eé]ctrico/i],
  ['Climatización', /climatizaci[oó]n|aire acondicionado|hvac|ventilaci[oó]n/i],
  ['Aseo y limpieza', /\baseo\b|limpieza|sanitizaci[oó]n|higienizaci[oó]n/i],
  ['Seguridad', /cctv|c[aá]mara(?:s)?|control de acceso|seguridad|port[oó]n|citofon/i],
  ['Protección contra incendios', /extintor|red h[uú]meda|incendio|detecci[oó]n de humo/i],
  ['Jardinería', /jardiner[ií]a|paisajismo|[aá]reas verdes|poda/i],
  ['Pintura', /\bpintura\b|pintado|revestimiento/i],
  ['Obras civiles', /obra(?:s)? civil|construcci[oó]n|remodelaci[oó]n|reparaci[oó]n estructural/i],
  ['Impermeabilización', /impermeabili|filtraci[oó]n|humedad/i],
  ['Techumbre', /techumbre|cubierta|techo/i],
  ['Control de plagas', /plaga(?:s)?|fumigaci[oó]n|desratizaci[oó]n|desinsectaci[oó]n/i],
  ['Piscinas', /piscina|tratamiento de agua/i],
  ['Bombas', /bomba(?:s)? de agua|sala de bombas|presurizaci[oó]n/i],
  ['Grupos electrógenos', /grupo(?:s)? electr[oó]geno|generador(?:es)?/i],
  ['Cerrajería', /cerrajer[ií]a|cerradura(?:s)?/i],
  ['Mallas de seguridad', /malla(?:s)? de seguridad|malla(?:s)? de protecci[oó]n/i],
  ['Asesoría legal', /abogad|asesor[ií]a legal|cobranza judicial/i],
  ['Auditoría y contabilidad', /auditor[ií]a|contabilidad|contador/i],
  ['Software', /software|plataforma|sistema de gesti[oó]n|saas/i],
  ['Aromatización', /aromatizaci[oó]n|desodorizaci[oó]n/i],
  ['Mantención general', /mantenci[oó]n general|multiservicio|mantenimiento de edificio/i]
];

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso',
  'Metropolitana','O’Higgins',"O'Higgins",'Maule','Ñuble','Biobío','La Araucanía',
  'Los Ríos','Los Lagos','Aysén','Magallanes'
];

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });
}

function unico<T>(valores: T[]) {
  return [...new Set(valores.filter(Boolean))];
}

function textoPlano(html = '') {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function segmento(s: string) {
  return String(s || 'sin-id')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'archivo';
}

function correoDe(direccion: any): { nombre: string | null; email: string | null } {
  if (!direccion) return { nombre: null, email: null };
  if (Array.isArray(direccion)) {
    const x = direccion.find((a: any) => a?.address) ?? direccion[0];
    return { nombre: x?.name || null, email: x?.address?.toLowerCase?.() || null };
  }
  if (direccion.address) return {
    nombre: direccion.name || null,
    email: direccion.address.toLowerCase?.() || null
  };
  return { nombre: null, email: null };
}

function emailsDe(lista: any) {
  if (!Array.isArray(lista)) return [];
  return unico(lista.flatMap((a: any) => {
    if (a?.address) return [String(a.address).toLowerCase()];
    if (Array.isArray(a?.group)) return a.group.map((g: any) => String(g.address || '').toLowerCase());
    return [];
  }).filter(Boolean));
}

function normalizarTelefono(v: string) {
  let n = v.replace(/[^\d+]/g, '');
  if (n.startsWith('0056')) n = '+' + n.slice(2);
  if (/^9\d{8}$/.test(n)) n = '+56' + n;
  if (/^56\d{9}$/.test(n)) n = '+' + n;
  return n;
}

function sitioDesdeRemitente(email: string | null, urls: string[]) {
  const bloqueados = /google\\.com|googleusercontent|facebook\\.com|instagram\\.com|linkedin\\.com|unsubscribe|wa\\.me|sendibm|hubspot|hs-sales-engage|mailchimp|mailchi|tinyurl|bit\\.ly/i;
  const limpios = urls.filter(x => !bloqueados.test(x));

  const dominio = email?.split('@')[1]?.toLowerCase() || '';
  const gratuito = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me)\\./i.test(dominio);
  if (dominio && !gratuito) {
    const delDominio = limpios.find(x => {
      try {
        const u = new URL(/^https?:/i.test(x) ? x : 'https://' + x);
        const h = u.hostname.replace(/^www\\./i, '').toLowerCase();
        return h === dominio || h.endsWith('.' + dominio) || dominio.endsWith('.' + h);
      } catch { return false; }
    });
    if (delDominio) return delDominio;
    return 'https://' + dominio;
  }
  return limpios[0] ?? null;
}

function extraer(texto: string, remitente: { nombre: string | null; email: string | null }) {
  const limpio = texto.replace(/\r/g, '');
  const lineas = limpio.split('\n').map(x => x.trim()).filter(Boolean);
  const emails = unico((limpio.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
    .map(x => x.toLowerCase())
    .filter(x => !x.endsWith('@coproactiva.cl')));

  const telefonos = unico((limpio.match(/(?:\+?56[\s().-]*)?(?:9[\s().-]*\d{4}[\s().-]*\d{4}|2[\s().-]*\d{4}[\s().-]*\d{4})/g) ?? [])
    .map(normalizarTelefono)
    .filter(x => x.length >= 9));

  const rut = limpio.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/)?.[0] ?? null;

  const urls = unico((limpio.match(/https?:\/\/[^\s<>()\]]+|www\.[^\s<>()\]]+/gi) ?? [])
    .map(x => x.replace(/[),.;]+$/g, ''))
    .filter(x => !/google\.com|googleusercontent|facebook\.com|instagram\.com|linkedin\.com|unsubscribe|wa\.me/i.test(x)));
  const sitio_web = urls[0] ?? null;

  const especialidades = ESPECIALIDADES.filter(([, re]) => re.test(limpio)).map(([n]) => n);

  const regiones = unico(REGIONES.filter(r => {
    const re = new RegExp(r.replace(/[.*+?^$()|[\]\\]/g, '\\$&'), 'i');
    return re.test(limpio);
  }).map(r => r === "O'Higgins" ? 'O’Higgins' : r));

  const direccion = lineas.find(l =>
    /\b(av(?:enida)?\.?|calle|camino|pasaje|ruta|oficina|local)\b/i.test(l)
    && /\d/.test(l)
    && l.length <= 180
  ) ?? null;

  const certificaciones = unico(lineas.filter(l =>
    /certificad|\biso\s*\d|registro\s+(?:sec|minvu|seremi)|acreditad/i.test(l)
    && l.length <= 200
  )).slice(0, 8);

  const condiciones = unico(lineas.filter(l =>
    /descuento|garant[ií]a|sin costo|visita t[eé]cnica|forma de pago|facilidades de pago|precio|cotizaci[oó]n|presupuesto/i.test(l)
    && l.length <= 220
  )).slice(0, 8);

  const palabras = unico([
    ...especialidades,
    ...(['condominio','edificio','comunidad','emergencia','preventiva','correctiva']
      .filter(k => limpio.toLowerCase().includes(k)))
  ]);

  const contactos: any[] = [];
  if (remitente.email) contactos.push({
    nombre: remitente.nombre,
    cargo: null,
    email: remitente.email,
    telefono: telefonos[0] ?? null,
    origen: 'correo'
  });
  for (const email of emails.slice(0, 8)) {
    if (email === remitente.email) continue;
    contactos.push({ nombre: null, cargo: null, email, telefono: null, origen: 'correo' });
  }

  return {
    rut,
    telefonos,
    emails,
    sitio_web,
    direccion,
    regiones,
    especialidades,
    palabras_clave: palabras,
    certificaciones,
    marcas: [],
    condiciones_comerciales: condiciones.join('\n') || null,
    contactos
  };
}

function unirContactos(actuales: any[], nuevos: any[]) {
  const mapa = new Map<string, any>();
  for (const c of [...(actuales ?? []), ...(nuevos ?? [])]) {
    if (!c) continue;
    const clave = String(c.email || c.telefono || c.nombre || '').toLowerCase().trim();
    if (!clave) continue;
    mapa.set(clave, { ...(mapa.get(clave) ?? {}), ...c });
  }
  return [...mapa.values()].slice(0, 30);
}

function fechaMasNueva(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

function threadDecimal(threadHex: string) {
  const limpio = threadHex.trim().replace(/^0x/i, '');
  return BigInt('0x' + limpio).toString(10);
}

async function autorizadoManual(req: Request, admin: any) {
  const auth = req.headers.get('Authorization');
  if (!auth) return false;
  const usuario = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await admin.from('perfiles').select('rol,activo').eq('id', user.id).maybeSingle();
  return Boolean(perfil?.activo && ['superadmin','admin'].includes(perfil.rol));
}

async function abrirImap() {
  if (!CLAVE) throw new Error('SMTP_CLAVE no configurada');
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: USUARIO, pass: CLAVE },
    logger: false
  });
  await client.connect();
  const buzones = await client.list();
  const allMail = buzones.find((m: any) =>
    m.specialUse === '\\All' || m.specialUse?.has?.('\\All')
  ) ?? buzones.find((m: any) => /\[Gmail\]\/(All Mail|Todos|Todos los mensajes)/i.test(m.path));
  if (!allMail?.path) throw new Error('No se encontró la carpeta Todos de Gmail');
  const lock = await client.getMailboxLock(allMail.path);
  return { client, lock, mailbox: allMail.path };
}

async function guardarArchivo(admin: any, path: string, bytes: Uint8Array, mime: string) {
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime || 'application/octet-stream',
    upsert: true
  });
  if (error) throw error;
}

async function procesarMensaje(admin: any, proveedor: any, msg: any, uidValidity: string) {
  if (!msg?.source) return { nuevo: 0, actualizado: 0, adjuntos: 0 };

  const raw = msg.source instanceof Uint8Array ? msg.source : new Uint8Array(msg.source);
  const parsed: any = await PostalMime.parse(raw, {
    attachmentEncoding: 'arraybuffer',
    maxNestingDepth: 80,
    maxHeadersSize: 1048576
  });

  const remitente = correoDe(parsed.from);
  const texto = (parsed.text || textoPlano(parsed.html || '') || '').trim();
  const datos = extraer(texto, remitente);
  const rfcId = parsed.messageId || null;
  const gmailId = String(msg.emailId || rfcId || ('imap:' + uidValidity + ':' + msg.uid));

  const { data: ya } = await admin.from('proveedor_correos')
    .select('id').eq('gmail_message_id', gmailId).maybeSingle();

  const base = proveedor.id + '/' + segmento(gmailId);
  let storagePathEml: string | null = null;
  const guardados: any[] = [];
  let adjuntosGuardados = 0;

  if (!ya) {
    storagePathEml = base + '/correo.eml';
    try {
      await guardarArchivo(admin, storagePathEml, raw, 'message/rfc822');
    } catch (e) {
      console.error('No se pudo guardar EML', gmailId, e);
      storagePathEml = null;
    }

    let indice = 0;
    for (const a of parsed.attachments ?? []) {
      if (a.related || a.disposition === 'inline') continue;
      indice++;
      const contenido = a.content instanceof Uint8Array
        ? a.content
        : new Uint8Array(a.content as ArrayBuffer);
      const nombre = a.filename || ('adjunto-' + indice);
      const meta: any = {
        filename: nombre,
        mime_type: a.mimeType || 'application/octet-stream',
        bytes: contenido.byteLength,
        storage_path: null
      };
      if (contenido.byteLength <= 35 * 1024 * 1024) {
        const path = base + '/adjuntos/' + String(indice).padStart(2,'0') + '-' + segmento(nombre);
        try {
          await guardarArchivo(admin, path, contenido, meta.mime_type);
          meta.storage_path = path;
          adjuntosGuardados++;
        } catch (e) {
          meta.error = e instanceof Error ? e.message : String(e);
        }
      } else {
        meta.error = 'Adjunto mayor al límite de 35 MB';
      }
      guardados.push(meta);
    }
  }

  const fechaCorreo = parsed.date
    ? new Date(parsed.date).toISOString()
    : msg.internalDate
      ? new Date(msg.internalDate).toISOString()
      : new Date().toISOString();

  const cuerpo = texto.slice(0, 200000);
  const html = parsed.html ? String(parsed.html).slice(0, 500000) : null;
  const snippet = cuerpo.replace(/\s+/g, ' ').slice(0, 300);

  if (!ya) {
    const fila = {
      proveedor_id: proveedor.id,
      gmail_message_id: gmailId,
      gmail_thread_id: proveedor.gmail_thread_id || (msg.threadId ? String(msg.threadId) : null),
      remitente_nombre: remitente.nombre,
      remitente_email: remitente.email,
      asunto: parsed.subject || msg.envelope?.subject || null,
      fecha_correo: fechaCorreo,
      snippet,
      cuerpo_texto: cuerpo || null,
      cuerpo_html: html,
      destinatarios: emailsDe(parsed.to),
      cc: emailsDe(parsed.cc),
      rfc_message_id: rfcId,
      storage_path_eml: storagePathEml,
      adjuntos: guardados,
      datos_extraidos: datos,
      procesado_en: new Date().toISOString()
    };
    const { error } = await admin.from('proveedor_correos').insert(fila);
    if (error) throw error;
  }

  const especialidades = unico([...(proveedor.especialidades ?? []), ...datos.especialidades]);
  const palabras = unico([...(proveedor.palabras_clave ?? []), ...datos.palabras_clave]);
  const regiones = unico([...(proveedor.regiones ?? []), ...datos.regiones]);
  const certificaciones = unico([...(proveedor.certificaciones ?? []), ...datos.certificaciones]);
  const marcas = unico([...(proveedor.marcas ?? []), ...datos.marcas]);
  const contactos = unirContactos(proveedor.contactos ?? [], datos.contactos);

  let condiciones = proveedor.condiciones_comerciales || '';
  if (datos.condiciones_comerciales && !condiciones.includes(datos.condiciones_comerciales)) {
    condiciones = [condiciones, datos.condiciones_comerciales].filter(Boolean).join('\n').slice(0, 5000);
  }

  const cambios: any = {
    rut: proveedor.rut || datos.rut,
    telefono: proveedor.telefono || datos.telefonos[0] || null,
    sitio_web: proveedor.sitio_web || datos.sitio_web,
    direccion: proveedor.direccion || datos.direccion,
    contacto_nombre: proveedor.contacto_nombre || remitente.nombre,
    contacto_cargo: proveedor.contacto_cargo || null,
    especialidades,
    palabras_clave: palabras,
    regiones,
    contactos,
    certificaciones,
    marcas,
    condiciones_comerciales: condiciones || null,
    gmail_ultimo_mensaje_id: gmailId,
    gmail_asunto_ultimo: parsed.subject || msg.envelope?.subject || null,
    gmail_ultima_sincronizacion: new Date().toISOString(),
    gmail_sync_error: null,
    fecha_contacto: fechaMasNueva(proveedor.fecha_contacto, fechaCorreo),
    origen: 'correo'
  };
  if (!proveedor.servicios && especialidades.length) cambios.servicios = especialidades.join(', ');

  const { error: errorProveedor } = await admin.from('proveedores').update(cambios).eq('id', proveedor.id);
  if (errorProveedor) throw errorProveedor;
  Object.assign(proveedor, cambios);

  return { nuevo: ya ? 0 : 1, actualizado: 1, adjuntos: adjuntosGuardados };
}

async function sincronizarProveedor(admin: any, client: any, proveedor: any, uidValidity: string) {
  let uids: any = [];
  try {
    const decimal = threadDecimal(proveedor.gmail_thread_id);
    uids = await client.search({ threadId: decimal }, { uid: true }) || [];
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await admin.from('proveedores').update({
      gmail_ultima_sincronizacion: new Date().toISOString(),
      gmail_sync_error: error
    }).eq('id', proveedor.id);
    return { correos: 0, adjuntos: 0, error };
  }

  if (!Array.isArray(uids) || !uids.length) {
    await admin.from('proveedores').update({
      gmail_ultima_sincronizacion: new Date().toISOString(),
      gmail_sync_error: 'No se encontró el hilo en Gmail'
    }).eq('id', proveedor.id);
    return { correos: 0, adjuntos: 0, error: 'No se encontró el hilo en Gmail' };
  }

  const mensajes = await client.fetchAll(uids, {
    source: true,
    envelope: true,
    internalDate: true,
    threadId: true
  }, { uid: true });

  let correos = 0;
  let adjuntos = 0;
  for (const msg of mensajes) {
    const r = await procesarMensaje(admin, proveedor, msg, uidValidity);
    correos += r.nuevo;
    adjuntos += r.adjuntos;
  }

  await admin.from('proveedores').update({
    gmail_ultima_sincronizacion: new Date().toISOString(),
    gmail_sync_error: null
  }).eq('id', proveedor.id);

  return { correos, adjuntos, error: null };
}

async function sincronizarRecientes(admin: any, client: any, proveedores: any[], uidValidity: string) {
  const mapa = new Map<string, any>();
  for (const p of proveedores) {
    if (p.email) mapa.set(String(p.email).toLowerCase(), p);
    for (const c of p.contactos ?? []) if (c?.email) mapa.set(String(c.email).toLowerCase(), p);
  }
  if (!mapa.size) return { correos: 0, adjuntos: 0, proveedores: 0 };

  const uids: any = await client.search({
    gmraw: 'newer_than:7d -from:' + USUARIO
  }, { uid: true }) || [];
  if (!Array.isArray(uids) || !uids.length) return { correos: 0, adjuntos: 0, proveedores: 0 };

  const metadatos = await client.fetchAll(uids.slice(-250), {
    envelope: true,
    internalDate: true,
    threadId: true
  }, { uid: true });

  const porProveedor = new Map<string, { proveedor: any; uids: number[] }>();
  for (const m of metadatos) {
    const desde = correoDe(m.envelope?.from).email;
    const p = desde ? mapa.get(desde) : null;
    if (!p) continue;
    const actual = porProveedor.get(p.id) ?? { proveedor: p, uids: [] };
    actual.uids.push(m.uid);
    porProveedor.set(p.id, actual);
  }

  let correos = 0;
  let adjuntos = 0;
  let actualizados = 0;
  for (const item of porProveedor.values()) {
    const mensajes = await client.fetchAll(item.uids, {
      source: true,
      envelope: true,
      internalDate: true,
      threadId: true
    }, { uid: true });
    let tocado = false;
    for (const msg of mensajes) {
      const r = await procesarMensaje(admin, item.proveedor, msg, uidValidity);
      correos += r.nuevo;
      adjuntos += r.adjuntos;
      tocado = tocado || r.nuevo > 0;
    }
    if (tocado) actualizados++;
  }

  return { correos, adjuntos, proveedores: actualizados };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch {}

  const origen = String(cuerpo.origen || 'manual');
  const manual = await autorizadoManual(req, admin);

  const { data: estado } = await admin.from('proveedor_sync_estado')
    .select('*').eq('clave', 'gmail_proveedores').maybeSingle();

  let cronAutorizado = false;
  if (origen === 'cron') {
    const token = req.headers.get('X-Coproactiva-Sync') || '';
    if (token && estado?.token_hash) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
      cronAutorizado = hash === estado.token_hash;
    }
  }
  if (!manual && !cronAutorizado) return responder({ error: 'Sin permiso' }, 403);

  const ahora = Date.now();
  if (estado?.en_ejecucion_desde && ahora - new Date(estado.en_ejecucion_desde).getTime() < 15 * 60 * 1000) {
    return responder({ ok: true, omitida: true, motivo: 'Ya hay una sincronización en curso' }, 202);
  }

  const { count: pendientesGlobal } = await admin.from('proveedores')
    .select('id', { count: 'exact', head: true })
    .not('gmail_thread_id', 'is', null)
    .is('gmail_ultima_sincronizacion', null);

  if (!manual && (pendientesGlobal ?? 0) === 0
      && estado?.ultimo_exito
      && ahora - new Date(estado.ultimo_exito).getTime() < 20 * 60 * 60 * 1000) {
    return responder({ ok: true, omitida: true, motivo: 'La sincronización diaria ya se ejecutó' });
  }

  const inicio = new Date().toISOString();
  await admin.from('proveedor_sync_estado').update({
    ultima_revision: inicio,
    en_ejecucion_desde: inicio,
    ultimo_error: null,
    editado_en: inicio
  }).eq('clave', 'gmail_proveedores');

  let imap: any = null;
  try {
    imap = await abrirImap();
    const uidValidity = String((imap.client.mailbox as any)?.uidValidity ?? '0');

    const limite = Math.max(1, Math.min(12, Number(cuerpo.limite_backfill ?? (manual ? 8 : 6))));
    const { data: pendientes, error: ePendientes } = await admin.from('proveedores')
      .select('*')
      .not('gmail_thread_id', 'is', null)
      .is('gmail_ultima_sincronizacion', null)
      .order('fecha_contacto', { ascending: false, nullsFirst: false })
      .limit(limite);
    if (ePendientes) throw ePendientes;

    let correos = 0;
    let adjuntos = 0;
    let actualizados = 0;
    const errores: any[] = [];

    for (const p of pendientes ?? []) {
      const r = await sincronizarProveedor(admin, imap.client, p, uidValidity);
      correos += r.correos;
      adjuntos += r.adjuntos;
      if (!r.error) actualizados++;
      else errores.push({ proveedor: p.empresa, error: r.error });
    }

    const recientes = cuerpo.solo_backfill
      ? { correos: 0, adjuntos: 0, proveedores: 0 }
      : await (async () => {
          const { data: todos } = await admin.from('proveedores').select('*').eq('origen', 'correo');
          return sincronizarRecientes(admin, imap.client, todos ?? [], uidValidity);
        })();
    correos += recientes.correos;
    adjuntos += recientes.adjuntos;
    actualizados += recientes.proveedores;

    imap.lock.release();
    await imap.client.logout();
    imap = null;

    const { count: faltan } = await admin.from('proveedores')
      .select('id', { count: 'exact', head: true })
      .not('gmail_thread_id', 'is', null)
      .is('gmail_ultima_sincronizacion', null);

    const fin = new Date().toISOString();
    await admin.from('proveedor_sync_estado').update({
      ultimo_exito: fin,
      ultimo_error: errores.length ? JSON.stringify(errores.slice(0, 10)) : null,
      en_ejecucion_desde: null,
      correos_procesados: (estado?.correos_procesados ?? 0) + correos,
      proveedores_actualizados: (estado?.proveedores_actualizados ?? 0) + actualizados,
      editado_en: fin
    }).eq('clave', 'gmail_proveedores');

    return responder({
      ok: true,
      buzon: USUARIO,
      backfill_revisados: (pendientes ?? []).length,
      faltan_backfill: faltan ?? 0,
      correos_nuevos: correos,
      adjuntos_guardados: adjuntos,
      proveedores_actualizados: actualizados,
      errores
    });
  } catch (e) {
    try {
      imap?.lock?.release?.();
      await imap?.client?.logout?.();
    } catch {}
    const error = e instanceof Error ? e.message : String(e);
    await admin.from('proveedor_sync_estado').update({
      ultimo_error: error,
      en_ejecucion_desde: null,
      editado_en: new Date().toISOString()
    }).eq('clave', 'gmail_proveedores');
    console.error('Sincronización Gmail proveedores', e);
    return responder({ ok: false, error }, 500);
  }
});
