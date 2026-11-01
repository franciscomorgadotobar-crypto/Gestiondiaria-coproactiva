import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO,ETIQUETAS_ESTADO} from '../../lib/plantillasDocumentales';
import {generarPdfDocumento} from '../../lib/documentoPdf';
import './EditorDocumentoGestion.css';

const TIPOS_EDITABLES=new Set(['seguimiento_documental','primera_administracion','informe_gestion']);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const VACIO={titulo:'',estado:'borrador',contexto_tipo:null,contexto_id:null,contexto_nombre:'',
 contenido:{periodo:'',introduccion:''}};
const FECHA=new Intl.DateTimeFormat('es-CL',{dateStyle:'medium'});
const camposPorTipo=tipo=>CAMPOS_POR_TIPO[tipo]||[];

export default function EditorDocumentoGestion(){
 const {id}=useParams();
 const [params]=useSearchParams();
 const navegar=useNavigate();
 const {perfil}=useSesion();
 const inicial=params.get('tipo');
 const [tipo,setTipo]=useState(TIPOS_EDITABLES.has(inicial)?inicial:'informe_gestion');
 const [doc,setDoc]=useState(null);
 const [form,setForm]=useState({...VACIO,contenido:{...VACIO.contenido}});
 const [cargando,setCargando]=useState(Boolean(id));
 const [guardando,setGuardando]=useState(false);
 const [exportando,setExportando]=useState(false);
 const [error,setError]=useState('');
 const [aviso,setAviso]=useState('');
 const [versiones,setVersiones]=useState([]);
 const [pestana,setPestana]=useState('editar');
 const [verVersion,setVerVersion]=useState(null);

 useEffect(()=>{
  if(!id)return;
  if(!UUID.test(id)){setError('Documento inválido');setCargando(false);return;}
  let activo=true;
  Promise.all([
   supabase.from('documentos_gestion').select('*').eq('id',id).maybeSingle(),
   supabase.from('documentos_versiones').select('id,version,estado,creado_en')
    .eq('documento_id',id).order('version',{ascending:false}).limit(30)
  ]).then(([r,v])=>{
   if(!activo)return;
   if(r.error||!r.data)setError(r.error?.message||'Documento no encontrado o sin permisos');
   else{setDoc(r.data);setTipo(r.data.tipo);setForm({
     titulo:r.data.titulo,estado:r.data.estado,contexto_tipo:r.data.contexto_tipo,
     contexto_id:r.data.contexto_id,contexto_nombre:r.data.contexto_nombre||'',
     contenido:r.data.contenido||{}
   });}
   setVersiones(v.data||[]);
   setCargando(false);
  });
  return()=>{activo=false;};
 },[id]);

 useEffect(()=>{
  if(id)return;
  const categoria=[['prospecto','prospectos','nombre_condominio'],['comunidad','comunidades','nombre'],['proveedor','proveedores','empresa']]
   .find(([nombre])=>UUID.test(params.get(nombre)||''));
  if(!categoria)return;
  const [tipoContexto,tabla,columna]=categoria;
  const contextoId=params.get(tipoContexto);
  let activo=true;
  supabase.from(tabla).select('id,'+columna).eq('id',contextoId).maybeSingle()
   .then(({data})=>{
    if(!activo||!data)return;
    setForm(v=>({...v,contexto_tipo:tipoContexto,contexto_id:data.id,
     contexto_nombre:data[columna]||'',titulo:v.titulo||data[columna]||''}));
   });
  return()=>{activo=false;};
 },[id,params]);

 const plantilla=TIPOS_DOCUMENTO.find(t=>t.id===tipo);
 const cambiar=(clave,valor)=>{setAviso('');setForm(v=>({...v,[clave]:valor}));};
 const contenido=(clave,valor)=>{setAviso('');setForm(v=>({...v,contenido:{...v.contenido,[clave]:valor}}));};
 const conContenido=useMemo(()=>camposPorTipo(tipo).some(([key])=>(form.contenido[key]||'').trim()),[tipo,form.contenido]);
 const soloLectura=Boolean(verVersion);
 const vista=verVersion?{
  titulo:verVersion.titulo,estado:verVersion.estado,contenido:verVersion.contenido,
  contexto_nombre:form.contexto_nombre,version:verVersion.version
 }:{...form,version:doc?.version||1};

 async function guardar({silencioso=false}={}){
  if(!form.titulo.trim()){setError('El documento necesita un título');return null;}
  if(!TIPOS_EDITABLES.has(tipo)){setError('Selecciona un tipo de documento válido');return null;}
  if(form.estado==='emitido'&&!conContenido){setError('Completa al menos una sección antes de emitir');return null;}
  setGuardando(true);setError('');setAviso('');
  const {data,error:e}=await supabase.rpc('guardar_documento_gestion',{
    p_id:doc?.id||null,p_tipo:tipo,p_titulo:form.titulo.trim(),
    p_estado:form.estado,p_contexto_tipo:form.contexto_tipo,
    p_contexto_id:form.contexto_id,
    p_contenido:form.contenido,p_version_esperada:doc?.version||null
  });
  setGuardando(false);
  if(e){setError(e.message);return null;}
  setDoc(data);setVersiones(v=>[{id:data.id+':'+data.version,version:data.version,
    estado:data.estado,creado_en:data.actualizado_en},...v].slice(0,30));
  if(!silencioso)setAviso('Documento guardado - versión '+data.version);
  if(!doc?.id)navegar('/documentos/'+data.id,{replace:true});
  return data;
 }
 async function exportar({biblioteca=false}={}){
  if(!doc){setError('Guarda el documento antes de exportar.');return;}
  setExportando(true);setError('');setAviso('');
  try{
   const resultado=await generarPdfDocumento({...doc,...form});
   if(!biblioteca){
    const url=URL.createObjectURL(resultado.blob);
    const enlace=document.createElement('a');enlace.href=url;enlace.download=resultado.nombre;
    document.body.appendChild(enlace);enlace.click();enlace.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    setAviso('PDF preparado para descargar.');
   }else{
    const fd=new FormData();
    fd.set('action','upload');fd.set('categoria','Documentos generados');
    fd.set('archivo',new File([resultado.blob],resultado.nombre,{type:'application/pdf'}));
    const {data,error:e}=await supabase.functions.invoke('correo-archivos',{body:fd});
    if(e||!data?.ok)throw new Error(data?.error||e?.message||'No fue posible guardar el PDF en Drive');
    const actual={...form.contenido,
     pdf_biblioteca:{archivo_id:data.archivo.id,nombre:resultado.nombre,
       version:doc.version,fecha:new Date().toISOString()}};
    const {data:guardado,error:errorGuardar}=await supabase.rpc('guardar_documento_gestion',{
      p_id:doc.id,p_tipo:tipo,p_titulo:form.titulo.trim(),
      p_estado:form.estado,p_contexto_tipo:form.contexto_tipo,p_contexto_id:form.contexto_id,
      p_contenido:actual,p_version_esperada:doc.version
    });
    if(errorGuardar)throw new Error('Archivo guardado en biblioteca, pero no pudo vincularse al documento: '+errorGuardar.message);
    setDoc(guardado);setForm(v=>({...v,contenido:actual}));
    setVersiones(v=>[{version:guardado.version,estado:guardado.estado,creado_en:guardado.actualizado_en},...v].slice(0,30));
    setAviso('PDF guardado en la biblioteca de correos. Puedes adjuntarlo como archivo real.');
   }
  }catch(e){setError(e?.message||'Error al generar el PDF');}
  finally{setExportando(false);}
 }
 async function abrirVersion(version){
  if(!doc)return;
  setError('');
  const {data,error:e}=await supabase.from('documentos_versiones')
   .select('version,titulo,estado,contenido,creado_en').eq('documento_id',doc.id).eq('version',version).single();
  if(e){setError(e.message);return;}
  setVerVersion(data);setPestana('vista');
 }
 if(cargando)return <p className="cargando">Cargando documento...</p>;
 return <main className="editor-documento">
  <header className="editor-documento-barra">
   <div><Link to="/documentos" className="editor-enlace-volver">← Gestor documental</Link>
    <h1>{doc?'Editar documento':'Nuevo documento'}</h1>
    <p>{plantilla?.titulo} - Plantilla corporativa Coproactiva</p></div>
   <div className="editor-documento-acciones">
    <button type="button" className="boton boton-secundario" disabled={!doc||exportando||guardando} onClick={()=>exportar()}>Descargar PDF</button>
    <button type="button" className="boton boton-secundario" disabled={!doc||exportando||guardando} onClick={()=>exportar({biblioteca:true})}>Guardar PDF en biblioteca</button>
    <button type="button" className="boton" disabled={guardando||exportando||soloLectura} onClick={()=>guardar()}>{guardando?'Guardando...':'Guardar documento'}</button>
   </div>
  </header>
  {error&&<p className="editor-alerta error" role="alert">{error}</p>}
  {aviso&&<p className="editor-alerta" role="status">{aviso}</p>}
  <div className="editor-mobile-tabs">
   <button type="button" className={pestana==='editar'?'activo':''} onClick={()=>{setVerVersion(null);setPestana('editar');}}>Editar</button>
   <button type="button" className={pestana==='vista'?'activo':''} onClick={()=>setPestana('vista')}>Vista previa</button>
  </div>
  <div className={'editor-documento-layout'+(pestana==='vista'?' mostrando-vista':'')}>
   <div className="editor-documento-formulario">
    <fieldset disabled={soloLectura||guardando} className="editor-documento-campos">
     <label>Tipo de documento
      <select value={tipo} disabled={Boolean(doc)} onChange={e=>setTipo(e.target.value)}>
       {TIPOS_DOCUMENTO.filter(t=>t.id!=='propuesta_comercial').map(t=><option key={t.id} value={t.id}>{t.titulo}</option>)}
      </select>
     </label>
     <label>Título del documento *
      <input maxLength={180} value={form.titulo} onChange={e=>cambiar('titulo',e.target.value)} placeholder="Ej.: Informe de gestión - Comunidad"/>
     </label>
     <div className="editor-documento-dos">
      <label>Estado
       <select value={form.estado} onChange={e=>cambiar('estado',e.target.value)}>
        {Object.entries(ETIQUETAS_ESTADO).map(([v,n])=><option key={v} value={v}>{n}</option>)}
       </select>
      </label>
      <label>Periodo
       <input maxLength={100} value={form.contenido.periodo||''} onChange={e=>contenido('periodo',e.target.value)} placeholder="Ej.: Octubre 2026"/>
      </label>
     </div>
     <label>Contexto asociado
      <input value={form.contexto_nombre||'Documento interno'} readOnly title="Vinculación desde CRM, Comunidades o Proveedores" />
     </label>
     <label>Introducción
      <textarea rows={3} maxLength={3000} value={form.contenido.introduccion||''} onChange={e=>contenido('introduccion',e.target.value)} placeholder="Introducción, propósito y antecedentes..."/>
     </label>
     {camposPorTipo(tipo).map(([id,label],i)=><label key={id} className="editor-documento-seccion">
      <span><em>{String(i+1).padStart(2,'0')}</em> {label}</span>
      <textarea rows={id==='resumen'?4:3} maxLength={8000} value={form.contenido[id]||''}
       onChange={e=>contenido(id,e.target.value)}
       placeholder="Escribe el contenido. Una actividad o punto por línea cuando corresponda."/>
     </label>)}
    </fieldset>
    {doc&&<section className="editor-documento-historial">
     <h2>Control de versiones</h2>
     <p>Las versiones emitidas permanecen disponibles para consulta.</p>
     {versiones.map((v,i)=><button type="button" key={v.id||v.version||i} onClick={()=>abrirVersion(v.version)}>
       v{v.version} - {ETIQUETAS_ESTADO[v.estado]||v.estado} - {FECHA.format(new Date(v.creado_en))}
     </button>)}
     {soloLectura&&<button type="button" onClick={()=>{setVerVersion(null);setPestana('editar');}}>Volver a la versión actual</button>}
    </section>}
   </div>
   <aside className="editor-documento-preview" aria-label="Vista previa del documento">
    <div className="editor-documento-hoja">
     <div className="editor-documento-membrete"><span className="editor-documento-logo">coproactiva</span><span>GESTIÓN DOCUMENTAL</span></div>
     <div className="editor-documento-interior">
      <span className="editor-documento-kicker">{plantilla?.titulo||'Documento de gestión'}</span>
      <h2>{vista.titulo||'Título del documento'}</h2>
      <p className="editor-documento-meta">{vista.contexto_nombre||'Coproactiva Administración SpA'} - v{vista.version} - {ETIQUETAS_ESTADO[vista.estado]}</p>
      {vista.contenido?.periodo&&<p>Periodo: {vista.contenido.periodo}</p>}
      {vista.contenido?.introduccion&&<p>{vista.contenido.introduccion}</p>}
      {camposPorTipo(tipo).filter(([id])=>(vista.contenido?.[id]||'').trim()).map(([id,label],i)=>
       <section key={id}><h3><span>{String(i+1).padStart(2,'0')}</span>{label}</h3>
        <p className="editor-documento-contenido">{vista.contenido[id]}</p>
       </section>)}
      {!conContenido&&<p className="editor-documento-placeholder">Completa las secciones para previsualizar el documento.</p>}
     </div>
     <footer>COPROACTIVA ADMINISTRACIÓN SPA - Documento corporativo</footer>
    </div>
   </aside>
  </div>
 </main>;
}
