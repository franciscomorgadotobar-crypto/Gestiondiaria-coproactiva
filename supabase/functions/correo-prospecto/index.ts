// Envío individual desde Pipeline, exclusivamente a la dirección YA guardada
// en el prospecto. Autenticación obligatoria, control de rol y auditoría.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { driveFetch } from '../_compartido/google-drive.ts';

const BASE = Deno.env.get('SUPABASE_URL') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SMTP_USER = Deno.env.get('SMTP_USUARIO') || 'contacto@coproactiva.cl';
const SMTP_PASS = (Deno.env.get('SMTP_CLAVE') || '').replace(/\s+/g,'');
const SMTP_HOST = Deno.env.get('SMTP_SERVIDOR') || 'smtp.gmail.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PUERTO') || '465');
const ORIGEN = 'https://app.coproactiva.cl';
// CCO indicado expresamente en el catálogo de correos Coproactiva v1.0.
const CCO = ['osmarmeza.adm7@gmail.com','franciscomorgadotobar@gmail.com'];
// Máximo 3 archivos físicos, 8 MiB en total antes de la codificación MIME.
const MAX_ARCHIVOS=3, MAX_TOTAL=8*1024*1024;
const MIME_PERMITIDOS=new Set([
 'application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const cors = {
  'access-control-allow-origin': ORIGEN,
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};
const respuesta = (data:unknown, status=200) => new Response(JSON.stringify(data),{status,headers:cors});
const normal = (value:unknown, max:number) => typeof value==='string' ? value.trim().slice(0,max) : '';
const correoValido = (x:string) => x.length<=254 && /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(x);
const uuidValido = (x:string) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const escapar=(v:string)=>v.replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]||x));

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return respuesta({error:'Método no permitido'},405);
  if(req.headers.get('origin') && req.headers.get('origin')!==ORIGEN)
    return respuesta({error:'Origen no permitido'},403);
  const autorizacion = req.headers.get('authorization');
  if(!autorizacion||!BASE||!ANON||!SERVICE) return respuesta({error:'Servicio no configurado o sin sesión'},503);
  const dbUsuario=createClient(BASE,ANON,{global:{headers:{Authorization:autorizacion}}});
  const {data:{user},error:sesionError}=await dbUsuario.auth.getUser();
  if(sesionError||!user) return respuesta({error:'Sesión inválida'},401);
  const admin=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:perfil,error:perfilError}=await admin.from('perfiles')
    .select('id,nombre,rol,activo,telefono').eq('id',user.id).maybeSingle();
  if(perfilError||!perfil?.activo||!['superadmin','admin','jefatura'].includes(perfil.rol))
    return respuesta({error:'No tienes permiso para enviar correos desde el CRM'},403);

  let body:Record<string,unknown>;
  try {body=await req.json();}catch{return respuesta({error:'Solicitud inválida'},400);}
  const prospectoId=normal(body?.prospecto_id,36);
  let asunto=normal(body?.asunto,160).replace(/[\r\n]+/g,' ');
  const mensaje=normal(body?.mensaje,5000);
  const plantillaId=normal(body?.plantilla_id,36);
  const referencias=Array.isArray(body?.adjuntos) ? body.adjuntos : [];
  if(referencias.length>MAX_ARCHIVOS||!referencias.every(x=>typeof x==='string' && /^(b|c):[a-f0-9-]{36}$/i.test(x)))
    return respuesta({error:'Se permiten hasta tres archivos registrados en la biblioteca o comunidad'},422);
  const idsUnicos=[...new Set(referencias)];
  if(idsUnicos.length!==referencias.length)return respuesta({error:'Hay adjuntos repetidos'},422);

  if(!uuidValido(prospectoId)||!asunto||!mensaje)
    return respuesta({error:'Selecciona el prospecto y completa asunto y mensaje'},400);
  if(/{{[\w]+}}|\[[^\]\n]+\]/.test(asunto+'\n'+mensaje))
    return respuesta({error:'El correo tiene variables pendientes o instrucciones entre corchetes'},422);
  let plantillaCorreo:{codigo?:string;asunto?:string;nombre?:string}|null=null;
  if(plantillaId){
    if(!uuidValido(plantillaId)) return respuesta({error:'Plantilla inválida'},400);
    const {data:plantilla,error:plantillaError}=await admin.from('plantillas_correo_crm')
      .select('codigo,asunto,nombre,adjunto_sugerido').eq('id',plantillaId).eq('activa',true).maybeSingle();
    if(plantillaError||!plantilla) return respuesta({error:'Plantilla no disponible'},422);
    plantillaCorreo=plantilla;
    if(plantilla.adjunto_sugerido?.trim()&&!referencias.length)
      return respuesta({error:'La plantilla requiere seleccionar un adjunto físico antes del envío'},422);
  }

  // Límite de seguridad para evitar envíos masivos desde una herramienta
  // pensada para gestionar un prospecto a la vez.
  const desde=new Date(Date.now()-86400000).toISOString();
  const {count,error:errorLimite}=await admin.from('prospecto_correos')
    .select('id',{head:true,count:'exact'}).eq('enviado_por',user.id).gte('creado_en',desde);
  if(errorLimite) return respuesta({error:'No se pudo validar el límite de envíos'},503);
  if((count||0)>=30) return respuesta({error:'Se alcanzó el máximo diario de 30 intentos'},429);

  const {data:prospecto,error:errorProspecto}=await admin.from('prospectos')
    .select('id,nombre_condominio,nombre_contacto,email').eq('id',prospectoId).maybeSingle();
  if(errorProspecto||!prospecto) return respuesta({error:'Prospecto no encontrado'},404);
  const destinatario=normal(prospecto.email,254).toLowerCase();
  if(!correoValido(destinatario)) return respuesta({error:'El prospecto no tiene un correo válido'},422);

  // Plantilla 04: asunto genérico personalizado. Nunca reemplazar un asunto redactado a mano.
  if(plantillaCorreo?.codigo==='04'){
    const referencia=normal(prospecto.nombre_condominio||prospecto.nombre_contacto,80);
    const asuntoPlantilla=normal(plantillaCorreo.asunto,160);
    const generico=asunto===asuntoPlantilla||/^presentaci[oó]n(?: corporativa)? coproactiva(?:\s*[|–—-].*)?$/i.test(asunto);
    if(generico) asunto=('Presentación Coproactiva y propuesta de reunión'+(referencia?' | '+referencia:'')).slice(0,160);
  }

  // Los IDs se resuelven en el servidor: jamás se aceptan URLs o Drive file IDs
  // proporcionados por el navegador. Descarga binaria desde Google Drive privado.
  const adjuntosSMTP:{filename:string;contentType:string;encoding:'binary';content:Uint8Array}[]=[];
  const auditoriaAdjuntos:{id:string;origen:string;nombre:string;bytes:number}[]=[];
  let total=0;
  for(const referencia of idsUnicos){
    const origen=referencia.slice(0,1),id=referencia.slice(2);
    if(!uuidValido(id))return respuesta({error:'Referencia de archivo inválida'},422);
    const tabla=origen==='b'?'correo_archivos_drive':'drive_archivos_comunidad';
    const {data:doc,error:docError}=await admin.from(tabla).select('*').eq('id',id).is('eliminado_en',null).maybeSingle();
    if(docError||!doc)return respuesta({error:'Un archivo ya no se encuentra disponible'},422);
    if(origen==='c'){
      // Igualar los permisos de lectura existentes de Drive-comunidad.
      const cid=doc.comunidad_id;
      if(perfil.rol!=='superadmin'){
        const {data:permiso}=await admin.from('perfil_comunidades')
         .select('comunidad_id').eq('perfil_id',user.id).eq('comunidad_id',cid).maybeSingle();
        if(!permiso)return respuesta({error:'Sin permiso para usar este documento comunitario'},403);
      }
      // Jamás se incluye un documento borrado, aunque haya sido visible al portal.
    }
    const nombre=normal(doc.nombre,180);
    const mime=normal(doc.mime,150);
    const tamano=Number(doc.tamano);
    if(!MIME_PERMITIDOS.has(mime)||!Number.isSafeInteger(tamano)||tamano<=0||tamano>MAX_TOTAL)
      return respuesta({error:'Tipo o tamaño de adjunto no permitido'},422);
    total+=tamano;
    if(total>MAX_TOTAL)return respuesta({error:'El conjunto de archivos supera 8 MB'},422);
    const googleId=doc.drive_file_id;
    if(typeof googleId!=='string'||!googleId)return respuesta({error:'Archivo sin respaldo válido en Drive'},422);
    let respuestaDrive:Response;
    try{
      respuestaDrive=await driveFetch(admin,'/drive/v3/files/'+encodeURIComponent(googleId)+'?alt=media&supportsAllDrives=true');
    }catch{
      return respuesta({error:'No se pudo obtener un adjunto desde Drive'},503);
    }
    if(!respuestaDrive.ok)return respuesta({error:'No se pudo descargar uno de los adjuntos'},503);
    const longitud=Number(respuestaDrive.headers.get('content-length')||0);
    if(longitud>tamano||longitud>MAX_TOTAL-total+tamano){
      await respuestaDrive.body?.cancel();
      return respuesta({error:'El archivo descargado excede el tamaño autorizado'},422);
    }
    const bytes=new Uint8Array(await respuestaDrive.arrayBuffer());
    if(bytes.length!==tamano)return respuesta({error:'El archivo cambió de tamaño. Vuelve a seleccionarlo'},422);
    adjuntosSMTP.push({filename:nombre,contentType:mime,encoding:'binary',content:bytes});
    auditoriaAdjuntos.push({id,origen:origen==='b'?'biblioteca':'comunidad',nombre,bytes:tamano});
  }

  const {data:registro,error:errorRegistro}=await admin.from('prospecto_correos').insert({
    prospecto_id:prospectoId,enviado_por:user.id,destinatario,asunto,mensaje,estado:'pendiente',adjuntos:auditoriaAdjuntos
  }).select('id').single();
  if(errorRegistro||!registro) return respuesta({error:'No se pudo registrar el intento de envío'},503);

  let enviado=false;
  let motivo='Error SMTP';
  if(!SMTP_PASS) motivo='SMTP sin configurar';
  else {
    const smtp=new SMTPClient({
      connection:{hostname:SMTP_HOST,port:SMTP_PORT,tls:SMTP_PORT===465,
        auth:{username:SMTP_USER,password:SMTP_PASS}}
    });
    try {
      // La firma elegida pertenece al usuario autenticado; no se acepta
      // contenido HTML ni URLs de imagen suministradas por el navegador.
      const {data:firmaGuardada,error:firmaError}=await admin.from('firmas_correo')
        .select('nombre,cargo,empresa,telefono,correo,web,texto_adicional,logo_path,activa,actualizada_en')
        .eq('usuario_id',user.id).maybeSingle();
      if(firmaError)throw new Error('No se pudo consultar la firma configurada');
      const firmaActiva=firmaGuardada?.activa!==false;
      const datos=firmaGuardada||{
        nombre:String(perfil.nombre||'Equipo Coproactiva'),
        cargo:'',
        empresa:'Coproactiva Administración SpA',
        telefono:String(perfil.telefono||''),
        correo:SMTP_USER,
        web:'www.coproactiva.cl',
        texto_adicional:''
      };
      const valor=(v:unknown,max=160)=>normal(v,max);
      const firmaLineas=firmaActiva?[
        valor(datos.nombre,120),
        valor(datos.cargo,120),
        valor(datos.empresa,140),
        valor(datos.telefono,60),
        valor(datos.correo,150),
        valor(datos.web,150),
        valor(datos.texto_adicional,750)
      ].filter(Boolean):[];
      const texto=mensaje+(firmaLineas.length?'\n\n'+firmaLineas.join('\n'):'');
      const lineasHtml=firmaLineas.map((line:string,j:number)=>
        (j===0?'<strong style="font-size:13px">':'')+
        escapar(line).replace(/\n/g,'<br>')+
        (j===0?'</strong>':'')+'<br>').join('');
      const path=valor(firmaGuardada?.logo_path,150);
      const logoValido=firmaActiva && path &&
        new RegExp('^'+user.id+'/logo\\.(png|jpg|webp)$').test(path);
      const urlLogo=logoValido
        ? BASE.replace(/\/$/,'')+'/storage/v1/object/public/firmas-correo/'+
          path.split('/').map(encodeURIComponent).join('/')+
          '?v='+encodeURIComponent(String(firmaGuardada?.actualizada_en||'1'))
        : '';
      // El HTML del correo replica la vista previa de Mi cuenta:
      // logo a la izquierda y datos a la derecha. Las tablas de presentación
      // evitan que Gmail apile el logo encima del texto.
      const logoHtml=urlLogo
        ? '<img src="'+escapar(urlLogo)+'" alt="Logo Coproactiva" width="156" '+
          'style="display:block;width:156px;max-width:156px;height:auto;max-height:85px;border:0;" />'
        : '';
      const datosHtml=[
        valor(datos.nombre,120),
        valor(datos.cargo,120),
        valor(datos.empresa,140),
        valor(datos.telefono,60),
        valor(datos.correo,150),
        valor(datos.web,150),
        valor(datos.texto_adicional,750)
      ].filter(Boolean).map((line:string,j:number)=>
        (j===0?'<strong style="font-size:13px;line-height:1.5">':'')+
        '<span style="color:#292f36;text-decoration:none">'+escapar(line).replace(/\n/g,'<br>')+'</span>'+
        (j===0?'</strong>':'')+(j<6?'<br>':'')
      ).join('');
      const tablaFirma='<table role="presentation" cellpadding="0" cellspacing="0" border="0" '+
        'style="border-collapse:collapse;border:0;margin:0;padding:0;max-width:570px"><tr>'+
        (logoHtml?'<td valign="middle" style="border:0;padding:0 16px 0 0;vertical-align:middle;width:160px">'+logoHtml+'</td>':'')+
        '<td valign="middle" style="border:0;padding:0;vertical-align:middle;'+
          'font:12px/1.55 Arial,sans-serif;color:#292f36">'+datosHtml+'</td>'+
        '</tr></table>';
      const html='<div style="font:14px/1.6 Arial,sans-serif;color:#292f36">'+
        '<p>'+escapar(mensaje).replace(/\n/g,'<br>')+'</p>'+
        (firmaActiva&&(lineasHtml||logoHtml)
          ? '<div style="margin-top:20px;padding-top:10px;border-top:1px solid #e4e0d9">'+tablaFirma+'</div>'
          : '')+'</div>';
      await smtp.send({from:'Coproactiva <'+SMTP_USER+'>',to:destinatario,bcc:CCO,
        subject:asunto,content:texto,html,attachments:adjuntosSMTP});
      enviado=true;
    }catch(e) {
      console.error('correo-prospecto SMTP',e instanceof Error?e.name:'unknown');
      motivo='No fue posible entregar el mensaje a SMTP';
    }finally {try{await smtp.close();}catch{/* no invalida el envío */}}
  }
  await admin.from('prospecto_correos').update(enviado
    ? {estado:'enviado',enviado_en:new Date().toISOString(),error:null}
    : {estado:'fallido',error:motivo}).eq('id',registro.id);
  if(!enviado) return respuesta({enviado:false,error:motivo},503);
  // No se altera la etapa ni los datos de contacto durante la correspondencia.
  await admin.from('prospectos').update({fecha_ultima_interaccion:new Date().toISOString()})
    .eq('id',prospectoId);
  return respuesta({enviado:true,id:registro.id,asunto});
});
