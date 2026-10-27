import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import {useVolverGlobal} from '../../lib/navegacion';
import './CompromisosGeneral.css';

const ETAPAS=[['todos','Todos'],['pendiente','Pendientes'],['en_curso','En ejecución'],['en_espera','En espera'],['completado','Completados']];
const FECHA=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-CL'):'Sin fecha';
export default function CompromisosGeneral(){
 const navegar=useNavigate();
 useVolverGlobal(()=>navegar('/'));
 const {perfil}=useSesion();
 const [items,setItems]=useState(null),[comunidades,setComunidades]=useState([]),[error,setError]=useState('');
 const [filtro,setFiltro]=useState('todos');
 const [busqueda,setBusqueda]=useState('');
 const [abiertos,setAbiertos]=useState(new Set());
 const puedeGestionar=['superadmin','admin','jefatura'].includes(perfil?.rol);
 useEffect(()=>{
  let vivo=true;
  Promise.all([
   supabase.from('compromisos_administracion').select('id,comunidad_id,titulo,estado,avance,responsable,fecha_limite,fecha_proxima_accion,orden,creado_en').order('orden',{ascending:true,nullsFirst:false}),
   supabase.from('comunidades').select('id,nombre,comuna').order('nombre')
  ]).then(([c,b])=>{
   if(!vivo)return;
   if(c.error||b.error)setError(c.error?.message||b.error?.message);
   setItems(c.data||[]);setComunidades(b.data||[]);
  });
  return()=>{vivo=false};
 },[]);
 const porComunidad=useMemo(()=>{
  const nombres=new Map(comunidades.map(c=>[c.id,c]));
  const salida=new Map();
  for(const c of items||[]){
   if(filtro!=='todos'&&c.estado!==filtro)continue;
   const comunidad=nombres.get(c.comunidad_id);
   const texto=(c.titulo+' '+(comunidad?.nombre||'')+' '+(c.responsable||'')).toLowerCase();
   if(!texto.includes(busqueda.toLowerCase().trim()))continue;
   if(!salida.has(c.comunidad_id))salida.set(c.comunidad_id,{comunidad,items:[]});
   salida.get(c.comunidad_id).items.push(c);
  }
  return [...salida.values()].sort((a,b)=>(a.comunidad?.nombre||'').localeCompare(b.comunidad?.nombre||'','es'));
 },[items,comunidades,filtro,busqueda]);
 return <div className="pantalla modulo-unificado compromisos-general">
   <header className="encabezado modulo-cabecera"><div>
      <h1 className="h3">Compromisos y avances</h1>
      <p className="chico apagado">Seguimiento consecutivo por comunidad, etapa y fecha comprometida.</p>
   </div></header>
   <div className="cuerpo modulo-contenido compromisos-general-cuerpo">
     {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
     <div className="compromisos-general-filtros">
       <label>Etapa<select value={filtro} onChange={e=>setFiltro(e.target.value)}>
         {ETAPAS.map(([id,t])=><option key={id} value={id}>{t}</option>)}
       </select></label>
       <label>Buscar comunidad o compromiso<input type="search" value={busqueda}
         onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar…"/></label>
     </div>
     {items===null?<p className="cargando">Cargando…</p>:<div className="compromisos-general-lista">
       {porComunidad.map(({comunidad,items:lista})=>{
         const id=comunidad?.id||lista[0].comunidad_id;
         const abierto=abiertos.has(id)||Boolean(busqueda);
         return <section className="tarjeta compromisos-general-grupo" key={id}>
           <button type="button" aria-expanded={abierto} className="compromisos-general-desplegar"
             onClick={()=>setAbiertos(x=>{const y=new Set(x);y.has(id)?y.delete(id):y.add(id);return y})}>
             <span><strong>{comunidad?.nombre||'Comunidad'}</strong><small>{comunidad?.comuna||''}</small></span>
             <span>{lista.length} compromisos</span><span aria-hidden="true">{abierto?'⌃':'⌄'}</span>
           </button>
           {abierto&&<div className="compromisos-general-enlaces">{lista.map((c,i)=>
             <Link key={c.id} to={'/comunidades/'+encodeURIComponent(id)+'?seccion=compromisos'}
               className="compromisos-general-enlace">
               <strong>{String(i+1).padStart(2,'0')}. {c.titulo}</strong>
               <span>{ETAPAS.find(x=>x[0]===c.estado)?.[1]||c.estado} · {c.avance}% · Fecha: {FECHA(c.fecha_limite)}</span>
             </Link>)}</div>}
         </section>
       })}
       {!porComunidad.length&&<p className="vacio">No hay compromisos que coincidan con los filtros.</p>}
     </div>}
     {!puedeGestionar&&<p className="micro apagado">La edición está restringida a usuarios con permisos de administración.</p>}
   </div>
 </div>;
}
