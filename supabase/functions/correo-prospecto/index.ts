// Envío individual desde Pipeline, exclusivamente a la dirección YA guardada
// en el prospecto. Autenticación obligatoria, control de rol y auditoría.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const BASE = Deno.env.get('SUPABASE_URL') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SMTP_USER = Deno.env.get('SMTP_USUARIO') || 'contacto@coproactiva.cl';
const SMTP_PASS = (Deno.env.get('SMTP_CLAVE') || '').replace(/\s+/g,'');
const SMTP_HOST = Deno.env.get('SMTP_SERVIDOR') || 'smtp.gmail.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PUERTO') || '465');
const ORIGEN = 'https://app.coproactiva.cl';
// CCO indicado expresamente en el catálogo de correos Coproactiva v1.0.
const CCO = ['osmarmeza.adm7@gmail.com','franciscomorgadotobar@gmail.com'];

const cors = {
  'access-control-allow-origin': ORIGEN,
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};
const respuesta = (data:unknown, status=200) => new Response(JSON.stringify(data),{status,headers:cors});
const normal = (value:unknown, max:number) => typeof value==='string' ? value.trim().slice(0,max) : '';
const correoValido = (x:string) => x.length<=254 && /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(x);
const uuidValido = (x:string) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const escapar=(v:string)=>v.replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]||x));

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return respuesta({error:'Método no permitido'},405);
  if(req.headers.get('origin') && req.headers.get('origin')!==ORIGEN)
    return respuesta({error:'Origen no permitido'},403);
  const autorizacion = req.headers.get('authorization');
  if(!autorizacion||!BASE||!ANON||!SERVICE) return respuesta({error:'Servicio no configurado o sin sesión'},503);
  const dbUsuario=createClient(BASE,ANON,{global:{headers:{Authorization:autorizacion}}});
  const {data:{user},error:sesionError}=await dbUsuario.auth.getUser();
  if(sesionError||!user) return respuesta({error:'Sesión inválida'},401);
  const admin=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:perfil,error:perfilError}=await admin.from('perfiles')
    .select('id,nombre,rol,activo').eq('id',user.id).maybeSingle();
  if(perfilError||!perfil?.activo||!['superadmin','admin','jefatura'].includes(perfil.rol))
    return respuesta({error:'No tienes permiso para enviar correos desde el CRM'},403);

  let body:Record<string,unknown>;
  try {body=await req.json();}catch{return respuesta({error:'Solicitud inválida'},400);}
  const prospectoId=normal(body?.prospecto_id,36);
  const asunto=normal(body?.asunto,160).replace(/[\r\n]+/g,' ');
  const mensaje=normal(body?.mensaje,5000);
  const plantillaId=normal(body?.plantilla_id,36);
  if(!uuidValido(prospectoId)||!asunto||!mensaje)
    return respuesta({error:'Selecciona el prospecto y completa asunto y mensaje'},400);
  if(/{{[\w]+}}|\[[^\]\n]+\]/.test(asunto+'\n'+mensaje))
    return respuesta({error:'El correo tiene variables pendientes o instrucciones entre corchetes'},422);
  if(plantillaId){
    if(!uuidValido(plantillaId)) return respuesta({error:'Plantilla inválida'},400);
    const {data:plantilla,error:plantillaError}=await admin.from('plantillas_correo_crm')
      .select('codigo,asunto,adjunto_sugerido').eq('id',plantillaId).eq('activa',true).maybeSingle();
    if(plantillaError||!plantilla) return respuesta({error:'Plantilla no disponible'},422);
    if(plantilla.asunto?.startsWith('Re:')||['25','26','30'].includes(plantilla.codigo)||plantilla.adjunto_sugerido?.trim())
      return respuesta({error:'Para este correo debes usar el hilo original o incorporar adjuntos. Cópialo y envíalo desde tu correo.'},422);
  }

  // Límite de seguridad para evitar envíos masivos desde una herramienta
  // pensada para gestionar un prospecto a la vez.
  const desde=new Date(Date.now()-86400000).toISOString();
  const {count,error:errorLimite}=await admin.from('prospecto_correos')
    .select('id',{head:true,count:'exact'}).eq('enviado_por',user.id).gte('creado_en',desde);
  if(errorLimite) return respuesta({error:'No se pudo validar el límite de envíos'},503);
  if((count||0)>=30) return respuesta({error:'Se alcanzó el máximo diario de 30 intentos'},429);

  const {data:prospecto,error:errorProspecto}=await admin.from('prospectos')
    .select('id,nombre_condominio,nombre_contacto,email').eq('id',prospectoId).maybeSingle();
  if(errorProspecto||!prospecto) return respuesta({error:'Prospecto no encontrado'},404);
  const destinatario=normal(prospecto.email,254).toLowerCase();
  if(!correoValido(destinatario)) return respuesta({error:'El prospecto no tiene un correo válido'},422);

  const {data:registro,error:errorRegistro}=await admin.from('prospecto_correos').insert({
    prospecto_id:prospectoId,enviado_por:user.id,destinatario,asunto,mensaje,estado:'pendiente'
  }).select('id').single();
  if(errorRegistro||!registro) return respuesta({error:'No se pudo registrar el intento de envío'},503);

  let enviado=false;
  let motivo='Error SMTP';
  if(!SMTP_PASS) motivo='SMTP sin configurar';
  else {
    const smtp=new SMTPClient({
      connection:{hostname:SMTP_HOST,port:SMTP_PORT,tls:SMTP_PORT===465,
        auth:{username:SMTP_USER,password:SMTP_PASS}}
    });
    try {
      // El editor ya contiene el saludo y la despedida; no duplicarlos.
      const texto=mensaje;
      const html='<div style="font:14px/1.6 Arial,sans-serif;color:#292f36"><p>'+
        escapar(mensaje).replace(/\n/g,'<br>')+'</p></div>';
      await smtp.send({from:'Coproactiva <'+SMTP_USER+'>',to:destinatario,bcc:CCO,
        subject:asunto,content:texto,html});
      enviado=true;
    }catch(e) {
      console.error('correo-prospecto SMTP',e instanceof Error?e.name:'unknown');
      motivo='No fue posible entregar el mensaje a SMTP';
    }finally {try{await smtp.close();}catch{/* no invalida el envío */}}
  }
  await admin.from('prospecto_correos').update(enviado
    ? {estado:'enviado',enviado_en:new Date().toISOString(),error:null}
    : {estado:'fallido',error:motivo}).eq('id',registro.id);
  if(!enviado) return respuesta({enviado:false,error:motivo},503);
  // No se altera la etapa ni los datos de contacto durante la correspondencia.
  await admin.from('prospectos').update({fecha_ultima_interaccion:new Date().toISOString()})
    .eq('id',prospectoId);
  return respuesta({enviado:true,id:registro.id});
});
