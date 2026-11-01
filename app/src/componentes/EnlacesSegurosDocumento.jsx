import {useState} from 'react';
import {supabase} from '../lib/supabase';
import './EnlacesSegurosDocumento.css';

const fecha=valor=>valor?new Date(valor).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}):'-';
const activo=enlace=>!enlace.revocado_en&&new Date(enlace.vence_en).getTime()>Date.now();

export default function EnlacesSegurosDocumento({archivo,onInsertarEnCorreo=null}){
 const [abierto,setAbierto]=useState(false);
 const [dias,setDias]=useState(7);
 const [destinatario,setDestinatario]=useState('');
 const [enlaces,setEnlaces]=useState([]);
 const [enlaceNuevo,setEnlaceNuevo]=useState('');
 const [cargando,setCargando]=useState(false);
 const [error,setError]=useState('');
 const [aviso,setAviso]=useState('');
 if(!archivo?.id || archivo?.mime!=='application/pdf')return null;
 async function listar(){
  const {data,error:e}=await supabase.functions.invoke('enlace-documental',{
   body:{action:'listar',archivo_id:archivo.id}});
  if(e||!data?.ok)throw Error(data?.error||e?.message||'No se pudo consultar el seguimiento');
  setEnlaces(data.enlaces||[]);
 }
 async function alternar(){
  if(abierto){setAbierto(false);return;}
  setAbierto(true);setError('');
  setCargando(true);
  try{await listar()}catch(e){setError(e.message)}
  finally{setCargando(false)}
 }
 async function crear(){
  setCargando(true);setError('');setAviso('');setEnlaceNuevo('');
  try{
   const {data,error:e}=await supabase.functions.invoke('enlace-documental',{
    body:{action:'crear',archivo_id:archivo.id,dias,
     destinatario_previsto:destinatario.trim()}});
   if(e||!data?.ok)throw Error(data?.error||e?.message||'No se pudo generar el enlace');
   setEnlaceNuevo(data.url);
   setAviso('Enlace creado. Copia la dirección o insértala en el correo. Se mostrará una sola vez.');
   await listar();
  }catch(e){setError(e.message)}
  finally{setCargando(false)}
 }
 async function revocar(id){
  setCargando(true);setError('');
  try{
   const {data,error:e}=await supabase.functions.invoke('enlace-documental',{
    body:{action:'revocar',enlace_id:id}});
   if(e||!data?.ok)throw Error(data?.error||e?.message||'No se pudo revocar');
   setEnlaceNuevo('');
   setAviso('El enlace ha sido revocado.');
   await listar();
  }catch(e){setError(e.message)}
  finally{setCargando(false)}
 }
 async function copiar(){
  try{
   await navigator.clipboard.writeText(enlaceNuevo);
   setAviso('Enlace copiado. Recuerda indicar al destinatario su vigencia.');
  }catch{
   setAviso('Selecciona y copia manualmente la dirección que aparece arriba.');
  }
 }
 return <div className="enlaces-documentales">
  <button className="boton boton-secundario" type="button" aria-expanded={abierto}
   disabled={cargando} onClick={alternar}>
   {abierto?'Cerrar enlaces':'Crear enlace seguro / seguimiento'}
  </button>
  {abierto&&<div className="enlaces-documentales-panel">
   <strong>Compartir {archivo.nombre||'PDF'}</strong>
   <p className="micro apagado">El enlace puede reenviarse. Las cifras muestran solicitudes de descarga, no prueban lectura ni verifican quién abrió el documento.</p>
   <div className="enlaces-documentales-campos">
    <label className="campo">Vigencia
     <select value={dias} onChange={e=>setDias(Number(e.target.value))}>
      <option value={1}>1 día</option><option value={7}>7 días</option><option value={30}>30 días</option>
     </select>
    </label>
    <label className="campo">Destinatario previsto (opcional)
     <input value={destinatario} maxLength={120} onChange={e=>setDestinatario(e.target.value)}
      placeholder="Referencia interna, no validación de identidad"/>
    </label>
    <button type="button" className="boton" disabled={cargando} onClick={crear}>Generar enlace</button>
   </div>
   {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
   {aviso&&<p className="micro" role="status">{aviso}</p>}
   {enlaceNuevo&&<div className="enlaces-documentales-nuevo">
    <label className="campo">Enlace generado
     <input type="text" value={enlaceNuevo} readOnly onFocus={e=>e.target.select()}/>
    </label>
    <div className="fila-botones">
     <button type="button" className="boton boton-secundario" onClick={copiar}>Copiar enlace</button>
     {onInsertarEnCorreo&&<button type="button" className="boton" onClick={()=>onInsertarEnCorreo(enlaceNuevo)}>Insertar en correo</button>}
    </div>
   </div>}
   {cargando&&<p className="micro apagado">Actualizando seguimiento...</p>}
   <div className="enlaces-documentales-historial">
    <strong>Enlaces creados ({enlaces.length})</strong>
    {!enlaces.length&&<p className="micro apagado">No hay enlaces anteriores para este archivo.</p>}
    {enlaces.map(e=><div className="enlaces-documentales-fila" key={e.id}>
     <div><strong>{e.destinatario_previsto||'Sin destinatario asignado'}</strong>
      <small>Creado {fecha(e.creado_en)} · Vence {fecha(e.vence_en)}</small>
      <small>{e.accesos_total||0} solicitudes de descarga{e.ultima_solicitud?' · Última '+fecha(e.ultima_solicitud):''}</small>
     </div>
     <div><span className="micro">{e.revocado_en?'Revocado':activo(e)?'Activo':'Vencido'}</span>
      {activo(e)&&<button type="button" className="boton boton-texto" disabled={cargando}
        onClick={()=>revocar(e.id)}>Revocar</button>}
     </div>
    </div>)}
   </div>
  </div>}
 </div>;
}
