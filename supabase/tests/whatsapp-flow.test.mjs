import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flow, phone, withinWindow, metaPayload, FILE_REPLY, APPLICANT_REPLY, PROVIDER_REPLY } from '../functions/_shared/whatsapp-flow.mjs';
import { verifySignature, safeMessage } from '../functions/_shared/whatsapp-security.mjs';
const context={unidad_id:'00000000-0000-0000-0000-000000000001',comunidad_id:'00000000-0000-0000-0000-000000000002',comunidad_nombre:'Las Casas',numero:'405',residente_id:null,copropietario_id:null};
function session(contexts=[]) {
 let c={estado:'bot',paso_actual:'inicio',datos:{},motivo:null};
 return { get c(){return c;},say(v,tipo='texto'){const r=flow(c,{tipo,contenido:v},contexts);c={...c,estado:r.state,paso_actual:r.step,datos:r.data,motivo:r.motive};return r;} };
}
test('asks motive before matching phone; short WhatsApp list is valid',()=>{
 const s=session([context]),r=s.say('Soy del 405');assert.equal(r.step,'motivo');assert.equal(r.data.context,undefined);assert.equal(r.replies[0].choices.length,5);assert.equal(metaPayload('56912345678',r.replies[0]).interactive.type,'list');
});
test('normalizes Chilean numbers and rejects a stale 24h window',()=>{
 assert.equal(phone('+56 9 1234 5678'),'56912345678');assert.equal(phone('9 1234 5678'),'56912345678');
 const now=Date.now();assert.ok(withinWindow(new Date(now-86399999),now));assert.equal(withinWindow(new Date(now-86400000),now),false);assert.equal(withinWindow('invalid',now),false);
});
test('known phone reuses unit and grouped house menus exclude elevators',()=>{
 const s=session([context]);s.say('Hola');const r=s.say('residente');assert.equal(r.step,'res_menu');assert.equal(r.data.context.numero,'405');assert.ok(r.replies[0].choices.every(x=>x.title.length<=24));
 const groups=s.say('problema');assert.equal(groups.replies[0].choices.length,4);const sub=s.say('accesos');assert.equal(sub.replies[0].choices.length,3);assert.doesNotMatch(JSON.stringify(sub),/ascensor/i);
});
test('multiple units are paginated without exposing other contact names',()=>{
 const contexts=Array.from({length:19},(_,i)=>({...context,numero:String(i+1),unidad_id:String(i)}));const s=session(contexts);s.say('Hola');let r=s.say('residente');assert.equal(r.step,'res_contexto');assert.equal(r.replies[0].choices.length,9);r=s.say('mas');assert.equal(r.replies[0].choices.length,10);r=s.say('context_10');assert.equal(r.data.context.numero,'11');
});
test('unknown phone never treats unit declaration as identity proof',()=>{
 const s=session();for(const v of ['hola','residente','Juan','Las Casas','405','Residente'])s.say(v);
 assert.equal(s.c.datos.validacion,'pendiente');assert.equal(s.c.datos.context,undefined);
 for(const v of ['gestion','Reparar el acceso'])s.say(v);
 const r=s.say('confirmar');assert.equal(r.action,'revision');assert.equal(r.state,'derivada');
});
test('confirmation creates a single intent; correction and cancellation never create one',()=>{
 const s=session([context]);for(const v of ['hola','residente','problema','servicios','electricidad','casa','La luminaria no enciende','Ayer','no'])s.say(v);
 assert.equal(s.c.paso_actual,'res_confirmar');assert.equal(s.c.datos.confirmado,undefined);
 const r=s.say('confirmar');assert.equal(r.action,'bitacora');assert.equal(r.replies.length,0);assert.equal(s.say('confirmar').action,null);
 const a=session([context]);for(const v of ['hola','residente','gestion','Cambiar el acceso'])a.say(v);assert.equal(a.say('corregir').step,'res_menu');
 const b=session([context]);for(const v of ['hola','residente','reclamo','Aseo incompleto'])b.say(v);assert.equal(b.say('cancelar').state,'cerrada');
});
test('emergency risk immediately hands off and never creates an unconfirmed Bitácora',()=>{
 const s=session([context]);for(const v of ['hola','residente','problema','accesos','seguridad','comun','Portón','Hay peligro','Ahora'])s.say(v);
 const r=s.say('si');assert.equal(r.state,'derivada');assert.equal(r.action,null);assert.match(r.replies[0].text,/servicios de emergencia/);assert.equal(s.say('nuevo mensaje').replies.length,0);
});
test('handoff and HUMAN never automatically respond, even to attachments',()=>{
 for(const state of ['derivada','atencion_humana'])for(const tipo of ['texto','imagen','audio','documento']){
  const r=flow({estado:state,datos:{},paso_actual:'humano'},{tipo,contenido:'Hola'});assert.deepEqual(r.replies,[]);assert.equal(r.state,state);
 }
});
test('files only prompt email and do not advance the current question',()=>{
 const s=session();s.say('Hola');s.say('cotizacion');for(const tipo of ['imagen','documento','audio','video','sticker','otro']){const r=s.say('file',tipo);assert.equal(r.step,'cot_servicio');assert.equal(r.replies[0].text,FILE_REPLY);}
 const safe=safeMessage({type:'document',document:{id:'private_meta_media',filename:'CV.pdf',mime_type:'application/pdf',url:'https://private',caption:'secret',content:'BYTES'}});
 assert.deepEqual(safe.metadatos,{mime_type:'application/pdf',filename:'CV.pdf'});assert.doesNotMatch(JSON.stringify(safe),/private|BYTES|secret/);
});
test('quote validates email and units then confirms Prospectos intent',()=>{
 const s=session();for(const v of ['hola','cotizacion','administracion','Ana','Las Casas','Maipú'])s.say(v);
 assert.equal(s.say('cien').step,'cot_unidades');s.say('No sé');assert.equal(s.say('bad-address').step,'cot_email');s.say('No');s.say('No');const r=s.say('confirmar');assert.equal(r.action,'prospecto');assert.equal(r.data.unidades,null);assert.equal(r.data.email,null);
});
test('applicant only asks name, commune and area; vendor asks no questions',()=>{
 const s=session();const all=[];for(const v of ['hola','postulacion','Ana','Maipú','area_1'])all.push(...s.say(v).replies);
 assert.equal(all.at(-1).text,APPLICANT_REPLY);assert.equal(s.c.estado,'cerrada');assert.doesNotMatch(JSON.stringify(all),/experiencia|disponibilidad|vacante|asunto|jornada/i);
 const p=session();p.say('hola');const r=p.say('proveedor');assert.equal(r.replies[0].text,PROVIDER_REPLY);assert.equal(r.state,'cerrada');
});
test('other motive receives brief reason and hands off',()=>{
 const s=session();for(const v of ['Hola','otro','Ana'])s.say(v);const r=s.say('Quiero conversar');assert.equal(r.state,'derivada');assert.equal(r.action,null);
});
test('returning to an incomplete flow offers resume or menu',()=>{
 const s=session();s.say('Hola');s.say('cotizacion');assert.equal(s.say('Hola').step,'retomar');assert.equal(s.say('continuar').step,'cot_servicio');assert.equal(s.say('menu').step,'motivo');
});
test('all generated choice labels satisfy Meta list constraints',()=>{
 for(const values of [['hola'],['hola','residente','problema','comunes'],['hola','residente','problema','servicios'],['hola','cotizacion'],['hola','postulacion','Ana','Maipú']]) {
  const s=session([context]);for(const v of values)for(const r of s.say(v).replies)if(r.choices){assert.ok(r.choices.length<=10);for(const c of r.choices){assert.ok(c.title.length<=24,c.title);assert.ok((c.description?.length??0)<=72);}}
 }
});
test('HMAC verifies raw body and rejects modified payload, missing secret or invalid signature',async()=>{
 const body='{"message":"hola"}',secret='test-secret';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));const sig='sha256='+Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifySignature(body,sig,secret),true);assert.equal(await verifySignature(body+' ',sig,secret),false);assert.equal(await verifySignature(body,sig,''),false);assert.equal(await verifySignature(body,'',secret),false);
});
test('new Gmail sync never writes attachment bytes, MIME source, HTML embeds or storage',()=>{
 const source=readFileSync(new URL('../functions/sincronizar-proveedores-gmail/index.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/\.storage\.from|\.upload\(/);assert.match(source,/const storagePathEml = null/);assert.match(source,/const html = null/);
});
