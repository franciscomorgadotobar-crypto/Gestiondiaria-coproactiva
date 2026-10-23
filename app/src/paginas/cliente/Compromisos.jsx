import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Compromisos.css';

const NOMBRES = { pendiente: 'Pendiente', en_curso: 'En ejecución', en_espera: 'En espera de tercero', completado: 'Completado' };
const fecha = x => x ? new Date(x + (x.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL') : 'Sin fecha';
const inicial = { titulo: '', descripcion: '', referencia_contractual: '', fecha_limite: '', responsable: '' };

export default function Compromisos({ comunidadId, administrador = false }) {
 const [compromisos, setCompromisos] = useState([]);
 const [avances, setAvances] = useState([]);
 const [adjuntos, setAdjuntos] = useState([]);
 const [archivos, setArchivos] = useState([]);
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
 async function cargar() {
  if (!comunidadId) return;
  setCargando(true); setError('');
  const { data, error: err } = await supabase.from('compromisos_administracion').select('*').eq('comunidad_id', comunidadId).order('orden', {ascending:true, nullsFirst:false}).order('creado_en', {ascending:true});
  if (err) { setError('No fue posible cargar compromisos: ' + err.message); setCargando(false); return; }
  setCompromisos(data || []);
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
   const { data: avance, error: err } = await supabase.from('compromisos_avances').insert({
    compromiso_id: detalle, descripcion: texto.trim(), porcentaje: Number(porcentaje),
    estado, evidencia_url: evidencia.trim() || null, publicado: publicar
   }).select('id').single();
   if (err) throw err;
   const fallidos = [];
   for (const file of archivos) {
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
    avance:Number(porcentaje), estado, actualizado_en:new Date().toISOString()
   }).eq('id',detalle);
   if(err2) throw err2;
   setTexto('');setEvidencia('');setPublicar(false);setArchivos([]);
   await cargar();
   if(fallidos.length) setError('Avance guardado, pero algunos archivos no se adjuntaron: ' + fallidos.join('; '));
  } catch(err) { setError(err.message || 'No fue posible registrar el avance.'); }
  finally { setGuardando(false); }
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
      {administrador && <div className="compromisos-acciones"><button type="button" className="boton boton-texto" onClick={()=>visibilidad(item)}>{item.publicado?'Retirar del portal cliente':'Publicar compromiso'}</button><button type="button" className="boton boton-texto" onClick={()=>{setDetalle(detalle===item.id?null:item.id);setPorcentaje(item.avance);setEstado(item.estado);}}>Registrar avance</button></div>}
      <div className="compromisos-historial">{avances.filter(x=>x.compromiso_id===item.id).map(a=><div key={a.id}><span className="micro apagado">{fecha(a.registrado_en)}</span><p>{a.descripcion}</p>{a.evidencia_url && /^https:\/\//i.test(a.evidencia_url) && <a href={a.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}{adjuntos.filter(d=>d.avance_id===a.id).map(doc=><button key={doc.id} type="button" className="boton boton-texto" onClick={()=>abrirAdjunto(doc)}>📎 {doc.nombre}</button>)}</div>)}</div>
      {administrador && detalle===item.id && <form className="compromisos-form" onSubmit={registrar}>
       <label>Avance realizado<textarea required rows={3} value={texto} onChange={e=>setTexto(e.target.value)} /></label>
       <div className="compromisos-grid"><label>Estado<select value={estado} onChange={e=>setEstado(e.target.value)}>{Object.entries(NOMBRES).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>Porcentaje<input type="number" min="0" max="100" value={porcentaje} onChange={e=>setPorcentaje(e.target.value)}/></label></div>
       <label>Enlace de evidencia (opcional)<input type="url" value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></label>
       <label>Adjuntar archivos (PDF, imágenes, Word, Excel; máximo 15 MB por archivo)<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt" onChange={e=>setArchivos(Array.from(e.target.files || []))}/></label>
       {archivos.length > 0 && <span className="micro apagado">{archivos.length} archivo(s) seleccionado(s): {archivos.map(f=>f.name).join(', ')}</span>}
       <label className="compromisos-check"><input type="checkbox" checked={publicar} onChange={e=>setPublicar(e.target.checked)}/> Publicar este avance al cliente</label>
       <button className="boton boton-primario" disabled={guardando}>Guardar avance</button>
      </form>}
     </article>)}</div>}
 </section>;
}
