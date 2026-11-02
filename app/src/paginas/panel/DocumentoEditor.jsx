import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO,ETIQUETAS_ESTADO,EJEMPLOS_TITULO_DOCUMENTO,fechaLocalInput} from '../../lib/plantillasDocumentales';
import {descargarPdfDocumento} from '../../lib/documentosPdf';
import {crearContenidoBaseDocumental,REFERENCIAS_MODELO,tieneDatosPorConfirmar} from '../../lib/contenidoBaseDocumental';
import BloquesDocumento from '../../componentes/BloquesDocumento';
import './DocumentoEditor.css';

const tipos=TIPOS_DOCUMENTO.filter(t=>t.id!=='propuesta_comercial');
const vacio={fecha:fechaLocalInput(),destinatario:'',responsable:'',resumen:''};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contextoValido=t=>['prospecto','comunidad','proveedor'].includes(t);
const contextoNombre={prospecto:'Prospecto',comunidad:'Comunidad',proveedor:'Proveedor'};
function etiquetaSeccion(texto){return String(texto||'').replace(/[^a-zA-Z0-9-_ áéíóúñÁÉÍÓÚÑ]/g,'');}

export default function DocumentoEditor(){
 const {id}=useParams();const [params]=useSearchParams();const navegar=useNavigate();
 const esNuevo=!id;
 const [tipo,setTipo]=useState(esNuevo?params.get('tipo')||'seguimiento_documental':'');
 const [titulo,setTitulo]=useState('');
 const [estado,setEstado]=useState('borrador');
 const [contenido,setContenido]=useState(()=>esNuevo?crearContenidoBaseDocumental(params.get('tipo')||'seguimiento_documental'):{...vacio});
 const [contexto,setContexto]=useState(()=>{
  const t=params.get('contexto')||(params.get('prospecto')?'prospecto':params.get('comunidad')?'comunidad':params.get('proveedor')?'proveedor':'');
  const clave=t==='prospecto'?'prospecto':t==='comunidad'?'comunidad':'proveedor';
  const cid=params.get('contexto_id')||params.get(clave)||'';
  return contextoValido(t)&&uuid.test(cid)?{tipo:t,id:cid}:{tipo:'',id:''};
 });
 const [entidad,setEntidad]=useState('');
 const [version,setVersion]=useState(null);
 const [versiones,setVersiones]=useState([]);
 const [vistaVersion,setVistaVersion]=useState(null);
 const [guardando,setGuardando]=useState(false);
 const [vistaMovil,setVistaMovil]=useState('editar');
 const [cargando,setCargando]=useState(!esNuevo);
 const [error,setError]=useState('');const [aviso,setAviso]=useState('');
 const plantilla=tipos.find(t=>t.id===tipo);
 const campos=CAMPOS_POR_TIPO[tipo]||[];

 useEffect(()=>{
  if(!esNuevo)return;
  const solicitado=params.get('tipo')||'seguimiento_documental';
  if(solicitado!==tipo&&CAMPOS_POR_TIPO[solicitado]){
   setTipo(solicitado);
   setTitulo('');
   setContenido(crearContenidoBaseDocumental(solicitado));
  }
 },[esNuevo,params,tipo]);
 const pendientesModelo=tieneDatosPorConfirmar(contenido);
 function restaurarTextoBase(){
  if(!window.confirm('Se reemplazará el contenido de todas las secciones por el modelo base. ¿Continuar?'))return;
  setContenido(actual=>({...crearContenidoBaseDocumental(tipo),fecha:actual.fecha||fechaLocalInput(),responsable:actual.responsable||'Coproactiva Administración SpA'}));
  setAviso('Modelo redactado restaurado. Revisa los datos entre corchetes antes de emitir.');
  setError('');
 }

 useEffect(()=>{
  if(esNuevo)return;
  let activo=true;
  Promise.all([
   supabase.from('documentos_gestion').select('*').eq('id',id).single(),
   supabase.from('documentos_versiones').select('id,version,titulo,estado,contenido,creado_en').eq('documento_id',id).order('version',{ascending:false})
  ]).then(([doc,history])=>{
   if(!activo)return;
   if(doc.error||!doc.data){setError('No se pudo abrir el documento: '+(doc.error?.message||'no encontrado'));}
   else{
    const d=doc.data;setTipo(d.tipo);setTitulo(d.titulo);setContenido(d.contenido||{});
    setEstado(d.estado);setVersion(d.version);setContexto({tipo:d.contexto_tipo||'',id:d.contexto_id||''});
    if(history.error)setError('No se pudo consultar el historial: '+history.error.message);
    else setVersiones(history.data||[]);
   }
   setCargando(false);
  });
  return ()=>{activo=false;};
 },[id,esNuevo]);

 useEffect(()=>{
  if(!contexto.tipo||!contexto.id){setEntidad('');return;}
  const tabla={prospecto:'prospectos',comunidad:'comunidades',proveedor:'proveedores'}[contexto.tipo];
  const campo={prospecto:'nombre_condominio',comunidad:'nombre',proveedor:'empresa'}[contexto.tipo];
  let activo=true;
  supabase.from(tabla).select('id,'+campo).eq('id',contexto.id).maybeSingle().then(({data})=>{
   if(!activo)return;
   setEntidad(data?.[campo]||contexto.id);
   if(esNuevo&&data?.[campo])setTitulo(v=>v||plantilla?.titulo+' - '+data[campo]);
  });
  return ()=>{activo=false;};
 },[contexto.tipo,contexto.id,esNuevo,plantilla?.titulo]);
 const datosVista=vistaVersion?.contenido||contenido;
 const tituloVista=vistaVersion?.titulo||titulo;
 const estadoVista=vistaVersion?.estado||estado;
 const totalLetras=useMemo(()=>Object.values(contenido).reduce((sum,x)=>sum+String(x||'').length,0),[contenido]);

 async function guardar(){
  if(!plantilla)return setError('Elige un tipo de documento válido');
  if(!titulo.trim()||titulo.trim().length<2)return setError('Escribe un título de al menos dos caracteres');
  if(totalLetras>100000)return setError('El documento supera el límite de texto permitido');
  if(['aprobado','emitido'].includes(estado)&&pendientesModelo)return setError('Para aprobar o emitir, reemplaza o elimina los datos [por confirmar] del modelo. Puedes guardar el borrador mientras tanto.');
  setGuardando(true);setError('');setAviso('');
  const {data,error:e}=await supabase.rpc('guardar_documento_gestion',{
   p_id:esNuevo?null:id,p_tipo:tipo,p_titulo:titulo.trim(),
   p_estado:estado,p_contexto_tipo:contexto.tipo||null,p_contexto_id:contexto.id||null,
   p_contenido:contenido,p_version_esperada:version
  });
  if(e)setError('No se pudo guardar: '+e.message);
  else{
   setAviso('Versión '+data.version+' guardada correctamente.');
   setVersion(data.version);setVistaVersion(null);
   if(esNuevo)navegar('/documentos/'+data.id,{replace:true});
   else{
    const {data:historia}=await supabase.from('documentos_versiones')
     .select('id,version,titulo,estado,contenido,creado_en')
     .eq('documento_id',data.id).order('version',{ascending:false});
    setVersiones(historia||[]);
   }
  }
  setGuardando(false);
 }
 if(cargando)return <p className="cargando">Cargando documento...</p>;
 if(!plantilla)return <main className="doc-editor"><p role="alert">Tipo de documento no reconocido.</p><Link to="/documentos">Volver al gestor</Link></main>;
 return <main className="doc-editor">
  <header className="doc-editor-toolbar no-imprimir">
   <div className="doc-editor-identidad"><Link to="/documentos" className="doc-editor-atras">← Gestor documental</Link>
    <h1>{esNuevo?'Crear documento':titulo||'Editar documento'}</h1>
    <p>{plantilla.titulo} {version?' - Versión '+version:''}</p>
   </div>
   <div className="doc-editor-acciones">
    <button type="button" className="boton boton-secundario"
     onClick={()=>descargarPdfDocumento({tipo,titulo:tituloVista,contenido:datosVista,estado:estadoVista})}>
      Descargar PDF
    </button>
    <button type="button" className="boton boton-secundario" onClick={()=>window.print()}>Imprimir</button>
    <button type="button" className="boton" onClick={guardar} disabled={guardando||Boolean(vistaVersion)}>
      {guardando?'Guardando...':esNuevo?'Guardar documento':'Guardar nueva versión'}
    </button>
   </div>
  </header>
  {error&&<p className="aviso aviso-critico no-imprimir" role="alert">{error}</p>}
  {aviso&&<p className="aviso aviso-ok no-imprimir" role="status">{aviso}</p>}
  <nav className="doc-editor-vistas-movil no-imprimir" aria-label="Vista del documento">
    <button type="button" className={vistaMovil==='editar'?'activo':''}
      aria-pressed={vistaMovil==='editar'} onClick={()=>setVistaMovil('editar')}>
      Editar contenido
    </button>
    <button type="button" className={vistaMovil==='vista'?'activo':''}
      aria-pressed={vistaMovil==='vista'} onClick={()=>setVistaMovil('vista')}>
      Vista previa
    </button>
  </nav>
  <div className={'doc-editor-layout '+(vistaMovil==='vista'?'mostrando-vista':'mostrando-form')}>
   <section className="doc-editor-form no-imprimir" aria-label="Datos editables del documento">
    <div className="doc-editor-form-titulo">
      <span className="doc-editor-form-paso">01 / EDICIÓN</span>
      <h2>Contenido del documento</h2>
      <p>El contenido está precargado desde el modelo corporativo; ajusta los datos propios de la comunidad.</p>
    </div>
    {!vistaVersion&&<div className="doc-editor-modelo" role="note">
      <strong><span aria-hidden="true">✓</span> Plantilla redactada y precargada</strong>
      <span>Basada en {REFERENCIAS_MODELO[tipo]}. Secciones, listas y tablas listas para editar.</span>
      {pendientesModelo&&<small>Los datos entre [corchetes] requieren confirmación antes de aprobar o emitir.</small>}
      <button type="button" className="boton boton-secundario" onClick={restaurarTextoBase}>Restaurar texto base</button>
    </div>}
    <label>Tipo de documento
     <input disabled readOnly value={plantilla.titulo}/>
    </label>
    <label>Título del documento
     <input required maxLength={180} value={titulo} disabled={Boolean(vistaVersion)}
      onChange={e=>setTitulo(e.target.value)} placeholder={EJEMPLOS_TITULO_DOCUMENTO[tipo]||"Ej.: Documento de la comunidad"}/>
    </label>
    <label>Estado
     <select disabled={Boolean(vistaVersion)} value={estado} onChange={e=>setEstado(e.target.value)}>
      {Object.entries(ETIQUETAS_ESTADO).map(([key,value])=><option key={key} value={key}>{value}</option>)}
     </select>
    </label>
    <div className="doc-editor-contexto">Contexto: <strong>{entidad||'Documento independiente'}</strong>
      {contexto.tipo&&<small>{contextoNombre[contexto.tipo]}</small>}
    </div>
    <label>Fecha del documento
     <input type="date" value={contenido.fecha||''} disabled={Boolean(vistaVersion)}
      onChange={e=>setContenido(x=>({...x,fecha:e.target.value}))}/>
    </label>
    <label>Elaborado por / Responsable
     <input maxLength={150} value={contenido.responsable||''} disabled={Boolean(vistaVersion)}
      onChange={e=>setContenido(x=>({...x,responsable:e.target.value}))}/>
    </label>
    {campos.map(([clave,nombre])=><label key={clave}>{nombre}
      <textarea rows={clave==='resumen'?3:5} maxLength={18000}
       disabled={Boolean(vistaVersion)} value={contenido[clave]||''}
       onChange={e=>setContenido(x=>({...x,[clave]:e.target.value}))}
       placeholder="Redacta o ajusta esta sección según los antecedentes reales."/>
     </label>)}
    {!!versiones.length&&<div className="doc-editor-versiones">
      <h2>Historial de versiones</h2>
      <button type="button" onClick={()=>setVistaVersion(null)}>Ver versión actual</button>
      {versiones.map(v=><button type="button" key={v.id} className={vistaVersion?.id===v.id?'activo':''}
       onClick={()=>setVistaVersion(v)}>v{v.version} - {new Date(v.creado_en).toLocaleDateString('es-CL')} ({ETIQUETAS_ESTADO[v.estado]})</button>)}
      {vistaVersion&&<p>Vista histórica solo lectura. Vuelve a la versión actual para editar.</p>}
     </div>}
   </section>
   <section className="doc-editor-vista" aria-label="Vista previa del documento">
    <div className="doc-editor-vista-cabecera no-imprimir">
      <strong>Vista previa del documento</strong>
      <span>Formato A4 · Diseño Coproactiva</span>
    </div>
    <article className="doc-editor-hoja">
     <header className="doc-editor-hoja-cabecera">
      <img className="doc-editor-logo" src={import.meta.env.BASE_URL+"brand/imagologo-horizontal-naranja.svg"} alt="Coproactiva"/>
      <span className="doc-editor-documento-tipo">{plantilla.titulo}</span>
     </header>
     <div className="doc-editor-hoja-body">
      <p className="doc-editor-epigrafe">COPROACTIVA / DOCUMENTO CORPORATIVO</p>
      <h2>{tituloVista||plantilla.titulo}</h2>
      <div className="doc-editor-meta">
       <span>{entidad||'Documento interno'}</span>
       <span>{datosVista.fecha||new Date().toLocaleDateString('es-CL')}</span>
       <span>{ETIQUETAS_ESTADO[estadoVista]}</span>
      </div>
      {campos.map(([clave,nombre],index)=><section className="doc-editor-hoja-seccion" key={clave}>
       <div className="doc-editor-seccion-titulo"><span>{String(index+1).padStart(2,'0')}</span><h3>{etiquetaSeccion(nombre)}</h3></div>
       <div className="doc-editor-texto"><BloquesDocumento texto={datosVista[clave]||'Pendiente de completar.'}/></div>
      </section>)}
      <section className="doc-editor-firma">
       <strong>{datosVista.responsable||'Coproactiva Administración SpA'}</strong>
       <span>Responsable del documento</span>
      </section>
     </div>
     <footer className="doc-editor-pie"><span>Gestión activa · Tecnología útil · Ecosistemas saludables</span><span>www.coproactiva.cl</span></footer>
    </article>
   </section>
  </div>
 </main>;
}
