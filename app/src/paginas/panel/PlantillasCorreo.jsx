import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import {VARIABLES_CORREO,completarCorreo} from '../../lib/plantillasCorreo';
import './PlantillasCorreo.css';
const vacia={nombre:'',asunto:'',cuerpo:''};
export default function PlantillasCorreo(){
 const {perfil}=useSesion();
 const [plantillas,setPlantillas]=useState(null);
 const [actual,setActual]=useState(null);
 const [form,setForm]=useState(vacia);
 const [prospectos,setProspectos]=useState([]);
 const [vista,setVista]=useState('');
 const [error,setError]=useState(''),[aviso,setAviso]=useState(''),[guardando,setGuardando]=useState(false);
 async function cargar(){
   const [a,b]=await Promise.all([
     supabase.from('plantillas_correo_crm').select('*').order('nombre'),
     supabase.from('prospectos').select('id,nombre_condominio,nombre_contacto,email').order('nombre_condominio').limit(150)
   ]);
   if(a.error||b.error)setError(a.error?.message||b.error?.message);
   setPlantillas(a.data||[]);setProspectos(b.data||[]);
 }
 useEffect(()=>{cargar()},[]);
 function editar(item){
   setActual(item?.id||'nuevo');
   setForm(item?{nombre:item.nombre,asunto:item.asunto,cuerpo:item.cuerpo}:vacia);
   setError('');setAviso('');
 }
 async function guardar(e){
   e.preventDefault();
   if(!form.nombre.trim()||!form.cuerpo.trim())return setError('Nombre y mensaje son obligatorios.');
   setGuardando(true);setError('');setAviso('');
   const datos={nombre:form.nombre.trim(),asunto:form.asunto.trim(),cuerpo:form.cuerpo,actualizado_en:new Date().toISOString()};
   const r=actual==='nuevo'
     ?await supabase.from('plantillas_correo_crm').insert({...datos,creada_por:perfil?.id}).select('id').single()
     :await supabase.from('plantillas_correo_crm').update(datos).eq('id',actual).select('id').single();
   if(r.error)setError(r.error.message);
   else{setActual(null);setAviso('Plantilla guardada.');await cargar();}
   setGuardando(false);
 }
 async function borrar(p){
   if(!window.confirm('¿Eliminar la plantilla '+p.nombre+'?'))return;
   const {error:err}=await supabase.from('plantillas_correo_crm').delete().eq('id',p.id).select('id').single();
   if(err)setError(err.message);
   else {setActual(null);setAviso('Plantilla eliminada.');await cargar();}
 }
 const prospecto=prospectos.find(x=>x.id===vista)||{};
 return <div className="pantalla modulo-unificado plantillas-correo">
  <header className="encabezado modulo-cabecera"><div>
    <h1 className="h3">Plantillas de correo</h1>
    <p className="chico apagado">Mensajes comerciales reutilizables. Aquí se redactan; el envío se realiza desde la ficha del prospecto.</p>
  </div></header>
  <div className="cuerpo modulo-contenido plantillas-correo-cuerpo">
    {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
    {aviso&&<div className="aviso" role="status">{aviso}</div>}
    <div className="plantillas-correo-cabecera">
      <Link to="/pipeline" className="boton boton-secundario">‹ Volver a Pipeline</Link>
      <button type="button" className="boton boton-primario" onClick={()=>editar(null)}>+ Nueva plantilla</button>
    </div>
    <p className="chico apagado">Variables disponibles: {VARIABLES_CORREO.join(' · ')}</p>
    {actual&&<form className="tarjeta plantillas-correo-editor" onSubmit={guardar}>
      <h2 className="h4">{actual==='nuevo'?'Nueva plantilla':'Editar plantilla'}</h2>
      <label>Nombre<input required maxLength={120} value={form.nombre}
        onChange={e=>setForm(x=>({...x,nombre:e.target.value}))}/></label>
      <label>Asunto<input maxLength={160} value={form.asunto}
        onChange={e=>setForm(x=>({...x,asunto:e.target.value}))}/></label>
      <label>Mensaje<textarea rows={9} required value={form.cuerpo}
        onChange={e=>setForm(x=>({...x,cuerpo:e.target.value}))}/></label>
      <div className="plantillas-correo-variables">
        {VARIABLES_CORREO.map(v=><button type="button" className="boton boton-texto" key={v}
          onClick={()=>setForm(x=>({...x,cuerpo:x.cuerpo+v}))}>{v}</button>)}
      </div>
      <label>Comprobar con datos de
        <select value={vista} onChange={e=>setVista(e.target.value)}>
          <option value="">Ejemplo genérico</option>
          {prospectos.map(p=><option key={p.id} value={p.id}>{p.nombre_condominio}</option>)}
        </select>
      </label>
      <div className="plantillas-correo-previa">
        <strong>{completarCorreo(form.asunto,prospecto,perfil?.nombre)||'Sin asunto'}</strong>
        <p>{completarCorreo(form.cuerpo,prospecto,perfil?.nombre)||'Escribe para ver la vista previa.'}</p>
      </div>
      <div className="fila">
        <button type="button" className="boton boton-secundario" onClick={()=>setActual(null)}>Cancelar</button>
        <button className="boton boton-primario" disabled={guardando}>{guardando?'Guardando…':'Guardar plantilla'}</button>
      </div>
    </form>}
    {plantillas===null?<p className="cargando">Cargando plantillas…</p>
      :<div className="plantillas-correo-lista">{plantillas.map(p=><details key={p.id} className="tarjeta plantillas-correo-item">
        <summary><strong>{p.nombre}</strong><span aria-hidden="true">⌄</span></summary>
        <div className="plantillas-correo-detalle"><p><strong>Asunto:</strong> {p.asunto}</p>
          <p>{p.cuerpo}</p><div className="fila">
          <button type="button" className="boton boton-secundario" onClick={()=>editar(p)}>Editar</button>
          <button type="button" className="boton boton-texto" onClick={()=>borrar(p)}>Eliminar</button>
          </div></div>
      </details>)}
      {!plantillas.length&&<div className="tarjeta plantillas-correo-detalle">Sin plantillas guardadas.</div>}
      </div>}
  </div>
 </div>
}
