import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@2.0.6";
import PostalMime from "npm:postal-mime@3.0.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{autoRefreshToken:false,persistSession:false}});
const MAIL = (Deno.env.get("SMTP_USUARIO") || "contacto@coproactiva.cl").toLowerCase().trim();
const PASS = (Deno.env.get("SMTP_CLAVE") || "").replace(/\s+/g, "");
const LIMIT = 65;
function output(value:any, code=200) {
  return new Response(JSON.stringify(value), {status:code,headers:{"content-type":"application/json"}});
}
function mailList(value:any):string[] {
  const arr=Array.isArray(value)?value:(value?[value]:[]);
  return [...new Set(arr.flatMap((v:any)=>{
    if(typeof v==="string") return v.includes("@")?[v.toLowerCase().trim()]:[];
    if(v?.address) return [String(v.address).toLowerCase().trim()];
    if(v?.group) return mailList(v.group);
    return [];
  }).filter((v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))];
}
function normalize(value:any) {
  return String(value||"").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim();
}
function subjectKey(value:any) {
  return normalize(String(value||"").replace(/^(\s*(re|fw|fwd|rv)\s*:\s*)+/ig,""));
}
function plain(html:string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").trim();
}
function attachmentNames(node:any, list:any[]=[]):any[] {
  if(!node) return list;
  const name=node.dispositionParameters?.filename || node.parameters?.name;
  if(name && node.disposition!=="inline")
    list.push({nombre:String(name).slice(0,220),tipo:node.type||"application/octet-stream",disponible_en:"gmail"});
  for(const child of node.childNodes||[]) attachmentNames(child,list);
  return list.slice(0,30);
}
function propertyName(subject:string,body:string) {
  const value=subject+"\n"+body.slice(0,1800);
  const expressions=[
    /(?:^|\n)\s*(?:nombre\s+(?:del?\s+)?(?:condominio|edificio|comunidad)|propiedad|condominio|edificio|comunidad)\s*:\s*([^\n,;.!?]{3,65})/im,
    /(?:cotizaci[oó]n|propuesta|administraci[oó]n)\s+(?:de|para|del)\s+(?:el\s+|la\s+)?(?:edificio|condominio|comunidad)\s+([^\n,;.!?]{3,55})/im
  ];
  for(const exp of expressions) {
    const match=exp.exec(value)?.[1]?.trim();
    if(match && !/^(de|del|la|el|administracion|edificios?|condominios?)$/i.test(match)) return match;
  }
  return null;
}
function commercial(subject:string,body:string,prop:string|null) {
  if (prop) return true;
  const normalized=normalize(subject+"\n"+body.slice(0,2100));
  if (/(administracion (de|para) (condominio|edificio|comunidad)|comite de administracion|copropietari|gastos comunes|administrador (del|de un|de la) (edificio|condominio))/.test(normalized)) return true;
  return /(cotizacion|solicitud|presupuesto|propuesta|consulta|interesad|contratar|reunion)/.test(normalized)
    && /(administracion|comunidad|condominio|edificio|comite|copropiedad)/.test(normalized);
}
function addressText(from:any) {
  const obj=Array.isArray(from)?from[0]:from;
  return obj?.address ? (obj.name ? obj.name+" <"+obj.address+">" : obj.address) : "";
}
function matches(prospects:any[], history:any[], info:any):{id:string|null, reason:string} {
  if(info.thread) {
    const byThread=history.filter((h:any)=>h.gmail_thread_id===info.thread);
    if(byThread.length && new Set(byThread.map((h:any)=>h.prospecto_id)).size===1)
      return {id:byThread[0].prospecto_id,reason:"hilo_gmail"};
  }
  if(info.references?.length) {
    const ref=history.filter((h:any)=>info.references.some((r:string)=>r===h.rfc_message_id || r===h.gmail_message_id));
    if(ref.length && new Set(ref.map((h:any)=>h.prospecto_id)).size===1)
      return {id:ref[0].prospecto_id,reason:"respuesta_gmail"};
  }
  const byEmail=prospects.filter((p:any)=>p.email && info.external.includes(String(p.email).toLowerCase().trim()));
  const text=normalize(info.subject+" "+info.body.slice(0,1500));
  const byName=prospects.filter((p:any)=>{
    const name=normalize(p.nombre_condominio);
    return name.length>=6 && text.includes(name);
  });
  // Nombre de comunidad explícito en ASUNTO tiene precedencia sobre el email.
  const exactSubject=prospects.filter((p:any)=>{
    const name=normalize(p.nombre_condominio);
    return name.length>=6 && normalize(info.subject).includes(name);
  });
  // Un nombre de propiedad en el asunto por sí solo NO prueba que quien escribió sea el cliente.
  if(exactSubject.length>1) return {id:null,reason:"varias_propiedades_en_asunto"};
  if(byEmail.length===1) {
    if(byName.length===1 && byName[0].id!==byEmail[0].id)
      return {id:null,reason:"contacto_conflicto_propiedad"};
    return {id:byEmail[0].id,reason:"contacto"};
  }
  if(byEmail.length>1) {
    const joint=byEmail.filter((p:any)=>byName.some((n:any)=>n.id===p.id));
    return joint.length===1?{id:joint[0].id,reason:"contacto_y_propiedad"}:{id:null,reason:"contacto_compartido"};
  }
  // Algunos integrantes de comités escriben con una dirección distinta
  // de la dirección principal del prospecto. Consultar participantes previos.
  const historical=prospects.filter((p:any)=>history.some((h:any)=>{
    if(h.prospecto_id!==p.id) return false;
    const allAddresses=(String(h.remitente||"")+" "+String(h.destinatario||""))
      .toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
    return info.external.some((e:string)=>allAddresses.includes(e));
  }));
  if(historical.length===1) return {id:historical[0].id,reason:"correo_historico"};
  if(historical.length>1) {
    const exact=historical.filter((p:any)=>byName.some((x:any)=>x.id===p.id));
    if(exact.length===1) return {id:exact[0].id,reason:"correo_historico_y_propiedad"};
    return {id:null,reason:"contacto_de_varias_propiedades"};
  }
  if(byName.length===1) return {id:null,reason:"propiedad_sugerida_revisar"};
  return {id:null,reason:byName.length?"propiedad_ambigua":"sin_ficha"};
}
async function notify(tipo:string,title:string,body:string,prospectId:string|null,mailId:string|null) {
  const {data:admins}=await db.from("perfiles").select("id").eq("activo",true).in("rol",["admin","superadmin"]);
  if(!admins?.length) return;
  const rows=admins.map((x:any)=>({destinatario_id:x.id,tipo,titulo:title.slice(0,120),
    mensaje:body.slice(0,450),prospecto_id:prospectId,correo_origen:"gmail",correo_registro_id:mailId}));
  const {error}=await db.from("notificaciones").insert(rows);
  if(error) console.error("notificación:",error.message);
}
async function authorized(request:Request) {
  const token=request.headers.get("X-Coproactiva-Sync")||"";
  if(!token) return false;
  const {data,error}=await db.from("proveedor_sync_estado").select("token_hash").eq("clave","gmail_proveedores").single();
  if(error||!data?.token_hash) return false;
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  const digest=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return digest===data.token_hash;
}
async function history() {
  const [p,m,staff]=await Promise.all([
    db.from("prospectos").select("id,email,nombre_condominio,fecha_ultima_interaccion"),
    db.from("prospecto_correos").select("id,prospecto_id,origen,estado,asunto,destinatario,remitente,creado_en,enviado_en,gmail_message_id,gmail_thread_id,rfc_message_id")
      .order("creado_en",{ascending:false}).limit(3000),
    db.from("perfiles").select("email").in("rol",["admin","superadmin","jefatura","terreno"])
  ]);
  if(p.error) throw p.error;
  if(m.error) throw m.error;
  if(staff.error) throw staff.error;
  return {prospects:p.data||[],messages:m.data||[],staffEmails:(staff.data||[]).map((s:any)=>String(s.email||"").toLowerCase())};
}
async function processMail(info:any, known:any) {
  // Excluir empleados copiados en CC/CCO, nunca convertirlos en contactos del prospecto.
  info.external=info.external.filter((e:string)=>!known.staffEmails.includes(e));
  const id=info.gmailId;
  const linked=matches(known.prospects,known.messages,info);
  const prior=known.messages.find((x:any)=>x.gmail_message_id===id || (info.rfc && (x.gmail_message_id===info.rfc || x.rfc_message_id===info.rfc)));
  const prospectId=linked.id||prior?.prospecto_id||null;
  if(!prospectId) {
    // Correos ajenos al proceso comercial permanecen únicamente en Gmail.
    if(!commercial(info.subject,info.body,info.property)) return {nuevo:0,pendiente:0,vinculado:0};
    const {data:old}=await db.from("prospecto_gmail_pendientes").select("id").eq("gmail_message_id",id).maybeSingle();
    const pending={
      gmail_message_id:id,gmail_thread_id:info.thread,rfc_message_id:info.rfc,
      remitente:info.sender,destinatarios:info.to,asunto:info.subject,mensaje:info.body,
      adjuntos:info.attachments,fecha_correo:info.date,direccion:info.direction,
      propiedad_detectada:info.property,motivo:linked.reason,editado_en:new Date().toISOString()
    };
    const saved=old
      ? await db.from("prospecto_gmail_pendientes").update(pending).eq("id",old.id).select("id").single()
      : await db.from("prospecto_gmail_pendientes").insert(pending).select("id").single();
    if(saved.error) throw saved.error;
    // Las coincidencias no verificadas permanecen en revisión interna.
    // No generan notificaciones ni se convierten en prospectos automáticamente.
    return {nuevo:0,pendiente:old?0:1,vinculado:0};
  }
  if(prior && prior.prospecto_id===prospectId) {
    const patch:any={};
    if(info.thread && !prior.gmail_thread_id) patch.gmail_thread_id=info.thread;
    if(info.rfc && !prior.rfc_message_id) patch.rfc_message_id=info.rfc;
    if(Object.keys(patch).length) {
      const {error}=await db.from("prospecto_correos").update(patch).eq("id",prior.id);
      if(error) throw error;
    }
    await db.from("prospecto_gmail_pendientes").update({estado:"vinculado",prospecto_id:prospectId})
      .eq("gmail_message_id",id).eq("estado","pendiente");
    return {nuevo:0,pendiente:0,vinculado:0};
  }
  const twin=info.direction==="enviado"
    ? known.messages.find((x:any)=>x.prospecto_id===prospectId && x.origen==="crm" && x.estado==="enviado"
      && subjectKey(x.asunto)===subjectKey(info.subject)
      && Math.abs(new Date(x.enviado_en||x.creado_en).getTime()-new Date(info.date).getTime())<=900000
      && info.external.some((email:string)=>String(x.destinatario||"").toLowerCase().includes(email)))
    : null;
  let inserted:string|null=null;
  if(twin) {
    const {error}=await db.from("prospecto_correos")
      .update({gmail_message_id:id,gmail_thread_id:info.thread,rfc_message_id:info.rfc}).eq("id",twin.id);
    if(error) throw error;
    twin.gmail_message_id=id;
  } else {
    const payload={
      prospecto_id:prospectId,origen:"gmail",estado:info.direction,
      remitente:info.sender,destinatario:info.to||"—",asunto:info.subject,
      mensaje:info.body,adjuntos:info.attachments,creado_en:info.date,enviado_en:info.date,
      gmail_message_id:id,gmail_thread_id:info.thread,rfc_message_id:info.rfc,
      enviado_por:null,seguimiento_activo:false
    };
    const {data,error}=await db.from("prospecto_correos").upsert(payload,{
      onConflict:"prospecto_id,gmail_message_id",ignoreDuplicates:true
    }).select("id").maybeSingle();
    if(error) throw error;
    inserted=data?.id||null;
    if(inserted) known.messages.unshift({...payload,id:inserted});
  }
  const p=known.prospects.find((x:any)=>x.id===prospectId);
  if(p && (!p.fecha_ultima_interaccion || new Date(info.date)>new Date(p.fecha_ultima_interaccion))) {
    const {error}=await db.from("prospectos").update({fecha_ultima_interaccion:info.date}).eq("id",prospectId);
    if(error) throw error;
    p.fecha_ultima_interaccion=info.date;
  }
  const {error:unpending}=await db.from("prospecto_gmail_pendientes")
    .update({estado:"vinculado",prospecto_id:prospectId,editado_en:new Date().toISOString()})
    .eq("gmail_message_id",id).eq("estado","pendiente");
  if(unpending) throw unpending;
  if(inserted && info.direction==="recibido")
    await notify("correo_prospecto_recibido","Respuesta de prospecto",info.subject,prospectId,inserted);
  return {nuevo:inserted?1:0,pendiente:0,vinculado:1};
}
function fromMessage(msg:any):Promise<any> {
  return (async()=>{
    const source=msg.source instanceof Uint8Array?msg.source:new Uint8Array(msg.source||[]);
    const parsed:any=await PostalMime.parse(source).catch(()=>({}));
    const from=parsed.from||msg.envelope?.from?.[0];
    const sender=addressText(from)||mailList(from).join(", ");
    const fromEmails=mailList(from);
    const receivers=[...new Set([
      ...mailList(parsed.to||msg.envelope?.to), ...mailList(parsed.cc||msg.envelope?.cc),
      ...mailList(parsed.bcc||msg.envelope?.bcc)])];
    const outgoing=fromEmails.some((e:string)=>e===MAIL||e.endsWith("@coproactiva.cl"));
    const subject=String(parsed.subject||msg.envelope?.subject||"").trim()||"(Sin asunto)";
    const body=String(parsed.text||plain(String(parsed.html||""))||"").slice(0,30000);
    const dateObj=new Date(parsed.date||msg.internalDate||Date.now());
    const date=Number.isFinite(dateObj.getTime())?dateObj.toISOString():new Date().toISOString();
    const rfc=String(parsed.messageId||"").trim()||null;
    const external=(outgoing?receivers:fromEmails).filter((e:string)=>!e.endsWith("@coproactiva.cl"));
    const references=[String(parsed.inReplyTo||""),...(Array.isArray(parsed.references)?parsed.references:String(parsed.references||"").split(/\s+/))]
      .filter(Boolean);
    return {gmailId:String(msg.emailId||rfc||("imap:"+msg.uid)),thread:String(msg.threadId||"")||null,
      rfc,sender,to:receivers.join(", "),subject,body,date,
      direction:outgoing?"enviado":"recibido", external,references,
      property:propertyName(subject,body),attachments:attachmentNames(msg.bodyStructure)};
  })();
}
async function pendingRepair(known:any) {
  const {data,error}=await db.from("prospecto_gmail_pendientes").select("*")
    .eq("estado","pendiente").order("fecha_correo",{ascending:false}).limit(35);
  if(error) throw error;
  let fixed=0;
  for(const p of data||[]) {
    const inbound=p.direccion==="recibido";
    const sender=(String(p.remitente||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map((x:string)=>x.toLowerCase());
    const receivers=(String(p.destinatarios||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map((x:string)=>x.toLowerCase());
    const info={gmailId:p.gmail_message_id,thread:p.gmail_thread_id,rfc:p.rfc_message_id,
      sender:p.remitente,to:p.destinatarios,subject:p.asunto,body:p.mensaje,
      date:p.fecha_correo,direction:p.direccion,external:(inbound?sender:receivers).filter((x:string)=>!x.endsWith("@coproactiva.cl")),
      references:[],property:p.propiedad_detectada,attachments:p.adjuntos};
    info.external=info.external.filter((e:string)=>!known.staffEmails.includes(e));
    if(!matches(known.prospects,known.messages,info).id) continue;
    await processMail(info,known);
    fixed++;
  }
  return fixed;
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return output({error:"Método no permitido"},405);
  if(!(await authorized(req))) return output({error:"Sin permiso"},403);
  if(!PASS) return output({error:"No hay credenciales IMAP"},500);
  const {data:state,error:sErr}=await db.from("prospecto_gmail_sync_estado").select("*").eq("clave","contacto").single();
  if(sErr) return output({error:sErr.message},500);
  const now=new Date().toISOString();
  const {data:lock,error:lockErr}=await db.from("prospecto_gmail_sync_estado")
    .update({bloqueado_hasta:new Date(Date.now()+120000).toISOString(),ultima_revision:now})
    .eq("clave","contacto").or("bloqueado_hasta.is.null,bloqueado_hasta.lt."+now)
    .select("clave").maybeSingle();
  if(lockErr) return output({error:lockErr.message},500);
  if(!lock) return output({ok:true,omitido:"en_ejecucion"},202);
  let client:any=null, mailboxLock:any=null;
  let processed=0,attached=0,staged=0,newRecords=0,recovered=0;
  let last=Number(state.ultimo_uid||0);
  try {
    const known=await history();
    client=new ImapFlow({host:"imap.gmail.com",port:993,secure:true,
      auth:{user:MAIL,pass:PASS},logger:false});
    await client.connect();
    const boxes=await client.list();
    const all=boxes.find((x:any)=>x.specialUse==="\\All" || x.specialUse?.has?.("\\All"))
      ||boxes.find((x:any)=>/\[Gmail\]\/(All Mail|Todos|Todos los mensajes)/i.test(x.path));
    if(!all?.path) throw new Error("No se encontró Todos los mensajes de Gmail");
    mailboxLock=await client.getMailboxLock(all.path);
    const validity=String(client.mailbox?.uidValidity||"0");
    if(validity!==state.uid_validity) last=0;
    const found:any=await client.search(last?{uid:String(last+1)+":*"}:{gmraw:"newer_than:14d"},{uid:true})||[];
    const uidList=(Array.isArray(found)?found:[])
      .filter((x:number)=>x>last).sort((a:number,b:number)=>a-b).slice(0,LIMIT);
    for(const uid of uidList) {
      const [msg]=await client.fetchAll([uid],
        {envelope:true,internalDate:true,emailId:true,threadId:true,bodyStructure:true,source:{maxLength:220000}},
        {uid:true});
      if(!msg) throw new Error("Mensaje IMAP no encontrado: "+uid);
      const info=await fromMessage(msg);
      const result=await processMail(info,known);
      attached+=result.vinculado;
      staged+=result.pendiente;
      newRecords+=result.nuevo;
      processed++;
      last=uid;
      const {error}=await db.from("prospecto_gmail_sync_estado")
        .update({ultimo_uid:last,uid_validity:validity,editado_en:new Date().toISOString()})
        .eq("clave","contacto");
      if(error) throw error;
    }
    mailboxLock.release();mailboxLock=null;
    await client.logout();client=null;
    recovered=await pendingRepair(known);
    const {error:doneErr}=await db.from("prospecto_gmail_sync_estado").update({
      ultimo_exito:new Date().toISOString(),ultimo_error:null,bloqueado_hasta:null,
      correos_procesados:(state.correos_procesados||0)+processed,
      correos_vinculados:(state.correos_vinculados||0)+attached+recovered,
      correos_pendientes:(state.correos_pendientes||0)+staged,editado_en:new Date().toISOString()
    }).eq("clave","contacto");
    if(doneErr) throw doneErr;
    return output({ok:true,procesados:processed,vinculados:attached,
      mensajes_nuevos_en_fichas:newRecords,sin_asociar:staged,reconciliados:recovered,
      posible_continuacion:processed===LIMIT});
  } catch(err:any) {
    const message=err instanceof Error?err.message:String(err);
    console.error("Gmail prospectos",message);
    await db.from("prospecto_gmail_sync_estado")
      .update({ultimo_error:message.slice(0,450),bloqueado_hasta:null,editado_en:new Date().toISOString()})
      .eq("clave","contacto");
    return output({ok:false,error:message,procesados:processed,ultimo_uid:last},500);
  } finally {
    try {mailboxLock?.release()}catch{}
    try {await client?.logout()}catch{}
  }
});