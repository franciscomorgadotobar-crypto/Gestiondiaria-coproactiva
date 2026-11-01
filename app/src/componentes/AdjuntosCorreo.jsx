import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import SelectorCarpetaDrive from './SelectorCarpetaDrive';
import './AdjuntosCorreo.css';

const MAX_BYTES=8*1024*1024;
const MAX_ARCHIVOS=3;
const ACCEPT='.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const permitidos=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
const textoTamano=b=>(Number(b)/1048576).toFixed(2).replace('.',',')+' MB';

/* Selector de archivos físicos para correo. Los bytes se transmiten solo desde
 * Drive al SMTP en la Edge Function; aquí se manejan únicamente IDs internos. */
export default function AdjuntosCorreo({seleccion=[],onChange,guardadosDrive={},onGuardarChange=()=>{},usuarioId=''}){
 const [biblioteca,setBiblioteca]=useState([]);
 const [comunidades,setComunidades]=useState([]);
 const [origen,setOrigen]=useState('biblioteca');
 const [filtro,setFiltro]=useState('');
 const [categoria,setCategoria]=useState('General');
 const [error,setError]=useState('');
 const [aviso,setAviso]=useState('');
 const [ocupado,setOcupado]=useState(false);
 const [cargando,setCargando]=useState(true);
 const [seleccionandoCarpeta,setSeleccionandoCarpeta]=useState(null);
 const cargar=async()=>{
  setCargando(true);
  const [b,c]=await Promise.all([
   supabase.functions.invoke('correo-archivos',{body:{action:'list'}}),
   supabase.from('drive_archivos_comunidad')
    .select('id,nombre,mime,tamano,comunidad_id,creado_en')
    .is('eliminado_en',null).order('creado_en',{ascending:false}).limit(150)
  ]);
  if(b.error||!b.data?.ok)setError(b.data?.error||b.error?.message||'No se pudo abrir la biblioteca.');
  else setBiblioteca(b.data.archivos||[]);
  if(!c.error)setComunidades(c.data||[]);
  setCargando(false);
 };
 useEffect(()=>{let activo=true;
  const run=async()=>{try{await cargar();}catch(e){if(activo)setError(e.message);}};
  run();return()=>{activo=false;};
 },[]);
 const opciones=useMemo(()=>{
   const todos=origen==='biblioteca'?biblioteca.map(f=>({...f,ref:'b:'+f.id})):
    comunidades.map(f=>({...f,ref:'c:'+f.id,categoria:'Documento de comunidad'}));
   return todos.filter(f=>f.nombre.toLocaleLowerCase('es-CL').includes(filtro.toLocaleLowerCase('es-CL')));
 },[biblioteca,comunidades,origen,filtro]);
 const mapa=useMemo(()=>new Map([
   ...biblioteca.map(f=>['b:'+f.id,f]),
   ...comunidades.map(f=>['c:'+f.id,f])
 ]),[biblioteca,comunidades]);
 const tamanoTotal=seleccion.reduce((n,ref)=>n+Number(mapa.get(ref)?.tamano||0),0);
 function alternar(ref){
   setError('');
   if(seleccion.includes(ref)){
    const restantes=seleccion.filter(x=>x!==ref);
    if(guardadosDrive[ref]){
     const siguiente={...guardadosDrive};
     delete siguiente[ref];
     onGuardarChange(siguiente);
    }
    if(seleccionandoCarpeta===ref)setSeleccionandoCarpeta(null);
    return onChange(restantes);
   }
   const documento=mapa.get(ref);
   if(!documento)return setError('Archivo no disponible, actualiza la biblioteca.');
   if(!permitidos.has(documento.mime))return setError('Este formato no puede enviarse como adjunto.');
   if(seleccion.length>=MAX_ARCHIVOS)return setError('Máximo tres archivos por correo.');
   if(tamanoTotal+Number(documento.tamano)>MAX_BYTES)return setError('Los archivos juntos no deben superar 8 MB.');
   onChange([...seleccion,ref]);
 }
 async function subir(event){
   const files=Array.from(event.target.files||[]);
   event.target.value='';
   if(!files.length)return;
   setOcupado(true);setError('');setAviso('');
   let count=0,seleccionados=[...seleccion],total=tamanoTotal;
   for(const archivo of files){
    if(seleccionados.length>=MAX_ARCHIVOS||total+archivo.size>MAX_BYTES){
     setError('Máximo tres archivos, 8 MB entre todos. Los demás no se subieron.');break;
    }
    if(!archivo.size||!archivo.name.match(/\.(pdf|jpe?g|png|webp|docx?|xlsx?|pptx?|txt|csv)$/i)){
     setError('Formato no admitido o archivo vacío: '+archivo.name);continue;
    }
    const fd=new FormData();
    fd.append('action','upload');fd.append('categoria',categoria);fd.append('archivo',archivo,archivo.name);
    try {
     const {data,error}=await supabase.functions.invoke('correo-archivos',{body:fd});
     if(error||!data?.ok)throw new Error(data?.error||error?.message||'Error al guardar');
     count++;total+=archivo.size;
     seleccionados.push('b:'+data.archivo.id);
     setBiblioteca(prev=>[data.archivo,...prev]);
    }catch(e){setError(archivo.name+': '+e.message);}
   }
   onChange(seleccionados);
   if(count)setAviso(count===1?'Archivo incorporado a la biblioteca y adjuntado.':count+' archivos incorporados a la biblioteca y adjuntados.');
   setOcupado(false);
 }
 return <section className="correo-adjuntos" aria-label="Adjuntos del correo">
  <div className="correo-adjuntos-cabecera">
   <strong>Adjuntos reales</strong>
   <span className="micro apagado">{seleccion.length}/{MAX_ARCHIVOS} · {textoTamano(tamanoTotal)} / 8 MB</span>
  </div>
  <p className="micro apagado">Los documentos se enviarán dentro del correo, no como enlaces de Drive.</p>
  <div className="correo-adjuntos-acciones">
   <label className="campo">Categoría en biblioteca
    <select value={categoria} onChange={e=>setCategoria(e.target.value)}>
     {['General','Comercial','Presentaciones','Propuestas','Contratos','Informes','Otros'].map(x=><option key={x}>{x}</option>)}
    </select>
   </label>
   <label className="correo-adjuntos-cargar">
    {ocupado?'Subiendo…':'Adjuntar desde teléfono o computador'}
    <input type="file" multiple accept={ACCEPT} disabled={ocupado} onChange={subir}/>
   </label>
  </div>
  <div className="correo-adjuntos-origen" role="group" aria-label="Origen de los adjuntos">
   <button type="button" className={origen==='biblioteca'?'activo':''} aria-pressed={origen==='biblioteca'} onClick={()=>setOrigen('biblioteca')}>Biblioteca interna</button>
   <button type="button" className={origen==='comunidad'?'activo':''} aria-pressed={origen==='comunidad'} onClick={()=>setOrigen('comunidad')}>Documentos de comunidades</button>
  </div>
  <input aria-label="Buscar adjuntos" type="search" placeholder="Buscar por nombre…" value={filtro} onChange={e=>setFiltro(e.target.value)}/>
  {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
  {aviso&&<p className="aviso" role="status">{aviso}</p>}
  {cargando?<p className="micro apagado">Cargando biblioteca…</p>
  :<div className="correo-adjuntos-lista">
   {opciones.slice(0,70).map(doc=><label key={doc.ref} className="correo-adjuntos-doc">
    <input type="checkbox" checked={seleccion.includes(doc.ref)} onChange={()=>alternar(doc.ref)}/>
    <span className="correo-adjuntos-nombre">{doc.nombre}</span>
    <span className="micro apagado">{textoTamano(doc.tamano)}</span>
   </label>)}
   {!opciones.length&&<p className="micro apagado">No hay documentos disponibles. Puedes subirlos desde el teléfono.</p>}
  </div>}
  {!!seleccion.length&&<div className="correo-adjuntos-resumen">
   <strong>Documentos seleccionados ({seleccion.length})</strong>
   <p className="micro apagado">Cada documento puede enviarse como adjunto y, opcionalmente, guardarse en una carpeta diferente de Google Drive.</p>
   {seleccion.map(ref=><article className="correo-adjuntos-tarjeta" key={ref}>
    <div className="correo-adjuntos-doc">
     <span className="correo-adjuntos-nombre"><strong>{mapa.get(ref)?.nombre||'Archivo no disponible'}</strong></span>
     <span className="micro apagado">{textoTamano(mapa.get(ref)?.tamano||0)}</span>
     <button type="button" className="boton boton-texto" onClick={()=>alternar(ref)}>Quitar</button>
    </div>
    <div className="correo-guardar-drive">
     <label className="correo-guardar-drive-check">
      <input type="checkbox" checked={Boolean(guardadosDrive[ref]?.carpeta_id)}
       aria-label={'Guardar copia permanente de '+(mapa.get(ref)?.nombre||'este documento')+' en Google Drive'}
       onChange={e=>{
        if(e.target.checked)setSeleccionandoCarpeta(ref);
        else {
         const siguiente={...guardadosDrive};
         delete siguiente[ref];
         onGuardarChange(siguiente);
        }
       }}/>
      <span><strong>Guardar copia permanente en Google Drive</strong>
       <small>Selecciona una carpeta solo para este documento.</small></span>
     </label>
     {guardadosDrive[ref]?.carpeta_id&&<div className="correo-guardar-drive-destino">
      <span>Carpeta: {guardadosDrive[ref].ruta||guardadosDrive[ref].carpeta_nombre}</span>
      <button type="button" className="boton boton-secundario" onClick={()=>setSeleccionandoCarpeta(ref)}>Cambiar carpeta</button>
     </div>}
    </div>
   </article>)}
  </div>}
  {seleccionandoCarpeta&&seleccion.includes(seleccionandoCarpeta)&&
   <SelectorCarpetaDrive usuarioId={usuarioId} seleccionActual={guardadosDrive[seleccionandoCarpeta]}
    onCerrar={()=>setSeleccionandoCarpeta(null)}
    onElegir={carpeta=>{
     onGuardarChange({...guardadosDrive,[seleccionandoCarpeta]:{...carpeta,operacion_id:crypto.randomUUID()}});
     setSeleccionandoCarpeta(null);
    }}/>}
 </section>;
}
