// Biblioteca corporativa privada. Drive guarda los bytes, la aplicación solo IDs internos.
// El navegador nunca recibe acceso a Google ni enlaces públicos.
import {
 admin, aPapelera, buscarCarpeta, crearCarpeta, cors, driveFetch, leerConfig, nombreSeguro,
 subirArchivo, validarArchivo, mensajeSeguro, estadoHttp, buscarPorPropiedad, obtener, esDescendiente, driveJson, DriveError
} from '../_compartido/google-drive.ts';
import { navegarCarpetas, agregarCarpeta, carpetaAutorizada, raizComercial } from '../_compartido/drive-correo.ts';

const MAX=8*1024*1024;
const PERSONAL=new Set(['superadmin','admin','jefatura']);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const DB='correo_archivos_drive';
const allowed=new Set(['pdf','jpg','jpeg','png','webp','doc','docx','xls','xlsx','ppt','pptx','txt','csv']);
const headers=(req:Request)=>({...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
const json=(req:Request,obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:headers(req)});

// La etapa siempre se lee desde el CRM; el cliente no elige el destino.
const ETAPAS_CRM:Record<string,string>={
 nuevo:'01 Nuevo',contacto:'02 Contacto',diagnostico:'03 Diagnóstico',
 propuesta:'04 Propuesta',negociacion:'05 Negociación',ganado:'06 Ganado',perdido:'07 Perdido'
};
type Db=ReturnType<typeof admin>;
async function mover(db:Db,id:string,padres:string[],destino:string,nombre?:string){
 const remover=padres.filter(p=>p!==destino);
 const params=new URLSearchParams({supportsAllDrives:'true',fields:'id,name,parents,appProperties'});
 if(!padres.includes(destino))params.set('addParents',destino);
 if(remover.length)params.set('removeParents',remover.join(','));
 return driveJson(db,'/drive/v3/files/'+encodeURIComponent(id)+'?'+params,{
  method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(nombre?{name:nombre}:{})
 });
}
async function leerProspecto(db:Db,id:string){
 const {data,error}=await db.from('prospectos').select('id,nombre_condominio,etapa').eq('id',id).maybeSingle();
 if(error)throw error;
 if(!data)throw new DriveError(404,'Prospecto no encontrado');
 if(!ETAPAS_CRM[data.etapa])throw new DriveError(422,'Etapa comercial no reconocida');
 return data;
}
async function sincronizarCarpetaProspecto(db:Db,id:string){
 if(!UUID.test(id))throw new DriveError(400,'Prospecto inválido');
 let p=await leerProspecto(db,id);
 const {data:propuestas,error}=await db.from('propuestas_comerciales').select('id,datos').eq('prospecto_id',id);
 if(error)throw error;
 // Identidad estable por UUID; no se busca ni se reasigna por nombre.
 let carpeta=await buscarPorPropiedad(db,'coproactiva_prospecto_id',id);
 if(!carpeta&&!propuestas?.length)return {carpeta:null,etapa:p.etapa};
 const raiz=await raizComercial(db);
 const embudo=await buscarCarpeta(db,raiz.id,'Pipeline comercial') ??
  await crearCarpeta(db,raiz.id,'Pipeline comercial',{coproactiva_tipo:'pipeline_comercial'});
 if(carpeta&&!(await esDescendiente(db,carpeta.id,embudo.id,12)))
  throw new DriveError(409,'La carpeta del prospecto está fuera del Pipeline comercial. Revisa su ubicación en Drive.');
 for(let intento=0;intento<3;intento++){
  p=await leerProspecto(db,id);
  const etiqueta=ETAPAS_CRM[p.etapa];
  const etapa=await buscarCarpeta(db,embudo.id,etiqueta) ??
   await crearCarpeta(db,embudo.id,etiqueta,{coproactiva_tipo:'etapa_crm',coproactiva_etapa:p.etapa});
  const nombre=nombreSeguro(p.nombre_condominio,'Prospecto')+' · '+id.slice(0,8);
  if(!carpeta){
   carpeta=await buscarPorPropiedad(db,'coproactiva_prospecto_id',id) ??
    await crearCarpeta(db,etapa.id,nombre,{coproactiva_tipo:'prospecto_crm',coproactiva_prospecto_id:id});
  }
  if(!(await esDescendiente(db,carpeta.id,embudo.id,12)))
   throw new DriveError(409,'La carpeta no pertenece al Pipeline comercial');
  if(!carpeta.parents?.includes(etapa.id)||carpeta.name!==nombre)
   carpeta=await mover(db,carpeta.id,carpeta.parents||[],etapa.id,nombre);
  // Recupera PDFs anteriores vinculados al prospecto que quedaron en la raíz.
  // Nunca mueve archivos de otro prospecto o una carpeta elegida manualmente.
  for(const propuesta of propuestas||[]){
   const archivoId=String(propuesta.datos?.pdfArchivado?.id||'');
   if(!UUID.test(archivoId))continue;
   const {data:a,error:e}=await db.from(DB).select('id,drive_file_id,carpeta_drive_id,categoria,mime')
    .eq('id',archivoId).is('eliminado_en',null).maybeSingle();
   if(e)throw e;
   if(!a||a.mime!=='application/pdf'||a.categoria!=='Propuestas comerciales'||!a.drive_file_id)continue;
   const meta=await obtener(db,a.drive_file_id);
   if(!meta||meta.trashed)continue;
   if(meta.parents?.includes(raiz.id)&&a.carpeta_drive_id===raiz.id)
    await mover(db,a.drive_file_id,meta.parents,carpeta.id);
   else if(!meta.parents?.includes(carpeta.id))continue;
   if(a.carpeta_drive_id!==carpeta.id){
    const {error:actualizar}=await db.from(DB).update({carpeta_drive_id:carpeta.id}).eq('id',a.id);
    if(actualizar)throw actualizar;
   }
  }
  // Reconciliar si otra sesión cambió la etapa durante el movimiento.
  const vigente=await leerProspecto(db,id);
  if(vigente.etapa===p.etapa&&vigente.nombre_condominio===p.nombre_condominio)
   return {carpeta:{id:carpeta.id,name:carpeta.name},etapa:p.etapa,etiqueta};
 }
 throw new DriveError(409,'El prospecto cambió durante la sincronización. Reintenta.');
}

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
  if(accion==='carpetas'){
   const padre=String(get('carpeta_id')||'');
   const data=await navegarCarpetas(db,padre||undefined);
   return json(req,{ok:true,...data});
  }
  if(accion==='crear_carpeta'){
   const padre=String(get('carpeta_id')||'');
   const nombre=String(get('nombre')||'');
   const carpeta=await agregarCarpeta(db,padre,nombre);
   return json(req,{ok:true,carpeta});
  }
  if(accion==='sincronizar_prospecto'){
   const resultado=await sincronizarCarpetaProspecto(db,String(get('prospecto_id')||''));
   return json(req,{ok:true,...resultado});
  }
  if(accion==='upload'){
   const archivo=get('archivo');
   if(!(archivo instanceof File))return json(req,{error:'Selecciona un archivo'},400);
   if(archivo.size>MAX)return json(req,{error:'Máximo 8 MB por archivo'},413);
   const bytes=new Uint8Array(await archivo.arrayBuffer());
   const ext=(archivo.name.match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase();
   if(!allowed.has(ext))return json(req,{error:'Tipo de archivo no admitido en correos'},415);
   const check=validarArchivo(archivo.name,bytes);
   // Las versiones del Gestor Documental son PDF en Drive, sin bytes en Supabase.
   const documentoId=String(get('documento_id')||'').trim();
   const version=Number(get('version_documento')||0);
   if(documentoId){
    if(!UUID.test(documentoId)||!Number.isInteger(version)||version<1)
      return json(req,{error:'Documento o versión inválidos'},400);
    const {data:documento}=await db.from('documentos_gestion')
      .select('id,version').eq('id',documentoId).maybeSingle();
    if(!documento||documento.version!==version)
      return json(req,{error:'La versión ya no es la última del documento'},409);
    const {data:existente}=await db.from(DB).select('id,nombre,mime,tamano,categoria,creado_en')
      .eq('documento_id',documentoId).eq('version_documento',version)
      .is('eliminado_en',null).maybeSingle();
    if(existente)return json(req,{ok:true,archivo:existente,repetido:true});
   }
   const carpetaSolicitada=String(get('carpeta_id')||'').trim();
   let repo;
   const propuestaId=String(get('propuesta_id')||'').trim();
   if(propuestaId){
    if(!UUID.test(propuestaId)||documentoId||check.mime!=='application/pdf')
     return json(req,{error:'Propuesta o PDF inválido'},400);
    const {data:propuesta,error:e}=await db.from('propuestas_comerciales').select('id,prospecto_id').eq('id',propuestaId).maybeSingle();
    if(e)throw e;
    if(!propuesta)return json(req,{error:'Propuesta no encontrada'},404);
    if(propuesta.prospecto_id){
     const destino=await sincronizarCarpetaProspecto(db,propuesta.prospecto_id);
     if(!destino.carpeta)throw new DriveError(409,'No se pudo localizar la carpeta del prospecto');
     repo=destino.carpeta;
    }else repo=await raizComercial(db);
   }
   else if(carpetaSolicitada)repo=await carpetaAutorizada(db,carpetaSolicitada);
   else {
    const raiz=await raizComercial(db);
    repo=await buscarCarpeta(db,raiz.id,'Adjuntos CRM') ??
      await crearCarpeta(db,raiz.id,'Adjuntos CRM',{coproactiva_tipo:'adjuntos_crm'});
   }
   const nombre=nombreSeguro(check.nombre);
   const subido=await subirArchivo(db,{bytes,nombre,mime:check.mime,padre:repo.id,
    props:{coproactiva:'1',modulo:propuestaId?'propuesta_comercial':documentoId?'gestor_documental':'correo_crm',...(propuestaId?{coproactiva_propuesta_id:propuestaId}:{})}});
   const categoria=String(get('categoria')||'General').slice(0,70);
   const {data,error}=await db.from(DB).insert({
    drive_file_id:subido.id,nombre,mime:check.mime,tamano:bytes.length,
    categoria,subido_por:user.id,
    documento_id:documentoId||null,
    version_documento:documentoId?version:null,
    carpeta_drive_id:repo.id
   }).select('id,nombre,mime,tamano,categoria,creado_en').single();
   if(error){
    await aPapelera(db,subido.id).catch(()=>{});
    if(documentoId&&error.code==='23505'){
     const {data:existente}=await db.from(DB).select('id,nombre,mime,tamano,categoria,creado_en')
      .eq('documento_id',documentoId).eq('version_documento',version)
      .is('eliminado_en',null).maybeSingle();
     if(existente)return json(req,{ok:true,archivo:existente,repetido:true});
    }
    throw error;
   }
   return json(req,{ok:true,archivo:data});
  }
  if(accion==='descargar'){
   const id=String(get('id')||'');
   if(!UUID.test(id))return json(req,{error:'ID inválido'},400);
   const {data:archivo,error}=await db.from(DB).select('drive_file_id,nombre,mime,tamano')
    .eq('id',id).is('eliminado_en',null).maybeSingle();
   if(error)throw error;
   if(!archivo||archivo.mime!=='application/pdf'||!archivo.drive_file_id||
      Number(archivo.tamano)<=0||Number(archivo.tamano)>MAX)
    return json(req,{error:'PDF no disponible'},404);
   const respuesta=await driveFetch(db,'/drive/v3/files/'+encodeURIComponent(archivo.drive_file_id)+'?alt=media&supportsAllDrives=true');
   if(!respuesta.ok)return json(req,{error:'No se pudo obtener el PDF'},502);
   const bytes=new Uint8Array(await respuesta.arrayBuffer());
   if(bytes.length!==Number(archivo.tamano)||bytes.length>MAX||
      new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')
    return json(req,{error:'PDF inválido'},502);
   return new Response(bytes,{headers:{...cors(req),'content-type':'application/pdf',
    'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
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
