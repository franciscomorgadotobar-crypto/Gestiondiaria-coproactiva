import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';

// Archivos binarios en Drive; en Supabase solo la ficha, ID y permisos.
export default function DriveArchivos({ comunidadId, origenTipo = 'levantamiento', origenId, categoria = 'operaciones' }) {
 const { perfil } = useSesion();
 const [archivos, setArchivos] = useState([]);
 const [pendientes, setPendientes] = useState([]);
 const [error, setError] = useState('');
 const [ok, setOk] = useState('');
 const [guardando, setGuardando] = useState(false);
 const puedeEliminar = ['superadmin','admin','jefatura'].includes(perfil?.rol);
 const cargar = useCallback(async () => {
  if(!comunidadId || !origenId)return;
  const {data,error:err}=await supabase.from('drive_archivos_comunidad')
   .select('id,nombre,mime,tamano,creado_en')
   .eq('comunidad_id',comunidadId).eq('origen_tipo',origenTipo)
   .eq('origen_id',String(origenId)).order('creado_en',{ascending:false});
  if(err)setError(err.message);else setArchivos(data||[]);
 },[comunidadId,origenTipo,origenId]);
 useEffect(()=>{cargar();},[cargar]);
 async function subir() {
  if(!pendientes.length || guardando)return;
  setGuardando(true);setError('');setOk('');
  let uploaded=0;
  try{
   for(const f of pendientes){
    if(f.size>10*1024*1024)throw new Error('El archivo '+f.name+' supera 10 MB');
    const data=new FormData();
    data.append('action','upload');data.append('comunidad_id',comunidadId);
    data.append('categoria',categoria);data.append('origen_tipo',origenTipo);
    data.append('origen_id',String(origenId));data.append('archivo',f);
    const {data:resp,error:err}=await supabase.functions.invoke('drive-comunidad',{body:data});
    if(err)throw new Error(err.message||'No se pudo guardar en Drive');
    if(!resp?.ok)throw new Error(resp?.error||'No se pudo guardar en Drive');
    uploaded++;
   }
   setPendientes([]);setOk(uploaded+' archivo(s) guardado(s) en Google Drive.');
  }catch(e){setError((e?.message||'Error de Drive')+(uploaded?' ('+uploaded+' ya guardados)':''));}
  await cargar();setGuardando(false);
 }
 async function descargar(doc) {
  setError('');
  const {data,error:err}=await supabase.functions.invoke('drive-comunidad',{body:{
   action:'download',comunidad_id:comunidadId,documento_id:doc.id
  }});
  if(err){setError(err.message);return;}
  if(!(data instanceof Blob)){setError('No fue posible recibir el archivo.');return;}
  const url=URL.createObjectURL(data);
  const link=document.createElement('a');link.href=url;link.download=doc.nombre;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function eliminar(doc) {
  if(!window.confirm('¿Enviar "'+doc.nombre+'" a la papelera de Drive?'))return;
  setError('');
  const {data,error:err}=await supabase.functions.invoke('drive-comunidad',{body:{
   action:'delete',comunidad_id:comunidadId,documento_id:doc.id
  }});
  if(err||!data?.ok){setError(err?.message||data?.error||'Error al eliminar');return;}
  await cargar();
 }
 return <section className="tarjeta" style={{padding:16,marginTop:16}}>
  <h3 className="h4" style={{margin:'0 0 6px'}}>Archivos del levantamiento · Google Drive</h3>
  <p className="micro apagado">Los archivos se guardan en la carpeta de esta comunidad; Supabase conserva solo sus referencias.</p>
  {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
  {ok&&<p className="aviso" role="status">{ok}</p>}
  <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',margin:'12px 0'}}>
   <input type="file" multiple aria-label="Seleccionar documentos para Drive" onChange={e=>setPendientes(Array.from(e.target.files||[]))}/>
   <button type="button" className="boton" disabled={!pendientes.length||guardando} onClick={subir}>
    {guardando?'Guardando…':'Guardar en Drive'}
   </button>
  </div>
  {pendientes.length>0&&<p className="micro">{pendientes.length} archivo(s) seleccionados.</p>}
  <div style={{display:'grid',gap:8}}>
   {archivos.map(d=><div key={d.id} className="fila" style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <span className="crece">{d.nombre}</span>
    <button type="button" className="boton boton-texto" onClick={()=>descargar(d)}>Descargar</button>
    {puedeEliminar&&<button type="button" className="boton boton-texto" onClick={()=>eliminar(d)}>Eliminar</button>}
   </div>)}
   {archivos.length===0&&<span className="micro apagado">Sin documentos guardados en Drive para este levantamiento.</span>}
  </div>
 </section>;
}
