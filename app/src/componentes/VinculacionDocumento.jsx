import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import './VinculacionDocumento.css';

/**
 * Asocia un documento a uno o ambos contextos independientes.
 * No crea leads ni comunidades; solo permite seleccionar registros existentes.
 * Las relaciones se guardan en la misma transacción de guardar_documento_con_relaciones.
 */
export default function VinculacionDocumento({prospectoId,comunidadId,onProspecto,onComunidad,disabled=false}){
 const [prospectos,setProspectos]=useState([]);
 const [comunidades,setComunidades]=useState([]);
 const [buscarProspecto,setBuscarProspecto]=useState('');
 const [buscarComunidad,setBuscarComunidad]=useState('');
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let actual=true;
  Promise.all([
   supabase.from('prospectos').select('id,nombre_condominio,comunidad_id,etapa').order('nombre_condominio').limit(1000),
   supabase.from('comunidades').select('id,nombre').order('nombre').limit(1000)
  ]).then(([rp,rc])=>{
   if(!actual)return;
   if(rp.error||rc.error)setError([rp.error?.message,rc.error?.message].filter(Boolean).join(' / '));
   setProspectos(rp.data||[]);setComunidades(rc.data||[]);setCargando(false);
  });
  return()=>{actual=false;};
 },[]);
 const prospectosVisibles=useMemo(()=>prospectos.filter(p=>p.id===prospectoId||
  (p.nombre_condominio||'').toLocaleLowerCase('es-CL').includes(buscarProspecto.trim().toLocaleLowerCase('es-CL'))),[prospectos,prospectoId,buscarProspecto]);
 const comunidadesVisibles=useMemo(()=>comunidades.filter(c=>c.id===comunidadId||
  (c.nombre||'').toLocaleLowerCase('es-CL').includes(buscarComunidad.trim().toLocaleLowerCase('es-CL'))),[comunidades,comunidadId,buscarComunidad]);
 function elegirProspecto(id){
  const seleccionado=prospectos.find(p=>p.id===id);
  onProspecto(id,seleccionado||null);
  // Si el lead ya se convirtió en comunidad, sugerir también la relación real.
  if(seleccionado?.comunidad_id&&!comunidadId) {
   onComunidad(seleccionado.comunidad_id,comunidades.find(c=>c.id===seleccionado.comunidad_id)||null);
  }
 }
 return <section className="documento-vinculacion" aria-label="Vinculación del documento">
  <div><h3>Vincular documento</h3>
   <p>Puedes relacionarlo con una comunidad, un lead del CRM o ambos. Se mostrará automáticamente en sus fichas.</p>
  </div>
  {error&&<p className="aviso aviso-critico" role="alert">No se pudieron consultar los registros: {error}</p>}
  <div className="documento-vinculacion-grid">
   <div className="documento-vinculacion-campo">
    <label htmlFor="documento-buscar-prospecto">Buscar lead o prospecto (CRM)</label>
    <input id="documento-buscar-prospecto" type="search" placeholder="Buscar por nombre"
     value={buscarProspecto} onChange={e=>setBuscarProspecto(e.target.value)} disabled={disabled||cargando}/>
    <label htmlFor="documento-prospecto">Asociar lead / prospecto</label>
    <select id="documento-prospecto" value={prospectoId} disabled={disabled||cargando||Boolean(error)}
     onChange={e=>elegirProspecto(e.target.value)}>
     <option value="">Sin lead asociado</option>
     {prospectosVisibles.map(p=><option key={p.id} value={p.id}>{p.nombre_condominio}</option>)}
    </select>
    {prospectoId&&<Link to={'/pipeline?prospecto='+prospectoId}>Abrir ficha CRM</Link>}
   </div>
   <div className="documento-vinculacion-campo">
    <label htmlFor="documento-buscar-comunidad">Buscar comunidad</label>
    <input id="documento-buscar-comunidad" type="search" placeholder="Buscar por nombre"
     value={buscarComunidad} onChange={e=>setBuscarComunidad(e.target.value)} disabled={disabled||cargando}/>
    <label htmlFor="documento-comunidad">Asociar comunidad</label>
    <select id="documento-comunidad" value={comunidadId} disabled={disabled||cargando||Boolean(error)}
     onChange={e=>{
      const seleccionado=comunidades.find(c=>c.id===e.target.value);
      onComunidad(e.target.value,seleccionado||null);
     }}>
     <option value="">Sin comunidad asociada</option>
     {comunidadesVisibles.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
    {comunidadId&&<Link to={'/comunidades/'+comunidadId+'?seccion=documentos'}>Abrir comunidad</Link>}
   </div>
  </div>
  <small>{prospectoId||comunidadId?'Las relaciones se guardarán junto con el documento.':'Documento independiente: puedes asociarlo ahora o después.'}</small>
 </section>;
}
