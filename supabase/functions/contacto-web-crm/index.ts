// Formulario público de Coproactiva hacia el Pipeline real de Gestión Diaria.
// Nunca entregar service_role al navegador. Rate-limit + honeypot + deduplicación.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGINS = new Set(['https://www.coproactiva.cl','https://coproactiva.cl']);
function response(obj: unknown, status: number, origin: string) {
 return new Response(JSON.stringify(obj), { status, headers: {
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin': ORIGINS.has(origin)?origin:'https://www.coproactiva.cl',
  'access-control-allow-headers':'content-type',
  'access-control-allow-methods':'POST,OPTIONS',
  'vary':'Origin','cache-control':'no-store'
 }});
}
const normal = (v: unknown,max:number) => typeof v==='string'?v.trim().slice(0,max):'';
async function sha(s:string) {
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req => {
 const origin=req.headers.get('origin')||'';
 if (req.method==='GET') return response({ok:true,servicio:'contacto-web-crm'},200,origin);
 if (req.method==='OPTIONS') return new Response(null,{status:204,headers:{
  'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://www.coproactiva.cl',
  'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type',
  'vary':'Origin'
 }});
 if(req.method!=='POST')return response({ok:false,error:'Método no permitido'},405,origin);
 if(!ORIGINS.has(origin))return response({ok:false,error:'Origen no autorizado'},403,origin);
 if(Number(req.headers.get('content-length')||'0')>12_000)return response({ok:false,error:'Solicitud demasiado grande'},413,origin);
 try{
  const body=await req.json();
  if(!body||typeof body!=='object')return response({ok:false,error:'Datos inválidos'},400,origin);
  if(normal(body.website,200))return response({ok:true},200,origin); // Honeypot
  const nombre=normal(body.nombre,180),condominio=normal(body.condominio,180);
  const email=normal(body.email,254).toLowerCase(),telefono=normal(body.telefono,40).replace(/[\s()\-]/g,'');
  const servicio=normal(body.servicio,150),mensaje=normal(body.mensaje,3500);
  const form=normal(body.form_id,80)||'contact_form';
  if(!nombre||!condominio||!email||!telefono)return response({ok:false,errores:['Completa nombre, condominio, correo y teléfono.']},400,origin);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return response({ok:false,errores:['Correo electrónico inválido']},400,origin);
  const tel=telefono.replace(/^\+?56/,'');
  if(!/^[2-79][0-9]{8}$/.test(tel))return response({ok:false,errores:['Teléfono chileno inválido']},400,origin);
  if(body.privacy!==true)return response({ok:false,errores:['Debes aceptar la política de privacidad.']},400,origin);
  const secret=Deno.env.get('WEB_FORM_TURNSTILE_SECRET');
  if(secret) {
   const token=normal(body.turnstile_token,2048);
   if(!token)return response({ok:false,error:'Verificación antispam requerida'},400,origin);
   const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',body:new URLSearchParams({secret,response:token})
   });
   const verified=await verify.json();
   if(!verified.success)return response({ok:false,error:'Verificación antispam fallida'},403,origin);
  }
  const utm_source=normal(body.utm_source,150),utm_medium=normal(body.utm_medium,150),utm_campaign=normal(body.utm_campaign,150);
  const contacto_hash=await sha(email+'|'+tel);
  const fingerprint=await sha(email+'|'+tel+'|'+condominio.toLowerCase()+'|'+mensaje+'|'+String(Math.floor(Date.now()/3600000)));
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return response({ok:false,error:'Servicio no configurado'},503,origin);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.rpc('registrar_formulario_web',{p_nombre:nombre,p_condominio:condominio,
   p_email:email,p_telefono:telefono,p_servicio:servicio,p_mensaje:mensaje,p_formulario:form,
   p_utm_source:utm_source,p_utm_medium:utm_medium,p_utm_campaign:utm_campaign,
   p_fingerprint:fingerprint,p_contacto_hash:contacto_hash
  });
  if(error){if(error.message.includes('Demasiadas solicitudes'))return response({ok:false,error:'Demasiados intentos; vuelve más tarde.'},429,origin);
   console.error('No se pudo registrar formulario',error.code);return response({ok:false,error:'No pudimos registrar el mensaje.'},500,origin);}
  return response({ok:true,mensaje:'Recibimos tu solicitud.'},200,origin);
 }catch(e){console.error('Error validación formulario',e instanceof Error?e.name:'unknown');
  return response({ok:false,error:'No pudimos procesar la solicitud.'},400,origin);}
});
