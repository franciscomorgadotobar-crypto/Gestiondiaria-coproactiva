import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import './SelectorCarpetaDrive.css';

const KEY='coproactiva-correo-drive-ultima-carpeta-v1';
const leerUltima=usuarioId=>{
 try{return JSON.parse(localStorage.getItem(KEY+':'+usuarioId)||'null');}catch{return null;}
};
const guardarUltima=(usuarioId,carpeta)=>{
 try{localStorage.setItem(KEY+':'+usuarioId,JSON.stringify(carpeta));}catch{/* almacenamiento opcional */}
};

/** Selector de carpetas autenticado. Solo permite navegar en Documentos comerciales. */
export default function SelectorCarpetaDrive({usuarioId,seleccionActual,onElegir,onCerrar}){
 const [raiz,setRaiz]=useState(null);
 const [actual,setActual]=useState(null);
 const [pila,setPila]=useState([]);
 const [carpetas,setCarpetas]=useState([]);
 const [ocupado,setOcupado]=useState(true);
 const [error,setError]=useState('');
 const [creando,setCreando]=useState(false);
 const [nombre,setNombre]=useState('');
 const [ultimo]=useState(()=>seleccionActual?.carpeta_id ? seleccionActual : leerUltima(usuarioId));

 async function consultar(id='',ruta=[]){
  setOcupado(true);setError('');
  try{
   const {data,error:e}=await supabase.functions.invoke('correo-archivos',{
    body:{action:'carpetas',carpeta_id:id}
   });
   if(e||!data?.ok)throw new Error(data?.error||e?.message||'No fue posible consultar Drive');
   setRaiz(data.raiz);setActual(data.carpeta);setPila(ruta);setCarpetas(data.carpetas||[]);
  }catch(e){setError(e.message||'No fue posible abrir las carpetas');}
  finally{setOcupado(false);}
 }
 useEffect(()=>{consultar();},[]);
 async function crear(){
  if(!nombre.trim())return;
  setOcupado(true);setError('');
  try{
   const {data,error:e}=await supabase.functions.invoke('correo-archivos',{
    body:{action:'crear_carpeta',carpeta_id:actual.id,nombre:nombre.trim()}
   });
   if(e||!data?.ok)throw new Error(data?.error||e?.message||'No fue posible crear la carpeta');
   setNombre('');setCreando(false);
   await consultar(data.carpeta.id,[...pila,actual]);
  }catch(e){setError(e.message||'No fue posible crear la carpeta');setOcupado(false);}
 }
 function elegir(){
  if(!actual||ocupado)return;
  const ruta=[...pila.map(x=>x.name),actual.name].join(' / ');
  const carpeta={carpeta_id:actual.id,carpeta_nombre:actual.name,ruta};
  guardarUltima(usuarioId,carpeta);
  onElegir(carpeta);
 }
 async function volver(){
  if(pila.length){
   const anterior=pila[pila.length-1];await consultar(anterior.id,pila.slice(0,-1));
  }else onCerrar();
 }
 async function abrirUltima(){
  if(!ultimo?.carpeta_id)return;
  // El servidor comprueba de nuevo la pertenencia al árbol permitido.
  await consultar(ultimo.carpeta_id,[]);
 }
 return <div className="selector-drive-fondo" onClick={onCerrar}>
  <section className="selector-drive-dialogo" role="dialog" aria-modal="true" aria-label="Seleccionar carpeta en Google Drive"
   onClick={e=>e.stopPropagation()}>
   <header className="selector-drive-cabecera">
    <div><strong>Guardar en Google Drive</strong>
     <p className="micro apagado">Selecciona dónde conservar una copia permanente.</p></div>
    <button className="selector-drive-icono" type="button" onClick={onCerrar} aria-label="Cerrar selector">×</button>
   </header>
   <nav className="selector-drive-ruta" aria-label="Ubicación en Drive">
    <button type="button" onClick={()=>consultar()} disabled={ocupado}>Documentos comerciales</button>
    {actual&&raiz&&actual.id!==raiz.id&&<span> / {actual.name}</span>}
   </nav>
   {ultimo?.carpeta_id && ultimo.carpeta_id!==actual?.id &&
    <button type="button" className="selector-drive-ultima" onClick={abrirUltima} disabled={ocupado}>
     Ir a la última carpeta utilizada: {ultimo.carpeta_nombre}
    </button>}
   {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
   {ocupado?<p className="micro apagado">Cargando carpetas...</p>:
    <div className="selector-drive-lista">
     {carpetas.map(c=><button key={c.id} className="selector-drive-item" type="button"
       onClick={()=>consultar(c.id,[...pila,actual])}><span aria-hidden="true">📁</span>{c.name}<span aria-hidden="true">›</span></button>)}
     {!carpetas.length&&<p className="micro apagado">Esta carpeta no contiene subcarpetas.</p>}
    </div>}
   {creando&&<div className="selector-drive-nueva">
    <label className="campo">Nombre de nueva carpeta
     <input value={nombre} maxLength={64} onChange={e=>setNombre(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();crear();}}}
       placeholder="Por ejemplo: Cotizaciones" autoFocus/>
    </label>
    <button type="button" className="boton" onClick={crear} disabled={!nombre.trim()||ocupado}>Crear</button>
   </div>}
   <footer className="selector-drive-acciones">
    <button type="button" className="boton boton-secundario" disabled={ocupado} onClick={volver}>Volver</button>
    <button type="button" className="boton boton-secundario" disabled={ocupado} onClick={()=>setCreando(x=>!x)}>+ Nueva carpeta</button>
    <button type="button" className="boton" disabled={ocupado||!actual} onClick={elegir}>Guardar en esta carpeta</button>
   </footer>
  </section>
 </div>;
}
