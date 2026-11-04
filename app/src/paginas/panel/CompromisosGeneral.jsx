import {Fragment,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import {useVolverGlobal} from '../../lib/navegacion';
import './CompromisosGeneral.css';
import {resumenGlobalCompromisos} from '../../lib/progresoCompromisos';
import Compromisos from '../cliente/Compromisos';

const ETAPAS=[['todos','Todos'],['pendiente','Pendientes'],['en_curso','En ejecución'],['en_espera','En espera'],['completado','Completados']];
const FECHA=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-CL'):'Sin fecha';
export default function CompromisosGeneral({integrado=false}){
 const navegar=useNavigate();
 useVolverGlobal(()=>navegar('/'));
 const {perfil}=useSesion();
 const [items,setItems]=useState(null),[comunidades,setComunidades]=useState([]),[error,setError]=useState('');
 const [filtro,setFiltro]=useState('todos');
 const [vista,setVista]=useState('comunidad');
 const [ordenVista,setOrdenVista]=useState('fecha');
 const [nuevoEnGrupo,setNuevoEnGrupo]=useState(null);
 const [nuevoTitulo,setNuevoTitulo]=useState('');
 const [nuevoResponsable,setNuevoResponsable]=useState('');
 const [nuevaFecha,setNuevaFecha]=useState('');
 const [creando,setCreando]=useState(false);
 const [busqueda,setBusqueda]=useState('');
 const [abiertos,setAbiertos]=useState(new Set());
 const [seleccionadoId,setSeleccionadoId]=useState(null);
 function abrirCompromiso(id){
  setSeleccionadoId(actual=>actual===id?null:id);
 }
 async function actualizarListado(){
  const {data,error:err}=await supabase.from('compromisos_administracion')
   .select('id,comunidad_id,titulo,estado,avance,responsable,fecha_limite,fecha_proxima_accion,orden,creado_en')
   .order('orden',{ascending:true,nullsFirst:false});
  if(err){setError('No fue posible actualizar los compromisos: '+err.message);return;}
  setItems(data||[]);
  setSeleccionadoId(actual=>(data||[]).some(x=>x.id===actual)?actual:null);
 }
 const [editandoTitulo,setEditandoTitulo]=useState(null);
 const [guardandoTitulo,setGuardandoTitulo]=useState(false);
 async function guardarTitulo(e){
  e.preventDefault();
  if(!puedeGestionar||guardandoTitulo||!editandoTitulo)return;
  const titulo=editandoTitulo.valor.trim();
  if(!titulo||titulo.length>180){
   setError('El título debe contener entre 1 y 180 caracteres.');
   return;
  }
  const anterior=items?.find(x=>x.id===editandoTitulo.id);
  if(!anterior)return;
  if(titulo===anterior.titulo){setEditandoTitulo(null);return;}
  setGuardandoTitulo(true);setError('');
  try{
   const {data,error:err}=await supabase.from('compromisos_administracion')
    .update({titulo}).eq('id',editandoTitulo.id).select('id,titulo').single();
   if(err)throw err;
   setItems(actual=>(actual||[]).map(x=>x.id===data.id?{...x,titulo:data.titulo}:x));
   setEditandoTitulo(null);
  }catch(err){setError('No fue posible guardar el título: '+(err.message||'Error desconocido'));}
  finally{setGuardandoTitulo(false);}
 }
 const puedeGestionar=['superadmin','admin','jefatura'].includes(perfil?.rol);
 async function crearCompromiso(e,comunidadId){
  e.preventDefault();
  const titulo=nuevoTitulo.trim();
  if(!puedeGestionar||creando||!comunidadId||!titulo)return;
  setCreando(true);setError('');
  try{
   const {data,error:err}=await supabase.from('compromisos_administracion')
    .insert({comunidad_id:comunidadId,titulo,responsable:nuevoResponsable.trim(),
      fecha_limite:nuevaFecha||null,publicado:false})
    .select('id').single();
   if(err)throw err;
   setNuevoEnGrupo(null);setNuevoTitulo('');setNuevoResponsable('');setNuevaFecha('');
   await actualizarListado();
   if(data?.id)setSeleccionadoId(data.id);
  }catch(err){setError('No fue posible crear el compromiso: '+(err.message||'Error desconocido'));}
  finally{setCreando(false);}
 }
 useEffect(()=>{
  let vivo=true;
  Promise.all([
   supabase.from('compromisos_administracion').select('id,comunidad_id,titulo,estado,avance,responsable,fecha_limite,fecha_proxima_accion,orden,creado_en').order('orden',{ascending:true,nullsFirst:false}),
   supabase.from('comunidades').select('id,nombre,comuna').order('nombre')
  ]).then(([c,b])=>{
   if(!vivo)return;
   if(c.error||b.error)setError(c.error?.message||b.error?.message);
   setItems(c.data||[]);setComunidades(b.data||[]);
   // Si solo hay una comunidad, mostrar sus compromisos al abrir:
   // evita la tarjeta vacía que se veía en escritorio.
   const idsComunidad=new Set((c.data||[]).map(item=>item.comunidad_id));
   if(idsComunidad.size===1)setAbiertos(new Set(idsComunidad));
  });
  return()=>{vivo=false};
 },[]);
 const global=useMemo(()=>resumenGlobalCompromisos(items||[]),[items]);
 const porComunidad=useMemo(()=>{
  const nombres=new Map(comunidades.map(c=>[c.id,c]));
  const salida=new Map();
  for(const c of items||[]){
   if(filtro!=='todos'&&c.estado!==filtro)continue;
   const comunidad=nombres.get(c.comunidad_id);
   const texto=(c.titulo+' '+(comunidad?.nombre||'')+' '+(c.responsable||'')).toLowerCase();
   if(!texto.includes(busqueda.toLowerCase().trim()))continue;
   const responsable=(c.responsable||'Sin responsable').trim()||'Sin responsable';
   const key=vista==='responsable'?'responsable:'+responsable:c.comunidad_id;
   if(!salida.has(key))salida.set(key,{key,comunidad:vista==='responsable'
     ?{id:null,nombre:responsable,comuna:'Responsable'}
     :comunidad,items:[]});
   salida.get(key).items.push(c);
  }
  const grupos=[...salida.values()];
  for(const grupo of grupos){
   grupo.items.sort((a,b)=>{
    if(ordenVista==='avance')return (Number(b.avance)||0)-(Number(a.avance)||0);
    if(ordenVista==='orden')return (a.orden??99999)-(b.orden??99999);
    return (a.fecha_limite||'9999-12-31').localeCompare(b.fecha_limite||'9999-12-31')
      ||(a.orden??99999)-(b.orden??99999);
   });
  }
  return grupos.sort((a,b)=>(a.comunidad?.nombre||'').localeCompare(b.comunidad?.nombre||'','es'));
 },[items,comunidades,filtro,busqueda,vista,ordenVista]);
 return <section className={'pantalla modulo-unificado compromisos-general'+(integrado?' compromisos-general-embebido':'')}>
   <header className="encabezado modulo-cabecera compromisos-general-cabecera">
     <div>
       {integrado?<h2 className="h3">Compromisos y avances</h2>:<h1 className="h3">Compromisos y avances</h1>}
       <p className="chico apagado">Seguimiento por comunidad, responsable y fecha comprometida.</p>
     </div>
     <div className="compromisos-general-filtros" role="search" aria-label="Filtrar compromisos">
       <label>Etapa<select value={filtro} onChange={e=>setFiltro(e.target.value)}>
         {ETAPAS.map(([id,t])=><option key={id} value={id}>{t}</option>)}
       </select></label>
       <label>Buscar comunidad o compromiso<input type="search" value={busqueda}
         onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar comunidad, responsable o tarea…"/></label>
     </div>
   </header>
   <div className="cuerpo modulo-contenido compromisos-general-cuerpo">
     {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
     {items!==null&&<section className="compromisos-general-kpis" aria-label="Avance global de compromisos">
       <div className="compromisos-general-kpi-circular">
         <span className="compromisos-general-anillo" style={{'--avance':global.porcentaje+'%'}}>
           <strong>{global.porcentaje}%</strong><small>Avance global</small>
         </span>
       </div>
       <div><strong>{global.abiertos}</strong><span>Por resolver</span></div>
       <div><strong>{global.completados}</strong><span>Completados</span></div>
       <div><strong>{global.total}</strong><span>Total</span></div>
       <div className="compromisos-general-kpi-balance">
         <strong>Estado actual</strong>
         <span>{items.filter(c=>c.estado==='en_curso').length} en ejecución</span>
         <div className="compromisos-general-balance-barra" role="progressbar"
           aria-label="Avance global actual" aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={global.porcentaje}>
           <span style={{width:global.porcentaje+'%'}}/>
         </div>
         <small>Avance calculado a partir de los compromisos registrados</small>
       </div>
     </section>}
     <div className="compromisos-general-herramientas">
       <div className="compromisos-general-vistas" role="tablist" aria-label="Agrupar compromisos">
         <button type="button" role="tab" aria-selected={vista==='comunidad'}
           className={vista==='comunidad'?'activo':''} onClick={()=>{setVista('comunidad');setSeleccionadoId(null)}}>
           Por comunidad
         </button>
         <button type="button" role="tab" aria-selected={vista==='responsable'}
           className={vista==='responsable'?'activo':''} onClick={()=>{setVista('responsable');setSeleccionadoId(null)}}>
           Por responsable
         </button>
       </div>
       <label className="compromisos-general-ordenar">Ordenar por:
         <select value={ordenVista} onChange={e=>setOrdenVista(e.target.value)}
           aria-label="Ordenar compromisos">
           <option value="fecha">Fecha comprometida</option>
           <option value="orden">Orden de gestión</option>
           <option value="avance">Mayor avance</option>
         </select>
       </label>
     </div>
     {items===null?<p className="cargando">Cargando compromisos…</p>:<div className="compromisos-general-lista">
       {porComunidad.map(({key:grupoKey,comunidad,items:lista})=>{
         const id=comunidad?.id||lista[0].comunidad_id;
         const abierto=abiertos.has(grupoKey)||Boolean(busqueda);
         const avanceGrupo=Math.round(lista.reduce((n,x)=>n+(Number(x.avance)||0),0)/lista.length);
         const cerrados=lista.filter(c=>c.estado==='completado').length;
         const enCurso=lista.filter(c=>c.estado==='en_curso').length;
         const proxima=lista.filter(c=>c.fecha_proxima_accion).sort((a,b)=>a.fecha_proxima_accion.localeCompare(b.fecha_proxima_accion))[0];
         return <section className="tarjeta compromisos-general-grupo" key={grupoKey}>
           <button type="button" aria-expanded={abierto} className="compromisos-general-desplegar"
             onClick={()=>setAbiertos(x=>{const y=new Set(x);y.has(grupoKey)?y.delete(grupoKey):y.add(grupoKey);return y})}>
             <span className="compromisos-general-nombre-grupo">
               <strong>{comunidad?.nombre||'Comunidad'}</strong>
               <small>{comunidad?.comuna||'Comunidad sin comuna informada'}</small>
             </span>
             <span className="compromisos-general-progreso-grupo">
               <small>Avance</small><strong>{avanceGrupo}%</strong>
               <span className="compromisos-general-barra"><span style={{width:avanceGrupo+'%'}}/></span>
             </span>
             <span className="compromisos-general-resumen">
               <strong>{lista.length} compromisos</strong>
               <small>{cerrados} completados</small>
             </span>
             <span className="compromisos-general-flecha" aria-hidden="true">{abierto?'⌃':'⌄'}</span>
           </button>
           {abierto&&<>
             <div className="compromisos-general-pulso">
               <div><strong>{lista.length-cerrados}</strong><span>Por resolver</span></div>
               <div><strong>{enCurso}</strong><span>En ejecución</span></div>
               <div><strong>{cerrados}</strong><span>Completados</span></div>
               <div className="compromisos-general-proxima">
                 <small>Próxima acción</small>
                 <strong>{proxima?.titulo||'Sin próxima acción programada'}</strong>
                 <small>{proxima?.fecha_proxima_accion?FECHA(proxima.fecha_proxima_accion):'Sin fecha definida'}</small>
               </div>
               {puedeGestionar&&vista==='comunidad'&&<button type="button"
                 className="compromisos-general-nuevo" onClick={()=>{
                   setNuevoEnGrupo(actual=>actual===grupoKey?null:grupoKey);
                   setNuevoTitulo('');setNuevoResponsable('');setNuevaFecha('');
                 }}>+ Nuevo compromiso</button>}
             </div>
             {puedeGestionar&&nuevoEnGrupo===grupoKey&&vista==='comunidad'&&
               <form className="compromisos-general-nuevo-form" onSubmit={e=>crearCompromiso(e,id)}>
                 <label>Título del compromiso
                   <input required maxLength={180} autoFocus value={nuevoTitulo}
                     onChange={e=>setNuevoTitulo(e.target.value)} placeholder="Describe el compromiso"/>
                 </label>
                 <label>Responsable
                   <input value={nuevoResponsable} onChange={e=>setNuevoResponsable(e.target.value)}
                     placeholder="Nombre del responsable"/>
                 </label>
                 <label>Fecha comprometida
                   <input type="date" value={nuevaFecha} onChange={e=>setNuevaFecha(e.target.value)}/>
                 </label>
                 <div className="compromisos-general-nuevo-acciones">
                   <button type="submit" className="compromisos-general-nuevo" disabled={creando||!nuevoTitulo.trim()}>
                     {creando?'Creando…':'Guardar compromiso'}
                   </button>
                   <button type="button" className="boton boton-secundario" disabled={creando}
                     onClick={()=>setNuevoEnGrupo(null)}>Cancelar</button>
                 </div>
               </form>}
             <div className="compromisos-general-lista-titulo"><strong>Compromisos ({lista.length})</strong></div>
             <div className="compromisos-general-enlaces">{lista.map((c,i)=>
               <Fragment key={c.id}>
               <div className={'compromisos-general-enlace'+(seleccionadoId===c.id?' compromisos-general-enlace--abierto':'')}>
                 <div className="compromisos-general-enlace-titulo">
                   {editandoTitulo?.id===c.id?
                     <form className="compromisos-general-edicion-titulo" onSubmit={guardarTitulo}>
                       <label htmlFor={'titulo-compromiso-'+c.id}>Título del compromiso</label>
                       <input id={'titulo-compromiso-'+c.id} type="text" autoFocus required
                         maxLength={180} disabled={guardandoTitulo} value={editandoTitulo.valor}
                         onChange={e=>setEditandoTitulo(x=>({...x,valor:e.target.value}))}/>
                       <span className="compromisos-general-edicion-acciones">
                         <button type="submit" disabled={guardandoTitulo||!editandoTitulo.valor.trim()}>
                           {guardandoTitulo?'Guardando…':'Guardar'}
                         </button>
                         <button type="button" disabled={guardandoTitulo}
                           onClick={()=>setEditandoTitulo(null)}>Cancelar</button>
                       </span>
                     </form>:
                     <>
                       <span className="compromisos-general-titulo-cabecera">
                         <button type="button" className="compromisos-general-titulo-link"
                           aria-expanded={seleccionadoId===c.id}
                           aria-controls={'detalle-compromiso-'+c.id}
                           aria-label={'Gestionar compromiso: '+c.titulo}
                           onClick={()=>abrirCompromiso(c.id)}>
                           <span aria-hidden="true" className="compromisos-general-fila-chevron">{seleccionadoId===c.id?'⌄':'›'}</span>
                           <span>{String(i+1).padStart(2,'0')}. {c.titulo}</span>
                         </button>
                         {puedeGestionar&&<button type="button" className="compromisos-general-editar-titulo"
                           aria-label={'Editar título de '+c.titulo}
                           onClick={()=>{setError('');setEditandoTitulo({id:c.id,valor:c.titulo})}}>
                           Editar
                         </button>}
                       </span>
                       {c.responsable&&<small>Responsable: {c.responsable}</small>}
                       {vista==='responsable'&&<small>Comunidad: {comunidades.find(x=>x.id===c.comunidad_id)?.nombre||'Comunidad'}</small>}
                     </>}
                 </div>
                 <span className={'compromisos-general-estado compromisos-general-estado--'+c.estado}>
                   {ETAPAS.find(x=>x[0]===c.estado)?.[1]||c.estado}
                 </span>
                 <span className="compromisos-general-avance">
                   <strong>{c.avance??0}%</strong>
                   <span className="compromisos-general-barra">
                     <span style={{width:Math.max(0,Math.min(100,Number(c.avance)||0))+'%'}}/>
                   </span>
                 </span>
                 <span className="compromisos-general-fecha">
                   {c.fecha_limite?'Vence: '+FECHA(c.fecha_limite):'Sin fecha límite'}
                 </span>
               </div>
               {seleccionadoId===c.id&&<div className="compromisos-general-detalle-integrado"
                 id={'detalle-compromiso-'+c.id} aria-label={'Gestión de '+c.titulo}>
                 <Compromisos comunidadId={c.comunidad_id} administrador={puedeGestionar}
                   seleccionadoId={c.id} integrado onActualizado={actualizarListado}/>
               </div>}
               </Fragment>)}</div>
           </>}
         </section>
       })}
       {!porComunidad.length&&<p className="vacio">No hay compromisos que coincidan con los filtros.</p>}
     </div>}
     {!puedeGestionar&&<p className="micro apagado">La edición está restringida a usuarios con permisos de administración.</p>}
   </div>
 </section>;
}
