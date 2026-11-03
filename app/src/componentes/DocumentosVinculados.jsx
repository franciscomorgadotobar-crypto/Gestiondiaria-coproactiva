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
  Promise.all([
   supabase.from('documentos_gestion').select('id,titulo,tipo,estado,version,actualizado_en')
    .eq(columna,id).order('actualizado_en',{ascending:false}).limit(100),
   // El generador comercial conserva sus propuestas en una tabla propia.
   // La propuesta Nova Vida está vinculada por prospecto_id aunque antes
   // no apareciera en esta ficha por consultar solo documentos_gestion.
   tipo==='prospecto'
    ?supabase.from('propuestas_comerciales').select('id,nombre,prospecto_id,actualizado_en')
     .eq('prospecto_id',id).order('actualizado_en',{ascending:false}).limit(100)
    :Promise.resolve({data:[],error:null})
  ]).then(([genericos,comerciales])=>{
   if(!vigente)return;
   const generales=(genericos.data||[]).map(d=>({...d,origen:'gestor'}));
   const propuestas=(comerciales.data||[]).map(p=>({
    id:p.id,titulo:p.nombre,tipo:'propuesta_comercial',estado:'borrador',
    version:1,actualizado_en:p.actualizado_en,origen:'propuestas'
   }));
   setDocumentos([...generales,...propuestas].sort((a,b)=>
    String(b.actualizado_en||'').localeCompare(String(a.actualizado_en||''))));
   if(genericos.error||comerciales.error)
    setError([genericos.error?.message,comerciales.error?.message].filter(Boolean).join(' / '));
   setCargando(false);
  });
  return()=>{vigente=false;};
 },[columna,id,idValido,key]);
 const url='/documentos?'+(tipo==='comunidad'?'comunidad':'prospecto')+'='+encodeURIComponent(id||'');
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
    <Link to={d.origen==='propuestas'?'/propuestas?documento='+encodeURIComponent(d.id):'/documentos/'+d.id}>Abrir documento</Link>
   </li>)}
  </ul>}
  <Link to={gestionar}>Ver documentos en el Gestor Documental</Link>
 </section>;
}
