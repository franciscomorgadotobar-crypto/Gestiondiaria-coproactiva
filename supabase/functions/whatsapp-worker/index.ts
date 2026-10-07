import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import { drain, requiredSecrets, rpc } from '../_shared/whatsapp-worker.ts';
const headers={'Access-Control-Allow-Origin':'https://app.coproactiva.cl','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response({});if(req.method!=='POST')return response({error:'Método no permitido'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 let allowed=false,role='';
 const internal=req.headers.get('X-Coproactiva-Worker');
 if(internal) {
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(internal)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const {data,error}=await db.from('whatsapp_config').select('cron_token_hash').eq('id',true).single();allowed=!error&&hash===data?.cron_token_hash;
 } else {
   const bearer=req.headers.get('authorization')?.replace(/^Bearer /i,'');
   if(bearer){const {data,error}=await db.auth.getUser(bearer);if(!error&&data?.user){const p=await db.from('perfiles').select('rol,activo').eq('id',data.user.id).single();role=p.data?.rol;allowed=p.data?.activo&&['admin','superadmin'].includes(role);}}
 }
 if(!allowed)return response({error:'Sin permiso'},403);
 try {
   let body:any={};try{body=await req.json();}catch{}
   if(body.action==='readiness') {
     if(role!=='superadmin')return response({error:'Solo superadmin'},403);
     const {data,error}=await db.from('whatsapp_config').select('habilitado,responsable_recepcion').eq('id',true).single();if(error)throw error;
     return response({missing:requiredSecrets.filter(key=>!Deno.env.get(key)),config:data});
   }
   return response(await drain(db));
 } catch {return response({error:'No se pudo procesar la cola'},500);}
});
