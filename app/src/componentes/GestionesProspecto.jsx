import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

const fechaCL=v=>v?new Date(v).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'medium',timeStyle:'short'}):'Sin fecha';
const local=v=>{
 if(!v)return '';
 const d=new Date(v);
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export default function GestionesProspecto({prospecto,onActualizar,disabled=false}){
 const [historial,setHistorial]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const [errorHistorial,setErrorHistorial]=useState('');
 const [modo,setModo]=useState('');
 const [resultado,setResultado]=useState('');
 const [accion,setAccion]=useState('');
 const [fecha,setFecha]=useState('');
 const [guardando,setGuardando]=useState(false);
 const [aviso,setAviso]=useState('');
 const [revision,setRevision]=useState(0);
 const pendiente=Boolean(prospecto.proxima_accion||prospecto.fecha_proxima_accion);
 const vencida=Boolean(prospecto.fecha_proxima_accion&&new Date(prospecto.fecha_proxima_accion)<new Date());
 const cerrado=['ganado','perdido'].includes(prospecto.etapa);
 useEffect(()=>{
  let activo=true;setCargando(true);setErrorHistorial('');
  supabase.from('prospecto_historial').select('id,fecha,accion,etapa_anterior,etapa_nueva,notas,correo_enviado')
   .eq('prospecto_id',prospecto.id).order('fecha',{ascending:false}).limit(100)
   .then(({data,error})=>{if(activo){setHistorial(data||[]);setErrorHistorial(error?.message||'');setCargando(false);}});
  return()=>{activo=false;};
 },[prospecto.id,prospecto.editado_en,revision]);
 function abrir(tipo){
  setModo(tipo);setResultado('');setError('');setAviso('');
  setAccion(['completar','eliminar'].includes(tipo)?'':prospecto.proxima_accion||'');
  setFecha(['completar','eliminar'].includes(tipo)?'':local(prospecto.fecha_proxima_accion));
 }
 async function guardar(e){
  e.preventDefault();if(guardando||disabled)return;
  if(modo!=='eliminar'&&!resultado.trim())return setError('Registra el resultado o motivo.');
  if(Boolean(accion.trim())!==Boolean(fecha))return setError('Completa la descripción y la fecha de la siguiente acción, o deja ambas vacías.');
  if(modo==='reagendar'&&(!fecha||new Date(fecha)<=new Date()))return setError('Indica una nueva fecha futura.');
  setGuardando(true);setError('');
  try{
   const {data,error}=await supabase.rpc('registrar_gestion_prospecto',{
    p_prospecto_id:prospecto.id,p_editado_en:prospecto.editado_en,
    p_tipo:modo,p_resultado:resultado.trim()||(modo==='eliminar'?'Eliminada por el usuario':''),p_proxima_accion:modo==='eliminar'?null:accion.trim()||null,
    p_fecha_proxima_accion:modo==='eliminar'?null:fecha?new Date(fecha).toISOString():null
   });
   if(error||!data)throw Error(error?.message||'No se pudo registrar la gestión.');
   onActualizar(data);setModo('');setRevision(n=>n+1);setAviso(modo==='eliminar'?'Acción eliminada de la agenda. Historial conservado.':'Gestión registrada. Agenda actualizada.');
  }catch(e){setError(e.message);}
  finally{setGuardando(false);}
 }
 return <section className="documentos-relacionados" aria-label="Agenda y gestiones comerciales" style={{marginTop:14}}>
  <h3 className="h4">Acciones comerciales</h3>
  {pendiente?<div style={{margin:'12px 0'}}>
   <span className={'chip '+(vencida?'chip-alerta':'chip-pendiente')}>{cerrado?'Prospecto cerrado':vencida?'Vencida':'Pendiente'}</span>
   <p style={{margin:'8px 0 4px',overflowWrap:'anywhere'}}><strong>{prospecto.proxima_accion||'Acción sin descripción'}</strong></p>
   <p className="chico apagado">{fechaCL(prospecto.fecha_proxima_accion)}</p>
  </div>:<p className="chico apagado">No hay una acción agendada.</p>}
  {!modo&&<div className="pipeline-ficha-acciones">
   {pendiente&&<button className="boton" type="button" disabled={disabled} onClick={()=>abrir('completar')}>Completar acción</button>}
   {pendiente&&!cerrado&&<button className="boton boton-secundario" type="button" disabled={disabled} onClick={()=>abrir('reagendar')}>Reagendar</button>}
   {pendiente&&<button className="boton boton-secundario pipeline-eliminar" type="button" disabled={disabled} onClick={()=>abrir('eliminar')}>Eliminar acción</button>}
   {!cerrado&&<button className="boton boton-secundario" type="button" disabled={disabled} onClick={()=>abrir('registrar')}>{pendiente?'Registrar gestión':'Agendar / registrar gestión'}</button>}
  </div>}
  {modo&&<form onSubmit={guardar} style={{display:'grid',gap:12,marginTop:12}}>
   {modo==='eliminar'&&<p className="chico" role="alert">¿Eliminar la acción pendiente? Se retirará de la agenda sin marcarla como realizada. El prospecto y su historial se conservarán.</p>}
   <label className="campo"><span className="etiqueta-campo">{modo==='eliminar'?'Motivo (opcional)':modo==='reagendar'?'Motivo del cambio':'Resultado de la gestión'}</span>
    <textarea required={modo!=='eliminar'} rows={3} value={resultado} onChange={e=>setResultado(e.target.value)} disabled={guardando||disabled}/></label>
   {!cerrado&&modo!=='eliminar'&&<><label className="campo"><span className="etiqueta-campo">{modo==='reagendar'?'Acción pendiente':'Siguiente acción (opcional)'}</span>
    <input value={accion} readOnly={modo==='reagendar'} onChange={e=>setAccion(e.target.value)} disabled={guardando||disabled}/></label>
   <label className="campo"><span className="etiqueta-campo">Fecha y hora</span>
    <input type="datetime-local" value={fecha} onChange={e=>setFecha(e.target.value)} disabled={guardando||disabled}/></label></>}
   <div className="pipeline-ficha-acciones"><button className={modo==='eliminar'?'boton boton-secundario pipeline-eliminar':'boton'} type="submit" disabled={guardando||disabled}>{guardando?'Guardando…':modo==='eliminar'?'Confirmar eliminación':'Guardar gestión'}</button><button className="boton boton-secundario" type="button" disabled={guardando} onClick={()=>setModo('')}>Cancelar</button></div>
  </form>}
  {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
  {aviso&&<p className="aviso" role="status">{aviso}</p>}
  <details className="pipeline-historial-correos" style={{marginTop:14}}>
   <summary><strong>Historial comercial</strong><span>{cargando?'Cargando…':historial.length+' registros'}</span></summary>
   <div className="pipeline-historial-contenido">
    {errorHistorial&&<p role="alert">No se pudo cargar el historial: {errorHistorial}</p>}
    {!cargando&&!errorHistorial&&!historial.length&&<p className="chico apagado">Sin gestiones registradas.</p>}
    {historial.map(h=><article key={h.id} style={{padding:'10px 0',borderBottom:'1px solid #e9e6e2',overflowWrap:'anywhere'}}>
     <strong>{h.accion||'Gestión'}</strong><p className="micro apagado">{fechaCL(h.fecha)}</p>
     {h.etapa_anterior&&h.etapa_nueva&&h.etapa_anterior!==h.etapa_nueva&&<p className="chico">{h.etapa_anterior} → {h.etapa_nueva}</p>}
     {h.notas&&<p className="chico" style={{whiteSpace:'pre-line'}}>{h.notas}</p>}
    </article>)}
   </div>
  </details>
 </section>;
}
