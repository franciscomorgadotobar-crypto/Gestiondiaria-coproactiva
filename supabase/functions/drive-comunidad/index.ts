// Drive corporativo: cuatro carpetas raíz por comunidad. Credenciales SOLO en secretos Edge.
// Requiere GOOGLE_SERVICE_ACCOUNT_JSON y GOOGLE_DRIVE_ROOT_ID (ideal: unidad compartida).
import { createClient } from 'npm:@supabase/supabase-js@2';
const CATS={administracion:'01 Administración',finanzas:'02 Finanzas',operaciones:'03 Operaciones',seguimiento:'04 Seguimiento e informes'} as const;
const TIPOS={levantamiento:'Levantamientos',mantencion:'Mantenciones',incidencia:'Incidencias',compromiso:'Compromisos',informe:'Informes',general:'Documentos'} as const;
type Categoria=keyof typeof CATS;
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const enc=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const encText=(v:string)=>enc(new TextEncoder().encode(v));
async function accessToken(){
 const raw=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
 if(!raw)throw new Error('Google Drive no configurado: falta cuenta de servicio');
 const account=JSON.parse(raw);
 if(!account.client_email||!account.private_key)throw new Error('Credencial Google incompleta');
 const pkcs8=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,'')),x=>x.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',pkcs8,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000);
 const unsigned=encText(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+encText(JSON.stringify({
  iss:account.client_email,scope:'https://www.googleapis.com/auth/drive',
  aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500
 }));
 const signature=enc(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))));
 const resp=await fetch('https://oauth2.googleapis.com/token',{method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})});
 const data=await resp.json();if(!resp.ok)throw new Error('Google OAuth: '+(data.error||resp.status));
 return data.access_token as string;
}
async function drive(path:string,token:string,init:RequestInit={}){
 const res=await fetch('https://www.googleapis.com'+path,{...init,headers:{authorization:'Bearer '+token,...(init.headers||{})}});
 if(!res.ok){const detail=(await res.text()).slice(0,240);throw new Error('Drive HTTP '+res.status+': '+detail);}
 return res;
}
async function folder(parent:string,name:string,token:string){
 const query=`'${parent.replace(/'/g,"\\'")}' in parents and name = '${name.replace(/'/g,"\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
 const params=new URLSearchParams({q:query,fields:'files(id,name),nextPageToken',pageSize:'20',includeItemsFromAllDrives:'true',supportsAllDrives:'true'});
 const existing=await (await drive('/drive/v3/files?'+params,token)).json();
 if(existing.files?.length)return existing.files[0].id as string;
 const created=await (await drive('/drive/v3/files?supportsAllDrives=true&fields=id',token,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent]})
 })).json();
 return created.id as string;
}
async function subir(file:File,parent:string,token:string){
 const boundary='copro_'+crypto.randomUUID().replace(/-/g,'');
 const metadata={name:file.name.slice(0,220),mimeType:file.type||'application/octet-stream',parents:[parent]};
 const prefix=new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`);
 const suffix=new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const body=new Uint8Array(prefix.length+bytes.length+suffix.length);
 body.set(prefix);body.set(bytes,prefix.length);body.set(suffix,prefix.length+bytes.length);
 const response=await drive('/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size',token,{
  method:'POST',headers:{'content-type':'multipart/related; boundary='+boundary},body
 });
 return await response.json();
}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({ok:false,error:'Método no permitido'},405);
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!jwt||!url||!secret)return json({ok:false,error:'No autorizado'},401);
 const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await sb.auth.getUser(jwt);
 if(authErr||!user)return json({ok:false,error:'Sesión inválida'},401);
 const {data:profile}=await sb.from('perfiles').select('rol,activo').eq('id',user.id).single();
 if(!profile?.activo||!['admin','superadmin','jefatura','terreno'].includes(profile.rol))
  return json({ok:false,error:'Perfil no autorizado'},403);
 try{
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data');
  const input=multipart?await req.formData():await req.json();
  const get=(key:string)=>multipart?input.get(key):input[key];
  const action=String(get('action')||'');
  const cid=String(get('comunidad_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(cid))return json({ok:false,error:'Comunidad inválida'},400);
  const {data:comunidad}=await sb.from('comunidades').select('id,nombre,carpeta_drive_id').eq('id',cid).single();
  if(!comunidad)return json({ok:false,error:'Comunidad no encontrada'},404);
  if(profile.rol==='terreno'){
   if(!['upload','download'].includes(action))return json({ok:false,error:'Acción no autorizada'},403);
   let controlId=String(get('origen_id')||'');
   if(action==='download'){
    const {data:doc}=await sb.from('drive_archivos_comunidad').select('origen_id,origen_tipo').eq('id',String(get('documento_id')||'')).eq('comunidad_id',cid).single();
    if(doc?.origen_tipo!=='levantamiento')return json({ok:false,error:'Sin acceso al documento'},403);
    controlId=doc.origen_id||'';
   }else if(String(get('origen_tipo'))!=='levantamiento')return json({ok:false,error:'Solo documentos de levantamientos asignados'},403);
   const {data:assigned}=await sb.from('controles').select('id').eq('id',controlId).eq('comunidad_id',cid).eq('responsable_id',user.id).maybeSingle();
   if(!assigned)return json({ok:false,error:'Levantamiento no asignado'},403);
  }
  if(!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')||!Deno.env.get('GOOGLE_DRIVE_ROOT_ID'))
   return json({ok:false,pendiente:true,error:'Drive pendiente de configurar: credenciales y carpeta raíz'},503);
  const token=await accessToken();
  async function provision(){
   const parent=Deno.env.get('GOOGLE_DRIVE_ROOT_ID')!;
   const fid=comunidad.carpeta_drive_id||await folder(parent,comunidad.nombre+' · '+cid.slice(0,8),token);
   const folders:Record<string,string>={};
   for(const [key,name] of Object.entries(CATS))folders[key]=await folder(fid,name,token);
   const {error:e1}=await sb.from('comunidades').update({carpeta_drive_id:fid}).eq('id',cid);
   if(e1)throw e1;
   const {error:e2}=await sb.from('drive_carpetas_comunidad').upsert({comunidad_id:cid,estado:'lista',carpetas:folders,ultimo_error:null,editado_en:new Date().toISOString()});
   if(e2)throw e2;
   return {fid,folders};
  }
  if(action==='provision'){
   const result=await provision();
   return json({ok:true,carpeta_id:result.fid,carpetas:result.folders});
  }
  if(action==='upload'){
   const file=get('archivo');
   if(!(file instanceof File))return json({ok:false,error:'Adjunta un archivo'},400);
   if(file.size>10*1024*1024||file.size===0)return json({ok:false,error:'Archivo máximo 10 MB'},413);
   const categoria=String(get('categoria')||'operaciones') as Categoria;
   const origen=String(get('origen_tipo')||'general') as keyof typeof TIPOS;
   const origenId=String(get('origen_id')||'');
   if(!(categoria in CATS)||!(origen in TIPOS))return json({ok:false,error:'Categoría inválida'},400);
   if(origen==='levantamiento'){
    const {data:control}=await sb.from('controles').select('id').eq('id',origenId).eq('comunidad_id',cid).maybeSingle();
    if(!control)return json({ok:false,error:'Levantamiento no pertenece a esta comunidad'},403);
   }
   const {folders}=await provision();
   const intermediate=await folder(folders[categoria],TIPOS[origen],token);
   const target=origenId?await folder(intermediate,origen+'-'+origenId.slice(0,36),token):intermediate;
   const saved=await subir(file,target,token);
   const {data:doc,error:e}=await sb.from('drive_archivos_comunidad').insert({
    comunidad_id:cid,categoria,origen_tipo:origen,origen_id:origenId||null,
    drive_file_id:saved.id,nombre:file.name,mime:file.type||null,tamano:file.size,
    registrado_por:user.id,visible_cliente:false
   }).select('id,nombre,categoria,origen_tipo,creado_en').single();
   if(e)throw e;
   return json({ok:true,documento:doc});
  }
  if(action==='delete'){
   const docId=String(get('documento_id')||'');
   const {data:doc}=await sb.from('drive_archivos_comunidad').select('id,drive_file_id').eq('id',docId).eq('comunidad_id',cid).single();
   if(!doc)return json({ok:false,error:'Archivo no encontrado'},404);
   await drive('/drive/v3/files/'+encodeURIComponent(doc.drive_file_id)+'?supportsAllDrives=true',token,{
    method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({trashed:true})
   });
   const {error:e}=await sb.from('drive_archivos_comunidad').delete().eq('id',docId);if(e)throw e;
   return json({ok:true});
  }
  if(action==='download'){
   const docId=String(get('documento_id')||'');
   const {data:doc}=await sb.from('drive_archivos_comunidad').select('drive_file_id,nombre,mime').eq('id',docId).eq('comunidad_id',cid).single();
   if(!doc)return json({ok:false,error:'Archivo no encontrado'},404);
   const google=await drive('/drive/v3/files/'+encodeURIComponent(doc.drive_file_id)+'?alt=media&supportsAllDrives=true',token);
   return new Response(google.body,{headers:{'content-type':doc.mime||'application/octet-stream',
    'content-disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(doc.nombre),'cache-control':'no-store'}});
  }
  return json({ok:false,error:'Acción inválida'},400);
 }catch(e){
  console.error('Drive operation failed',e instanceof Error?e.message:'unknown');
  return json({ok:false,error:'No se pudo completar la operación con Drive. Revisa conexión y permisos.'},502);
 }
});
