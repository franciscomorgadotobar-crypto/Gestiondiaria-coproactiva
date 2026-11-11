import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@2.0.6';
import PostalMime from 'npm:postal-mime@3.0.0';

/* Importación única del histórico de Gmail a la ficha de cada prospecto.
 *
 * Busca en contacto@coproactiva.cl todo lo enviado y recibido con el correo de
 * cada prospecto existente y lo agrega a prospecto_correos con origen 'gmail'.
 * No es una sincronización: se ejecutó una vez (noviembre de 2026) para los
 * prospectos de ese momento.
 *
 * Queda inactiva: solo responde a un token de un solo uso que valida
 * public.validar_importacion_historial_correos, y esa función se eliminó al
 * terminar la importación. Sin ella, toda llamada recibe 403.
 *
 * Solo guarda texto y nombres de adjuntos; nunca el MIME ni los archivos.
 */

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USUARIO = (Deno.env.get('SMTP_USUARIO') ?? 'contacto@coproactiva.cl').toLowerCase();
const CLAVE = (Deno.env.get('SMTP_CLAVE') ?? '').replace(/\s+/g, '');

const MAX_POR_PROSPECTO = 300;
const TANDA = 25;               // correos por llamada: el límite de CPU es estricto
const MAX_FUENTE = 150_000;     // bytes: el texto va antes que los adjuntos
const MAX_TEXTO = 20_000;       // caracteres guardados por correo
const VENTANA_DUPLICADO_MS = 15 * 60 * 1000;

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const normalizarAsunto = (s = '') =>
  s.toLowerCase().replace(/^\s*((re|rv|fw|fwd)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim();

function direcciones(lista: any[] | undefined) {
  return (lista ?? []).map((d: any) => String(d?.address || '').toLowerCase()).filter(Boolean);
}

function formato(d: any) {
  if (!d?.address) return '';
  return d.name ? `${d.name} <${d.address}>` : d.address;
}

/* Nombres de adjuntos desde la estructura del mensaje: no hace falta
 * descargarlos para saber cómo se llaman. */
function adjuntosDe(nodo: any, lista: any[] = []) {
  if (!nodo) return lista;
  const nombre = nodo.dispositionParameters?.filename || nodo.parameters?.name;
  if (nombre && nodo.disposition !== 'inline') {
    lista.push({ nombre, tipo: nodo.type || 'application/octet-stream', tamano: nodo.size || null, disponible_en: 'gmail' });
  }
  for (const hijo of nodo.childNodes ?? []) adjuntosDe(hijo, lista);
  return lista;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = req.headers.get('x-importacion-token') ?? '';
  const { data: valido, error: errorValidacion } = await admin.rpc('validar_importacion_historial_correos', { p_token: token });
  if (errorValidacion || valido !== true) return json({ error: 'Sin permiso' }, 403);
  if (!CLAVE) return json({ error: 'Falta SMTP_CLAVE' }, 500);

  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch { /* sin cuerpo: importación real */ }
  const simulacion = cuerpo?.simulacion === true;
  // Una llamada procesa un prospecto (por su posición) y una tanda de sus
  // correos; la respuesta dice cuál es la siguiente.
  const indice = Math.max(0, Number(cuerpo?.indice) || 0);
  const desde = Math.max(0, Number(cuerpo?.desde) || 0);

  const { data: prospectos, error: errorProspectos } = await admin.from('prospectos').select('id,email').order('creado_en');
  if (errorProspectos) return json({ error: errorProspectos.message }, 500);
  const { data: delCrm, error: errorCrm } = await admin.from('prospecto_correos')
    .select('prospecto_id,asunto,enviado_en,creado_en').eq('origen', 'crm');
  if (errorCrm) return json({ error: errorCrm.message }, 500);

  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: USUARIO, pass: CLAVE }, logger: false });
  await client.connect();
  const buzones = await client.list();
  const todos = buzones.find((m: any) => m.specialUse === '\\All' || m.specialUse?.has?.('\\All'))
    ?? buzones.find((m: any) => /\[Gmail\]\/(All Mail|Todos|Todos los mensajes)/i.test(m.path));
  if (!todos?.path) { await client.logout(); return json({ error: 'No se encontró la carpeta Todos de Gmail' }, 500); }
  const lock = await client.getMailboxLock(todos.path);
  const uidValidity = String((client.mailbox as any)?.uidValidity ?? '0');

  const resumen: any[] = [];
  let siguiente: { indice: number; desde: number } | null = null;
  try {
    for (const p of (prospectos ?? []).slice(indice, indice + 1)) {
      const email = String(p.email || '').trim().toLowerCase();
      const ref = p.id.slice(0, 8);
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) || email === USUARIO) {
        resumen.push({ ref, omitido: 'sin correo válido' });
        if (indice + 1 < (prospectos ?? []).length) siguiente = { indice: indice + 1, desde: 0 };
        continue;
      }
      const encontrados: number[] = await client.search({ gmraw: `from:${email} OR to:${email} OR cc:${email}` }, { uid: true }) || [];
      const todosUids = encontrados.sort((a, b) => b - a).slice(0, MAX_POR_PROSPECTO);
      const uids = todosUids.slice(desde, desde + TANDA);
      siguiente = desde + TANDA < todosUids.length
        ? { indice, desde: desde + TANDA }
        : indice + 1 < (prospectos ?? []).length ? { indice: indice + 1, desde: 0 } : null;
      const crmDelProspecto = (delCrm ?? []).filter((c: any) => c.prospecto_id === p.id);
      const filas: any[] = [];
      let duplicadosCrm = 0;

      if (uids.length) {
        for await (const msg of client.fetch(uids, {
          envelope: true, internalDate: true, bodyStructure: true, emailId: true,
          source: { maxLength: MAX_FUENTE }
        }, { uid: true })) {
          const crudo = msg.source instanceof Uint8Array ? msg.source : new Uint8Array(msg.source ?? []);
          const parsed: any = await PostalMime.parse(crudo).catch(() => ({}));
          const de = parsed.from ?? msg.envelope?.from?.[0];
          const remitente = String(de?.address || '').toLowerCase();
          const enviado = remitente === USUARIO || remitente.endsWith('@coproactiva.cl');
          const fecha = parsed.date ? new Date(parsed.date) : new Date(msg.internalDate ?? Date.now());
          const asunto = String(parsed.subject || msg.envelope?.subject || '').trim() || '(Sin asunto)';

          // Lo enviado desde el CRM ya está en el historial con su seguimiento.
          if (enviado && crmDelProspecto.some((c: any) =>
            normalizarAsunto(c.asunto) === normalizarAsunto(asunto) &&
            Math.abs(new Date(c.enviado_en || c.creado_en).getTime() - fecha.getTime()) <= VENTANA_DUPLICADO_MS)) {
            duplicadosCrm++;
            continue;
          }

          const para = [...direcciones(parsed.to ?? msg.envelope?.to), ...direcciones(parsed.cc ?? msg.envelope?.cc)];
          const texto = (parsed.text || textoPlano(parsed.html || '') || '').trim().slice(0, MAX_TEXTO);
          filas.push({
            prospecto_id: p.id,
            origen: 'gmail',
            estado: enviado ? 'enviado' : 'recibido',
            enviado_por: null,
            remitente: formato(de) || remitente || null,
            destinatario: para.join(', ') || '—',
            asunto,
            mensaje: texto,
            adjuntos: adjuntosDe(msg.bodyStructure),
            creado_en: fecha.toISOString(),
            enviado_en: fecha.toISOString(),
            seguimiento_activo: false,
            gmail_message_id: String(parsed.messageId || msg.emailId || `imap:${uidValidity}:${msg.uid}`)
          });
        }
      }

      let insertados = 0;
      if (!simulacion && filas.length) {
        const { data, error } = await admin.from('prospecto_correos')
          .upsert(filas, { onConflict: 'prospecto_id,gmail_message_id', ignoreDuplicates: true })
          .select('id');
        if (error) throw new Error(`${ref}: ${error.message}`);
        insertados = data?.length ?? 0;
      }
      resumen.push({
        ref, desde, encontrados: encontrados.length, recibidos: filas.filter(f => f.estado === 'recibido').length,
        enviados: filas.filter(f => f.estado === 'enviado').length, duplicados_crm: duplicadosCrm, insertados
      });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e), resumen }, 500);
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return json({ ok: true, simulacion, resumen, siguiente });
});
