import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarSimple } from '../_compartido/correo.ts';

const URL_PROYECTO = Deno.env.get('SUPABASE_URL')!;
const CLAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_APP = Deno.env.get('URL_APP') ?? 'https://app.coproactiva.cl/';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function escapar(valor: unknown) {
  return String(valor ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function nivelTexto(nivel: string) {
  if (nivel === 'urgente') return 'Requiere atención urgente';
  if (nivel === 'atencion') return 'Requiere atención';
  return 'Registro';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta la sesión' }, 401);

  const usuario = createClient(URL_PROYECTO, CLAVE_ANON, {
    global: { headers: { Authorization: autorizacion } }
  });
  const { data: { user }, error: errorSesion } = await usuario.auth.getUser();
  if (errorSesion || !user) return responder({ error: 'Sesión inválida' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  const bitacoraId = String(body.bitacora_id ?? '');
  if (!bitacoraId) return responder({ error: 'Falta el registro de Bitácora' }, 400);

  const admin = createClient(URL_PROYECTO, CLAVE_SERVICIO, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: registro, error } = await admin
    .from('bitacora_registros')
    .select('id, comunidad_id, tipo_codigo, tipo_otro, nivel, titulo, descripcion, registrado_por, registrado_en, correo_enviado_en')
    .eq('id', bitacoraId)
    .maybeSingle();

  if (error || !registro) return responder({ error: 'Registro no encontrado' }, 404);
  if (registro.registrado_por !== user.id) {
    return responder({ error: 'Solo quien creó el registro puede iniciar esta notificación' }, 403);
  }

  if (!['atencion', 'urgente'].includes(registro.nivel)) {
    return responder({ ok: true, omitido: true });
  }
  if (registro.correo_enviado_en) {
    return responder({ ok: true, ya_enviado: true });
  }

  const [{ data: comunidad }, { data: tipo }, { data: autor }] = await Promise.all([
    admin.from('comunidades').select('nombre').eq('id', registro.comunidad_id).maybeSingle(),
    admin.from('bitacora_tipos').select('nombre').eq('codigo', registro.tipo_codigo).maybeSingle(),
    admin.from('perfiles').select('nombre').eq('id', registro.registrado_por).maybeSingle()
  ]);

  const nombreComunidad = comunidad?.nombre ?? 'Comunidad';
  const nombreTipo = registro.tipo_codigo === 'otro'
    ? (registro.tipo_otro || 'Otro')
    : (tipo?.nombre ?? registro.tipo_codigo);
  const urgente = registro.nivel === 'urgente';
  const limpiarAsunto = (s: string) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const asunto = limpiarAsunto(`${urgente ? '[URGENTE] ' : ''}Bitacora · ${nombreComunidad} · ${registro.titulo}`);
  const enlace = `${URL_APP.replace(/\/$/, '')}/bitacora/${registro.id}`;

  const texto = [
    urgente ? 'REQUIERE ATENCIÓN URGENTE' : 'REQUIERE ATENCIÓN',
    '',
    registro.titulo,
    nombreComunidad,
    `Tipo: ${nombreTipo}`,
    `Registrado por: ${autor?.nombre ?? 'Usuario CoproActiva'}`,
    `Fecha: ${new Date(registro.registrado_en).toLocaleString('es-CL')}`,
    '',
    registro.descripcion,
    '',
    `Ver registro: ${enlace}`
  ].join('\n');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f7f4f0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b3138">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e3ded7">
      <tr><td style="padding:24px 26px">
        <div style="display:inline-block;padding:7px 10px;background:${urgente ? '#b42318' : '#c96f16'};color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">
          ${escapar(nivelTexto(registro.nivel))}
        </div>
        <h1 style="font-size:22px;line-height:1.25;margin:18px 0 6px">${escapar(registro.titulo)}</h1>
        <p style="margin:0 0 20px;color:#66717c;font-size:14px">${escapar(nombreComunidad)}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#7a838c">Tipo</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${escapar(nombreTipo)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#7a838c">Registrado por</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${escapar(autor?.nombre ?? 'Usuario CoproActiva')}</td></tr>
        </table>
        <p style="margin:20px 0;font-size:14px;line-height:1.6">${escapar(registro.descripcion)}</p>
        <a href="${escapar(enlace)}" style="display:inline-block;background:#2b3138;color:#fff;text-decoration:none;padding:13px 18px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Ver registro en CoproActiva</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const correo = await enviarSimple('contacto@coproactiva.cl', asunto, html);
  if (!correo.enviado) {
    return responder({ error: correo.motivo ?? 'No se pudo enviar el correo' }, 502);
  }

  await admin.from('bitacora_registros')
    .update({ correo_enviado_en: new Date().toISOString() })
    .eq('id', registro.id);

  return responder({ ok: true, correo });
});
