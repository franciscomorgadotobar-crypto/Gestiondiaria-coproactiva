import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarLote } from '../_compartido/correo.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

function escapar(v: unknown) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
}

function emailValido(v: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim());
}

function emailProveedor(p: any) {
  if (emailValido(p.email)) return String(p.email).trim().toLowerCase();
  const contactos = Array.isArray(p.contactos) ? p.contactos : [];
  const alternativo = contactos.find((c: any) => emailValido(c?.email))?.email;
  return alternativo ? String(alternativo).trim().toLowerCase() : null;
}

function primerNombre(v: unknown) {
  return String(v ?? '').trim().split(/\s+/)[0] || '';
}

function saludoProveedor(p: any) {
  const contacto = primerNombre(p.contacto_nombre);
  if (contacto) return `Hola ${contacto},`;
  const empresa = String(p.empresa ?? '').trim();
  if (empresa) return `Hola, equipo de ${empresa},`;
  return 'Estimados,';
}

function firmaTexto(perfil: any, incluirTelefono: boolean) {
  return [
    'Saludos,',
    perfil?.nombre || 'Equipo CoproActiva',
    'CoproActiva Administración SpA',
    incluirTelefono && perfil?.telefono ? perfil.telefono : null,
    'contacto@coproactiva.cl'
  ].filter(Boolean).join('\n');
}

function htmlCorreo(p: any, asunto: string, mensaje: string, perfil: any, incluirTelefono: boolean) {
  const saludo = escapar(saludoProveedor(p));
  const cuerpo = escapar(mensaje).replace(/\n/g, '<br>');
  const telefono = incluirTelefono && perfil?.telefono
    ? `<br><span style="color:#4a5a68;">${escapar(perfil.telefono)}</span>`
    : '';

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f7f4f0;padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#fff;border:1px solid #e3ded7;">
        <tr><td style="padding:28px 30px 0;">
          <img src="cid:logo" alt="CoproActiva" width="150" height="30"
               style="display:block;width:150px;height:30px;border:0;margin:0 0 24px;">
          <p style="margin:0 0 16px;font:600 17px/1.4 Arial,Helvetica,sans-serif;color:#2b3138;">${saludo}</p>
          <div style="font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#2b3138;">${cuerpo}</div>
        </td></tr>
        <tr><td style="padding:26px 30px 30px;">
          <p style="margin:0;padding-top:18px;border-top:1px solid #e9e6e2;font:400 13px/1.55 Arial,Helvetica,sans-serif;color:#2b3138;">
            Saludos,<br>
            <strong>${escapar(perfil?.nombre || 'Equipo CoproActiva')}</strong><br>
            CoproActiva Administración SpA
            ${telefono}<br>
            <a href="mailto:contacto@coproactiva.cl" style="color:#4a5a68;">contacto@coproactiva.cl</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta la sesión' }, 401);

  const usuario = createClient(URL, ANON, {
    global: { headers: { Authorization: autorizacion } }
  });
  const { data: { user }, error: authError } = await usuario.auth.getUser();
  if (authError || !user) return responder({ error: 'Sesión inválida' }, 401);

  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: perfil } = await admin.from('perfiles')
    .select('id,nombre,email,telefono,rol,activo')
    .eq('id', user.id).maybeSingle();

  if (!perfil?.activo || !['superadmin','admin'].includes(perfil.rol)) {
    return responder({ error: 'Solo administradores y superadministradores pueden enviar comunicaciones.' }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { return responder({ error: 'Cuerpo inválido' }, 400); }

  const ids = [...new Set((Array.isArray(body.proveedor_ids) ? body.proveedor_ids : [])
    .map((x: unknown) => String(x || '').trim()).filter(Boolean))];
  const asunto = String(body.asunto ?? '').trim();
  const mensaje = String(body.mensaje ?? '').trim();
  const alcance = ['seleccionados','filtrados','todos'].includes(body.alcance)
    ? body.alcance : 'seleccionados';
  const incluirTelefono = Boolean(body.incluir_telefono);
  const filtros = body.filtros && typeof body.filtros === 'object' ? body.filtros : {};

  if (!ids.length) return responder({ error: 'No hay proveedores seleccionados.' }, 400);
  if (!asunto) return responder({ error: 'El asunto es obligatorio.' }, 400);
  if (!mensaje) return responder({ error: 'El mensaje es obligatorio.' }, 400);
  if (ids.length > 500) return responder({ error: 'El máximo por comunicación es 500 proveedores.' }, 400);

  const { data: proveedores, error: eProveedores } = await admin.from('proveedores')
    .select('id,empresa,contacto_nombre,email,contactos,lista_negra')
    .in('id', ids);

  if (eProveedores) return responder({ error: eProveedores.message }, 500);

  const porId = new Map((proveedores ?? []).map((p: any) => [p.id,p]));
  const destinos = ids.map(id => porId.get(id)).filter(Boolean);

  const { data: comunicacion, error: eComunicacion } = await admin
    .from('proveedor_comunicaciones')
    .insert({
      asunto,
      mensaje,
      alcance,
      filtros,
      incluir_telefono: incluirTelefono,
      destinatarios_total: ids.length,
      creado_por: user.id,
      estado: 'procesando'
    })
    .select('id')
    .single();

  if (eComunicacion || !comunicacion) {
    return responder({ error: eComunicacion?.message || 'No se pudo registrar la comunicación.' }, 500);
  }

  const snapshots: any[] = [];
  const enviables: any[] = [];

  for (const id of ids) {
    const p: any = porId.get(id);
    if (!p) {
      snapshots.push({
        comunicacion_id: comunicacion.id,
        proveedor_id: null,
        empresa: 'Proveedor no encontrado',
        contacto_nombre: null,
        email: null,
        asunto,
        mensaje,
        estado: 'omitido',
        motivo_omision: 'Proveedor no encontrado'
      });
      continue;
    }

    const email = emailProveedor(p);
    let estado = 'pendiente';
    let motivo = null;

    if (p.lista_negra) {
      estado = 'omitido';
      motivo = 'Proveedor en lista negra';
    } else if (!email) {
      estado = 'omitido';
      motivo = 'Sin correo válido';
    }

    const fila = {
      comunicacion_id: comunicacion.id,
      proveedor_id: p.id,
      empresa: p.empresa,
      contacto_nombre: p.contacto_nombre,
      email,
      asunto,
      mensaje,
      estado,
      motivo_omision: motivo
    };
    snapshots.push(fila);
    if (estado === 'pendiente') enviables.push({ proveedor: p, email });
  }

  const { data: filasDest, error: eDest } = await admin
    .from('proveedor_comunicacion_destinatarios')
    .insert(snapshots)
    .select('id,proveedor_id,estado');

  if (eDest) {
    await admin.from('proveedor_comunicaciones').update({
      estado: 'fallida', fallidos: ids.length, finalizado_en: new Date().toISOString()
    }).eq('id', comunicacion.id);
    return responder({ error: eDest.message }, 500);
  }

  const destinoIdPorProveedor = new Map(
    (filasDest ?? []).filter((x: any) => x.proveedor_id).map((x: any) => [x.proveedor_id,x.id])
  );

  const correos = enviables.map(({ proveedor, email }) => ({
    para: email,
    asunto,
    html: htmlCorreo(proveedor, asunto, mensaje, perfil, incluirTelefono),
    texto: [
      saludoProveedor(proveedor),
      '',
      mensaje,
      '',
      firmaTexto(perfil, incluirTelefono)
    ].join('\n')
  }));

  const resultados = correos.length ? await enviarLote(correos) : [];
  const ahora = new Date().toISOString();
  const enviadosIds: string[] = [];
  let enviados = 0;
  let fallidos = 0;

  for (let i=0; i<enviables.length; i++) {
    const p = enviables[i].proveedor;
    const resultado = resultados[i] ?? { enviado:false, motivo:'Sin resultado de envío' };
    const destId = destinoIdPorProveedor.get(p.id);
    if (resultado.enviado) {
      enviados++;
      enviadosIds.push(p.id);
      await admin.from('proveedor_comunicacion_destinatarios')
        .update({ estado:'enviado', enviado_en:ahora, error:null })
        .eq('id', destId);
    } else {
      fallidos++;
      await admin.from('proveedor_comunicacion_destinatarios')
        .update({ estado:'error', error:resultado.motivo || 'Error SMTP' })
        .eq('id', destId);
    }
  }

  if (enviadosIds.length) {
    await admin.from('proveedor_interacciones').insert(enviadosIds.map(proveedorId => ({
      proveedor_id: proveedorId,
      canal: 'correo',
      detalle: `Comunicación masiva · ${asunto}`,
      realizado_por: user.id,
      realizado_en: ahora
    })));
  }

  const omitidos = snapshots.filter(x => x.estado === 'omitido').length;
  const estadoFinal = enviados > 0 && fallidos === 0 ? 'enviada'
    : enviados > 0 ? 'parcial'
    : 'fallida';

  await admin.from('proveedor_comunicaciones').update({
    enviados,
    fallidos,
    omitidos,
    estado: estadoFinal,
    finalizado_en: ahora
  }).eq('id', comunicacion.id);

  return responder({
    ok: true,
    comunicacion_id: comunicacion.id,
    destinatarios: ids.length,
    enviados,
    fallidos,
    omitidos,
    estado: estadoFinal
  });
});
