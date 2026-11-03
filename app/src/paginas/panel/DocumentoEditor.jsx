import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO,ETIQUETAS_ESTADO,EJEMPLOS_TITULO_DOCUMENTO,fechaLocalInput} from '../../lib/plantillasDocumentales';
import {descargarPdfDocumento,generarPdfDocumento,nombrePdfDocumento} from '../../lib/documentosPdf';
import {guardarPdfDocumentoDrive} from '../../lib/drive';
import CarpetaDriveComercial from '../../componentes/CarpetaDriveComercial';
import {crearContenidoBaseDocumental,REFERENCIAS_MODELO,tieneDatosPorConfirmar,personalizarModeloConEntidad} from '../../lib/contenidoBaseDocumental';
import BloquesDocumento from '../../componentes/BloquesDocumento';
import SeccionChecklist from '../../componentes/SeccionChecklist';
import VinculacionDocumento from '../../componentes/VinculacionDocumento';
import './DocumentoEditor.css';

const tipos=TIPOS_DOCUMENTO.filter(t=>t.id!=='propuesta_comercial');
const vacio={fecha:fechaLocalInput(),destinatario:'',responsable:'',resumen:''};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contextoValido=t=>['prospecto','comunidad','proveedor'].includes(t);
const contextoNombre={prospecto:'Prospecto',comunidad:'Comunidad',proveedor:'Proveedor'};
function etiquetaSeccion(texto){return String(texto||'').replace(/[^a-zA-Z0-9-_ áéíóúñÁÉÍÓÚÑ]/g,'');}

export default function DocumentoEditor(){
 const {id}=useParams();const [params]=useSearchParams();const navegar=useNavigate();const localizacion=useLocation();
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
 const [prospectoId,setProspectoId]=useState(()=>params.get('prospecto')||(
  (params.get('contexto')==='prospecto'&&uuid.test(params.get('contexto_id')||''))?params.get('contexto_id'):''));
 const [comunidadId,setComunidadId]=useState(()=>params.get('comunidad')||(
  (params.get('contexto')==='comunidad'&&uuid.test(params.get('contexto_id')||''))?params.get('contexto_id'):''));
 const [entidad,setEntidad]=useState('');

 function elegirProspecto(valor,registro){
  setProspectoId(valor);
  if(valor&&registro){
   setContexto({tipo:'prospecto',id:valor});
   setEntidad(registro.nombre_condominio||'');
   if(esNuevo){
    setTitulo(t=>t||plantilla?.titulo+' - '+registro.nombre_condominio);
    setContenido(c=>personalizarModeloConEntidad(c,registro.nombre_condominio));
   }
  }else if(!comunidadId){setEntidad('');setContexto({tipo:'',id:''});}
 }
 function elegirComunidad(valor,registro){
  setComunidadId(valor);
  if(valor&&registro){
   setContexto({tipo:'comunidad',id:valor});
   setEntidad(registro.nombre||'');
   if(esNuevo){
    setTitulo(t=>t||plantilla?.titulo+' - '+registro.nombre);
    setContenido(c=>personalizarModeloConEntidad(c,registro.nombre));
   }
  }else if(!prospectoId){setEntidad('');setContexto({tipo:'',id:''});}
 }
 const [version,setVersion]=useState(null);
 const [versiones,setVersiones]=useState([]);
 const [vistaVersion,setVistaVersion]=useState(null);
 const [guardando,setGuardando]=useState(false);
 const [vistaMovil,setVistaMovil]=useState('editar');
 const [cargando,setCargando]=useState(!esNuevo);
 const [error,setError]=useState('');
 const [aviso,setAviso]=useState(localizacion.state?.driveOk?'Documento archivado en Google Drive.':'');
 const [driveCarpeta,setDriveCarpeta]=useState(localizacion.state?.carpetaId||'');
 const [driveError,setDriveError]=useState(localizacion.state?.driveError||'');
 const [subiendoDrive,setSubiendoDrive]=useState(false);
 async function archivarEnDrive(docId,docVersion){
  const blob=generarPdfDocumento({tipo,titulo:titulo.trim(),contenido,estado});
  const archivo=new File([blob],nombrePdfDocumento(titulo.trim()),{type:'application/pdf'});
  return guardarPdfDocumentoDrive({documentoId:docId,version:docVersion,
   comunidadId:comunidadId||null,carpetaId:driveCarpeta||null,archivo});
 }
 async function reintentarDrive(){
  if(!id||!version||subiendoDrive)return;
  setSubiendoDrive(true);setDriveError('');setError('');
  try{
   await archivarEnDrive(id,version);
   setAviso('PDF de la versión '+version+' archivado en Google Drive.');
  }catch(e){setDriveError('La versión está guardada, pero el PDF no se archivó en Google Drive: '+e.message);}
  finally{setSubiendoDrive(false);}
 }
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
    setProspectoId(d.prospecto_id||(d.contexto_tipo==='prospecto'?d.contexto_id:'')||'');
    setComunidadId(d.comunidad_id||(d.contexto_tipo==='comunidad'?d.contexto_id:'')||'');
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
   if(esNuevo&&data?.[campo]){
    setTitulo(v=>v||plantilla?.titulo+' - '+data[campo]);
    setContenido(actual=>personalizarModeloConEntidad(actual,data[campo]));
   }
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
  setGuardando(true);setError('');setAviso('');setDriveError('');
  const {data,error:e}=await supabase.rpc('guardar_documento_con_relaciones',{
   p_id:esNuevo?null:id,p_tipo:tipo,p_titulo:titulo.trim(),
   p_estado:estado,p_prospecto_id:prospectoId||null,p_comunidad_id:comunidadId||null,
   p_contenido:contenido,p_version_esperada:version
  });
  if(e)setError('No se pudo guardar: '+e.message);
  else{
   setVersion(data.version);setVistaVersion(null);
   setSubiendoDrive(true);
   let falloDrive='';
   try{await archivarEnDrive(data.id,data.version);}
   catch(errorDrive){falloDrive=errorDrive.message||'No se pudo contactar Google Drive.';}
   setSubiendoDrive(false);
   if(esNuevo)navegar('/documentos/'+data.id,{
    replace:true,state:{driveError:falloDrive?'Documento guardado, pero el PDF no se archivó en Google Drive: '+falloDrive:'',driveOk:!falloDrive,carpetaId:driveCarpeta}
   });
   else{
    if(falloDrive)setDriveError('Documento guardado en Gestión Diaria, pero falta su PDF en Drive: '+falloDrive);
    else setAviso('Versión '+data.version+' guardada y archivada en Google Drive.');
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
  {driveError&&<div className="aviso aviso-critico no-imprimir" role="alert">
    <p>{driveError}</p>
    {!esNuevo&&<button type="button" className="boton boton-secundario"
      disabled={subiendoDrive||guardando} onClick={reintentarDrive}>
      {subiendoDrive?'Archivando…':'Reintentar archivo en Drive'}
    </button>}
  </div>
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
      <p>Revisa cada requisito o gestión y marca su casilla. Puedes editar la redacción solo cuando sea necesario.</p>
    </div>
    {!vistaVersion&&<div className="doc-editor-modelo" role="note">
      <strong><span aria-hidden="true">✓</span> Plantilla redactada y precargada</strong>
      <span>Basada en {REFERENCIAS_MODELO[tipo]}. Requisitos y acciones marcables; textos editables de forma opcional.</span>
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
    <VinculacionDocumento prospectoId={prospectoId} comunidadId={comunidadId}
      onProspecto={elegirProspecto} onComunidad={elegirComunidad}
      disabled={Boolean(vistaVersion)||guardando}/>
    {comunidadId?
      <div className="doc-editor-drive-comunidad">
       <strong>Destino: Google Drive de la comunidad</strong>
       <p>04 Seguimiento e informes / Informes. Se utilizará la carpeta configurada para esta comunidad.</p>
      </div>:
      <CarpetaDriveComercial valor={driveCarpeta} onChange={setDriveCarpeta}
        disabled={guardando||Boolean(vistaVersion)}/>}
    <div className="doc-editor-contexto">
      Relaciones: <strong>{prospectoId&&comunidadId?'Lead del CRM y comunidad':
        comunidadId?'Comunidad':prospectoId?'Lead / prospecto':entidad||'Documento independiente'}</strong>
    </div>
    <label>Fecha del documento
     <input type="date" value={contenido.fecha||''} disabled={Boolean(vistaVersion)}
      onChange={e=>setContenido(x=>({...x,fecha:e.target.value}))}/>
    </label>
    <label>Elaborado por / Responsable
     <input maxLength={150} value={contenido.responsable||''} disabled={Boolean(vistaVersion)}
      onChange={e=>setContenido(x=>({...x,responsable:e.target.value}))}/>
    </label>
    {campos.map(([clave,nombre])=><SeccionChecklist key={clave} clave={clave} nombre={nombre}
       contenido={contenido} disabled={Boolean(vistaVersion)}
       onChange={setContenido}/>)}
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
       <div className="doc-editor-texto"><BloquesDocumento texto={datosVista[clave]||'Pendiente de completar.'} clave={clave} contenido={datosVista}/></div>
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
