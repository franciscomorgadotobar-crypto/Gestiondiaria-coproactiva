import test from 'node:test';
import assert from 'node:assert/strict';
import { drain } from '../functions/_shared/whatsapp-worker.ts';
const secrets={WHATSAPP_APP_SECRET:'test',WHATSAPP_VERIFY_TOKEN:'test',WHATSAPP_ACCESS_TOKEN:'test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_GRAPH_VERSION:'v23.0'};
globalThis.Deno={env:{get:key=>secrets[key]}};
function database({incoming=[],outgoing=[],busy=false,commitFailure=false}={}) {
 const calls=[];const state={incoming,outgoing,calls};
 const db={
  async rpc(name,args={}) {
   calls.push({name,args});
   if(name==='whatsapp_worker_claim')return {data:busy?null:'lease'};
   if(name==='whatsapp_process_commit') {if(commitFailure)return {error:{message:'Registration unavailable'}};state.incoming.shift();return {data:true};}
   if(name==='whatsapp_process_error') {state.incoming.shift();return {data:null};}
   if(name==='whatsapp_preparar_envio')return {data:state.outgoing.shift()??null};
   return {data:null};
  },
  from(table) {
   const q={select(){return q;},eq(){return q;},is(){return q;},order(){return q;},
    async limit(){return {data:table==='whatsapp_messages'?(state.incoming.length?state.incoming:[...(state.outgoing.length?[{id:state.outgoing[0].id}]:[])]):[]};},
    async single(){return {data:table==='whatsapp_conversations'?{id:'conv',revision:0,estado:'bot',paso_actual:'inicio',datos:{},contacto_id:'contact'}:{wa_id:'56900000000'}};}
   };return q;
  }
 };return {db,state};
}
test('missing Meta connection does not acquire a worker or send anything',async()=>{
 const {db,state}=database();delete secrets.WHATSAPP_ACCESS_TOKEN;
 try{assert.deepEqual(await drain(db),{ready:false});assert.equal(state.calls.length,0);}finally{secrets.WHATSAPP_ACCESS_TOKEN='test';}
});
test('a concurrent worker cannot process or send',async()=>{
 const {db,state}=database({busy:true});assert.deepEqual(await drain(db),{busy:true});assert.equal(state.calls.length,1);
});
test('a failed transaction hands off without claiming the registration succeeded',async()=>{
 const {db,state}=database({incoming:[{id:'in',conversation_id:'conv',tipo:'texto',contenido:'Hola'}],commitFailure:true});
 await drain(db);assert.ok(state.calls.some(x=>x.name==='whatsapp_process_error'));assert.equal(state.calls.filter(x=>x.name==='whatsapp_process_commit').length,1);assert.equal(state.calls.at(-1).name,'whatsapp_worker_release');
});
test('uncertain HTTP delivery is recorded without automatic retries',async()=>{
 const original=globalThis.fetch;let attempts=0;
 globalThis.fetch=async()=>{attempts++;throw new Error('Response lost');};
 const {db,state}=database({outgoing:[{id:'out',to:'56900000000',reply:{text:'Recibimos tu solicitud.'}}]});
 try{await drain(db);await drain(db);assert.equal(attempts,1);const result=state.calls.find(x=>x.name==='whatsapp_envio_resultado');assert.equal(result.args.p_estado,'incierto');assert.equal(result.args.p_error,'respuesta_meta_no_confirmada');}
 finally{globalThis.fetch=original;}
});
test('Meta response confirms outbound ID only after successful HTTP acceptance',async()=>{
 const original=globalThis.fetch;let payload;
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://graph.facebook.com/v23.0/123/messages');payload=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({messages:[{id:'wamid.test'}]})};};
 const {db,state}=database({outgoing:[{id:'out',to:'56900000000',reply:{text:'Recibimos tu solicitud.'}}]});
 try{await drain(db);assert.equal(payload.type,'text');const result=state.calls.find(x=>x.name==='whatsapp_envio_resultado');assert.equal(result.args.p_estado,'enviado');assert.equal(result.args.p_meta_id,'wamid.test');}finally{globalThis.fetch=original;}
});
