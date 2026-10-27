// Biblioteca corporativa privada. Drive guarda los bytes, la aplicación solo IDs internos.
// El navegador nunca recibe acceso a Google ni enlaces públicos.
import {
 admin, aPapelera, buscarCarpeta, crearCarpeta, cors, leerConfig, nombreSeguro,
 subirArchivo, validarArchivo, mensajeSeguro, estadoHttp
} from '../_compartido/google-drive.ts';

const MAX=8*1024*1024;
const PERSONAL=new Set(['superadmin','admin','jefatura']);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const DB='correo_archivos_drive';
const allowed=new Set(['pdf','jpg','jpeg','png','webp','doc','docx','xls','xlsx','ppt','pptx','txt','csv']);
const headers=(req:Request)=>({...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
const json=(req:Request,obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:headers(req)});

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return json(req,{error:'Método no permitido'},405);
 const db=admin();
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!jwt)return json(req,{error:'Sesión requerida'},401);
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user)return json(req,{error:'Sesión inválida'},401);
 const {data:perfil}=await db.from('perfiles').select('rol,activo').eq('id',user.id).maybeSingle();
 if(!perfil?.activo||!PERSONAL.has(perfil.rol))return json(req,{error:'Acceso no autorizado'},403);
 try {
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data');
  const form= multipart?await req.formData():await req.json().catch(()=>({}));
  const get=(k:string):unknown => multipart?(form as FormData).get(k):(form as Record<string,unknown>)[k];
  const accion=String(get('action')||'');
  if(accion==='list'){
   const {data,error}=await db.from(DB).select('id,nombre,mime,tamano,categoria,creado_en')
     .is('eliminado_en',null).order('creado_en',{ascending:false}).limit(250);
   if(error)throw error;
   return json(req,{ok:true,archivos:data||[]});
  }
  if(accion==='upload'){
   const archivo=get('archivo');
   if(!(archivo instanceof File))return json(req,{error:'Selecciona un archivo'},400);
   if(archivo.size>MAX)return json(req,{error:'Máximo 8 MB por archivo'},413);
   const bytes=new Uint8Array(await archivo.arrayBuffer());
   const ext=(archivo.name.match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase();
   if(!allowed.has(ext))return json(req,{error:'Tipo de archivo no admitido en correos'},415);
   const check=validarArchivo(archivo.name,bytes);
   const cfg=await leerConfig(db);
   let carpeta=await buscarCarpeta(db,cfg.raiz_id,'Documentos comerciales');
   if(!carpeta)carpeta=await crearCarpeta(db,cfg.raiz_id,'Documentos comerciales',{coproactiva_tipo:'comercial'});
   let repo=await buscarCarpeta(db,carpeta.id,'Adjuntos CRM');
   if(!repo)repo=await crearCarpeta(db,carpeta.id,'Adjuntos CRM',{coproactiva_tipo:'adjuntos_crm'});
   const nombre=nombreSeguro(check.nombre);
   const subido=await subirArchivo(db,{bytes,nombre,mime:check.mime,padre:repo.id,props:{coproactiva:'1',modulo:'correo_crm'}});
   const categoria=String(get('categoria')||'General').slice(0,70);
   const {data,error}=await db.from(DB).insert({
    drive_file_id:subido.id,nombre,mime:check.mime,tamano:bytes.length,
    categoria,subido_por:user.id
   }).select('id,nombre,mime,tamano,categoria,creado_en').single();
   if(error){await aPapelera(db,subido.id).catch(()=>{});throw error;}
   return json(req,{ok:true,archivo:data});
  }
  if(accion==='delete'){
   const id=String(get('id')||'');
   if(!UUID.test(id))return json(req,{error:'ID inválido'},400);
   const {data}=await db.from(DB).select('drive_file_id').eq('id',id).is('eliminado_en',null).maybeSingle();
   if(!data)return json(req,{error:'Archivo no encontrado'},404);
   // Retirar de la biblioteca; envíos históricos preservan los metadatos.
   await aPapelera(db,data.drive_file_id);
   const {error}=await db.from(DB).update({eliminado_en:new Date().toISOString()}).eq('id',id);
   if(error)throw error;
   return json(req,{ok:true});
  }
  return json(req,{error:'Operación no reconocida'},400);
 }catch(e){
  console.error('correo-archivos:',e instanceof Error?e.name:'error');
  return json(req,{error:mensajeSeguro(e)||'No se pudo operar en Drive'},estadoHttp(e)||503);
 }
});
