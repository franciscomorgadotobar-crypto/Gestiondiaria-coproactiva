import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Compromisos.css';
import DriveArchivos from '../../componentes/DriveArchivos';
import { DRIVE_ACCEPT, conexionDrive, subirADrive, validarArchivoDrive } from '../../lib/drive';

const NOMBRES = { pendiente: 'Pendiente', en_curso: 'En ejecución', en_espera: 'En espera de tercero', completado: 'Completado' };
const fecha = x => x ? new Date(x + (x.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL') : 'Sin fecha';
const inicial = { titulo: '', descripcion: '', referencia_contractual: '', fecha_inicio: '', fecha_limite: '', fecha_proxima_accion: '', responsable: '' };

export default function Compromisos({ comunidadId, administrador = false }) {
 const [compromisos, setCompromisos] = useState([]);
 const [avances, setAvances] = useState([]);
 const [transiciones,setTransiciones] = useState([]);
 const [fechasRapidas,setFechasRapidas] = useState({});
 const [observacionesRapidas,setObservacionesRapidas] = useState({});
 const [adjuntos, setAdjuntos] = useState([]);
 const [archivos, setArchivos] = useState([]);
 const [subtareas,setSubtareas]=useState([]);
 const [nuevaSubtarea,setNuevaSubtarea]=useState({});
 const [editando,setEditando]=useState(null);
 const [editForm,setEditForm]=useState(inicial);
 const [error, setError] = useState('');
 const [cargando, setCargando] = useState(true);
 const [nuevo, setNuevo] = useState(inicial);
 const [detalle, setDetalle] = useState(null);
 const [texto, setTexto] = useState('');
 const [evidencia, setEvidencia] = useState('');
 const [porcentaje, setPorcentaje] = useState(0);
 const [estado, setEstado] = useState('en_curso');
 const [publicar, setPublicar] = useState(false);
 const [guardando, setGuardando] = useState(false);
 const [driveConectada, setDriveConectada] = useState(false);
 const [versionDocs, setVersionDocs] = useState(0);
 async function cargar() {
  if (!comunidadId) return;
  setCargando(true); setError('');
  const { data, error: err } = await supabase.from('compromisos_administracion').select('*').eq('comunidad_id', comunidadId).order('orden', {ascending:true, nullsFirst:false}).order('creado_en', {ascending:true});
  if (err) { setError('No fue posible cargar compromisos: ' + err.message); setCargando(false); return; }
  setCompromisos(data || []);
  const {data: subt,error: errSubt}=await supabase.from('compromisos_subtareas').select('*').in('compromiso_id',(data||[]).map(x=>x.id).length ? (data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']).order('orden',{ascending:true});
  if(errSubt) setError(errSubt.message);
  setSubtareas(subt||[]);
  const ids = (data || []).map(x => x.id);
  if (ids.length) {
   const { data: historial, error: err2 } = await supabase.from('compromisos_avances').select('*').in('compromiso_id', ids).order('registrado_en', {ascending:false});
   if (err2) setError(err2.message);
   setAvances(historial || []);
   const {data: trans,error: errTrans}=await supabase.from('compromisos_transiciones')
      .select('id,compromiso_id,estado_anterior,estado_nuevo,observacion,fecha_proxima_accion,cambiado_en')
      .in('compromiso_id', ids).order('cambiado_en',{ascending:false});
   if(errTrans) setError(errTrans.message);
   setTransiciones(trans || []);
   const avanceIds = (historial || []).map(a => a.id);
   if (avanceIds.length) {
    const {data: docs, error: errDocs} = await supabase.from('compromisos_avances_adjuntos').select('*').in('avance_id',avanceIds);
    if (errDocs) setError(errDocs.message);
    setAdjuntos(docs || []);
   } else setAdjuntos([]);
  } else { setAvances([]); setAdjuntos([]); setTransiciones([]); }
  setCargando(false);
 }
 useEffect(() => { cargar(); }, [comunidadId]);
 useEffect(() => { if (administrador) conexionDrive().then(c => setDriveConectada(Boolean(c?.conectada))); }, [administrador]);
 async function crear(e) {
  e.preventDefault(); setGuardando(true); setError('');
  const { error: err } = await supabase.from('compromisos_administracion').insert({
   comunidad_id: comunidadId, titulo: nuevo.titulo.trim(), descripcion: nuevo.descripcion,
   referencia_contractual: nuevo.referencia_contractual, fecha_limite: nuevo.fecha_limite || null,
   fecha_inicio: nuevo.fecha_inicio || null,
   fecha_proxima_accion: nuevo.fecha_proxima_accion || null,
   responsable: nuevo.responsable, publicado: false
  });
  if (err) setError(err.message); else { setNuevo(inicial); await cargar(); }
  setGuardando(false);
 }
 async function abrirAdjunto(doc) {
  const {data, error: err} = await supabase.storage.from('compromisos-adjuntos').createSignedUrl(doc.ruta, 90);
  if (err || !data?.signedUrl) { setError(err?.message || 'No fue posible abrir el archivo.'); return; }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
 }
 async function registrar(e) {
  e.preventDefault(); if (!detalle || !texto.trim() || guardando) return;
  setGuardando(true); setError('');
  try {
   const subt = subtareas.filter(s=>s.compromiso_id===detalle);
   const porcentajeReal=subt.length?Math.round(subt.filter(s=>s.completada).length/subt.length*100):Number(porcentaje);
   const { data: avance, error: err } = await supabase.from('compromisos_avances').insert({
    compromiso_id: detalle, descripcion: texto.trim(), porcentaje: porcentajeReal,
    estado, evidencia_url: evidencia.trim() || null, publicado: publicar
   }).select('id').single();
   if (err) throw err;
   const fallidos = [];
   for (const file of archivos) {
    if (driveConectada) {
     // Nuevos adjuntos: Google Drive · 04 Seguimiento e informes / Compromisos y avances / [ID]
     const invalido = validarArchivoDrive(file);
     if (invalido) { fallidos.push(invalido); continue; }
     try { await subirADrive({ comunidadId, origenTipo: 'compromiso', origenId: detalle, detalleId: avance.id, archivo: file }); }
     catch (eDrive) { fallidos.push(file.name + ': ' + eDrive.message); }
     continue;
    }
    if (file.size > 15728640) { fallidos.push(file.name + ' (supera 15 MB)'); continue; }
    const nombreSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ruta = `${comunidadId}/${detalle}/${avance.id}/${crypto.randomUUID()}-${nombreSeguro}`;
    const {error: errSubir} = await supabase.storage.from('compromisos-adjuntos').upload(ruta, file, { contentType:file.type || 'application/octet-stream', upsert:false });
    if (errSubir) { fallidos.push(file.name + ': ' + errSubir.message); continue; }
    const {error: errMeta} = await supabase.from('compromisos_avances_adjuntos').insert({
     avance_id: avance.id, ruta, nombre:file.name, tipo:file.type, tamano:file.size
    });
    if (errMeta) fallidos.push(file.name + ': ' + errMeta.message);
   }
   const {error: err2} = await supabase.from('compromisos_administracion').update({
     avance:porcentajeReal, actualizado_en:new Date().toISOString()
   }).eq('id',detalle).select('id').single();
   if(err2) throw err2;
   const {error: estadoError}=await supabase.rpc('compromisos_cambiar_etapa',{
     p_compromiso_id:detalle,p_estado:estado,
     p_proxima_accion:fechasRapidas[detalle]||null,
     p_observacion:'Cambio al registrar avance: '+texto.trim().slice(0,500)
   });
   if(estadoError) throw estadoError;
   setTexto('');setEvidencia('');setPublicar(false);setArchivos([]);setVersionDocs(v=>v+1);
   await cargar();
   if(fallidos.length) setError('Avance guardado, pero algunos archivos no se adjuntaron: ' + fallidos.join('; '));
  } catch(err) { setError(err.message || 'No fue posible registrar el avance.'); }
  finally { setGuardando(false); }
 }
 async function editarCompromiso(e) {
  e.preventDefault();if(!editando||guardando)return;
  setGuardando(true);setError('');
  const {error:err}=await supabase.from('compromisos_administracion').update({
   titulo:editForm.titulo.trim(),descripcion:editForm.descripcion,
   referencia_contractual:editForm.referencia_contractual,
   responsable:editForm.responsable,fecha_limite:editForm.fecha_limite||null,
   fecha_inicio:editForm.fecha_inicio||null,fecha_proxima_accion:editForm.fecha_proxima_accion||null
  }).eq('id',editando).select('id').single();
  setGuardando(false);
  if(err)setError(err.message);else {setEditando(null);await cargar();}
 }
 async function eliminarCompromiso(item) {
  if(!window.confirm(`¿Eliminar definitivamente "${item.titulo}" y sus avances y subtareas? Esta acción no se puede deshacer.`))return;
  setGuardando(true);setError('');
  try{
   const ids=avances.filter(a=>a.compromiso_id===item.id).map(a=>a.id);
   const docs=adjuntos.filter(d=>ids.includes(d.avance_id));
   if(docs.length){const {error:se}=await supabase.storage.from('compromisos-adjuntos').remove(docs.map(d=>d.ruta));if(se)throw se;}
   const {error:de}=await supabase.from('compromisos_administracion').delete().eq('id',item.id);
   if(de)throw de;
   await cargar();
  }catch(e){setError(e.message||'No fue posible eliminar.');}
  finally{setGuardando(false);}
 }
 async function eliminarAdjunto(doc) {
  if(!window.confirm(`¿Eliminar el archivo "${doc.nombre}"? Esta acción no se puede deshacer.`))return;
  setGuardando(true);setError('');
  try{
   const {error:de}=await supabase.storage.from('compromisos-adjuntos').remove([doc.ruta]);
   if(de)throw de;
   const {error:me}=await supabase.from('compromisos_avances_adjuntos').delete().eq('id',doc.id);
   if(me)throw me;
   await cargar();
  }catch(e){setError(e.message||'No fue posible eliminar el adjunto.');}
  finally{setGuardando(false);}
 }
 async function agregarSubtarea(item) {
  const titulo=(nuevaSubtarea[item.id]||'').trim();if(!titulo)return;
  setGuardando(true);setError('');
  const orden=subtareas.filter(s=>s.compromiso_id===item.id).length+1;
  const {error:err}=await supabase.from('compromisos_subtareas').insert({compromiso_id:item.id,titulo,orden});
  if(err)setError(err.message);else{
   const items=subtareas.filter(s=>s.compromiso_id===item.id);
   const avance=Math.round(items.filter(s=>s.completada).length/(items.length+1)*100);
   const {error:err2}=await supabase.from('compromisos_administracion').update({avance,actualizado_en:new Date().toISOString()}).eq('id',item.id).select('id').single();
   if(err2)setError(err2.message);
   setNuevaSubtarea(v=>({...v,[item.id]:''}));await cargar();}
  setGuardando(false);
 }
 async function marcarSubtarea(item,sub,completada) {
  setGuardando(true);setError('');
  try{
   const {error:err}=await supabase.from('compromisos_subtareas').update({completada}).eq('id',sub.id);
   if(err)throw err;
   const items=subtareas.filter(s=>s.compromiso_id===item.id).map(s=>s.id===sub.id?{...s,completada}:s);
   const avance=Math.round(items.filter(s=>s.completada).length/items.length*100);
   const {error:err2}=await supabase.from('compromisos_administracion').update({avance,actualizado_en:new Date().toISOString()}).eq('id',item.id).select('id').single();
   if(err2)throw err2;
   await cargar();
  }catch(e){setError(e.message||'No fue posible actualizar.');await cargar();}
  finally{setGuardando(false);}
 }
 async function eliminarSubtarea(item,sub) {
  if(!window.confirm(`¿Eliminar la subtarea "${sub.titulo}"?`))return;
  setGuardando(true);setError('');
  try{
   const {error:err}=await supabase.from('compromisos_subtareas').delete().eq('id',sub.id);
   if(err)throw err;
   const restantes=subtareas.filter(s=>s.compromiso_id===item.id&&s.id!==sub.id);
   {
    const avance=restantes.length?Math.round(restantes.filter(s=>s.completada).length/restantes.length*100):0;
    const {error:err2}=await supabase.from('compromisos_administracion').update({avance,actualizado_en:new Date().toISOString()}).eq('id',item.id).select('id').single();if(err2)throw err2;
   }
   await cargar();
  }catch(e){setError(e.message||'No fue posible eliminar subtarea.');}
  finally{setGuardando(false);}
 }
 async function cambiarEstado(item, siguiente) {
  if(!administrador || guardando || siguiente===item.estado)return;
  const proxima=fechasRapidas[item.id]||item.fecha_proxima_accion||null;
  if(siguiente==='en_espera'&&!proxima){
    return setError('Registra la fecha de la próxima acción antes de pasar el compromiso a En espera.');
  }
  setGuardando(true);setError('');
  const {error:err}=await supabase.rpc('compromisos_cambiar_etapa',{
    p_compromiso_id:item.id,p_estado:siguiente,p_proxima_accion:proxima,
    p_observacion:observacionesRapidas[item.id]?.trim()||'Cambio de etapa desde compromisos'
  });
  if(err)setError('No se pudo cambiar la etapa: '+err.message);
  else {setObservacionesRapidas(x=>({...x,[item.id]:''}));await cargar();}
  setGuardando(false);
 }
 async function visibilidad(item) {
  const {error: err} = await supabase.from('compromisos_administracion').update({publicado: !item.publicado}).eq('id', item.id);
  if(err) setError(err.message);else await cargar();
 }
 return <section className="compromisos-wrap" aria-label="Compromisos y avances">
   <header className="compromisos-cabecera"><h2 className="h4">Compromisos y avances</h2>
     <p className="chico apagado">Acuerdos, fechas, estado, subtareas y evidencias. Cada ficha se despliega al seleccionarla.</p>
   </header>
   {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
   {administrador&&<details className="tarjeta compromisos-crear-desplegable">
     <summary>+ Nuevo compromiso</summary>
     <form onSubmit={crear} className="compromisos-form">
       <label>Título<input required maxLength={180} value={nuevo.titulo} onChange={e=>setNuevo({...nuevo,titulo:e.target.value})}/></label>
       <label>Descripción<textarea rows={2} value={nuevo.descripcion} onChange={e=>setNuevo({...nuevo,descripcion:e.target.value})}/></label>
       <div className="compromisos-grid">
         <label>Referencia contractual<input value={nuevo.referencia_contractual} onChange={e=>setNuevo({...nuevo,referencia_contractual:e.target.value})}/></label>
         <label>Responsable<input value={nuevo.responsable} onChange={e=>setNuevo({...nuevo,responsable:e.target.value})}/></label>
         <label>Fecha de inicio<input type="date" value={nuevo.fecha_inicio} onChange={e=>setNuevo({...nuevo,fecha_inicio:e.target.value})}/></label>
         <label>Fecha comprometida<input type="date" value={nuevo.fecha_limite} onChange={e=>setNuevo({...nuevo,fecha_limite:e.target.value})}/></label>
         <label>Próxima acción<input type="date" value={nuevo.fecha_proxima_accion} onChange={e=>setNuevo({...nuevo,fecha_proxima_accion:e.target.value})}/></label>
       </div>
       <button className="boton boton-primario" disabled={guardando}>Crear compromiso interno</button>
     </form>
   </details>}
   {cargando ? <p className="cargando">Cargando compromisos…</p>
    : !compromisos.length ? <div className="portal-vacio">No hay compromisos registrados para esta comunidad.</div>
    : <div className="compromisos-lista">
        {compromisos.map((item,indice)=>{
          const sub=subtareas.filter(x=>x.compromiso_id===item.id);
          const realizados=sub.filter(x=>x.completada).length;
          const historico=avances.filter(x=>x.compromiso_id===item.id);
          const movimientos=transiciones.filter(x=>x.compromiso_id===item.id);
          return <details key={item.id} className="tarjeta compromisos-item">
            <summary className="compromisos-fila">
              <span className="compromisos-titulo">
                <strong>{String(indice+1).padStart(2,'0')}. {item.titulo}</strong>
                <small>{item.responsable||'Por asignar'} · Fecha límite: {fecha(item.fecha_limite)} · {item.avance}%</small>
              </span>
              <span className="portal-estado">{NOMBRES[item.estado]||item.estado}</span>
              <span className="compromisos-flecha" aria-hidden="true">⌄</span>
            </summary>
            <div className="compromisos-detalle">
              {item.descripcion&&<p>{item.descripcion}</p>}
              <div className="compromisos-meta">
                <span>Inicio: {fecha(item.fecha_inicio)}</span>
                <span>Comprometida: {fecha(item.fecha_limite)}</span>
                <span>Próxima acción: {fecha(item.fecha_proxima_accion)}</span>
                <span>Cierre: {fecha(item.fecha_cierre)}</span>
                {item.referencia_contractual&&<span>Contrato: {item.referencia_contractual}</span>}
              </div>
              <div className="compromisos-progreso" role="progressbar" aria-label="Avance del compromiso"
                aria-valuenow={item.avance} aria-valuemin={0} aria-valuemax={100}><div style={{width:item.avance+'%'}}/></div>
              {administrador&&<div className="compromisos-cambiar-etapa">
                <label>Etapa del compromiso
                  <select value={item.estado} disabled={guardando} aria-label={'Cambiar etapa de '+item.titulo}
                    onChange={e=>cambiarEstado(item,e.target.value)}>
                    {Object.entries(NOMBRES).map(([v,t])=><option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label>Próxima acción
                  <input type="date" value={fechasRapidas[item.id]??item.fecha_proxima_accion??''}
                    onChange={e=>setFechasRapidas(x=>({...x,[item.id]:e.target.value}))}/>
                </label>
                <label>Nota de seguimiento
                  <input maxLength={2000} placeholder="Motivo o próximo paso"
                    value={observacionesRapidas[item.id]||''}
                    onChange={e=>setObservacionesRapidas(x=>({...x,[item.id]:e.target.value}))}/>
                </label>
                <button type="button" disabled={guardando} className="boton boton-secundario"
                  onClick={()=>cambiarEstado(item,item.estado==='en_espera'?'en_curso':'en_espera')}>
                  {item.estado==='en_espera'?'Reanudar':'Poner en espera'}
                </button>
              </div>}
              <details className="compromisos-subtareas">
                <summary>Subtareas ({realizados}/{sub.length})</summary>
                {sub.map(x=><div className="compromisos-subfila" key={x.id}>
                  <label><input type="checkbox" checked={x.completada} disabled={!administrador||guardando}
                    onChange={e=>marcarSubtarea(item,x,e.target.checked)}/> {x.titulo}</label>
                  {administrador&&<button type="button" className="boton boton-texto" disabled={guardando}
                    onClick={()=>eliminarSubtarea(item,x)}>Eliminar</button>}
                </div>)}
                {administrador&&<div className="compromisos-subagregar">
                  <input aria-label={'Nueva subtarea para '+item.titulo} placeholder="Nueva subtarea"
                    value={nuevaSubtarea[item.id]||''}
                    onChange={e=>setNuevaSubtarea(v=>({...v,[item.id]:e.target.value}))}/>
                  <button type="button" className="boton boton-secundario"
                    disabled={guardando||!(nuevaSubtarea[item.id]||'').trim()}
                    onClick={()=>agregarSubtarea(item)}>Agregar subtarea</button>
                </div>}
              </details>
              <details className="compromisos-adjuntos">
                <summary>Documentos del compromiso</summary>
                <DriveArchivos key={item.id+'-'+versionDocs} comunidadId={comunidadId}
                  origenTipo="compromiso" origenId={item.id} compacto
                  titulo="Documentos · Google Drive" permitirSubir={administrador} ocultarVacio={!administrador}/>
              </details>
              {administrador&&<div className="compromisos-acciones">
                <button type="button" className="boton boton-secundario" disabled={guardando}
                  onClick={()=>{
                    setEditando(editando===item.id?null:item.id);
                    setEditForm({titulo:item.titulo,descripcion:item.descripcion||'',
                      referencia_contractual:item.referencia_contractual||'',fecha_inicio:item.fecha_inicio||'',
                      fecha_limite:item.fecha_limite||'',fecha_proxima_accion:item.fecha_proxima_accion||'',
                      responsable:item.responsable||''});
                  }}>Editar datos y fechas</button>
                <button type="button" className="boton boton-secundario"
                  onClick={()=>{setDetalle(detalle===item.id?null:item.id);setPorcentaje(item.avance);setEstado(item.estado);}}>Registrar avance</button>
                <button type="button" className="boton boton-texto" disabled={guardando}
                  onClick={()=>visibilidad(item)}>{item.publicado?'Retirar del portal':'Publicar compromiso'}</button>
                <button type="button" className="boton boton-texto" disabled={guardando}
                  onClick={()=>eliminarCompromiso(item)}>Eliminar</button>
              </div>}
              {administrador&&editando===item.id&&<form className="compromisos-form" onSubmit={editarCompromiso}>
                <label>Título<input required value={editForm.titulo} onChange={e=>setEditForm(v=>({...v,titulo:e.target.value}))}/></label>
                <label>Descripción<textarea value={editForm.descripcion} onChange={e=>setEditForm(v=>({...v,descripcion:e.target.value}))}/></label>
                <div className="compromisos-grid">
                  <label>Referencia contractual<input value={editForm.referencia_contractual} onChange={e=>setEditForm(v=>({...v,referencia_contractual:e.target.value}))}/></label>
                  <label>Responsable<input value={editForm.responsable} onChange={e=>setEditForm(v=>({...v,responsable:e.target.value}))}/></label>
                  <label>Inicio<input type="date" value={editForm.fecha_inicio} onChange={e=>setEditForm(v=>({...v,fecha_inicio:e.target.value}))}/></label>
                  <label>Límite<input type="date" value={editForm.fecha_limite} onChange={e=>setEditForm(v=>({...v,fecha_limite:e.target.value}))}/></label>
                  <label>Próxima acción<input type="date" value={editForm.fecha_proxima_accion} onChange={e=>setEditForm(v=>({...v,fecha_proxima_accion:e.target.value}))}/></label>
                </div>
                <button className="boton boton-primario" disabled={guardando}>Guardar cambios</button>
              </form>}
              <details className="compromisos-historial">
                <summary>Avances e historial ({historico.length+movimientos.length})</summary>
                {historico.map(a=><details key={a.id} className="compromisos-avance-item">
                  <summary>{fecha(a.registrado_en)} · {a.porcentaje??'—'}% · {NOMBRES[a.estado]||'Avance'}</summary>
                  <p>{a.descripcion}</p>
                  {a.evidencia_url&&/^https:\/\//i.test(a.evidencia_url)&&
                    <a href={a.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}
                  {adjuntos.filter(x=>x.avance_id===a.id).map(doc=><span key={doc.id}>
                    <button className="boton boton-texto" type="button" onClick={()=>abrirAdjunto(doc)}>📎 {doc.nombre}</button>
                    {administrador&&<button className="boton boton-texto" type="button" disabled={guardando}
                      onClick={()=>eliminarAdjunto(doc)}>Eliminar adjunto</button>}
                  </span>)}
                </details>)}
                {movimientos.map(t=><div key={t.id} className="compromisos-transicion">
                  {fecha(t.cambiado_en)} · {NOMBRES[t.estado_anterior]} → {NOMBRES[t.estado_nuevo]}
                  {t.observacion&&<p>{t.observacion}</p>}
                </div>)}
                {!historico.length&&!movimientos.length&&<p className="micro apagado">Sin movimientos.</p>}
              </details>
              {administrador&&detalle===item.id&&<form className="compromisos-form" onSubmit={registrar}>
                <label>Avance realizado<textarea required rows={3} value={texto} onChange={e=>setTexto(e.target.value)}/></label>
                <div className="compromisos-grid">
                  <label>Etapa<select value={estado} onChange={e=>setEstado(e.target.value)}>
                    {Object.entries(NOMBRES).map(([v,t])=><option key={v} value={v}>{t}</option>)}
                  </select></label>
                  <label>Porcentaje<input type="number" min="0" max="100" value={sub.length?Math.round(realizados/sub.length*100):porcentaje}
                    disabled={Boolean(sub.length)} onChange={e=>setPorcentaje(e.target.value)}/></label>
                </div>
                <label>Enlace de evidencia (opcional)<input type="url" value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></label>
                <label>Adjuntar archivos ({driveConectada?'Google Drive: 25 MB':'15 MB'} máximo por archivo)
                  <input type="file" multiple accept={driveConectada?DRIVE_ACCEPT:'.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt'}
                    onChange={e=>setArchivos(Array.from(e.target.files||[]))}/></label>
                {archivos.length>0&&<p className="micro apagado">{archivos.map(x=>x.name).join(', ')}</p>}
                <label className="compromisos-check"><input type="checkbox" checked={publicar}
                  onChange={e=>setPublicar(e.target.checked)}/>Publicar este avance al cliente</label>
                <button className="boton boton-primario" disabled={guardando}>Guardar avance</button>
              </form>}
            </div>
          </details>
        })}
      </div>}
 </section>;
}
