// Formulario público de Coproactiva hacia el Pipeline real de Gestión Diaria.
// Nunca entregar service_role al navegador. Rate-limit + honeypot + deduplicación.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { enviarLote } from '../_compartido/correo.ts';
import {
 BUZON_COMERCIAL, avisoNuevoProspecto, confirmacionContacto, correoEnviable, type DatosFormulario
} from '../_compartido/correo-formulario-web.ts';

// Confirmaciones por dirección en 24 horas. Evita que el formulario sirva para
// llenar de correos la bandeja de un tercero desde contacto@coproactiva.cl.
const MAX_CONFIRMACIONES_24H = 3;
const sinDirecciones = (t: string) => t.replace(/[^\s<>@]+@[^\s<>@]+/g, '[correo]').slice(0, 200);

async function enviarCorreos(db: SupabaseClient, d: DatosFormulario) {
 try {
  const mensajes = [{ para: BUZON_COMERCIAL, ...avisoNuevoProspecto(d) }];
  let confirmar = correoEnviable(d.email);
  if (confirmar) {
   const desde = new Date(Date.now() - 86_400_000).toISOString();
   const { count, error } = await db.from('prospectos').select('id', { count: 'exact', head: true })
    .eq('email', d.email).gte('fecha_primer_contacto', desde);
   confirmar = !error && (count ?? 0) <= MAX_CONFIRMACIONES_24H;
  }
  if (confirmar) mensajes.push({ para: d.email, ...confirmacionContacto(d) });
  const r = await enviarLote(mensajes, { logo: false });
  const fallas = r.filter(x => !x.enviado).map(x => sinDirecciones(x.motivo || 'sin detalle'));
  console.log('Correos formulario web', JSON.stringify({
   aviso_interno: r[0]?.enviado ?? false,
   confirmacion: confirmar ? (r[1]?.enviado ?? false) : 'omitida',
   ...(fallas.length ? { fallas } : {})
  }));
 } catch (e) {
  console.error('Correos formulario web', sinDirecciones(e instanceof Error ? e.message : String(e)));
 }
}

// El correo sale después de responder al navegador: la persona ve la
// confirmación en pantalla sin esperar al SMTP, y una falla de correo nunca
// borra un prospecto ya registrado.
function despuesDeResponder(p: Promise<unknown>) {
 const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
 if (rt?.waitUntil) { rt.waitUntil(p); return Promise.resolve(); }
 return p;
}

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
  const {data,error}=await db.rpc('registrar_formulario_web',{p_nombre:nombre,p_condominio:condominio,
   p_email:email,p_telefono:telefono,p_servicio:servicio,p_mensaje:mensaje,p_formulario:form,
   p_utm_source:utm_source,p_utm_medium:utm_medium,p_utm_campaign:utm_campaign,
   p_fingerprint:fingerprint,p_contacto_hash:contacto_hash
  });
  if(error){if(error.message.includes('Demasiadas solicitudes'))return response({ok:false,error:'Demasiados intentos; vuelve más tarde.'},429,origin);
   console.error('No se pudo registrar formulario',error.code);return response({ok:false,error:'No pudimos registrar el mensaje.'},500,origin);}
  // Un reenvío idéntico dentro de la hora no crea otro prospecto ni repite correos.
  if(data&&data.duplicado===false&&data.prospecto_id){
   await despuesDeResponder(enviarCorreos(db,{nombre,condominio,email,telefono,servicio,mensaje,
    origen:'web_coproactiva_cl'+(utm_source?':'+utm_source.slice(0,75):''),prospectoId:String(data.prospecto_id)}));
  }
  return response({ok:true,mensaje:'Recibimos tu solicitud.'},200,origin);
 }catch(e){console.error('Error validación formulario',e instanceof Error?e.name:'unknown');
  return response({ok:false,error:'No pudimos procesar la solicitud.'},400,origin);}
});
