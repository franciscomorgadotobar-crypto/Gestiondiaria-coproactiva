import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Compromisos.css';
import DriveArchivos from '../../componentes/DriveArchivos';
import { DRIVE_ACCEPT, conexionDrive, subirADrive, validarArchivoDrive } from '../../lib/drive';
import {porcentajeSubtareas,resumenGlobalCompromisos} from '../../lib/progresoCompromisos';
import {ordenarAvances,primerPendienteAvances,estadoVisualAvance} from '../../lib/motorAvances';
import MotorAvances from '../../componentes/MotorAvances';
import repositorioSantaClara from '../../datos/repositorioCompromisosSantaClara.json';

const NOMBRES = { pendiente: 'Pendiente', en_curso: 'En ejecución', en_espera: 'En espera de tercero', completado: 'Completado' };
const fecha = x => x ? new Date(x + (x.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL') : 'Sin fecha';
const inicial = { titulo: '', descripcion: '', referencia_contractual: '', fecha_inicio: '', fecha_limite: '', fecha_proxima_accion: '', responsable: '' };

export default function Compromisos({ comunidadId, administrador = false, soloVistaCliente = false, seleccionadoId = null, integrado = false, onActualizado }) {
 const [compromisos, setCompromisos] = useState([]);
 const [avances, setAvances] = useState([]);
 const [transiciones,setTransiciones] = useState([]);
 const [fechasRapidas,setFechasRapidas] = useState({});
 const [observacionesRapidas,setObservacionesRapidas] = useState({});
 const [adjuntos, setAdjuntos] = useState([]);
 const [archivos, setArchivos] = useState([]);
 const [subtareas,setSubtareas]=useState([]);
 const [nuevaSubtarea,setNuevaSubtarea]=useState({});
 // Índice numerado y detalle individual: el mismo recorrido de Levantamientos.
 const [pasoSubtarea,setPasoSubtarea]=useState({});
 const [tituloEnEdicion,setTituloEnEdicion]=useState(null);
 const [editando,setEditando]=useState(null);
 const [editForm,setEditForm]=useState(inicial);
 const [error, setError] = useState('');
 const [cargando, setCargando] = useState(true);
 const [nuevo, setNuevo] = useState(inicial);
 const [modeloSeleccionado,setModeloSeleccionado]=useState('');
 const [detalle, setDetalle] = useState(null);
 const [texto, setTexto] = useState('');
 const [evidencia, setEvidencia] = useState('');
 const [porcentaje, setPorcentaje] = useState(0);
 const [estado, setEstado] = useState('en_curso');
 const [publicar, setPublicar] = useState(false);
 const [guardando, setGuardando] = useState(false);
 const [driveConectada, setDriveConectada] = useState(false);
 const [versionDocs, setVersionDocs] = useState(0);
 async function cargar({silencioso=false}={}) {
  if (!comunidadId) return;
  if(!silencioso)setCargando(true);setError('');
  let consulta=supabase.from('compromisos_administracion').select('*').eq('comunidad_id',comunidadId);
  if(seleccionadoId)consulta=consulta.eq('id',seleccionadoId);
  const {data,error:err}=await consulta.order('orden',{ascending:true,nullsFirst:false}).order('creado_en',{ascending:true});
  if (err) { setError('No fue posible cargar compromisos: ' + err.message); setCargando(false); return; }
  const visibles=soloVistaCliente ? (data||[]).filter(c=>c.publicado===true) : (data||[]);
  setCompromisos(visibles);
  const {data: subt,error: errSubt}=await supabase.from('compromisos_subtareas').select('*').in('compromiso_id',visibles.map(x=>x.id).length ? visibles.map(x=>x.id):['00000000-0000-0000-0000-000000000000']).order('orden',{ascending:true});
  if(errSubt) setError(errSubt.message);
  setSubtareas(subt||[]);
  const ids = visibles.map(x => x.id);
  if (ids.length) {
   const { data: historial, error: err2 } = await supabase.from('compromisos_avances').select('*').in('compromiso_id', ids).order('registrado_en', {ascending:false});
   if (err2) setError(err2.message);
   setAvances(soloVistaCliente ? (historial||[]).filter(x=>x.publicado===true) : (historial||[]));
   const {data: trans,error: errTrans}=await supabase.from('compromisos_transiciones')
      .select('id,compromiso_id,estado_anterior,estado_nuevo,observacion,fecha_proxima_accion,cambiado_en')
      .in('compromiso_id', ids).order('cambiado_en',{ascending:false});
   if(errTrans) setError(errTrans.message);
   setTransiciones(trans || []);
   const avanceIds = (soloVistaCliente ? (historial||[]).filter(x=>x.publicado===true) : (historial||[])).map(a=>a.id);
   if (avanceIds.length) {
    const {data: docs, error: errDocs} = await supabase.from('compromisos_avances_adjuntos').select('*').in('avance_id',avanceIds);
    if (errDocs) setError(errDocs.message);
    setAdjuntos(docs || []);
   } else setAdjuntos([]);
  } else { setAvances([]); setAdjuntos([]); setTransiciones([]); }
  setCargando(false);
 }
 useEffect(() => { cargar(); }, [comunidadId, soloVistaCliente, seleccionadoId]);
 async function recargarYNotificar(){
  await cargar({silencioso:true});
  if(onActualizado)await onActualizado();
 }
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
  if (err) setError(err.message); else { setNuevo(inicial); await recargarYNotificar(); }
  setGuardando(false);
 }
 async function agregarDesdeRepositorio(e) {
  e.preventDefault();
  if(!administrador||guardando||!modeloSeleccionado)return;
  const modelo=repositorioSantaClara.items.find(x=>x.codigo===modeloSeleccionado);
  if(!modelo)return;
  if(compromisos.some(x=>x.titulo.trim().toLocaleLowerCase('es-CL')===modelo.titulo.toLocaleLowerCase('es-CL'))){
   setError('Este compromiso ya existe en la comunidad. No se creó un duplicado.');
   return;
  }
  setGuardando(true);setError('');
  try {
   const {error:err}=await supabase.from('compromisos_administracion').insert({
    comunidad_id:comunidadId,titulo:modelo.titulo,descripcion:'',
    orden:modelo.orden,estado:'pendiente',avance:0,publicado:false
   });
   if(err)throw err;
   setModeloSeleccionado('');
   await recargarYNotificar();
  }catch(err){setError('No se pudo agregar el compromiso: '+(err.message||'Error desconocido'));}
  finally{setGuardando(false);}
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
   const porcentajeReal=subt.length?porcentajeSubtareas(subt):Number(porcentaje);
   const { data: avance, error: err } = await supabase.from('compromisos_avances').insert({
    compromiso_id: detalle, descripcion: texto.trim(), porcentaje: porcentajeReal,
    estado, evidencia_url: evidencia.trim() || null, publicado: publicar
   }).select('id').single();
   if (err) throw err;
   const fallidos = [];
   if(archivos.length&&!driveConectada)
    throw new Error('Conecta Google Drive en Comunidades → Configuración antes de adjuntar archivos.');
   for (const file of archivos) {
    const invalido=validarArchivoDrive(file);
    if(invalido){fallidos.push(invalido);continue;}
    try{await subirADrive({comunidadId,origenTipo:'compromiso',origenId:detalle,detalleId:avance.id,archivo:file});}
    catch(eDrive){fallidos.push(file.name+': '+eDrive.message);}

   }
   if(!subt.length){
    const {error:e}=await supabase.from('compromisos_administracion').update({
     avance:porcentajeReal,actualizado_en:new Date().toISOString()
    }).eq('id',detalle).select('id').single();
    if(e)throw e;
   }
   const {error: estadoError}=await supabase.rpc('compromisos_cambiar_etapa',{
     p_compromiso_id:detalle,p_estado:subt.length?(compromisos.find(c=>c.id===detalle)?.estado||estado):estado,
     p_proxima_accion:fechasRapidas[detalle]||null,
     p_observacion:'Cambio al registrar avance: '+texto.trim().slice(0,500)
   });
   if(estadoError) throw estadoError;
   setTexto('');setEvidencia('');setPublicar(false);setArchivos([]);setVersionDocs(v=>v+1);
   await recargarYNotificar();
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
  if(err)setError(err.message);else {setEditando(null);await recargarYNotificar();}
 }
 async function eliminarCompromiso(item) {
  if(!window.confirm(`¿Eliminar definitivamente "${item.titulo}" y sus avances y subtareas? Esta acción no se puede deshacer.`))return;
  setGuardando(true);setError('');
  try{
   const ids=avances.filter(a=>a.compromiso_id===item.id).map(a=>a.id);
   const docs=adjuntos.filter(d=>ids.includes(d.avance_id));
   const {data:driveDocs,error:driveError}=await supabase.rpc('drive_listar_documentos',{
     p_comunidad_id:comunidadId,p_origen_tipo:'compromiso',p_origen_id:item.id,p_incluir_eliminados:false
   });
   if(driveError)throw driveError;
   if(driveDocs?.length)throw new Error('El compromiso tiene documentos en Google Drive. Retíralos antes de eliminarlo.');
   if(docs.length){const {error:se}=await supabase.storage.from('compromisos-adjuntos').remove(docs.map(d=>d.ruta));if(se)throw se;}
   const {error:de}=await supabase.from('compromisos_administracion').delete().eq('id',item.id);
   if(de)throw de;
   await recargarYNotificar();
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
   await recargarYNotificar();
  }catch(e){setError(e.message||'No fue posible eliminar el adjunto.');}
  finally{setGuardando(false);}
 }
 async function agregarSubtarea(item) {
  const titulo=(nuevaSubtarea[item.id]||'').trim();if(!titulo||guardando)return;
  setGuardando(true);setError('');
  try{
   const orden=subtareas.filter(x=>x.compromiso_id===item.id).length+1;
   const {error:e}=await supabase.from('compromisos_subtareas').insert({compromiso_id:item.id,titulo,orden});
   if(e)throw e;
   setNuevaSubtarea(v=>({...v,[item.id]:''}));await recargarYNotificar();
  }catch(e){setError(e.message||'No fue posible agregar la subtarea.');}
  finally{setGuardando(false);}
 }
 async function marcarSubtarea(item,sub,completada) {
  if(guardando)return;
  setGuardando(true);setError('');
  try{
   const {error:e}=await supabase.from('compromisos_subtareas').update({completada,avance:completada?100:0}).eq('id',sub.id);
   if(e)throw e;
   // El trigger actualiza porcentaje, etapa e historial en una transacción.
   await recargarYNotificar();
  }catch(e){setError(e.message||'No se pudo actualizar la subtarea.');await recargarYNotificar();}
  finally{setGuardando(false);}
 }
 async function cambiarProgresoSubtarea(sub,valor) {
  if(guardando)return;
  setGuardando(true);setError('');
  try{
   const {error:e}=await supabase.from('compromisos_subtareas')
    .update({avance:Math.min(90,Math.max(0,Number(valor)||0)),completada:false}).eq('id',sub.id);
   if(e)throw e;
   await recargarYNotificar();
  }catch(e){setError(e.message||'No se pudo actualizar el avance.');}
  finally{setGuardando(false);}
 }
 async function guardarTituloDirecto(e){
  e.preventDefault();
  if(!administrador||guardando||!tituloEnEdicion)return;
  const titulo=tituloEnEdicion.valor.trim();
  if(!titulo||titulo.length>180){
   setError('El título debe contener entre 1 y 180 caracteres.');
   return;
  }
  const esSubtarea=tituloEnEdicion.tipo==='subtarea';
  const origen=(esSubtarea?subtareas:compromisos).find(x=>x.id===tituloEnEdicion.id);
  if(!origen)return;
  if(titulo===origen.titulo){setTituloEnEdicion(null);return;}
  setGuardando(true);setError('');
  try{
   const tabla=esSubtarea?'compromisos_subtareas':'compromisos_administracion';
   let consulta=supabase.from(tabla).update({titulo}).eq('id',tituloEnEdicion.id);
   if(esSubtarea)consulta=consulta.eq('compromiso_id',tituloEnEdicion.compromisoId);
   else consulta=consulta.eq('comunidad_id',comunidadId);
   const {data,error:err}=await consulta.select('id,titulo').single();
   if(err)throw err;
   if(esSubtarea)setSubtareas(actual=>actual.map(x=>x.id===data.id?{...x,titulo:data.titulo}:x));
   else setCompromisos(actual=>actual.map(x=>x.id===data.id?{...x,titulo:data.titulo}:x));
   setTituloEnEdicion(null);
  }catch(err){setError('No fue posible guardar el título: '+(err.message||'Error desconocido'));}
  finally{setGuardando(false);}
 }
 async function eliminarSubtarea(item,sub) {
  if(!window.confirm('¿Eliminar esta subtarea y sus adjuntos?'))return;
  setGuardando(true);setError('');
  try{
   const {data:driveDocs,error:driveError}=await supabase.rpc('drive_listar_documentos',{
     p_comunidad_id:comunidadId,p_origen_tipo:'compromiso',p_origen_id:item.id,p_incluir_eliminados:false
   });
   if(driveError)throw driveError;
   if((driveDocs||[]).some(d=>d.detalle_id===sub.id))
    throw new Error('La subtarea tiene documentos en Google Drive. Retíralos antes de eliminarla.');
   const {error:e}=await supabase.from('compromisos_subtareas').delete().eq('id',sub.id);
   if(e)throw e;
   setPasoSubtarea(actual=>({...actual,[item.id]:null}));
   await recargarYNotificar();
  }catch(e){setError(e.message||'No se pudo eliminar la subtarea.');}
  finally{setGuardando(false);}
 }
 async function cambiarEstado(item, siguiente) {
  if(!administrador || guardando)return;
  const fechaNueva=fechasRapidas[item.id];
  const notaNueva=observacionesRapidas[item.id]?.trim();
  if(siguiente===item.estado && (!fechaNueva || fechaNueva===item.fecha_proxima_accion) && !notaNueva)return;
  const subtareasItem=subtareas.filter(x=>x.compromiso_id===item.id);
  if(siguiente==='completado'&&subtareasItem.some(x=>!x.completada))
   return setError('Para cerrar el compromiso, marca todas las subtareas.');
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
  else {setObservacionesRapidas(x=>({...x,[item.id]:''}));await recargarYNotificar();}
  setGuardando(false);
 }
 async function visibilidad(item) {
  const {error: err} = await supabase.from('compromisos_administracion').update({publicado: !item.publicado}).eq('id', item.id);
  if(err) setError(err.message);else await recargarYNotificar();
 }
 return <section className="compromisos-wrap" aria-label="Compromisos y avances">
   {!integrado&&<header className="compromisos-cabecera"><h2 className="h4">Compromisos y avances</h2>
     <p className="chico apagado">Acuerdos, fechas, estado, subtareas y evidencias. Cada ficha se despliega al seleccionarla.</p>
   </header>}
   {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
   {!integrado&&!cargando&&compromisos.length>0&&<div className="compromisos-resumen-global" aria-label="Avance de compromisos">
     <div><strong>{resumenGlobalCompromisos(compromisos).abiertos}</strong><span>Por resolver</span></div>
     <div><strong>{resumenGlobalCompromisos(compromisos).completados}</strong><span>Terminados</span></div>
     <div><strong>{resumenGlobalCompromisos(compromisos).porcentaje}%</strong><span>Avance global</span></div>
   </div>}
   {administrador&&!integrado&&<details className="tarjeta compromisos-crear-desplegable">
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
   {administrador&&!integrado&&<details className="tarjeta compromisos-crear-desplegable compromisos-repositorio">
     <summary>Repositorio de compromisos · {repositorioSantaClara.items.length} modelos</summary>
     <form className="compromisos-form" onSubmit={agregarDesdeRepositorio}>
       <p className="micro apagado">Catálogo de referencia de Reserva Santa Clara (23-10-2026). Agrega un modelo sin modificar el original ni los compromisos existentes.</p>
       <label>Modelo del repositorio
         <select aria-label="Seleccionar compromiso del repositorio" value={modeloSeleccionado}
           onChange={e=>setModeloSeleccionado(e.target.value)}>
           <option value="">Seleccionar compromiso…</option>
           {repositorioSantaClara.items.map(x=><option key={x.codigo} value={x.codigo}>{String(x.orden).padStart(2,'0')}. {x.titulo}</option>)}
         </select>
       </label>
       <button className="boton boton-secundario" type="submit" disabled={guardando||!modeloSeleccionado}>
         Agregar a esta comunidad
       </button>
     </form>
   </details>}
   {cargando ? <p className="cargando">Cargando compromisos…</p>
    : !compromisos.length ? <div className="portal-vacio">No hay compromisos registrados para esta comunidad.</div>
    : <div className="compromisos-lista">
        {compromisos.map((item,indice)=>{
          const sub=ordenarAvances(subtareas.filter(x=>x.compromiso_id===item.id));
          const primeraPendiente=primerPendienteAvances(sub, x=>Boolean(x.completada));
          const realizados=sub.filter(x=>x.completada).length;
          const progreso=sub.length?porcentajeSubtareas(sub):item.avance;
          const historico=avances.filter(x=>x.compromiso_id===item.id);
          const movimientos=transiciones.filter(x=>x.compromiso_id===item.id);
          const Etiqueta=integrado?'div':'details';
          return <Etiqueta key={item.id} className={'tarjeta compromisos-item'+(integrado?' compromisos-item-integrado':'')}>
            {!integrado&&<summary className="categoria-titulo compromisos-fila compromisos-categoria-titulo">
              <span className="compromisos-titulo crece">
                <strong>{String(indice+1).padStart(2,'0')}. {item.titulo}</strong>
                <small>{realizados}/{sub.length} completadas · {progreso}% de avance</small>
              </span>
              {sub.length>0&&realizados===sub.length&&<span className="categoria-ok" aria-label="Compromiso completado">✓</span>}
              <span className="portal-estado">{NOMBRES[item.estado]||item.estado}</span>
              {administrador&&<button type="button" className="compromisos-icono-eliminar"
                aria-label={'Eliminar compromiso: '+item.titulo} title="Eliminar compromiso"
                disabled={guardando}
                onClick={e=>{e.preventDefault();e.stopPropagation();eliminarCompromiso(item);}}>×</button>}
              <span className="compromisos-flecha" aria-hidden="true">⌄</span>
            </summary>}
            <div className="compromisos-detalle">
              {administrador&&<div className="compromisos-edicion-rapida">
                {tituloEnEdicion?.tipo==='compromiso'&&tituloEnEdicion.id===item.id?
                  <form className="compromisos-edicion-titulo-form" onSubmit={guardarTituloDirecto}>
                    <label htmlFor={'titulo-directo-'+item.id}>Título del compromiso</label>
                    <input id={'titulo-directo-'+item.id} autoFocus required maxLength={180}
                      value={tituloEnEdicion.valor} disabled={guardando}
                      onChange={e=>setTituloEnEdicion(x=>({...x,valor:e.target.value}))}/>
                    <div className="compromisos-edicion-titulo-acciones">
                      <button type="submit" className="boton boton-primario"
                        disabled={guardando||!tituloEnEdicion.valor.trim()}>Guardar título</button>
                      <button type="button" className="boton boton-secundario"
                        disabled={guardando} onClick={()=>setTituloEnEdicion(null)}>Cancelar</button>
                    </div>
                  </form>:
                  <button type="button" className="compromisos-editar-titulo"
                    onClick={()=>{setError('');setTituloEnEdicion({tipo:'compromiso',id:item.id,valor:item.titulo})}}>
                    Editar título del compromiso
                  </button>}
              </div>}
              {item.descripcion&&<p>{item.descripcion}</p>}
              <div className="compromisos-meta">
                <span>Inicio: {fecha(item.fecha_inicio)}</span>
                <span>Comprometida: {fecha(item.fecha_limite)}</span>
                <span>Próxima acción: {fecha(item.fecha_proxima_accion)}</span>
                <span>Cierre: {fecha(item.fecha_cierre)}</span>
                {item.referencia_contractual&&<span>Contrato: {item.referencia_contractual}</span>}
              </div>
              <MotorAvances valor={progreso} completados={realizados} total={sub.length}
                etiqueta="Avance del compromiso" compacto />
              <section className="compromisos-subtareas-v2" aria-label={'Subtareas de '+item.titulo}>
                <div className="compromisos-subtareas-cabecera">
                  <div><h3>Subtareas</h3>
                    <p>Selecciona una actividad del índice para revisar sus detalles, avanzar o adjuntar evidencias.</p>
                  </div>
                </div>
                {sub.length===0&&<p className="compromisos-subtareas-vacio">
                  Sin subtareas. Agrega las actividades necesarias para medir el avance de este compromiso.
                </p>}
                {sub.length>0&&!pasoSubtarea[item.id]&&
                  <ol className={'indice-preguntas compromisos-indice'+(administrador?' compromisos-indice-admin':'')} aria-label={'Actividades de '+item.titulo}>
                    {sub.map((x,indiceSub)=>{
                      const estadoVisual=estadoVisualAvance({completada:x.completada,avance:x.avance});
                      return <li key={x.id} className={'compromisos-indice-item motor-avances-fila--'+estadoVisual}>
                        <button type="button" className={'pregunta-indice'+(x.completada?' respondida':'')}
                          onClick={()=>setPasoSubtarea(actual=>({...actual,[item.id]:x.id}))}
                          aria-label={'Abrir actividad '+(indiceSub+1)+': '+x.titulo}>
                          <span className="numero-pregunta">{indiceSub+1}</span>
                          <span className="texto-pregunta">
                            <span>{x.titulo}</span>
                            <small>{x.completada?'Completada':(x.avance>0?'En ejecución':'Pendiente')}{indiceSub===primeraPendiente?' · Siguiente':''}</small>
                          </span>
                          <span className="compromisos-indice-porcentaje">{x.completada?100:(x.avance||0)}%</span>
                          <span className="estado-pregunta" aria-hidden="true">{x.completada?'✓':'›'}</span>
                        </button>
                        {administrador&&<button type="button" className="compromisos-icono-eliminar"
                          aria-label={'Eliminar subtarea: '+x.titulo} title="Eliminar subtarea"
                          disabled={guardando} onClick={()=>eliminarSubtarea(item,x)}>×</button>}
                      </li>;
                    })}
                  </ol>}
                {sub.filter(x=>x.id===pasoSubtarea[item.id]).map(x=>{
                  const indiceSub=sub.findIndex(v=>v.id===x.id);
                  const estadoVisual=estadoVisualAvance({completada:x.completada,avance:x.avance});
                  const esSiguiente=indiceSub===primeraPendiente;
                  return <div className={'compromisos-subtarea-card compromisos-subtarea-detalle motor-avances-fila motor-avances-fila--'+estadoVisual
                    +(esSiguiente?' motor-avances-fila--siguiente':'')
                    +(x.completada?' esta-completa':'')} key={x.id}>
                    <button type="button" className="volver-indice compromisos-volver-indice"
                      onClick={()=>setPasoSubtarea(actual=>({...actual,[item.id]:null}))}>‹ Volver a la lista</button>
                    <div className="compromisos-subtarea-principal">
                      <span className="motor-avances-numero" aria-label={'Paso '+(indiceSub+1)}>{indiceSub+1}</span>
                      {tituloEnEdicion?.tipo==='subtarea'&&tituloEnEdicion.id===x.id?
                        <form className="compromisos-edicion-titulo-form" onSubmit={guardarTituloDirecto}>
                          <label htmlFor={'titulo-subtarea-'+x.id}>Título de la subtarea</label>
                          <input id={'titulo-subtarea-'+x.id} autoFocus required maxLength={180}
                            value={tituloEnEdicion.valor} disabled={guardando}
                            onChange={e=>setTituloEnEdicion(v=>({...v,valor:e.target.value}))}/>
                          <div className="compromisos-edicion-titulo-acciones">
                            <button type="submit" className="boton boton-primario"
                              disabled={guardando||!tituloEnEdicion.valor.trim()}>Guardar</button>
                            <button type="button" className="boton boton-secundario"
                              disabled={guardando} onClick={()=>setTituloEnEdicion(null)}>Cancelar</button>
                          </div>
                        </form>:
                        <>
                          <label className="compromisos-subtarea-check">
                            <input type="checkbox" checked={x.completada} disabled={!administrador||guardando}
                              aria-label={'Cerrar subtarea: '+x.titulo}
                              onChange={e=>marcarSubtarea(item,x,e.target.checked)}/>
                            <span>{x.titulo}</span>
                          </label>
                          {administrador&&<button type="button" className="compromisos-editar-titulo"
                            onClick={()=>{setError('');setTituloEnEdicion({tipo:'subtarea',id:x.id,compromisoId:item.id,valor:x.titulo})}}>
                            Editar título
                          </button>}
                        </>}
                      {esSiguiente&&<span className="motor-avances-siguiente">Siguiente</span>}
                      <strong className="compromisos-subtarea-porcentaje">{x.completada?100:(x.avance||0)}%</strong>
                    </div>
                    <div className="compromisos-subtarea-herramientas">
                    {administrador&&!x.completada&&<label className="compromisos-subtarea-progreso">
                      <span>Avance parcial</span>
                      <select value={x.avance||0} disabled={guardando}
                        aria-label={'Avance de '+x.titulo}
                        onChange={e=>cambiarProgresoSubtarea(x,e.target.value)}>
                        {[0,10,20,30,40,50,60,70,80,90].map(n=><option key={n} value={n}>{n}%</option>)}
                      </select>
                    </label>}
                    <details className="compromisos-subtarea-drive">
                      <summary aria-label={'Adjuntos de esta subtarea: '+x.titulo}>Adjuntos · Google Drive</summary>
                      <DriveArchivos comunidadId={comunidadId} origenTipo="compromiso"
                        origenId={item.id} detalleId={x.id} compacto
                        titulo={'Evidencias · '+x.titulo} permitirSubir={administrador}
                        soloVistaCliente={soloVistaCliente}
                        ayuda="Los archivos se guardan en la carpeta de este compromiso en Google Drive y quedan asociados a la subtarea."/>
                    </details>
                    {administrador&&<button type="button" className="compromisos-subtarea-eliminar"
                      disabled={guardando} aria-label={'Eliminar subtarea: '+x.titulo}
                      title="Eliminar subtarea" onClick={()=>eliminarSubtarea(item,x)}>Eliminar</button>}
                    </div>
                  </div>;
                })}
                {pasoSubtarea[item.id]&&sub.length>0&&
                  <nav className="pasos compromisos-pasos" aria-label="Navegación de actividades">
                    <button type="button" className="boton boton-secundario"
                      disabled={sub.findIndex(x=>x.id===pasoSubtarea[item.id])<=0}
                      onClick={()=>{const i=sub.findIndex(x=>x.id===pasoSubtarea[item.id]);setPasoSubtarea(actual=>({...actual,[item.id]:sub[i-1]?.id||null}));}}>‹ Anterior</button>
                    <span className="conteo">{sub.findIndex(x=>x.id===pasoSubtarea[item.id])+1} de {sub.length}</span>
                    <button type="button" className="boton boton-primario"
                      onClick={()=>{const i=sub.findIndex(x=>x.id===pasoSubtarea[item.id]);setPasoSubtarea(actual=>({...actual,[item.id]:sub[i+1]?.id||null}));}}>
                      {sub.findIndex(x=>x.id===pasoSubtarea[item.id])===sub.length-1?'Volver al índice':'Siguiente ›'}
                    </button>
                  </nav>}
                {administrador&&<div className="compromisos-subagregar">
                  <input aria-label={'Nueva subtarea para '+item.titulo} placeholder="Escribe una nueva subtarea"
                    value={nuevaSubtarea[item.id]||''}
                    onChange={e=>setNuevaSubtarea(v=>({...v,[item.id]:e.target.value}))}/>
                  <button type="button" className="boton boton-secundario"
                    disabled={guardando||!(nuevaSubtarea[item.id]||'').trim()}
                    onClick={()=>agregarSubtarea(item)}>+ Agregar</button>
                </div>}
              </section>
              {administrador&&<details className="compromisos-opciones"><summary>Administrar fechas, etapa y seguimiento</summary><div className="compromisos-cambiar-etapa">
                <label>Etapa del compromiso
                  <select value={item.estado} disabled={guardando} aria-label={'Cambiar etapa de '+item.titulo}
                    onChange={e=>cambiarEstado(item,e.target.value)}>
                    {Object.entries(NOMBRES).map(([v,t])=><option key={v} value={v} disabled={v==='completado'&&sub.some(s=>!s.completada)}>{t}</option>)}
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
                  onClick={()=>cambiarEstado(item,item.estado)}>Guardar fecha / seguimiento</button>
                <button type="button" disabled={guardando} className="boton boton-secundario"
                  onClick={()=>cambiarEstado(item,item.estado==='en_espera'?'en_curso':'en_espera')}>
                  {item.estado==='en_espera'?'Reanudar':'Poner en espera'}
                </button>
              </div></details>}
              <details className="compromisos-adjuntos">
                <summary>Documentos del compromiso</summary>
                <DriveArchivos key={item.id+'-'+versionDocs} comunidadId={comunidadId}
                  origenTipo="compromiso" origenId={item.id} compacto
                  titulo="Documentos · Google Drive" permitirSubir={administrador} soloVistaCliente={soloVistaCliente} ocultarVacio={!administrador}/>
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
                  <summary>{fecha(a.registrado_en)} · {a.porcentaje??'-'}% · {NOMBRES[a.estado]||'Avance'}</summary>
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
          </Etiqueta>
        })}
      </div>}
 </section>;
}
