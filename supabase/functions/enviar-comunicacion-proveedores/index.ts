import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarLote } from '../_compartido/correo.ts';
import { firmaEstandar, prepararSeguimiento, AVISO_SEGUIMIENTO } from '../_compartido/motor-correo.ts';
import { validarCopiasCorreo } from '../_compartido/copias-correo.ts';
import { driveFetch } from '../_compartido/google-drive.ts';
import { guardarAdjuntosEnCarpeta } from '../_compartido/drive-correo.ts';

const MAX_ARCHIVOS = 3;
const MAX_TOTAL = 8 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const MIME_PERMITIDOS = new Set([
  'application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

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

function firmaTexto(perfil: any, firma: any, incluirTelefono: boolean, seguimiento: boolean) {
  const datos=firmaEstandar(firma,perfil,{incluirTelefono});
  return ['Saludos cordiales,',datos.texto,
    seguimiento?AVISO_SEGUIMIENTO:''].filter(Boolean).join('\n\n');
}

function htmlCorreo(p: any, mensaje: string, perfil: any, firma: any,
  incluirTelefono: boolean, seguimientoHtml: string) {
  const saludo=escapar(saludoProveedor(p));
  const cuerpo=escapar(mensaje).replace(/\n/g,'<br>');
  const datos=firmaEstandar(firma,perfil,{incluirTelefono});
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;background:#f7f4f0;padding:24px 12px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e3ded7;">',
    '<tr><td style="padding:28px 30px 0;">',
    '<img src="cid:logo" alt="Coproactiva" width="150" height="30" style="display:block;width:150px;height:30px;border:0;margin:0 0 24px;">',
    '<p style="margin:0 0 16px;font:600 17px/1.4 Arial,sans-serif;color:#2b3138;">',saludo,'</p>',
    '<div style="font:400 14px/1.65 Arial,sans-serif;color:#2b3138;">',cuerpo,'</div>',
    '</td></tr><tr><td style="padding:26px 30px 30px;">',
    '<p style="font:13px/1.5 Arial,sans-serif;color:#2b3138;margin:0;">Saludos cordiales,</p>',
    datos.html,seguimientoHtml,
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
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
  const {data:firmaGuardada,error:errorFirma}=await admin.from('firmas_correo')
    .select('*').eq('usuario_id',user.id).maybeSingle();
  if(errorFirma)return responder({error:'No se pudo cargar la firma del remitente'},503);
  const seguimientoActivo=firmaGuardada?.seguimiento_aperturas!==false;

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
  if (/\{\{[\w]+\}\}|\[[^\]\n]+\]/.test(asunto+'\n'+mensaje))
    return responder({error:'Completa las variables y elimina las instrucciones de la plantilla antes de enviar'},422);
  if (ids.length > 500) return responder({ error: 'El máximo por comunicación es 500 proveedores.' }, 400);
  let copias:{cc:string[];cco:string[]};
  try{copias=validarCopiasCorreo(body,'contacto@coproactiva.cl')}
  catch(e){return responder({error:e instanceof Error?e.message:'Copias inválidas'},422)}

  // Igual que CRM: referencias opacas de la biblioteca compartida o de una comunidad.
  // Los bytes y el identificador de Drive nunca vienen del navegador.
  const referencias = Array.isArray(body.adjuntos) ? body.adjuntos : [];
  if (referencias.length > MAX_ARCHIVOS ||
      !referencias.every((ref:unknown) => typeof ref === 'string' && /^(b|c):[a-f0-9-]{36}$/i.test(ref)) ||
      new Set(referencias).size !== referencias.length)
    return responder({error:'Selecciona hasta tres archivos distintos desde la biblioteca'},422);
  if (body.guardar_drive != null && !Array.isArray(body.guardar_drive))
    return responder({error:'El guardado permanente se configura por archivo'},422);
  const guardarDrive = (body.guardar_drive || []) as unknown[];
  const referenciasGuardadas = new Set<string>();
  if (guardarDrive.length > MAX_ARCHIVOS || guardarDrive.some(item=>{
    if(!item || typeof item !== 'object' || Array.isArray(item))return true;
    const d = item as Record<string,unknown>;
    if(typeof d.ref !== 'string' || !referencias.includes(d.ref) ||
       referenciasGuardadas.has(d.ref) ||
       typeof d.carpeta_id !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(d.carpeta_id) ||
       typeof d.operacion_id !== 'string' || !UUID.test(d.operacion_id))return true;
    referenciasGuardadas.add(d.ref);
    return false;
  }))return responder({error:'Revisa la carpeta de Drive por documento'},422);
  // Evita envíos excesivamente grandes al mismo tiempo y límites del runtime.
  if(referencias.length && ids.length > 50)
    return responder({error:'Con archivos adjuntos selecciona como máximo 50 proveedores por envío'},422);

  const { data: proveedores, error: eProveedores } = await admin.from('proveedores')
    .select('id,empresa,contacto_nombre,email,contactos,lista_negra')
    .in('id', ids);

  if (eProveedores) return responder({ error: eProveedores.message }, 500);

  const porId = new Map((proveedores ?? []).map((p: any) => [p.id,p]));
  const destinos = ids.map(id => porId.get(id)).filter(Boolean);

  const adjuntosSMTP: {filename:string;contentType:string;encoding:'binary';content:Uint8Array}[] = [];
  const adjuntosAuditoria: {id:string;origen:string;nombre:string;bytes:number;guardado_drive?:{carpeta_id:string;carpeta_nombre:string}}[] = [];
  const archivosParaDrive: {ref:string;drive_file_id:string;nombre:string}[] = [];
  let totalBytes = 0;
  for (const referencia of referencias as string[]) {
    const origen = referencia.slice(0,1), id = referencia.slice(2);
    if(!UUID.test(id))return responder({error:'Referencia de documento inválida'},422);
    const tabla = origen === 'b' ? 'correo_archivos_drive' : 'drive_archivos_comunidad';
    const {data:archivo,error:eArchivo}=await admin.from(tabla).select('*')
      .eq('id',id).is('eliminado_en',null).maybeSingle();
    if(eArchivo || !archivo)return responder({error:'Un archivo ya no está disponible'},422);
    if(origen === 'c' && perfil.rol !== 'superadmin'){
      const {data:permiso}=await admin.from('perfil_comunidades')
        .select('comunidad_id').eq('perfil_id',user.id)
        .eq('comunidad_id',archivo.comunidad_id).maybeSingle();
      if(!permiso)return responder({error:'No tienes acceso a ese documento de comunidad'},403);
    }
    const nombre = String(archivo.nombre||'').trim().slice(0,180);
    const mime = String(archivo.mime||'').trim().slice(0,150);
    const tamano = Number(archivo.tamano);
    if(!nombre || !MIME_PERMITIDOS.has(mime) ||
       !Number.isSafeInteger(tamano) || tamano<=0 || tamano>MAX_TOTAL)
      return responder({error:'Formato o tamaño de archivo no permitido'},422);
    totalBytes += tamano;
    if(totalBytes > MAX_TOTAL)return responder({error:'Los adjuntos superan los 8 MB en conjunto'},422);
    const driveFileId = archivo.drive_file_id;
    if(typeof driveFileId !== 'string' || !driveFileId)
      return responder({error:'Archivo sin respaldo válido en Drive'},422);
    let respuestaDrive:Response;
    try{
      respuestaDrive = await driveFetch(admin,'/drive/v3/files/'+encodeURIComponent(driveFileId)+'?alt=media&supportsAllDrives=true');
    }catch{return responder({error:'No se pudo obtener el archivo desde Drive'},503)}
    if(!respuestaDrive.ok)return responder({error:'No se pudo descargar un adjunto'},503);
    const longitud = Number(respuestaDrive.headers.get('content-length')||0);
    if(longitud>tamano || longitud>MAX_TOTAL){
      await respuestaDrive.body?.cancel();
      return responder({error:'El archivo descargado excede el tamaño permitido'},422);
    }
    const bytes = new Uint8Array(await respuestaDrive.arrayBuffer());
    if(bytes.length !== tamano)
      return responder({error:'El archivo cambió de tamaño; vuelve a seleccionarlo'},422);
    adjuntosSMTP.push({filename:nombre,contentType:mime,encoding:'binary',content:bytes});
    adjuntosAuditoria.push({id,origen:origen==='b'?'biblioteca':'comunidad',nombre,bytes:tamano});
    archivosParaDrive.push({ref:referencia,drive_file_id:driveFileId,nombre});
  }
  for(const item of guardarDrive){
    const seleccion = item as {ref:string;carpeta_id:string;operacion_id:string};
    const archivo = archivosParaDrive.find(a=>a.ref===seleccion.ref);
    if(!archivo)return responder({error:'No se encontró el archivo para guardar en Drive'},422);
    try{
      const guardado=await guardarAdjuntosEnCarpeta(admin,{
        carpetaId:seleccion.carpeta_id,operacionId:seleccion.operacion_id,
        usuarioId:user.id,archivos:[archivo]
      });
      const registro=adjuntosAuditoria.find(a=>a.id===seleccion.ref.slice(2));
      if(registro)registro.guardado_drive={carpeta_id:guardado.carpeta_id,carpeta_nombre:guardado.carpeta_nombre};
    }catch(e){
      return responder({error:e instanceof Error?e.message:'No se pudo guardar la copia en Drive'},503);
    }
  }

  const { data: comunicacion, error: eComunicacion } = await admin
    .from('proveedor_comunicaciones')
    .insert({
      asunto,
      mensaje,
      alcance,
      filtros,
      adjuntos: adjuntosAuditoria,
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
  const seguimientoPorProveedor = new Map<string,Awaited<ReturnType<typeof prepararSeguimiento>>>();

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

    const indicador=await prepararSeguimiento(seguimientoActivo && estado==='pendiente');
    if(estado==='pendiente')seguimientoPorProveedor.set(p.id,indicador);
    const fila = {
      seguimiento_activo:indicador.activo,
      seguimiento_token_hash:indicador.tokenHash,
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

  const correos = enviables.map(({ proveedor, email }) => {
    const indicador=seguimientoPorProveedor.get(proveedor.id);
    return {
      para: email,
      cc:copias.cc.filter(x=>x!==email),
      bcc:copias.cco.filter(x=>x!==email),
      asunto,
      html: htmlCorreo(proveedor,mensaje,perfil,firmaGuardada,incluirTelefono,indicador?.html||''),
      texto: [
        saludoProveedor(proveedor),'',mensaje,'',
        firmaTexto(perfil,firmaGuardada,incluirTelefono,indicador?.activo===true)
      ].join('\n'),
      adjuntos: adjuntosSMTP
    };
  });

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
    adjuntos: adjuntosAuditoria.length,
    enviados,
    fallidos,
    omitidos,
    estado: estadoFinal
  });
});
