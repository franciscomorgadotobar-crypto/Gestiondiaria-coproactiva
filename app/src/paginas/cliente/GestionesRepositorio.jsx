import {useEffect,useMemo,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {normalizarDocumentosModelo,normalizarTareasModelo} from '../../lib/gestiones';
import './GestionesRepositorio.css';

const VACIO={nombre:'',descripcion:'',categoria:'Administración',responsable_sugerido:'',
 plazo_dias:'',tareas:'',documentos_esperados:''};
const linea=a=>(Array.isArray(a)?a:[]).map(x=>typeof x==='string'?x:(x?.titulo||'')).join('\n');
const desdeModelo=m=>({
 nombre:m.nombre,descripcion:m.descripcion||'',categoria:m.categoria||'Administración',
 responsable_sugerido:m.responsable_sugerido||'',plazo_dias:m.plazo_dias??'',
 tareas:linea(m.tareas),documentos_esperados:linea(m.documentos_esperados)
});

export default function GestionesRepositorio({comunidadId,gestiones=[],subtareas=[],onActualizado}){
 const [modelos,setModelos]=useState([]);
 const [seleccion,setSeleccion]=useState('');
 const [modo,setModo]=useState('');
 const [form,setForm]=useState(VACIO);
 const [origen,setOrigen]=useState('');
 const [responsable,setResponsable]=useState('');
 const [fechaLimite,setFechaLimite]=useState('');
 const [ocupado,setOcupado]=useState(false);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const activo=useMemo(()=>modelos.find(m=>m.id===seleccion),[modelos,seleccion]);
 const cargar=async()=>{
  const {data,error:e}=await supabase.from('gestiones_tipos').select('*')
    .eq('activo',true).order('nombre');
  if(e)setError('Repositorio: '+e.message);
  else setModelos(data||[]);
 };
 useEffect(()=>{cargar();},[]);
 const notificar=async()=>{
  await cargar();
  if(onActualizado)await onActualizado();
 };
 const campos=()=>({
  nombre:form.nombre.trim(),descripcion:form.descripcion.trim(),
  categoria:form.categoria.trim()||'Administración',
  responsable_sugerido:form.responsable_sugerido.trim()||null,
  plazo_dias:form.plazo_dias===''?null:Number(form.plazo_dias),
  tareas:normalizarTareasModelo(form.tareas),
  documentos_esperados:normalizarDocumentosModelo(form.documentos_esperados)
 });
 const crearDesdeTipo=async e=>{
  e.preventDefault();
  if(!seleccion||!comunidadId||ocupado)return;
  setOcupado(true);setError('');setMensaje('');
  try{
   const {error:e}=await supabase.rpc('gestiones_crear_desde_tipo',{
    p_comunidad_id:comunidadId,p_tipo_id:seleccion,p_responsable:responsable.trim()||null,
    p_fecha_inicio:null,p_fecha_limite:fechaLimite||null
   });
   if(e)throw e;
   await notificar();setMensaje('Gestión creada con tareas y fechas propias de esta comunidad.');
   setSeleccion('');setResponsable('');setFechaLimite('');
  }catch(e){setError('No se pudo crear la gestión: '+e.message)}
  finally{setOcupado(false)}
 };
 const guardarModelo=async e=>{
  e.preventDefault();
  if(!form.nombre.trim()||ocupado)return;
  setOcupado(true);setError('');setMensaje('');
  try{
   const valores=campos();
   const consulta=modo==='editar'
     ?supabase.from('gestiones_tipos').update({...valores,actualizado_en:new Date().toISOString()}).eq('id',seleccion)
     :supabase.from('gestiones_tipos').insert(valores);
   const {data,error:e}=await consulta.select('id').single();
   if(e)throw e;
   await notificar();setSeleccion(data.id);setModo('');setOrigen('');
   setMensaje('Modelo guardado. Las gestiones creadas anteriormente no se modificaron.');
  }catch(e){setError(e.message)}
  finally{setOcupado(false)}
 };
 const tomarGestion=id=>{
  setOrigen(id);
  const g=gestiones.find(x=>x.id===id);
  if(!g)return;
  setModo('nuevo');
  setForm({
   ...VACIO,
   nombre:g.titulo+' - Variante',
   descripcion:g.descripcion||'',responsable_sugerido:g.responsable||'',
   tareas:linea(subtareas.filter(x=>x.compromiso_id===g.id).sort((a,b)=>a.orden-b.orden).map(x=>({titulo:x.titulo}))),
   documentos_esperados:(g.documentos_esperados||[]).join('\n')
  });
 };
 return <details className="tarjeta gestiones-repositorio" aria-label="Repositorio de tipos de gestión">
  <summary>Tipos de gestión · Biblioteca de procesos ({modelos.length})</summary>
  <div className="gestiones-repositorio-cuerpo">
   <p className="micro apagado">Un tipo es un modelo reutilizable. Cada nueva gestión tendrá sus propias tareas, fechas, avances y documentos.</p>
   {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
   {mensaje&&<p className="aviso aviso-ok" role="status">{mensaje}</p>}
   <form onSubmit={crearDesdeTipo} className="gestiones-repositorio-form">
    <label>Tipo de gestión
     <select aria-label="Seleccionar tipo de gestión" value={seleccion}
       onChange={e=>{setSeleccion(e.target.value);setModo('')}}>
      <option value="">Selecciona un proceso…</option>
      {modelos.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
     </select>
    </label>
    {activo&&<>
     <div className="gestiones-repositorio-previa">
      <strong>{activo.nombre}</strong>
      <small>{activo.descripcion||'Sin descripción'} · {(activo.tareas||[]).length} tareas · {(activo.documentos_esperados||[]).length} documentos esperados</small>
      {activo.tareas?.length>0&&<ol>{activo.tareas.map((x,i)=><li key={i}>{x.titulo||x}</li>)}</ol>}
      {activo.documentos_esperados?.length>0&&<p>Documentos esperados: {activo.documentos_esperados.join(' · ')}</p>}
     </div>
     <div className="gestiones-repositorio-grid">
      <label>Responsable (opcional)
       <input value={responsable} onChange={e=>setResponsable(e.target.value)}
         placeholder={activo.responsable_sugerido||'Por asignar'}/>
      </label>
      <label>Fecha límite (opcional)
       <input type="date" value={fechaLimite} onChange={e=>setFechaLimite(e.target.value)}/>
      </label>
     </div>
     <div className="gestiones-repositorio-botones">
      <button type="submit" disabled={ocupado} className="boton boton-primario">Crear gestión en esta comunidad</button>
      <button type="button" className="boton boton-secundario" disabled={ocupado}
        onClick={()=>{setModo('editar');setForm(desdeModelo(activo))}}>Editar modelo</button>
     </div>
    </>}
   </form>
   <div className="gestiones-repositorio-botones">
    <button type="button" className="boton boton-secundario"
      onClick={()=>{setModo(modo==='nuevo'?'':'nuevo');setForm(VACIO);setOrigen('')}}>
      + Nuevo tipo de gestión
    </button>
    {gestiones.length>0&&<label className="gestiones-repositorio-desde">
      Guardar una gestión como modelo
      <select aria-label="Guardar gestión existente como modelo" value={origen}
        onChange={e=>{if(e.target.value)tomarGestion(e.target.value);else setOrigen('')}}>
       <option value="">Seleccionar gestión…</option>
       {gestiones.map(g=><option key={g.id} value={g.id}>{g.titulo}</option>)}
      </select>
    </label>}
   </div>
   {modo&&<form onSubmit={guardarModelo} className="gestiones-repositorio-editor">
    <h3>{modo==='editar'?'Editar tipo de gestión':'Guardar nuevo tipo de gestión'}</h3>
    <p className="micro apagado">Las modificaciones del modelo no afectan instancias existentes.</p>
    <label>Nombre del tipo<input required maxLength={180} value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))}/></label>
    <label>Descripción<textarea rows={2} value={form.descripcion} onChange={e=>setForm(v=>({...v,descripcion:e.target.value}))}/></label>
    <div className="gestiones-repositorio-grid">
     <label>Categoría<input value={form.categoria} onChange={e=>setForm(v=>({...v,categoria:e.target.value}))}/></label>
     <label>Responsable sugerido<input value={form.responsable_sugerido} onChange={e=>setForm(v=>({...v,responsable_sugerido:e.target.value}))}/></label>
     <label>Plazo sugerido (días)<input type="number" min="0" max="3650" value={form.plazo_dias} onChange={e=>setForm(v=>({...v,plazo_dias:e.target.value}))}/></label>
    </div>
    <label>Tareas sugeridas (una por línea)<textarea rows={5} value={form.tareas} onChange={e=>setForm(v=>({...v,tareas:e.target.value}))}/></label>
    <label>Documentos esperados (uno por línea)<textarea rows={3} value={form.documentos_esperados} onChange={e=>setForm(v=>({...v,documentos_esperados:e.target.value}))}/></label>
    <div className="gestiones-repositorio-botones">
     <button type="submit" disabled={ocupado} className="boton boton-primario">Guardar modelo</button>
     <button type="button" className="boton boton-secundario" onClick={()=>setModo('')}>Cancelar</button>
    </div>
   </form>}
  </div>
 </details>;
}
