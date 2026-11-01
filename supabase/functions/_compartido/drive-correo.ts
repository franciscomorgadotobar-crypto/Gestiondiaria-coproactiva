// Carpetas de documentos comerciales usadas por los compositores de correo.
// No se exponen tokens, IDs de origen ni carpetas fuera de esta raíz.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.48.1';
import {
  buscarCarpeta, crearCarpeta, leerConfig, esDescendiente, obtener, listarCarpetas,
  DriveError, driveJson, sha256Hex, CARPETA
} from './google-drive.ts';

export async function raizComercial(db:SupabaseClient) {
  const config=await leerConfig(db);
  const raiz=await buscarCarpeta(db,config.raiz_id,'Documentos comerciales') ??
    await crearCarpeta(db,config.raiz_id,'Documentos comerciales',{coproactiva_tipo:'comercial'});
  return {id:raiz.id,name:raiz.name};
}

export async function carpetaAutorizada(db:SupabaseClient,id:string) {
  const raiz=await raizComercial(db);
  const destino=String(id||'');
  if(!/^[A-Za-z0-9_-]{8,200}$/.test(destino))throw new DriveError(400,'Selecciona una carpeta válida');
  if(destino!==raiz.id && !(await esDescendiente(db,destino,raiz.id,12)))
    throw new DriveError(403,'Esta carpeta no pertenece a Documentos comerciales');
  const metadatos=await obtener(db,destino);
  if(!metadatos || metadatos.trashed || metadatos.mimeType!==CARPETA)
    throw new DriveError(404,'La carpeta ya no está disponible');
  return {id:metadatos.id,name:metadatos.name,raiz};
}

export async function navegarCarpetas(db:SupabaseClient,padreId?:string) {
  const raiz=await raizComercial(db);
  const padre=padreId?await carpetaAutorizada(db,padreId):{...raiz,raiz};
  const carpetas=await listarCarpetas(db,padre.id);
  return {raiz,carpeta:{id:padre.id,name:padre.name},carpetas};
}

export async function agregarCarpeta(db:SupabaseClient,padreId:string,nombreEntrada:string) {
  const padre=await carpetaAutorizada(db,padreId);
  const nombre=nombreEntrada.trim();
  if(!nombre || nombre.length>64 || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(nombre))
    throw new DriveError(400,'Usa un nombre de carpeta de hasta 64 caracteres, con letras y números');
  const previa=await buscarCarpeta(db,padre.id,nombre);
  if(previa)throw new DriveError(409,'Ya existe una carpeta con ese nombre');
  const carpeta=await crearCarpeta(db,padre.id,nombre,{coproactiva_tipo:'comercial_correo'});
  return {id:carpeta.id,name:carpeta.name};
}

type DocumentoCorreo={ref:string;drive_file_id:string;nombre:string};

export async function guardarAdjuntosEnCarpeta(
  db:SupabaseClient,
  args:{carpetaId:string;operacionId:string;usuarioId:string;archivos:DocumentoCorreo[]}
) {
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(args.operacionId))
    throw new DriveError(422,'Identificador del guardado inválido');
  const carpeta=await carpetaAutorizada(db,args.carpetaId);
  const guardados:{ref:string;nombre:string;drive_file_id:string;existente:boolean}[]=[];
  for(const archivo of args.archivos){
    // Idempotencia: al reintentar un envío no duplicamos copias ya guardadas.
    const hash=await sha256Hex(args.usuarioId+':'+args.operacionId+':'+archivo.ref+':'+carpeta.id);
    const q=new URLSearchParams({
      q:`'${carpeta.id}' in parents and appProperties has { key='coproactiva_guardado' and value='${hash}' } and trashed = false`,
      fields:'files(id,name)',pageSize:'1',supportsAllDrives:'true',includeItemsFromAllDrives:'true'
    });
    const existente=await driveJson(db,'/drive/v3/files?'+q);
    if(existente.files?.[0]){
      guardados.push({ref:archivo.ref,nombre:archivo.nombre,drive_file_id:existente.files[0].id,existente:true});
      continue;
    }
    const original=await obtener(db,archivo.drive_file_id);
    if(!original || original.trashed)throw new DriveError(404,'El documento original ya no está disponible');
    if(original.parents?.includes(carpeta.id)){
      guardados.push({ref:archivo.ref,nombre:archivo.nombre,drive_file_id:archivo.drive_file_id,existente:true});
      continue;
    }
    const copia=await driveJson(db,'/drive/v3/files/'+encodeURIComponent(archivo.drive_file_id)+
      '/copy?supportsAllDrives=true&fields=id,name',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          name:archivo.nombre,
          parents:[carpeta.id],
          appProperties:{coproactiva:'1',coproactiva_guardado:hash}
        })
      });
    if(!copia.id)throw new DriveError(503,'Drive no confirmó el guardado del documento');
    guardados.push({ref:archivo.ref,nombre:archivo.nombre,drive_file_id:copia.id,existente:false});
  }
  return {carpeta_id:carpeta.id,carpeta_nombre:carpeta.name,archivos:guardados};
}
