import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
const ETIQUETAS=['01 Administración','02 Finanzas','03 Operaciones','04 Seguimiento e informes'];
export default function DriveEstado({comunidadId}){
 const [estado,setEstado]=useState(null),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false);
 async function cargar(){
  const {data,error:err}=await supabase.from('drive_carpetas_comunidad')
   .select('estado,carpetas,ultimo_error').eq('comunidad_id',comunidadId).maybeSingle();
  if(err)setError(err.message);else setEstado(data);
 }
 useEffect(()=>{cargar();},[comunidadId]);
 async function conectar(){
  setOcupado(true);setError('');
  const {data,error:err}=await supabase.functions.invoke('drive-comunidad',{body:{action:'provision',comunidad_id:comunidadId}});
  if(err||!data?.ok)setError(data?.error||err?.message||'No se pudo conectar Drive. Revisar credenciales.');
  await cargar();setOcupado(false);
 }
 return <section className="tarjeta" style={{padding:16,marginBottom:20}}>
  <h3 className="h4" style={{marginTop:0}}>Carpeta documental · Google Drive</h3>
  <p className="micro apagado">Una carpeta por comunidad, con cuatro categorías principales. Los archivos se conservan en Drive.</p>
  <p><strong>Estado:</strong> {estado?.estado==='lista'?'Vinculada':estado?.estado==='error'?'Requiere revisión':'Pendiente de vincular'}</p>
  <p className="micro apagado">{ETIQUETAS.join(' · ')}</p>
  {error&&<div role="alert" className="aviso aviso-critico">{error}</div>}
  <button type="button" className="boton boton-secundario" onClick={conectar} disabled={ocupado}>
   {ocupado?'Conectando…':estado?.estado==='lista'?'Comprobar carpetas':'Crear o reconectar carpetas'}
  </button>
 </section>;
}
