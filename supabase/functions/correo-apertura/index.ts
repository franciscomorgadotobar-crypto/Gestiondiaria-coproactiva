// Señal de apertura de correo: no almacena IP, ubicación ni agente de usuario.
// GET público con token criptográficamente aleatorio. Respuesta idéntica
// para token válido, inválido y correo sin seguimiento.
// Una carga de imagen no confirma que una persona leyó el correo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE=Deno.env.get('SUPABASE_URL')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9UcPW94AAAAASUVORK5CYII=';
const PNG=Uint8Array.from(atob(PNG_BASE64),c=>c.charCodeAt(0));
const HEADERS={
  'content-type':'image/png',
  'cache-control':'no-store, no-cache, max-age=0, must-revalidate',
  'pragma':'no-cache',
  'expires':'0',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'",
  'cross-origin-resource-policy':'cross-origin'
};

function hex(bytes:Uint8Array){
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req=>{
  const send=()=>new Response(req.method==='HEAD'?null:PNG,{status:200,headers:HEADERS});
  if(req.method!=='GET'&&req.method!=='HEAD')return new Response(null,{status:405,headers:{allow:'GET,HEAD'}});
  if(req.method==='HEAD')return send();
  const url=new URL(req.url);
  const token=url.searchParams.get('t')||'';
  // No registrar ni devolver tokens, cabeceras del cliente o datos del destinatario.
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)||!BASE||!SERVICE)return send();
  try{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const tokenHash=hex(new Uint8Array(digest));
    const admin=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await admin.rpc('registrar_apertura_correo',{p_token_hash:tokenHash});
    if(error)console.error('correo-apertura: error al registrar señal (sin datos del mensaje)');
  }catch{
    console.error('correo-apertura: no se pudo procesar una señal');
  }
  return send();
});
