import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {TIPOS_DOCUMENTO,ETIQUETAS_ESTADO} from '../lib/plantillasDocumentales';
import './VinculacionDocumento.css';

/** Se consulta la misma tabla que el Gestor: vínculo real en ambos sentidos. */
export default function DocumentosVinculados({tipo,id}){
 const {key}=useLocation();
 const [documentos,setDocumentos]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const columna=tipo==='comunidad'?'comunidad_id':'prospecto_id';
 const idValido=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'');
 useEffect(()=>{
  if(!idValido){setDocumentos([]);setCargando(false);return;}
  let vigente=true;
  setCargando(true);setError('');
  supabase.from('documentos_gestion').select('id,titulo,tipo,estado,version,actualizado_en')
   .eq(columna,id).order('actualizado_en',{ascending:false}).limit(100)
   .then(({data,error:e})=>{
    if(!vigente)return;
    setDocumentos(data||[]);
    if(e)setError(e.message);
    setCargando(false);
   });
  return()=>{vigente=false;};
 },[columna,id,idValido,key]);
 const url='/documentos/nuevo?tipo=informe_gestion&contexto='+encodeURIComponent(tipo)+'&contexto_id='+encodeURIComponent(id||'');
 const gestionar='/documentos?'+(tipo==='comunidad'?'comunidad':'prospecto')+'='+encodeURIComponent(id||'');
 return <section className="documentos-relacionados" aria-label="Documentos asociados">
  <div className="documentos-relacionados-cabecera">
   <h3>Documentos vinculados {cargando?'':'('+documentos.length+')'}</h3>
   <Link className="boton boton-secundario" to={url}>+ Nuevo documento</Link>
  </div>
  {cargando&&<p className="documentos-relacionados-vacio">Cargando documentos…</p>}
  {error&&<p role="alert" className="documentos-relacionados-vacio">No fue posible cargar los documentos: {error}</p>}
  {!cargando&&!error&&!documentos.length&&<p className="documentos-relacionados-vacio">Aún no hay documentos asociados a esta ficha.</p>}
  {!!documentos.length&&<ul className="documentos-relacionados-lista">
   {documentos.map(d=><li key={d.id}>
    <div><strong>{d.titulo}</strong>
     <small>{TIPOS_DOCUMENTO.find(t=>t.id===d.tipo)?.titulo||d.tipo} · {ETIQUETAS_ESTADO[d.estado]||d.estado} · v{d.version}</small>
    </div>
    <Link to={'/documentos/'+d.id}>Abrir documento</Link>
   </li>)}
  </ul>}
  <Link to={gestionar}>Ver documentos en el Gestor Documental</Link>
 </section>;
}
