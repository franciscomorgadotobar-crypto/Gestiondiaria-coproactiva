// Enlaces documentales de capacidad: token aleatorio de 256 bits, solo hash en BD.
// El registro informa solicitudes de descarga, nunca identidad ni lectura efectiva.
import {createClient} from 'npm:@supabase/supabase-js@2';
import {driveFetch} from '../_compartido/google-drive.ts';

const BASE=Deno.env.get('SUPABASE_URL')||'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ORIGEN='https://app.coproactiva.cl';
const ROLES=new Set(['superadmin','admin','jefatura']);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const MAX_PDF=8*1024*1024;
const seguridad={'cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','content-security-policy':"default-src 'none'"};
const cors=(req:Request)=>({
 ...seguridad,
 ...(req.headers.get('origin')===ORIGEN?{'access-control-allow-origin':ORIGEN}:{}),
 'access-control-allow-headers':'authorization,apikey,x-client-info,content-type',
 'access-control-allow-methods':'GET,POST,OPTIONS'
});
const json=(req:Request,obj:unknown,status=200)=>new Response(JSON.stringify(obj),{
 status,headers:{...cors(req),'content-type':'application/json; charset=utf-8'}
});
const binHex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function hashHex(token:string){
 const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return binHex(new Uint8Array(buffer));
}
function clienteAdmin(){
 return createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function identificacion(req:Request,admin:ReturnType<typeof clienteAdmin>){
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!jwt)return null;
 const {data:{user},error}=await admin.auth.getUser(jwt);
 if(error||!user)return null;
 const {data:perfil}=await admin.from('perfiles').select('rol,activo').eq('id',user.id).maybeSingle();
 return perfil?.activo&&ROLES.has(perfil.rol)?{id:user.id,rol:perfil.rol}:null;
}
function nombreDescarga(nombre:unknown){
 const basename=String(nombre||'documento.pdf').replace(/[\r\n\/\\"]/g,'_')
   .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,110);
 return basename.toLowerCase().endsWith('.pdf')?basename:basename+'.pdf';
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(!BASE||!ANON||!SERVICE)return json(req,{error:'Servicio no configurado'},503);
 const admin=clienteAdmin();
 try{
  if(req.method==='GET'){
   const token=new URL(req.url).searchParams.get('token')||'';
   if(!TOKEN.test(token))return json(req,{error:'Enlace no disponible'},404);
   const {data:enlace,error:e}=await admin.from('enlaces_documentales')
     .select('id,archivo_id,vence_en,revocado_en')
     .eq('token_hash',await hashHex(token)).maybeSingle();
   if(e||!enlace)return json(req,{error:'Enlace no disponible'},404);
   if(enlace.revocado_en||new Date(enlace.vence_en).getTime()<=Date.now())
    return json(req,{error:'Enlace caducado o revocado'},410);
   const {data:archivo,error:eArchivo}=await admin.from('correo_archivos_drive')
     .select('drive_file_id,nombre,mime,tamano').eq('id',enlace.archivo_id)
     .is('eliminado_en',null).maybeSingle();
   if(eArchivo||!archivo||archivo.mime!=='application/pdf'||
      Number(archivo.tamano)<=0||Number(archivo.tamano)>MAX_PDF||
      !archivo.drive_file_id)return json(req,{error:'Documento no disponible'},404);
   let respuestaDrive:Response;
   try{
    respuestaDrive=await driveFetch(admin,'/drive/v3/files/'+encodeURIComponent(archivo.drive_file_id)+'?alt=media&supportsAllDrives=true');
   }catch{return json(req,{error:'No fue posible recuperar el documento'},503)}
   if(!respuestaDrive.ok)return json(req,{error:'Documento temporalmente no disponible'},503);
   const longitud=Number(respuestaDrive.headers.get('content-length')||0);
   if(longitud>Number(archivo.tamano)||longitud>MAX_PDF){
    await respuestaDrive.body?.cancel();
    return json(req,{error:'Archivo no válido'},422);
   }
   const bytes=new Uint8Array(await respuestaDrive.arrayBuffer());
   if(bytes.length!==Number(archivo.tamano)||
      bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70||bytes[4]!==45)
    return json(req,{error:'Archivo no válido'},422);
   // Contabilización atómica, antes de responder. Es una solicitud, no prueba de lectura.
   const {data:registrado,error:eRegistro}=await admin.rpc('registrar_acceso_documental',{p_enlace_id:enlace.id});
   if(eRegistro)return json(req,{error:'No se pudo registrar el acceso'},503);
   if(!registrado)return json(req,{error:'Enlace caducado o revocado'},410);
   return new Response(bytes,{status:200,headers:{
    ...seguridad,
    'content-type':'application/pdf',
    'content-disposition':'attachment; filename="'+nombreDescarga(archivo.nombre)+'"',
    'content-length':String(bytes.length)
   }});
  }
  if(req.method!=='POST')return json(req,{error:'Método no permitido'},405);
  const origen=req.headers.get('origin');
  if(origen&&origen!==ORIGEN)return json(req,{error:'Origen no permitido'},403);
  const usuario=await identificacion(req,admin);
  if(!usuario)return json(req,{error:'Acceso no autorizado'},403);
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return json(req,{error:'Solicitud inválida'},400)}
  const accion=body.action;
  if(accion==='crear'){
   const archivoId=String(body.archivo_id||'');
   const dias=Number(body.dias);
   const destinatario=String(body.destinatario_previsto||'').trim().slice(0,120);
   if(!UUID.test(archivoId)||!Number.isInteger(dias)||dias<1||dias>30)
    return json(req,{error:'Selecciona un PDF y una vigencia de 1 a 30 días'},422);
   const desde=new Date(Date.now()-86400000).toISOString();
   const {count,error:eLimite}=await admin.from('enlaces_documentales')
     .select('id',{head:true,count:'exact'}).eq('creado_por',usuario.id).gte('creado_en',desde);
   if(eLimite)return json(req,{error:'No fue posible verificar el límite de enlaces'},503);
   if((count||0)>=30)return json(req,{error:'Límite diario de 30 enlaces alcanzado'},429);
   const {data:archivo,error:eArchivo}=await admin.from('correo_archivos_drive')
    .select('id,mime,tamano').eq('id',archivoId).is('eliminado_en',null).maybeSingle();
   if(eArchivo||!archivo||archivo.mime!=='application/pdf'||Number(archivo.tamano)<=0||
      Number(archivo.tamano)>MAX_PDF)return json(req,{error:'PDF no disponible para compartir'},422);
   const token=binHex(crypto.getRandomValues(new Uint8Array(32)));
   const vence=new Date(Date.now()+dias*86400000).toISOString();
   const {data:enlace,error:eCrear}=await admin.from('enlaces_documentales').insert({
    archivo_id:archivoId,token_hash:await hashHex(token),creado_por:usuario.id,
    destinatario_previsto:destinatario||null,vence_en:vence
   }).select('id,vence_en').single();
   if(eCrear||!enlace)return json(req,{error:'No se pudo crear el enlace'},503);
   return json(req,{ok:true,id:enlace.id,vence_en:enlace.vence_en,
    url:BASE+'/functions/v1/enlace-documental?token='+token});
  }
  if(accion==='listar'){
   const archivoId=String(body.archivo_id||'');
   if(!UUID.test(archivoId))return json(req,{error:'Archivo inválido'},422);
   let consulta=admin.from('enlaces_documentales')
    .select('id,destinatario_previsto,vence_en,revocado_en,accesos_total,primera_solicitud,ultima_solicitud,creado_en')
    .eq('archivo_id',archivoId).order('creado_en',{ascending:false}).limit(50);
   if(usuario.rol!=='superadmin')consulta=consulta.eq('creado_por',usuario.id);
   const {data,error}=await consulta;
   if(error)return json(req,{error:'No se pudo cargar el seguimiento'},503);
   return json(req,{ok:true,enlaces:data||[]});
  }
  if(accion==='revocar'){
   const id=String(body.enlace_id||'');
   if(!UUID.test(id))return json(req,{error:'Enlace inválido'},422);
   let consulta=admin.from('enlaces_documentales')
     .update({revocado_en:new Date().toISOString()}).eq('id',id)
     .is('revocado_en',null);
   if(usuario.rol!=='superadmin')consulta=consulta.eq('creado_por',usuario.id);
   const {data,error}=await consulta.select('id').maybeSingle();
   if(error||!data)return json(req,{error:'No se encontró un enlace activo autorizado'},404);
   return json(req,{ok:true});
  }
  return json(req,{error:'Operación no disponible'},400);
 }catch(e){
  console.error('enlace-documental:',e instanceof Error?e.name:'error');
  return json(req,{error:'No se pudo procesar la solicitud'},503);
 }
});