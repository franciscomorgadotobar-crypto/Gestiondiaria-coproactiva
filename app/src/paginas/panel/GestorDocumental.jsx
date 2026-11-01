import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {TIPOS_DOCUMENTO,ETIQUETAS_ESTADO} from '../../lib/plantillasDocumentales';
import './GestorDocumental.css';

const FILTROS=[
 ['todos','Todos'],['propuesta_comercial','Propuestas'],['seguimiento_documental','Seguimiento'],
 ['primera_administracion','Primera administración'],['informe_gestion','Informes'],
 ['emitidos','Emitidos'],['borradores','Borradores']
];
const ICONOS={
 folder:<path d="M3 7h6l2 2h10v10H3z" />,
 file:<><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></>,
 check:<><path d="M4 11h4l2 3 6-7"/><path d="M3 3h18v18H3z"/></>,
 building:<><path d="M4 21V6l8-3 8 3v15M9 9v2m6-2v2M9 15v2m6-2v2"/></>,
 chart:<><path d="M4 20V4M4 20h17M9 17v-6m5 6V7m5 10V3"/></>,
 cloud:<><path d="M5 17a4 4 0 0 1 0-8 7 7 0 0 1 14 2 3 3 0 0 1-1 6H5z"/><path d="M12 21V12m-3 3 3-3 3 3"/></>,
 layers:<><path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></>,
 paperclip:<path d="m7 12 7-7a4 4 0 0 1 6 6L11 20a6 6 0 0 1-9-9l9-9" />,
 eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
 search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>
};
function Icon({name,size=21}){return <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" aria-hidden="true">{ICONOS[name]||ICONOS.file}</svg>}
const FECHA=new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric'});
const bytes=n=>!n?'0 MB':(Number(n)/1048576).toLocaleString('es-CL',{maximumFractionDigits:2})+' MB';
const contexto=f=>f.contexto_nombre||f.contexto_tipo&&({
 prospecto:'CRM / Prospecto',comunidad:'Comunidad',proveedor:'Proveedor'
}[f.contexto_tipo])||'Interno';
const FECHA_VALOR=f=>new Date(f.actualizado_en||f.creado_en||0).getTime()||0;
const ESTADO_CLASE=e=>(e||'borrador').replace(/[^a-z_]/g,'');
const TIPO_ICONO={propuesta_comercial:'file',seguimiento_documental:'check',primera_administracion:'building',informe_gestion:'chart'};

export default function GestorDocumental(){
 const [params]=useSearchParams();
 const [documentos,setDocumentos]=useState([]);
 const [propuestas,setPropuestas]=useState([]);
 const [biblioteca,setBiblioteca]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const [busqueda,setBusqueda]=useState('');
 const [filtro,setFiltro]=useState('todos');
 const [mostrarBiblioteca,setMostrarBiblioteca]=useState(false);
 const [actualizando,setActualizando]=useState(false);
 const contextoParams=['prospecto','comunidad','proveedor'].find(k=>params.has(k));
 const contextoId=contextoParams?params.get(contextoParams):null;
 const desdeCorreo=params.get('origen')==='correo';
 const contextoQuery=contextoParams?'&'+contextoParams+'='+encodeURIComponent(contextoId):'';
 const rutaNuevo=tipo=>tipo==='propuesta_comercial'
   ? '/propuestas'+(contextoParams==='prospecto'?'?prospecto='+encodeURIComponent(contextoId):'')
   : '/documentos/nuevo?tipo='+tipo+contextoQuery;

 const cargar=useCallback(async()=>{
  setError('');setActualizando(true);
  const [docs,props,archivos]=await Promise.all([
   supabase.from('documentos_gestion')
    .select('id,tipo,titulo,estado,contexto_tipo,contexto_id,version,actualizado_en,creado_en')
    .order('actualizado_en',{ascending:false}).limit(200),
   supabase.from('propuestas_comerciales')
    .select('id,nombre,prospecto_id,actualizado_en').order('actualizado_en',{ascending:false}).limit(100),
   supabase.functions.invoke('correo-archivos',{body:{action:'list'}})
  ]);
  if(docs.error||props.error)setError([docs.error?.message,props.error?.message].filter(Boolean).join(' | '));
  if(!docs.error)setDocumentos(docs.data||[]);
  if(!props.error)setPropuestas(props.data||[]);
  if(!archivos.error&&archivos.data?.ok)setBiblioteca(archivos.data.archivos||[]);
  setCargando(false);setActualizando(false);
 },[]);
 useEffect(()=>{cargar();},[cargar]);
 const registros=useMemo(()=>{
  const d=documentos.map(v=>({...v,contexto_nombre:'',accion:'/documentos/'+v.id}));
  const p=propuestas.map(v=>({
    id:v.id,tipo:'propuesta_comercial',titulo:v.nombre,
    estado:'guardada',version:null,contexto_tipo:'prospecto',
    contexto_id:v.prospecto_id,contexto_nombre:'CRM / Comercial',
    actualizado_en:v.actualizado_en,accion:'/propuestas?documento='+encodeURIComponent(v.id)
  }));
  return [...d,...p].sort((a,b)=>FECHA_VALOR(b)-FECHA_VALOR(a));
 },[documentos,propuestas]);
 const filtrados=useMemo(()=>registros.filter(v=>{
  if(contextoId&&!(v.contexto_id===contextoId))return false;
  if(filtro==='emitidos'&&v.estado!=='emitido')return false;
  if(filtro==='borradores'&&v.estado!=='borrador')return false;
  if(!['todos','emitidos','borradores'].includes(filtro)&&v.tipo!==filtro)return false;
  const q=busqueda.toLocaleLowerCase('es-CL').trim();
  return !q||[v.titulo,v.contexto_nombre,v.tipo,v.estado].some(a=>String(a||'').toLocaleLowerCase('es-CL').includes(q));
 }),[registros,contextoId,filtro,busqueda]);
 const tipoNombre=id=>TIPOS_DOCUMENTO.find(t=>t.id===id)?.titulo||id;
 const totalBytes=biblioteca.reduce((s,f)=>s+(Number(f.tamano)||0),0);
 const textoContexto=contextoParams?({
   prospecto:'prospecto del CRM',comunidad:'comunidad',proveedor:'proveedor'
 }[contextoParams]):'todos los módulos';
 return <main className="documentos-gestor">
  <header className="documentos-cabecera">
   <div className="documentos-titulo-principal">
    <span className="documentos-kicker">COPROACTIVA / GESTIÓN DOCUMENTAL</span>
    <div className="documentos-titulo-icono"><span className="documentos-carpeta-icono"><Icon name="folder" size={28}/></span><div>
     <h1>Gestor documental</h1>
     <p>Plantillas, documentos, versiones y biblioteca central</p>
    </div></div>
   </div>
   <button type="button" className="documentos-actualizar" onClick={cargar} disabled={actualizando}>
    {actualizando?'Actualizando...':'Actualizar documentos'}
   </button>
  </header>
  {desdeCorreo&&<div className="documentos-contexto-banner">
   <Icon name="paperclip" size={19}/>
   <p>Abierto desde Correos. Genera y guarda el PDF en la biblioteca para seleccionarlo como adjunto real. El borrador del correo permanece abierto en la otra pestaña.</p>
  </div>}
  {contextoId&&<div className="documentos-contexto-banner"><Icon name="folder" size={19}/>
   <p>Documentos asociados al {textoContexto}. Puedes crear uno nuevo con este vínculo.</p>
   <Link to="/documentos">Ver todos</Link>
  </div>}
  <label className="documentos-buscador">
    <Icon name="search"/><input aria-label="Buscar documentos y plantillas" type="search"
     placeholder="Buscar documentos, plantillas o contextos..." value={busqueda}
     onChange={e=>setBusqueda(e.target.value)}/>
  </label>
  <div className="documentos-filtros" role="group" aria-label="Filtrar documentos">
   {FILTROS.map(([valor,nombre])=><button type="button" key={valor} className={filtro===valor?'activo':''}
    aria-pressed={filtro===valor} onClick={()=>setFiltro(valor)}>{nombre}</button>)}
  </div>
  <div className="documentos-contenido">
   <div className="documentos-principal">
    <section className="documentos-plantillas-seccion">
     <div className="documentos-seccion-titulo"><h2>Crear desde plantilla</h2>
      <p>Documentos con el formato corporativo de Coproactiva</p>
     </div>
     <div className="documentos-plantillas">
      {TIPOS_DOCUMENTO.map(t=><article key={t.id} className="documentos-plantilla">
       <div className="documentos-tarjeta-icono"><Icon name={TIPO_ICONO[t.id]} size={27}/></div>
       <h3>{t.titulo}</h3><p>{t.descripcion}</p>
       <Link className="documentos-crear" to={rutaNuevo(t.id)}>Crear +</Link>
      </article>)}
     </div>
    </section>
    <section className="documentos-recientes-seccion">
     <div className="documentos-recientes-encabezado">
      <div><h2><Icon name="file" size={19}/> Documentos recientes</h2>
       <p>{filtrados.length} documento{filtrados.length===1?'':'s'} visible{filtrados.length===1?'':'s'}</p></div>
      {busqueda||filtro!=='todos'?<button type="button" onClick={()=>{setFiltro('todos');setBusqueda('');}}>Limpiar filtros</button>:null}
     </div>
     {error&&<p className="documentos-error" role="alert">No se pudieron cargar todos los documentos: {error}</p>}
     {cargando?<p className="documentos-vacio">Cargando documentos...</p>:
       filtrados.length===0?<div className="documentos-vacio">
        <Icon name="folder" size={27}/><strong>No hay documentos con esos criterios.</strong>
        <span>Usa una plantilla para crear el primer documento o cambia los filtros.</span>
       </div>:
       <div className="documentos-tabla-contenedor"><table className="documentos-tabla">
        <thead><tr><th>Documento</th><th>Contexto</th><th>Estado</th><th>Versión</th><th>Actualizado</th><th>Acción</th></tr></thead>
        <tbody>{filtrados.map(d=><tr key={d.tipo+':'+d.id}>
         <td><div className="documentos-celda-nombre">
          <span className="documentos-archivo-icono"><Icon name={TIPO_ICONO[d.tipo]} size={19}/></span>
          <span><strong>{d.titulo}</strong><small>{tipoNombre(d.tipo)}</small></span>
         </div></td>
         <td>{contexto(d)}</td>
         <td><span className={'documentos-estado '+ESTADO_CLASE(d.estado)}>
          {ETIQUETAS_ESTADO[d.estado]||'Guardada'}</span></td>
         <td>{d.version?'v'+d.version:'-'}</td>
         <td>{FECHA_VALOR(d)?FECHA.format(new Date(FECHA_VALOR(d))):'-'}</td>
         <td><Link to={d.accion} aria-label={'Abrir '+d.titulo} className="documentos-abrir"><Icon name="eye" size={18}/> Abrir</Link></td>
        </tr>)}</tbody>
       </table></div>}
    </section>
   </div>
   <aside className="documentos-lateral">
    <div className="documentos-panel-lateral">
     <h2><Icon name="cloud" size={23}/> Biblioteca y Drive</h2>
     <p>Almacena, reutiliza y adjunta documentos en los módulos autorizados.</p>
     <div className="documentos-funcion">
      <Icon name="folder" size={21}/>
      <div><strong>Biblioteca central</strong><span>Archivos reales disponibles para adjuntar desde los correos.</span></div>
     </div>
     <div className="documentos-funcion">
      <Icon name="layers" size={21}/>
      <div><strong>Control de versiones</strong><span>Historial de revisiones de cada documento generado.</span></div>
     </div>
     <div className="documentos-funcion">
      <Icon name="paperclip" size={21}/>
      <div><strong>Adjuntar y compartir</strong><span>Elige qué PDF enviar y dónde guardar su copia permanente.</span></div>
     </div>
     <div className="documentos-almacenamiento">
      <strong>Documentos en la biblioteca</strong>
      <b>{biblioteca.length}</b>
      <span>{bytes(totalBytes)} almacenados</span>
     </div>
     <button type="button" className="documentos-ver-biblioteca"
      onClick={()=>setMostrarBiblioteca(v=>!v)} aria-expanded={mostrarBiblioteca}>
      {mostrarBiblioteca?'Ocultar biblioteca':'Ver biblioteca'} <span aria-hidden="true">›</span>
     </button>
     {mostrarBiblioteca&&<div className="documentos-biblioteca-lista">
       {biblioteca.length?biblioteca.slice(0,20).map(a=><div key={a.id}>
        <Icon name="file" size={16}/><span>{a.nombre}<small>{bytes(a.tamano)}</small></span>
       </div>):<p>No hay documentos guardados en la biblioteca.</p>}
       <small>Para adjuntar, abre el editor de correo del módulo correspondiente.</small>
      </div>}
    </div>
   </aside>
  </div>
  <footer className="documentos-flujo">
   <strong>Un mismo documento, conectado con toda la aplicación</strong>
   <span><Icon name="folder"/> Se gestiona aquí</span>
   <span><Icon name="file"/> Se crea desde cualquier módulo</span>
   <span><Icon name="paperclip"/> Se adjunta o consulta según permisos</span>
  </footer>
 </main>;
}
