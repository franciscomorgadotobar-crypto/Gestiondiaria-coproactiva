import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import { verifySignature, safeMessage } from '../_shared/whatsapp-security.mjs';
import { drain, ready, rpc } from '../_shared/whatsapp-worker.ts';
const response=(body:string,status=200)=>new Response(body,{status});
Deno.serve(async req=>{
  const url=new URL(req.url);
  if(req.method==='GET') {
    const token=Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if(token&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===token)return response(url.searchParams.get('hub.challenge')??'');
    return response('Forbidden',403);
  }
  if(req.method!=='POST')return response('Method not allowed',405);
  if(!ready())return response('Channel not connected',503);
  if(Number(req.headers.get('content-length')??0)>1024*1024)return response('Too large',413);
  const raw=await req.text();if(raw.length>1024*1024)return response('Too large',413);
  if(!await verifySignature(raw,req.headers.get('x-hub-signature-256'),Deno.env.get('WHATSAPP_APP_SECRET')))return response('Forbidden',403);
  let event:any;try{event=JSON.parse(raw);}catch{return response('Invalid JSON',400);}
  if(event.object!=='whatsapp_business_account')return response('Invalid event',400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  try {
    for(const entry of event.entry??[])for(const change of entry.changes??[]) {
      if(change.field!=='messages')continue;
      const value=change.value;if(value?.metadata?.phone_number_id!==Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'))continue;
      for(const status of value.statuses??[]) {
        const state={delivered:'entregado',read:'leido',failed:'fallido'}[status.status];
        if(state)await rpc(db,'whatsapp_delivery',{p_meta_id:status.id,p_estado:state});
      }
      for(const message of value.messages??[]) {
        const person=(value.contacts??[]).find((x:any)=>x.wa_id===message.from);
        const timestamp=Number(message.timestamp)*1000;if(!Number.isFinite(timestamp))continue;
        const safe=safeMessage(message);
        await rpc(db,'whatsapp_ingresar',{p_wa_id:message.from,p_nombre:person?.profile?.name??null,p_meta_id:message.id,p_tipo:safe.tipo,p_contenido:safe.contenido,p_fecha:new Date(timestamp).toISOString(),p_metadatos:safe.metadatos});
      }
    }
  } catch {return response('Persistence unavailable',503);}
  // Persisted first; cron will recover work if this background task is interrupted.
  EdgeRuntime.waitUntil(drain(db).catch(()=>console.error('WhatsApp worker pending; cron will recover')));
  return response('EVENT_RECEIVED');
});
