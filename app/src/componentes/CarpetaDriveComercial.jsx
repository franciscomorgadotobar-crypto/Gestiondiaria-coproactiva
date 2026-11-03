import {useCallback,useEffect,useState} from 'react';
import {llamarDrive} from '../lib/drive';

/** Navegación acotada a Documentos comerciales: la función valida la jerarquía. */
export default function CarpetaDriveComercial({valor,onChange,disabled=false}){
 const [raiz,setRaiz]=useState(null);
 const [actual,setActual]=useState(null);
 const [carpetas,setCarpetas]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const [nombre,setNombre]=useState('');
 const cargar=useCallback(async(id)=>{
  setCargando(true);setError('');
  try{
   const d=await llamarDrive('carpetas',id?{carpeta_id:id}:{},'correo-archivos');
   setRaiz(d.raiz);setActual(d.carpeta);setCarpetas(d.carpetas||[]);
   if(!valor)onChange(d.carpeta.id);
  }catch(e){setError(e.message||'No se pudo consultar Google Drive.');}
  finally{setCargando(false);}
 },[valor,onChange]);
 useEffect(()=>{cargar(valor||'');},[]); // abrir una sola vez; navegar con controles del usuario
 const elegir=async id=>{onChange(id);await cargar(id);};
 const crear=async()=>{
  if(!nombre.trim()||!actual)return;
  setError('');setCargando(true);
  try{
   const d=await llamarDrive('crear_carpeta',{carpeta_id:actual.id,nombre:nombre.trim()},'correo-archivos');
   setNombre('');await elegir(d.carpeta.id);
  }catch(e){setError(e.message||'No se pudo crear la carpeta.');setCargando(false);}
 };
 return <section className="doc-editor-drive-carpeta" aria-label="Carpeta de Google Drive">
  <strong>Carpeta de destino · Google Drive</strong>
  <p>Los PDF se archivarán en Documentos comerciales. Selecciona una carpeta existente o crea una nueva.</p>
  {error&&<p role="alert" className="aviso aviso-critico">{error}</p>}
  {actual&&<div className="doc-editor-drive-actual">
    <span>Carpeta seleccionada: <strong>{actual.name}</strong></span>
    {raiz&&actual.id!==raiz.id&&<button type="button" disabled={disabled||cargando}
      onClick={()=>elegir(raiz.id)}>Volver a Documentos comerciales</button>}
  </div>}
  {cargando?<small>Consultando carpetas…</small>:
   <div className="doc-editor-drive-acciones">
    <label>Entrar en una subcarpeta
     <select value="" disabled={disabled||!carpetas.length}
      onChange={e=>elegir(e.target.value)}>
      <option value="">Seleccionar subcarpeta…</option>
      {carpetas.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </label>
    <label>Crear carpeta dentro de la seleccionada
     <input maxLength={64} value={nombre} disabled={disabled}
      onChange={e=>setNombre(e.target.value)} placeholder="Nombre de la nueva carpeta"/>
    </label>
    <button type="button" className="boton boton-secundario" disabled={disabled||!nombre.trim()}
     onClick={crear}>Crear y seleccionar</button>
   </div>}
 </section>;
}
