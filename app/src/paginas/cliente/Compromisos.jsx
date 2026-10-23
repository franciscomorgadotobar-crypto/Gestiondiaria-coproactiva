import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Compromisos.css';
import DriveArchivos from '../../componentes/DriveArchivos';
import { DRIVE_ACCEPT, conexionDrive, subirADrive, validarArchivoDrive } from '../../lib/drive';

const NOMBRES = { pendiente: 'Pendiente', en_curso: 'En ejecución', en_espera: 'En espera de tercero', completado: 'Completado' };
const fecha = x => x ? new Date(x + (x.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL') : 'Sin fecha';
const inicial = { titulo: '', descripcion: '', referencia_contractual: '', fecha_limite: '', responsable: '' };

export default function Compromisos({ comunidadId, administrador = false }) {
 const [compromisos, setCompromisos] = useState([]);
 const [avances, setAvances] = useState([]);
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
   const avanceIds = (historial || []).map(a => a.id);
   if (avanceIds.length) {
    const {data: docs, error: errDocs} = await supabase.from('compromisos_avances_adjuntos').select('*').in('avance_id',avanceIds);
    if (errDocs) setError(errDocs.message);
    setAdjuntos(docs || []);
   } else setAdjuntos([]);
  } else { setAvances([]); setAdjuntos([]); }
  setCargando(false);
 }
 useEffect(() => { cargar(); }, [comunidadId]);
 useEffect(() => { if (administrador) conexionDrive().then(c => setDriveConectada(Boolean(c?.conectada))); }, [administrador]);
 async function crear(e) {
  e.preventDefault(); setGuardando(true); setError('');
  const { error: err } = await supabase.from('compromisos_administracion').insert({
   comunidad_id: comunidadId, titulo: nuevo.titulo.trim(), descripcion: nuevo.descripcion,
   referencia_contractual: nuevo.referencia_contractual, fecha_limite: nuevo.fecha_limite || null,
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
    avance:porcentajeReal, estado:subt.length?(porcentajeReal===100?'completado':porcentajeReal>0?'en_curso':'pendiente'):estado, actualizado_en:new Date().toISOString()
   }).eq('id',detalle);
   if(err2) throw err2;
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
   responsable:editForm.responsable,fecha_limite:editForm.fecha_limite||null
  }).eq('id',editando);
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
   const {error:err2}=await supabase.from('compromisos_administracion').update({avance,estado:avance>0?'en_curso':'pendiente'}).eq('id',item.id);
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
   const estado=avance===100?'completado':avance>0?'en_curso':'pendiente';
   const {error:err2}=await supabase.from('compromisos_administracion').update({avance,estado,actualizado_en:new Date().toISOString()}).eq('id',item.id);
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
    const estado=avance===100?'completado':avance>0?'en_curso':'pendiente';
    const {error:err2}=await supabase.from('compromisos_administracion').update({avance,estado}).eq('id',item.id);if(err2)throw err2;
   }
   await cargar();
  }catch(e){setError(e.message||'No fue posible eliminar subtarea.');}
  finally{setGuardando(false);}
 }
 async function visibilidad(item) {
  const {error: err} = await supabase.from('compromisos_administracion').update({publicado: !item.publicado}).eq('id', item.id);
  if(err) setError(err.message);else await cargar();
 }
 return <section className="compromisos-wrap" aria-label="Compromisos y avances">
  <header className="compromisos-cabecera"><h2 className="h4">Compromisos y avances</h2><p className="chico apagado">Seguimiento de los acuerdos de administración, sus plazos y evidencias.</p></header>
  {error && <div className="aviso aviso-critico" role="alert">{error}</div>}
  {administrador && <form onSubmit={crear} className="tarjeta compromisos-form">
   <h3 className="h4">Nuevo compromiso</h3><p className="micro apagado">Los acuerdos del contrato en revisión deben validarse antes de publicarse.</p>
   <label>Título<input required maxLength={180} value={nuevo.titulo} onChange={e=>setNuevo({...nuevo,titulo:e.target.value})}/></label>
   <label>Descripción<textarea rows={2} value={nuevo.descripcion} onChange={e=>setNuevo({...nuevo,descripcion:e.target.value})}/></label>
   <div className="compromisos-grid">
    <label>Referencia contractual<input value={nuevo.referencia_contractual} onChange={e=>setNuevo({...nuevo,referencia_contractual:e.target.value})}/></label>
    <label>Responsable<input value={nuevo.responsable} onChange={e=>setNuevo({...nuevo,responsable:e.target.value})}/></label>
    <label>Fecha comprometida<input type="date" value={nuevo.fecha_limite} onChange={e=>setNuevo({...nuevo,fecha_limite:e.target.value})}/></label>
   </div><button className="boton boton-primario" disabled={guardando}>Crear compromiso interno</button>
  </form>}
  {cargando ? <p className="cargando">Cargando compromisos…</p> : compromisos.length === 0
   ? <div className="portal-vacio"><strong>Sin compromisos publicados</strong><span>{administrador ? 'Registra el primer compromiso de esta comunidad.' : 'La administración aún no ha publicado compromisos para esta comunidad.'}</span></div>
   : <div className="compromisos-lista">{compromisos.map((item, indice) => <article className="tarjeta compromisos-item" key={item.id}>
      <div className="compromisos-fila"><div><strong>{String(indice + 1).padStart(2, '0')}. {item.titulo}</strong><p className="micro apagado">{item.descripcion}</p></div><span className="portal-estado">{NOMBRES[item.estado] || item.estado}</span></div>
      <div className="compromisos-meta"><span>Responsable: {item.responsable || 'Por asignar'}</span><span>Fecha: {fecha(item.fecha_limite)}</span>{item.referencia_contractual && <span>{item.referencia_contractual}</span>}</div>
      <div className="compromisos-progreso"><div style={{width:item.avance+'%'}}/></div><span className="micro">{item.avance}% de avance informado</span>
      <div className="compromisos-subtareas"><strong>Subtareas ({subtareas.filter(s=>s.compromiso_id===item.id&&s.completada).length}/{subtareas.filter(s=>s.compromiso_id===item.id).length})</strong>
       {subtareas.filter(s=>s.compromiso_id===item.id).map(s=><div key={s.id} className="compromisos-subfila"><label><input type="checkbox" checked={s.completada} disabled={!administrador||guardando} onChange={e=>marcarSubtarea(item,s,e.target.checked)}/> {s.titulo}</label>{administrador&&<button type="button" className="boton boton-texto" disabled={guardando} onClick={()=>eliminarSubtarea(item,s)}>Eliminar</button>}</div>)}
       {administrador&&<div className="compromisos-subagregar"><input aria-label="Nueva subtarea" placeholder="Nueva subtarea" value={nuevaSubtarea[item.id]||''} onChange={e=>setNuevaSubtarea(v=>({...v,[item.id]:e.target.value}))}/><button type="button" className="boton boton-texto" disabled={guardando||!(nuevaSubtarea[item.id]||'').trim()} onClick={()=>agregarSubtarea(item)}>Añadir subtarea</button></div>}
      </div>
      <DriveArchivos key={item.id + "-" + versionDocs} comunidadId={comunidadId} origenTipo="compromiso" origenId={item.id} compacto
                     titulo="Documentos del compromiso · Google Drive" permitirSubir={administrador} ocultarVacio={!administrador} />
      {administrador && <div className="compromisos-acciones"><button type="button" className="boton boton-texto" disabled={guardando} onClick={()=>{setEditando(editando===item.id?null:item.id);setEditForm({titulo:item.titulo,descripcion:item.descripcion||'',referencia_contractual:item.referencia_contractual||'',fecha_limite:item.fecha_limite||'',responsable:item.responsable||''});}}>Editar</button><button type="button" className="boton boton-texto" disabled={guardando} onClick={()=>eliminarCompromiso(item)}>Eliminar</button><button type="button" className="boton boton-texto" onClick={()=>visibilidad(item)}>{item.publicado?'Retirar del portal cliente':'Publicar compromiso'}</button><button type="button" className="boton boton-texto" onClick={()=>{setDetalle(detalle===item.id?null:item.id);setPorcentaje(item.avance);setEstado(item.estado);}}>Registrar avance</button></div>}
      {administrador&&editando===item.id&&<form className="compromisos-form" onSubmit={editarCompromiso}>
       <label>Título<input required value={editForm.titulo} onChange={e=>setEditForm(v=>({...v,titulo:e.target.value}))}/></label>
       <label>Descripción<textarea value={editForm.descripcion} onChange={e=>setEditForm(v=>({...v,descripcion:e.target.value}))}/></label>
       <div className="compromisos-grid"><label>Referencia contractual<input value={editForm.referencia_contractual} onChange={e=>setEditForm(v=>({...v,referencia_contractual:e.target.value}))}/></label><label>Responsable<input value={editForm.responsable} onChange={e=>setEditForm(v=>({...v,responsable:e.target.value}))}/></label><label>Fecha límite<input type="date" value={editForm.fecha_limite} onChange={e=>setEditForm(v=>({...v,fecha_limite:e.target.value}))}/></label></div>
       <button className="boton boton-primario" disabled={guardando}>Guardar cambios</button>
      </form>}
      <div className="compromisos-historial">{avances.filter(x=>x.compromiso_id===item.id).map(a=><div key={a.id}><span className="micro apagado">{fecha(a.registrado_en)}</span><p>{a.descripcion}</p>{a.evidencia_url && /^https:\/\//i.test(a.evidencia_url) && <a href={a.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}{adjuntos.filter(d=>d.avance_id===a.id).map(doc=><span key={doc.id}><button type="button" className="boton boton-texto" onClick={()=>abrirAdjunto(doc)}>📎 {doc.nombre}</button>{administrador&&<button type="button" className="boton boton-texto" disabled={guardando} onClick={()=>eliminarAdjunto(doc)}>Eliminar adjunto</button>}</span>)}</div>)}</div>
      {administrador && detalle===item.id && <form className="compromisos-form" onSubmit={registrar}>
       <label>Avance realizado<textarea required rows={3} value={texto} onChange={e=>setTexto(e.target.value)} /></label>
       <div className="compromisos-grid"><label>Estado<select value={estado} onChange={e=>setEstado(e.target.value)}>{Object.entries(NOMBRES).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>Porcentaje<input type="number" min="0" max="100" disabled={subtareas.some(s=>s.compromiso_id===detalle)} value={subtareas.some(s=>s.compromiso_id===detalle)?Math.round(subtareas.filter(s=>s.compromiso_id===detalle&&s.completada).length/subtareas.filter(s=>s.compromiso_id===detalle).length*100):porcentaje} onChange={e=>setPorcentaje(e.target.value)}/></label></div>
       <label>Enlace de evidencia (opcional)<input type="url" value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></label>
       <label>{driveConectada ? 'Adjuntar archivos a Google Drive (PDF, imágenes, Word, Excel; máximo 25 MB por archivo)' : 'Adjuntar archivos (PDF, imágenes, Word, Excel; máximo 15 MB por archivo)'}<input type="file" multiple accept={driveConectada ? DRIVE_ACCEPT : '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt'} onChange={e=>setArchivos(Array.from(e.target.files || []))}/></label>
       {archivos.length > 0 && <span className="micro apagado">{archivos.length} archivo(s) seleccionado(s): {archivos.map(f=>f.name).join(', ')}</span>}
       <label className="compromisos-check"><input type="checkbox" checked={publicar} onChange={e=>setPublicar(e.target.checked)}/> Publicar este avance al cliente</label>
       <button className="boton boton-primario" disabled={guardando}>Guardar avance</button>
      </form>}
     </article>)}</div>}
 </section>;
}
