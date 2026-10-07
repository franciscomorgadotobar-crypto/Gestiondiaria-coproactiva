import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import './WhatsApp.css';

const STATES={bot:'Bot',esperando_usuario:'Bot',derivada:'Pendiente',atencion_humana:'Atención humana',cerrada:'Cerrada'};
const MOTIVES={residente:'Residente / copropietario',cotizacion:'Cotización',postulacion:'Postulación',proveedor:'Proveedor',otro:'Otro motivo'};
const date=v=>v?new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}):'—';
export default function WhatsApp() {
 const {perfil}=useSesion();
 if(!perfil?.activo||!['admin','superadmin'].includes(perfil.rol))return <Navigate to="/" replace/>;
 return <WhatsAppInterno perfil={perfil}/>;
}
function WhatsAppInterno({perfil}) {
 const {vista}=useParams();const configView=vista==='configuracion',flowsView=vista==='automatizaciones';
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[events,setEvents]=useState([]),[admins,setAdmins]=useState([]);
 const [page,setPage]=useState(0);
 const [filter,setFilter]=useState('todas'),[query,setQuery]=useState(''),[answer,setAnswer]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [config,setConfig]=useState(null),[missing,setMissing]=useState(null),[owner,setOwner]=useState(''),[enabled,setEnabled]=useState(false);
 const [communities,setCommunities]=useState([]),[community,setCommunity]=useState('');
 const [units,setUnits]=useState([]),[unit,setUnit]=useState(''),[validationNote,setValidationNote]=useState(''),[draft,setDraft]=useState('');
 const load=useCallback(async()=>{
   const result=await supabase.rpc('whatsapp_bandeja',{p_estado:filter,p_busqueda:query,p_pagina:page});
   if(result.error)setError(result.error.message);else setItems(result.data??[]);setLoading(false);
 },[filter,query,page]);
 useEffect(()=>{const t=setTimeout(load,250);const timer=setInterval(load,10000);return()=>{clearTimeout(t);clearInterval(timer);};},[load]);
 useEffect(()=>{
   supabase.from('perfiles').select('id,nombre').eq('activo',true).in('rol',['admin','superadmin']).order('nombre').then(r=>{if(r.error)setError(r.error.message);else setAdmins(r.data??[]);});
   supabase.rpc('whatsapp_config_publica').then(r=>{if(r.error)setError(r.error.message);else {setConfig(r.data);setOwner(r.data?.responsable_recepcion??'');setEnabled(Boolean(r.data?.habilitado));}});
 },[]);
 const current=items.find(x=>x.id===selected);
 const history=useCallback(async()=>{
   if(!selected)return;
   const results=await Promise.all([
     supabase.from('whatsapp_messages').select('id,direccion,tipo,contenido,estado,creado_en,es_bot,metadatos,error_codigo').eq('conversation_id',selected).order('orden',{ascending:false}).limit(500),
     supabase.from('whatsapp_events').select('id,evento,detalle,creado_en,actor:perfiles(nombre)').eq('conversation_id',selected).order('creado_en',{ascending:false}).limit(80)
   ]);
   for(const r of results)if(r.error)setError(r.error.message);
   if(!results[0].error)setMessages((results[0].data??[]).reverse());if(!results[1].error)setEvents(results[1].data??[]);
 },[selected]);
 useEffect(()=>{setMessages([]);setEvents([]);setAnswer('');setDraft('');setUnit('');setValidationNote('');history();const t=setInterval(history,7000);return()=>clearInterval(t);},[history]);
 useEffect(()=>{if(!selected)return;setDraft(current?.datos?.descripcion??'');},[selected,current?.datos?.descripcion]);
 async function action(name,value) {
   setBusy(true);setError('');
   const {error}=await supabase.rpc('whatsapp_accion',{p_conv:selected,p_accion:name,p_valor:value??null});
   if(error)setError(error.message);else {if(name==='responder')setAnswer('');await Promise.all([load(),history()]);if(name==='responder')supabase.functions.invoke('whatsapp-worker').then(r=>{if(r.error)setError('Mensaje en cola. Revisa su estado de envío.');});}
   setBusy(false);
 }
 async function readiness(){setError('');const r=await supabase.functions.invoke('whatsapp-worker',{body:{action:'readiness'}});if(r.error)setError('No se pudo verificar la conexión.');else setMissing(r.data.missing);}
 useEffect(()=>{if(configView&&perfil.rol==='superadmin')readiness();},[configView,perfil.rol]);
 async function saveConfig(){setBusy(true);const r=await supabase.rpc('whatsapp_configurar',{p_habilitado:enabled,p_responsable:owner||null});if(r.error)setError(r.error.message);else {setConfig({habilitado:enabled,responsable_recepcion:owner});await readiness();}setBusy(false);}
 async function loadUnits(){const r=await supabase.from('comunidades').select('id,nombre').in('estado',['activo','marcha_blanca']).order('nombre');if(r.error)setError(r.error.message);else setCommunities(r.data??[]);}
 async function selectCommunity(id){setCommunity(id);setUnit('');const r=await supabase.from('unidades').select('id,numero').eq('comunidad_id',id).order('numero');if(r.error)setError(r.error.message);else setUnits(r.data??[]);}
 async function validate(){setBusy(true);const r=await supabase.rpc('whatsapp_validar',{p_conv:selected,p_unidad:unit,p_nota:validationNote});if(r.error)setError(r.error.message);else await Promise.all([load(),history()]);setBusy(false);}
 async function createCase(){
   if(!window.confirm('¿Confirmas registrar esta solicitud en Bitácora?'))return;
   setBusy(true);setError('');
   const p=await supabase.rpc('whatsapp_preparar_solicitud',{p_conv:selected,p_descripcion:draft});
   if(p.error){setError(p.error.message);setBusy(false);return;}
   await action('crear_bitacora');setBusy(false);
 }
 if((configView||flowsView)&&perfil.rol!=='superadmin')return <Navigate to="/whatsapp" replace/>;
 const lastIncoming=messages.filter(x=>x.direccion==='entrante').at(-1)?.creado_en;
 const openWindow=lastIncoming&&Date.now()-new Date(lastIncoming).getTime()<86400000;
 const isOwner=current?.estado==='atencion_humana'&&current?.asignado_a===perfil.id;
 const visible=items.filter(x=>(filter==='todas'||(filter==='bot'?['bot','esperando_usuario'].includes(x.estado):x.estado===filter))&&`${x.contacto?.nombre_whatsapp??''} ${x.contacto?.telefono??''} ${x.comunidad?.nombre??''}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="cuerpo wa-page">
   <div className="wa-header"><div><h1>WhatsApp</h1><p className="apagado">Recepción de solicitudes y atención de administración.</p></div><span className="wa-status">{config?.habilitado?'Canal habilitado':'Pendiente de conexión'}</span></div>
   <nav className="wa-tabs" aria-label="WhatsApp"><Link to="/whatsapp">Bandeja</Link>{perfil.rol==='superadmin'&&<><Link to="/whatsapp/automatizaciones">Automatizaciones</Link><Link to="/whatsapp/configuracion">Configuración</Link></>}</nav>
   {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
   {flowsView?<div className="tarjeta wa-box"><h2>Flujos de recepción</h2><p>Versión 1.0 · Sin IA · Menús breves</p><ul><li>Residente: teléfono → casa → motivo → descripción → confirmación → Bitácora o revisión humana.</li><li>Cotización: datos de contacto y comunidad → confirmación → Prospectos (origen WhatsApp).</li><li>Postulación: nombre, comuna y área → currículum a contacto@coproactiva.cl.</li><li>Proveedor: presentación de servicios a contacto@coproactiva.cl.</li><li>Otro: nombre y motivo → atención humana.</li></ul><p>Los adjuntos permanecen en WhatsApp o correo. El bot pide enviarlos por correo. Al derivar o tomar una conversación, deja de responder.</p><p>Las conversaciones cerradas vuelven al menú inicial con un nuevo mensaje. Cerrar una conversación no finaliza su Bitácora.</p></div>
   :configView?<div className="tarjeta wa-box"><h2>Conectar WhatsApp Cloud API</h2><p>El número actual usa WhatsApp Business. La recepción automática requiere conectarlo a Meta antes de habilitar el canal.</p><p>Webhook: <code>https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/whatsapp-webhook</code></p><p>Configura las credenciales de Meta como secretos de las funciones. No se guardan ni se muestran en esta pantalla.</p>{missing===null?<p>Verificando conexión…</p>:missing.length?<><p>Configuración pendiente:</p><ul>{missing.map(x=><li key={x}><code>{x}</code></li>)}</ul></>:<p>Credenciales configuradas. Verifica el webhook y prueba el número antes de habilitar.</p>}<label>Responsable de recepción automática<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Seleccionar</option>{admins.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label><p className="chico apagado">Las Bitácoras automáticas quedarán bajo este responsable; el historial indicará que el registro lo generó el bot.</p><label><input type="checkbox" checked={enabled} disabled={missing===null||missing.length>0} onChange={e=>setEnabled(e.target.checked)}/> Habilitar recepción</label><button className="boton" disabled={busy||(!config?.habilitado&&enabled&&(missing===null||missing.length>0))} onClick={saveConfig}>Guardar</button><button className="boton boton-texto" onClick={readiness}>Verificar conexión</button></div>
   :<><div className="wa-filters"><label className="sr-only" htmlFor="wa-search">Buscar conversaciones</label><input id="wa-search" placeholder="Buscar nombre, teléfono o comunidad" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><label className="sr-only" htmlFor="wa-filter">Estado</label><select id="wa-filter" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>{[['todas','Todas'],['bot','Bot'],['derivada','Pendientes'],['atencion_humana','Atención humana'],['cerrada','Cerradas']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
   <div className="wa-controls"><button className="boton boton-texto" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page+1} · {items[0]?.total??0} conversaciones</span><button className="boton boton-texto" disabled={(page+1)*50>=Number(items[0]?.total??0)} onClick={()=>setPage(page+1)}>Siguiente</button></div>
   <div className="wa-layout"><aside className="wa-list" aria-label="Conversaciones">{loading?<p>Cargando…</p>:visible.length===0?<p className="apagado">{config?.habilitado?'No hay conversaciones en este filtro.':'La bandeja recibirá mensajes al conectar el número a Meta.'}</p>:visible.map(x=><button type="button" key={x.id} className={'wa-contact '+(selected===x.id?'selected':'')} onClick={()=>setSelected(x.id)}><strong>{x.contacto?.nombre_whatsapp||x.datos?.nombre||x.contacto?.telefono}</strong><span>{MOTIVES[x.motivo]??'Selección de motivo'} · {STATES[x.estado]}</span><span>{x.comunidad?.nombre??x.datos?.comunidad??''}{(x.unidad?.numero??x.datos?.unidad)?` · Casa ${x.unidad?.numero??x.datos?.unidad}`:''}</span><small>{date(x.ultima_interaccion)}{x.responsable?.nombre?` · ${x.responsable.nombre}`:''}</small></button>)}</aside>
   <section className="wa-detail">{!current?<p className="apagado">Selecciona una conversación para atenderla.</p>:<><header><h2>{current.contacto?.nombre_whatsapp||current.datos?.nombre||'Contacto'}</h2><p>{current.contacto?.telefono} · {STATES[current.estado]} · {MOTIVES[current.motivo]??'Sin motivo'}</p><p>{current.comunidad?.nombre??current.datos?.comunidad??''}{(current.unidad?.numero??current.datos?.unidad)?` · Casa ${current.unidad?.numero??current.datos?.unidad}`:''} · {current.validacion==='pendiente'?'Identidad pendiente de revisión':current.validacion==='humana'?'Identidad validada por administración':'Teléfono asociado'}</p><div className="wa-controls">{current.estado!=='cerrada'&&<><button className="boton" disabled={busy||Boolean(current.asignado_a&&current.asignado_a!==perfil.id)} onClick={()=>action('tomar')}>{isOwner?'Conversación tomada':'Tomar conversación'}</button><select aria-label="Reasignar conversación" value={current.asignado_a??''} disabled={busy} onChange={e=>e.target.value&&action('reasignar',e.target.value)}><option value="">Reasignar a…</option>{admins.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select><button className="boton boton-texto" disabled={busy} onClick={()=>window.confirm('¿Cerrar esta atención? La Bitácora seguirá abierta.')&&action('cerrar')}>Cerrar atención</button></>}{current.bitacora_id&&<Link to={`/bitacora/${current.bitacora_id}`}>Ver Bitácora</Link>}{current.prospecto_id&&<Link to="/pipeline">Ver Prospectos</Link>}{current.postulante_id&&<Link to="/proveedores/postulantes">Ver Postulantes</Link>}{current.proveedor_id&&<Link to={`/proveedores/${current.proveedor_id}`}>Ver proveedor</Link>}</div></header>
   <div className="wa-history" aria-label="Historial de mensajes">{messages.map(m=><article key={m.id} className={'wa-message '+m.direccion}><p>{m.contenido}</p>{!['texto','interaccion'].includes(m.tipo)&&<small>Archivo en WhatsApp. Revisar por correo; sin copia en Supabase.</small>}<small>{date(m.creado_en)} · {m.direccion==='saliente'?`${m.es_bot?'Bot':'Administración'} · ${m.estado}`:'Recibido'}{m.error_codigo?` · ${m.error_codigo}`:''}</small></article>)}</div>
   <p className="chico apagado">Este canal recibe solicitudes. No compartir información privada, financiera ni gastos.</p>
   {isOwner&&!openWindow&&<p className="aviso">Pasaron 24 horas desde el último mensaje. Espera a que la persona vuelva a escribir para responder por aquí.</p>}
   <form onSubmit={e=>{e.preventDefault();action('responder',answer);}} className="wa-compose"><label htmlFor="wa-answer">Respuesta de administración</label><textarea id="wa-answer" value={answer} maxLength={3500} disabled={!isOwner||!openWindow} onChange={e=>setAnswer(e.target.value)} placeholder={isOwner?'Escribe una respuesta breve':'Toma la conversación para responder'}/><button className="boton" disabled={busy||!isOwner||!openWindow||!answer.trim()||!config?.habilitado}>Enviar</button></form>
   {isOwner&&current.motivo==='residente'&&<details className="wa-box"><summary>Validación y registro de solicitud</summary>{current.validacion==='pendiente'&&<><p>Confirma la identidad por un canal confiable conocido. Declarar una casa o un RUT no basta.</p><button className="boton boton-texto" onClick={loadUnits}>Elegir comunidad y casa</button><select aria-label="Comunidad validada" value={community} onChange={e=>selectCommunity(e.target.value)}><option value="">Seleccionar comunidad</option>{communities.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select><select aria-label="Comunidad y casa validada" value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Seleccionar casa</option>{units.map(x=><option key={x.id} value={x.id}>Casa {x.numero}</option>)}</select><label>Cómo se verificó la identidad<textarea value={validationNote} maxLength={1000} onChange={e=>setValidationNote(e.target.value)}/></label><button className="boton" disabled={busy||!unit||validationNote.trim().length<10} onClick={validate}>Registrar validación</button></>}{!current.bitacora_id&&<><label>Descripción de la solicitud<textarea value={draft} maxLength={3500} onChange={e=>setDraft(e.target.value)}/></label><button className="boton" disabled={busy||current.validacion==='pendiente'||!draft.trim()} onClick={createCase}>Confirmar y crear Bitácora</button></>}</details>}
   <details className="wa-box"><summary>Trazabilidad</summary>{events.map(e=><p className="chico" key={e.id}>{date(e.creado_en)} · {e.evento.replaceAll('_',' ')} · {e.actor?.nombre??'Sistema'}</p>)}</details></>}</section></div></>}
 </div>;
}
