/* Motor único de correo transaccional Coproactiva.
 * Lo usan CRM y Proveedores sin trasladar la gestión fuera de sus fichas.
 * SMTP, firma, seguimiento, autorización y evidencias permanecen en servidor.
 */
import nodemailer from 'npm:nodemailer@10.3.1';
import { Buffer } from 'node:buffer';
import { LOGO_PNG } from './logo.ts';

const remitente=Deno.env.get('SMTP_USUARIO')||'contacto@coproactiva.cl';
const clave=(Deno.env.get('SMTP_CLAVE')||'').replace(/\s+/g,'');
const servidor=Deno.env.get('SMTP_SERVIDOR')||'smtp.gmail.com';
const puerto=Number(Deno.env.get('SMTP_PUERTO')||'465');
const urlSupabase=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');

const escapar=(v:unknown)=>String(v??'').replace(/[&<>"']/g,x=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[x]||x));

export const AVISO_SEGUIMIENTO=
  'Este mensaje puede registrar la carga de imágenes para seguimiento comercial. Esa señal no confirma su lectura.';

export async function prepararSeguimiento(activo:boolean) {
  if(!activo)return {activo:false,tokenHash:null as string|null,html:''};
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const tokenHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const url=urlSupabase+'/functions/v1/correo-apertura?t='+encodeURIComponent(token);
  const html='<p style="font:10px/1.4 Arial,sans-serif;color:#777;margin-top:20px">'+
    escapar(AVISO_SEGUIMIENTO)+'</p>'+
    '<img src="'+escapar(url)+'" alt="" width="1" height="1" '+
    'style="display:block;width:1px;height:1px;border:0"/>';
  return {activo:true,tokenHash,html};
}

export function firmaEstandar(
  firma:Record<string,any>|null,
  perfil:Record<string,any>|null,
  opciones:{incluirTelefono?:boolean;correoDefault?:string}={}
) {
  if(firma?.activa===false)return {texto:'',html:''};
  const tel=opciones.incluirTelefono!==false;
  const campos=[
    String(firma?.nombre||perfil?.nombre||'Equipo Coproactiva').trim(),
    String(firma?.cargo||'').trim(),
    String(firma?.empresa??'Coproactiva Administración SpA').trim(),
    tel?String(firma?.telefono??perfil?.telefono??'').trim():'',
    String(firma?.correo??opciones.correoDefault??remitente).trim(),
    String(firma?.web??'www.coproactiva.cl').trim(),
    String(firma?.texto_adicional||'').trim()
  ];
  const lineas=campos.filter(Boolean);
  const path=String(firma?.logo_path||'');
  const autorizado=Boolean(firma?.usuario_id &&
    new RegExp('^'+firma.usuario_id+'/logo\\.(png|jpg|webp)$').test(path));
  const logoSrc=autorizado
    ? urlSupabase+'/storage/v1/object/public/firmas-correo/'+
      path.split('/').map(encodeURIComponent).join('/')+
      '?v='+encodeURIComponent(String(firma?.actualizada_en||'1'))
    : '';
  const imagen=logoSrc
    ? '<img src="'+escapar(logoSrc)+'" alt="Logo Coproactiva" width="156" '+
      'style="display:block;width:156px;max-width:156px;max-height:85px;height:auto;border:0"/>'
    : '';
  const lineasHtml=campos.map((line,i)=>line
    ? (i===0?'<strong style="font-size:13px">':'')+
      escapar(line).replace(/\n/g,'<br>')+(i===0?'</strong>':'')+'<br>'
    : '').join('');
  const html='<div style="margin-top:20px;padding-top:10px;border-top:1px solid #e4e0d9">'+
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '+
    'style="border-collapse:collapse;max-width:570px"><tr>'+
    (imagen?'<td valign="middle" style="border:0;padding:0 16px 0 0;width:160px">'+imagen+'</td>':'')+
    '<td valign="middle" style="border:0;padding:0;font:12px/1.55 Arial,sans-serif;color:#292f36">'+
    lineasHtml+'</td></tr></table></div>';
  return {texto:lineas.join('\n'),html};
}

export type MotorAdjunto={
  filename:string;contentType:string;encoding:'binary'|'base64';
  content:Uint8Array|string;contentID?:string;
};
export type MotorMensaje={
  para:string;asunto:string;html:string;texto:string;cc?:string[];bcc?:string[];
  adjuntos?:MotorAdjunto[];
};
export type ResultadoMotor={enviado:boolean;motivo?:string};

export async function enviarLoteMotor(
  mensajes:MotorMensaje[],
  opciones:{logo?:boolean}={}
):Promise<ResultadoMotor[]> {
  if(!mensajes.length)return [];
  if(!clave)return mensajes.map(()=>({enviado:false,motivo:'SMTP sin configurar'}));
  // Nodemailer construye el MIME completo (RFC 2045/2047), codifica UTF-8,
  // los asuntos y los adjuntos sin exponer las fronteras multipart en Gmail.
  const cliente=nodemailer.createTransport({
    host:servidor,port:puerto,secure:puerto===465,
    auth:{user:remitente,pass:clave}
  });
  const resultados:ResultadoMotor[]=[];
  try{
    for(const mensaje of mensajes){
      try{
        const logo=opciones.logo!==false && !mensaje.adjuntos?.some(a=>a.contentID==='logo')
          ? [{contentType:'image/png',filename:'coproactiva.png',encoding:'base64' as const,content:LOGO_PNG,contentID:'logo'}]
          : [];
        await cliente.sendMail({
          from:{name:'Coproactiva',address:remitente},
          to:mensaje.para,
          ...(mensaje.cc?.length?{cc:mensaje.cc}:{}),
          ...(mensaje.bcc?.length?{bcc:mensaje.bcc}:{}),
          subject:mensaje.asunto,
          text:mensaje.texto,
          html:mensaje.html,
          attachments:[...logo,...(mensaje.adjuntos||[])].map(a=>({
            filename:a.filename,contentType:a.contentType,
            content:typeof a.content==='string'&&a.encoding==='base64'
              ? Buffer.from(a.content,'base64') : Buffer.from(a.content),
            ...(a.contentID?{cid:a.contentID}:{}),
          }))
        });
        resultados.push({enviado:true});
      }catch(e){
        resultados.push({enviado:false,motivo:e instanceof Error?e.message:'Error SMTP'});
      }
    }
  }finally{
    try{cliente.close()}catch{/* envío ya registrado por destinatario */}
  }
  return resultados;
}
