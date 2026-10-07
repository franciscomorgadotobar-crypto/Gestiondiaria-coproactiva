import { flow, metaPayload } from './whatsapp-flow.mjs';
export const requiredSecrets = ['WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_VERSION'];
export function ready() { return requiredSecrets.every(key=>Boolean(Deno.env.get(key))); }
export async function rpc(db:any,name:string,args:any={}) {const {data,error}=await db.rpc(name,args);if(error)throw error;return data;}
export async function drain(db:any) {
  if(!ready())return {ready:false};
  const token=await rpc(db,'whatsapp_worker_claim');if(!token)return {busy:true};
  const deadline=Date.now()+45000;let processed=0;
  try {
    while(processed<30&&Date.now()<deadline) {
      const {data:messages,error}=await db.from('whatsapp_messages').select('*').eq('direccion','entrante').is('procesado_en',null).order('orden').limit(1);
      if(error)throw error;const m=messages?.[0];if(!m)break;
      const {data:c,error:ce}=await db.from('whatsapp_conversations').select('*').eq('id',m.conversation_id).single();if(ce)throw ce;
      const {data:contact,error:te}=await db.from('whatsapp_contacts').select('wa_id').eq('id',c.contacto_id).single();if(te)throw te;
      let contexts=[];
      if(c.paso_actual==='motivo'&&['residente','residente/copropietario','1'].includes(String(m.contenido).trim().toLowerCase()))contexts=await rpc(db,'whatsapp_contextos',{p_telefono:contact.wa_id});
      const plan=flow(c,m,contexts);
      try {
        const committed=await rpc(db,'whatsapp_process_commit',{p_token:token,p_message:m.id,p_revision:c.revision,p_plan:plan});
        if(!committed)break;
      } catch {
        // A failed registration must hand off, never claim that a case exists.
        await rpc(db,'whatsapp_process_error',{p_token:token,p_message:m.id,p_revision:c.revision});
      }
      processed++;
    }
    while(Date.now()<deadline) {
      const {data:list,error}=await db.from('whatsapp_messages').select('id').eq('estado','pendiente').order('orden').limit(1);
      if(error)throw error;if(!list?.length)break;
      const item=await rpc(db,'whatsapp_preparar_envio',{p_token:token,p_message:list[0].id});if(!item)continue;
      const version=Deno.env.get('WHATSAPP_GRAPH_VERSION')!;
      if(!/^v\d+\.\d+$/.test(version)) {await rpc(db,'whatsapp_envio_resultado',{p_token:token,p_message:item.id,p_estado:'fallido',p_error:'version_api_invalida'});continue;}
      try {
        const response=await fetch(`https://graph.facebook.com/${version}/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`,{
          method:'POST',headers:{Authorization:`Bearer ${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify(metaPayload(item.to,item.reply)),signal:AbortSignal.timeout(12000)
        });
        const payload=await response.json();
        const metaId=payload?.messages?.[0]?.id;
        await rpc(db,'whatsapp_envio_resultado',{p_token:token,p_message:item.id,p_estado:response.ok&&metaId?'enviado':response.status>=500?'incierto':'fallido',p_meta_id:metaId??null,p_error:response.ok&&metaId?null:String(payload?.error?.code??response.status)});
      } catch {
        await rpc(db,'whatsapp_envio_resultado',{p_token:token,p_message:item.id,p_estado:'incierto',p_error:'respuesta_meta_no_confirmada'});
      }
    }
    return {ready:true,processed};
  } finally {await rpc(db,'whatsapp_worker_release',{p_token:token});}
}
