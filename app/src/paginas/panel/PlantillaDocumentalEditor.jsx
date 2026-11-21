import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO} from '../../lib/plantillasDocumentales';
import {CAMPOS_PROPUESTA_PLANTILLA,modeloEditable,contenidoEditable,filas} from '../../lib/plantillasDocumentalesEditables';
import './PlantillaDocumentalEditor.css';

export default function PlantillaDocumentalEditor(){
 const {tipo}=useParams();
 const navegar=useNavigate();
 const plantilla=TIPOS_DOCUMENTO.find(t=>t.id===tipo);
 const campos=tipo==='propuesta_comercial'?CAMPOS_PROPUESTA_PLANTILLA:(CAMPOS_POR_TIPO[tipo]||[]);
 const [contenido,setContenido]=useState(()=>modeloEditable(tipo));
 const [version,setVersion]=useState(null);
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [aviso,setAviso]=useState('');
 const [error,setError]=useState('');
 const [inicial,setInicial]=useState(()=>modeloEditable(tipo));
 useEffect(()=>{
  if(!plantilla){setCargando(false);return;}
  let vivo=true;
  setCargando(true);setError('');
  supabase.from('plantillas_documentales_app').select('contenido,version')
   .eq('tipo',tipo).maybeSingle().then(({data,error:err})=>{
    if(!vivo)return;
    if(err)setError('No se pudo cargar la plantilla: '+err.message);
    else{
     const plantillaActual=contenidoEditable(tipo,data?.contenido);
     setContenido(plantillaActual);setInicial(plantillaActual);
     setVersion(data?.version??null);
    }
    setCargando(false);
   });
  return()=>{vivo=false;};
 },[tipo]);
 const cambiado=useMemo(()=>JSON.stringify(contenido)!==JSON.stringify(inicial),[contenido,inicial]);
 async function guardar(){
  if(guardando||cargando||!plantilla)return;
  const limpio=Object.fromEntries(campos.map(([key])=>[key,String(contenido[key]||'').trim()]));
  if(campos.some(([key])=>!limpio[key])){setError('Completa todas las secciones de la plantilla.');return;}
  if(tipo==='propuesta_comercial'){
   for(const [campo,columnas] of [['enfoques',2],['areas',2],['plan',2],['entregables',2],['sla',4]]){
    const lineas=limpio[campo].split(/\r?\n/).filter(x=>x.trim());
    if(filas(limpio[campo],columnas).length!==lineas.length){
     setError('Revisa la tabla "'+campo+'": cada línea debe tener '+columnas+' columnas separadas por |.');return;
    }
   }
  }
  setGuardando(true);setError('');setAviso('');
  const {data,error:err}=await supabase.rpc('guardar_plantilla_documental_app',{
   p_tipo:tipo,p_contenido:limpio,p_version_esperada:version
  });
  if(err)setError('No se pudo guardar la plantilla: '+err.message);
  else{
   const modelo=contenidoEditable(tipo,data.contenido);
   setContenido(modelo);setInicial(modelo);setVersion(data.version);
   setAviso('Plantilla guardada. Los próximos documentos utilizarán esta versión. Los documentos anteriores no se modifican.');
  }
  setGuardando(false);
 }
 function restaurar(){
  if(!window.confirm('¿Restaurar el texto original de esta plantilla? Tendrás que guardar para aplicar los cambios.'))return;
  setContenido(modeloEditable(tipo));setAviso('');
 }
 if(!plantilla)return <main className="plantilla-documental-editor"><Link to="/documentos">← Gestor documental</Link><p>Plantilla no reconocida.</p></main>;
 return <main className="plantilla-documental-editor">
  <header className="plantilla-documental-editor-cabecera">
   <div><Link to="/documentos">← Gestor documental</Link>
    <h1>Editar plantilla · {plantilla.titulo}</h1>
    <p>Define el texto base para futuros documentos. No cambia documentos ya guardados ni sus versiones.</p>
   </div>
   <div className="plantilla-documental-editor-acciones">
    <button type="button" className="boton boton-secundario" onClick={restaurar} disabled={cargando||guardando}>Restaurar original</button>
    <button type="button" className="boton" onClick={guardar} disabled={cargando||guardando||!cambiado}>
     {guardando?'Guardando…':version?'Guardar nueva versión':'Guardar plantilla'}
    </button>
   </div>
  </header>
  {error&&<p role="alert" className="aviso aviso-critico">{error}</p>}
  {aviso&&<p role="status" className="aviso aviso-ok">{aviso}</p>}
  {cargando?<p>Cargando plantilla…</p>:<div className="plantilla-documental-editor-contenido">
   <div className="plantilla-documental-editor-info">
    <strong>{version?'Versión '+version:'Modelo original'}</strong>
    <span>{cambiado?'Cambios sin guardar':'Sin cambios pendientes'}</span>
   </div>
   {campos.map(([key,nombre])=><label key={key} className="plantilla-documental-editor-campo">
    <strong>{nombre}</strong>
    <textarea rows={key==='presentacion'||key==='condiciones'?5:Math.min(12,Math.max(4,contenido[key]?.split('\n').length+1||4))}
     value={contenido[key]||''} onChange={e=>setContenido(prev=>({...prev,[key]:e.target.value}))}/>
   </label>)}
   <div className="plantilla-documental-editor-pie">
    <span>Los marcadores entre llaves se completan automáticamente al generar la propuesta, cuando corresponda.</span>
    <Link to={tipo==='propuesta_comercial'?'/propuestas':'/documentos/nuevo?tipo='+tipo}>Crear documento con esta plantilla</Link>
   </div>
  </div>}
 </main>;
}
