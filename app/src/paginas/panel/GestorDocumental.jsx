import {Fragment,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {TIPOS_DOCUMENTO,ETIQUETAS_ESTADO} from '../../lib/plantillasDocumentales';
import EnlacesSegurosDocumento from '../../componentes/EnlacesSegurosDocumento';
import './GestorDocumental.css';

const FILTROS=[
 ['todos','Todos'],['propuesta_comercial','Propuestas'],['seguimiento_documental','Seguimiento'],
 ['primera_administracion','Primera administración'],['informe_gestion','Informes'],
 ['emitido','Emitidos'],['borrador','Borradores']
];
const iconos={
 propuesta_comercial:'▤',seguimiento_documental:'☑',
 primera_administracion:'▥',informe_gestion:'▥'
};
const fecha=valor=>valor?new Date(valor).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}):'-';

export default function GestorDocumental(){
 const [params,setParams]=useSearchParams();
 const [buscar,setBuscar]=useState('');
 const [filtro,setFiltro]=useState(params.get('filtro')||'todos');
 const [documentos,setDocumentos]=useState([]);
 const [archivos,setArchivos]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const [bibliotecaError,setBibliotecaError]=useState('');
 const [verBiblioteca,setVerBiblioteca]=useState(params.get('vista')==='biblioteca');
 const [enlaceArchivoId,setEnlaceArchivoId]=useState(null);
 const prospecto=params.get('prospecto')||'';
 const comunidad=params.get('comunidad')||'';
 const proveedor=params.get('proveedor')||'';
 const desdeCorreo=params.get('origen')==='correo';
 const contextoTipo=prospecto?'prospecto':comunidad?'comunidad':proveedor?'proveedor':null;
 const contextoId=prospecto||comunidad||proveedor||'';
 const queryContexto=contextoTipo?'&contexto='+contextoTipo+'&contexto_id='+encodeURIComponent(contextoId):'';
 const rutaNueva=prospecto?'/propuestas?prospecto='+encodeURIComponent(prospecto):'/propuestas';
 const rutaPlantilla=tipo=>'/documentos/nuevo?tipo='+tipo+queryContexto;

 useEffect(()=>{
  let vigente=true;
  async function cargar(){
   setCargando(true);setError('');
   const [propuestas,documentosGenericos,biblioteca]=await Promise.all([
    supabase.from('propuestas_comerciales')
      .select('id,nombre,actualizado_en,prospecto_id').order('actualizado_en',{ascending:false}).limit(250),
    supabase.from('documentos_gestion')
      .select('id,tipo,titulo,estado,version,contexto_tipo,contexto_id,actualizado_en')
      .order('actualizado_en',{ascending:false}).limit(250),
    supabase.functions.invoke('correo-archivos',{body:{action:'list'}})
   ]);
   if(!vigente)return;
   const errs=[propuestas.error,documentosGenericos.error].filter(Boolean);
   if(errs.length)setError('No se pudo consultar toda la información: '+errs.map(e=>e.message).join(' / '));
   const a=(propuestas.data||[]).map(d=>({
    id:d.id,tipo:'propuesta_comercial',titulo:d.nombre,estado:'borrador',
    contexto_tipo:d.prospecto_id?'prospecto':null,contexto_id:d.prospecto_id,
    version:1,actualizado_en:d.actualizado_en,ruta:'/propuestas?documento='+d.id
   }));
   const b=(documentosGenericos.data||[]).map(d=>({
    ...d,ruta:'/documentos/'+d.id
   }));
   setDocumentos([...a,...b].sort((x,y)=>String(y.actualizado_en).localeCompare(String(x.actualizado_en))));
   if(biblioteca.error||!biblioteca.data?.ok)setBibliotecaError('La biblioteca de adjuntos se puede consultar desde el editor de correos.');
   else setArchivos(biblioteca.data.archivos||[]);
   setCargando(false);
  }
  cargar();
  return()=>{vigente=false;};
 },[]);

 const filtrados=useMemo(()=>documentos.filter(d=>{
  if(filtro==='emitido'&&d.estado!=='emitido')return false;
  if(filtro==='borrador'&&d.estado!=='borrador')return false;
  if(!['todos','emitido','borrador'].includes(filtro)&&d.tipo!==filtro)return false;
  if(contextoTipo&&!(d.contexto_tipo===contextoTipo&&d.contexto_id===contextoId))return false;
  const texto=(d.titulo+' '+d.tipo+' '+d.estado).toLocaleLowerCase('es-CL');
  return texto.includes(buscar.toLocaleLowerCase('es-CL').trim());
 }),[documentos,filtro,contextoTipo,contextoId,buscar]);
 const archivosFiltrados=useMemo(()=>archivos.filter(a=>{
  const t=(a.nombre||'').toLocaleLowerCase('es-CL');
  return t.includes(buscar.toLocaleLowerCase('es-CL').trim());
 }),[archivos,buscar]);
 const etiquetaContexto=d=>d.contexto_tipo==='prospecto'?'CRM / Prospecto':
  d.contexto_tipo==='comunidad'?'Comunidad':d.contexto_tipo==='proveedor'?'Proveedor':'General';
 function alternarBiblioteca(estado){
  setVerBiblioteca(estado);const nuevos=new URLSearchParams(params);
  if(estado)nuevos.set('vista','biblioteca');else nuevos.delete('vista');
  setParams(nuevos,{replace:true});
 }
 return <main className="documentos-gestor comercial-ui comercial-documentos">
  <header className="documentos-gestor-cabecera">
   <div><span className="documentos-kicker comercial-eyebrow">Comercial · Documentación centralizada</span>
    <h1><span className="documentos-cabecera-icono" aria-hidden="true">▱</span> Gestor documental</h1>
    <p>Plantillas, documentos, versiones y biblioteca central.</p>
   </div>
   <Link className="boton documentos-nuevo" to={rutaPlantilla('informe_gestion')}>+ Crear documento</Link>
  </header>
  {desdeCorreo&&<div className="documentos-origen-correo">
   <strong>Estás consultando documentos desde Correos.</strong>
   <p>Esta ventana conserva el borrador del correo. Puedes crear documentos aquí y seleccionar archivos PDF disponibles en la biblioteca interna al regresar al compositor.</p>
  </div>}
  {contextoTipo&&<div className="documentos-contexto">
   <span>Vista contextual: {etiquetaContexto({contexto_tipo:contextoTipo})}</span>
   <Link to="/documentos">Ver todos los documentos</Link>
  </div>}
  <div className="documentos-caja-busqueda">
   <span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar documentos"
    placeholder="Buscar documentos, plantillas o contextos..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
  </div>
  <nav className="documentos-filtros" aria-label="Filtrar documentos">
   {FILTROS.map(([clave,nombre])=><button type="button" key={clave}
    onClick={()=>{setFiltro(clave);alternarBiblioteca(false);}}
    aria-pressed={!verBiblioteca&&filtro===clave}
    className={!verBiblioteca&&filtro===clave?'activo':''}>{nombre}</button>)}
   <button type="button" onClick={()=>alternarBiblioteca(true)}
    aria-pressed={verBiblioteca} className={verBiblioteca?'activo':''}>Biblioteca</button>
  </nav>
  <div className="documentos-layout">
   <div className="documentos-principal">
    <section className="documentos-seccion" aria-label="Crear desde plantilla">
     <div className="documentos-plantillas">
      {TIPOS_DOCUMENTO.map((t,i)=><article key={t.id} className="documentos-plantilla">
       <div className="documentos-plantilla-icono" aria-hidden="true">{iconos[t.id]}</div>
       <h2>{t.titulo}</h2>
       <p>{t.descripcion}</p>
       <Link className={'boton '+(i?'boton-secundario':'')}
        to={t.id==='propuesta_comercial'?rutaNueva:rutaPlantilla(t.id)}>Crear +</Link>
      </article>)}
     </div>
    </section>
    <section className="documentos-seccion" aria-labelledby="documentos-recientes">
     <div className="documentos-tabla-titulo">
      <h2 id="documentos-recientes">{verBiblioteca?'Biblioteca de adjuntos':'Documentos recientes'}</h2>
      <button type="button" onClick={()=>alternarBiblioteca(!verBiblioteca)}>
       {verBiblioteca?'Ver documentos':'Ver biblioteca completa'}
      </button>
     </div>
     {cargando?<p className="documentos-vacio">Cargando documentos...</p>:
      verBiblioteca?
      <div className="documentos-tabla-wrap">
       {bibliotecaError&&<p className="documentos-vacio">{bibliotecaError}</p>}
       {!bibliotecaError&&!archivosFiltrados.length&&<p className="documentos-vacio">No hay archivos que coincidan con la búsqueda.</p>}
       {!!archivosFiltrados.length&&<table className="documentos-tabla">
        <thead><tr><th>Archivo</th><th>Categoría</th><th>Tamaño</th><th>Acción</th></tr></thead>
        <tbody>{archivosFiltrados.map(a=><Fragment key={a.id}>
         <tr>
          <td><span className="documentos-tipo-archivo">{a.mime==='application/pdf'?'PDF':'FILE'}</span>{a.nombre}</td>
          <td>{a.categoria||'General'}</td><td>{(Number(a.tamano||0)/1048576).toFixed(2)} MB</td>
          <td>{a.mime==='application/pdf'?
           <button type="button" className="boton boton-secundario"
             aria-expanded={enlaceArchivoId===a.id}
             onClick={()=>setEnlaceArchivoId(v=>v===a.id?null:a.id)}>
             {enlaceArchivoId===a.id?'Cerrar seguimiento':'Enlace seguro'}
           </button>:<span className="documentos-estado">Disponible para adjuntar</span>}</td>
         </tr>
         {a.mime==='application/pdf'&&enlaceArchivoId===a.id&&
          <tr className="documentos-fila-enlace"><td colSpan={4}><EnlacesSegurosDocumento archivo={a}/></td></tr>}
        </Fragment>)}</tbody>
       </table>}
      </div>:
      <div className="documentos-tabla-wrap">
       {error&&<p role="alert" className="documentos-vacio">{error}</p>}
       {!filtrados.length?<p className="documentos-vacio">No hay documentos para este filtro. Puedes crear uno desde las plantillas superiores.</p>:
       <table className="documentos-tabla">
        <thead><tr><th>Documento</th><th>Contexto</th><th>Estado</th><th>Versión</th><th>Actualizado</th><th>Acción</th></tr></thead>
        <tbody>{filtrados.map(d=><tr key={d.tipo+'-'+d.id}>
         <td className="documentos-nombre"><span className="documentos-tipo-archivo" aria-hidden="true">{d.tipo==='propuesta_comercial'?'PDF':'DOC'}</span>{d.titulo}</td>
         <td>{etiquetaContexto(d)}</td>
         <td><span className={'documentos-estado estado-'+d.estado}>{ETIQUETAS_ESTADO[d.estado]||d.estado}</span></td>
         <td>v{d.version}</td><td>{fecha(d.actualizado_en)}</td>
         <td><Link className="documentos-abrir" to={d.ruta}>Abrir</Link></td>
        </tr>)}</tbody>
       </table>}
      </div>}
    </section>
   </div>
   <aside className="documentos-lateral" aria-label="Biblioteca y Drive">
    <h2><span aria-hidden="true">☁</span> Biblioteca y Drive</h2>
    <p>Almacena, versiona y reutiliza documentos de forma centralizada.</p>
    <div className="documentos-lateral-item"><span aria-hidden="true">▱</span>
     <div><strong>Biblioteca central</strong><small>{archivos.length} archivos en la biblioteca de correos.</small></div>
    </div>
    <div className="documentos-lateral-item"><span aria-hidden="true">▤</span>
     <div><strong>Control de versiones</strong><small>Cada edición guarda una revisión anterior del documento.</small></div>
    </div>
    <div className="documentos-lateral-item"><span aria-hidden="true">♧</span>
     <div><strong>Adjuntar y compartir</strong><small>Archivos reutilizables desde CRM, Operaciones y Correos.</small></div>
    </div>
    <button type="button" className="boton boton-secundario documentos-biblioteca-boton"
     onClick={()=>alternarBiblioteca(true)}>Ver biblioteca</button>
    <a className="documentos-drive-link" href="https://drive.google.com/drive/u/0/my-drive"
     target="_blank" rel="noopener noreferrer">Abrir Google Drive</a>
   </aside>
  </div>
 </main>;
}
