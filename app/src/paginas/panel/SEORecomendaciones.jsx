import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { propuestaEditorial } from '../../lib/seoOportunidades';
import './SEORecomendaciones.css';

const n = v => Number(v ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const pct = v => (Number(v ?? 0) * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%';
const decimal = v => Number(v ?? 0).toLocaleString('es-CL',{ maximumFractionDigits: 1 });
const normal = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ICON = {
  chart: <><path d="M5 20V12M11 20V6M17 20V9M23 20V3"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  lightbulb: <><path d="M9 18h6m-5 3h4M8 14.5a7 7 0 1 1 8 0c-1 1-1.4 2-1.4 3.5H9.4c0-1.5-.5-2.5-1.4-3.5Z"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M10 2h4l.8 2.6 2 1.1 2.6-.7 2 3.5-1.8 1.9v2.4l1.8 1.9-2 3.5-2.6-.7-2 1.1L14 22h-4l-.8-2.6-2-1.1-2.6.7-2-3.5 1.8-1.9v-2.4L2.6 9.3l2-3.5 2.6.7 2-1.1Z"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  file: <><path d="M14 2H5v20h14V7Z"/><path d="M14 2v5h5M8 12h8M8 16h8"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l3-3a5 5 0 0 0-7.1-7.1l-2.2 2.2"/><path d="M14 11a5 5 0 0 0-7.1-.1l-3 3a5 5 0 0 0 7.1 7.1l2.2-2.2"/></>,
  eye: <><path d="M2 12c3-5 6-7 10-7s7 2 10 7c-3 5-6 7-10 7S5 17 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  pencil: <><path d="M4 20h4l12-12-4-4L4 16zM14 6l4 4"/></>,
  trash: <><path d="M5 7h14M9 7V4h6v3m2 0-1 14H8L7 7M10 11v6m4-6v6"/></>,
  shield: <><path d="M12 2 4 5v7c0 5 4 8 8 10 4-2 8-5 8-10V5Z"/><path d="m9 12 2 2 4-4"/></>,
  refresh: <><path d="M20 6v5h-5M4 18v-5h5M5 9a8 8 0 0 1 14-3l1 5M4 13l1 5a8 8 0 0 0 14-3"/></>,
  external: <><path d="M14 3h7v7m-10 3L21 3"/><path d="M20 13v7H4V4h7"/></>
};
function Icono({name,size=19}) {
  return <span className="seo-reco-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width={size} height={size}
    fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {ICON[name] || ICON.chart}
  </svg></span>;
}
function Clave({nombre,valor}) {
  return <div className="seo-reco-kpi"><small>{nombre}</small><strong>{valor}</strong></div>;
}
function Comparar({titulo,actual,propuesto,cambia}) {
  return <div className="seo-reco-comparacion">
    <h4>{titulo} <span className="seo-reco-sutil">{cambia?'Cambio propuesto':'Conservar'}</span></h4>
    <div className="seo-reco-antes-despues">
      <div><span>ACTUAL · WEB</span><p>{actual || 'No se detectó texto vigente.'}</p></div>
      <div><span>PROPUESTA</span><p>{propuesto || 'Sin propuesta automática'}</p></div>
    </div>
  </div>;
}

function construirPropuesta(consultas,auditoria) {
  if (!auditoria || auditoria.status!==200 || !consultas.length) return null;
  const base=propuestaEditorial(consultas[0].consulta,auditoria);
  if(!base || base.error) return base;
  const terms=consultas.map(x=>normal(x.consulta)).join(' ');
  const ambos=terms.includes('edificio') && terms.includes('condominio');
  if(ambos && /\/servicios\/administracion-de-condominios\/|^\/$/.test(new URL(auditoria.url).pathname)) {
    base.titulo.propuesto='Administración de Edificios y Condominios en Santiago | Coproactiva';
    base.titulo.cambiar=base.titulo.propuesto!==base.titulo.actual;
    base.description.propuesto='Administración de edificios y condominios en Santiago, con cuentas claras, mantenciones, proveedores y seguimiento para tu comunidad. Conoce Coproactiva.';
    base.description.cambiar=base.description.propuesto!==base.description.actual;
    base.diagnostico='La misma página aparece para búsquedas de edificios y condominios, pero recibe pocos clics.';
    base.motivo='Estas consultas tienen intención comercial próxima y Search Console las vincula con esta URL. La baja tasa de clics justifica revisar el título y la descripción, sin afirmar que sean la única causa.';
  }
  return base;
}
function calcularGrupo(items,ruta,auditoria) {
  const impresiones=items.reduce((v,x)=>v+Number(x.metricas?.impresiones||0),0);
  const clicks=items.reduce((v,x)=>v+Number(x.metricas?.clicks||0),0);
  const posicion=impresiones>0 ? items.reduce((v,x)=>v+Number(x.metricas?.posicion||0)*Number(x.metricas?.impresiones||0),0)/impresiones : 0;
  const consultas=items.map(x=>({consulta:x.consulta,metricas:x.metricas}));
  const propuesta=construirPropuesta(consultas,auditoria);
  const principales=items.map(x=>x.consulta);
  const titulo=principales.length>1 && principales.some(x=>normal(x).includes('edificio')) &&
    principales.some(x=>normal(x).includes('condominio'))
    ? 'Administración de edificios y condominios'
    : principales.length>1 ? 'Mejorar captación: '+principales[0] : 'Mejorar captación: '+principales[0];
  return {
    id:ruta+'|'+principales.slice().sort().join('|'),
    ruta, auditoria, propuesta, consultas,
    titulo, prioridad:impresiones>=100?'Alta':'Media',
    metricas:{impresiones,clicks,ctr:impresiones?clicks/impresiones:0,posicion},
    diagn:propuesta?.diagnostico||'Google muestra esta página para búsquedas con potencial de mejora.',
    motivo:propuesta?.motivo||'Se requieren datos de la página antes de proponer modificaciones.'
  };
}
function SeguimientoSeo({invocar,ruta,publicadaEn}) {
  const [datos,setDatos]=useState(null);
  const [error,setError]=useState('');
  const [cargando,setCargando]=useState(false);
  async function actualizar(){
    setCargando(true);setError('');
    try {
      const r=await invocar('seguimiento-seo',{ruta,publicadaEn});
      setDatos(r);
    }catch(e){setError(e.message||'No se pudieron consultar los indicadores.');}
    finally{setCargando(false);}
  }
  useEffect(()=>{if(publicadaEn)actualizar();},[ruta,publicadaEn,invocar]);
  return <div className="seo-reco-seguimiento">
    <div className="seo-reco-seguimiento-cabecera"><div><Icono name="chart"/>
      <div><strong>Seguimiento de resultados</strong>
        <small>Comparación antes y después de la publicación, por URL.</small></div>
    </div><button type="button" onClick={actualizar} disabled={cargando} className="boton boton-secundario">
      {cargando?'Consultando…':'Actualizar'}</button></div>
    {error && <p className="seo-reco-alerta">{error}</p>}
    {datos?.disponible && <>
      <div className="seo-reco-seguimiento-grid">
        {datos.periodos?.map(periodo=><div key={periodo.dias} className="seo-reco-seguimiento-periodo">
          <strong>{periodo.dias} días</strong>
          <small>{periodo.completo?'Período completo':periodo.diasFinalizados+' de '+periodo.dias+' días finalizados'}</small>
          <div><span>Antes: {n(periodo.anterior?.clicks)} clics</span><span>Después: {n(periodo.posterior?.clicks)} clics</span></div>
          <div><span>Impresiones antes: {n(periodo.anterior?.impresiones)}</span>
            <span>Después: {n(periodo.posterior?.impresiones)}</span></div>
          <strong className="seo-reco-cambio">
            {periodo.cambioClics!=null?(periodo.cambioClics>0?'+':'')+decimal(periodo.cambioClics)+'% clics':'Comparación pendiente'}
          </strong>
        </div>)}
      </div>
      <p className="seo-reco-nota">{datos.nota} Última consulta: {new Date(datos.consultadoEn).toLocaleString('es-CL')}.</p>
    </>}
    {datos&&!datos.disponible && <p className="seo-reco-aviso">{datos.error||'Search Console no está disponible.'}</p>}
  </div>;
}
function estadosDisponibles(actual) {
  if(!actual)return null;
  return {
    aprobada:'Aprobación guardada · pendiente de preparar',
    preparada:'Propuesta preparada en GitHub · sin publicar',
    ajustes_solicitados:'Se solicitaron ajustes',
    descartada:'Recomendación descartada',
    publicada:'PR integrado · esperando/validando despliegue',
    error_preparacion:'Aprobación guardada · error al preparar PR'
  }[actual.estado]||actual.estado;
}
export default function SEORecomendaciones({lista,invocar,dias,irVista,consultaPrioritaria}) {
  const [grupos,setGrupos]=useState([]);
  const [pendientes,setPendientes]=useState([]);
  const [cargando,setCargando]=useState(false);
  const [error,setError]=useState('');
  const [seleccion,setSeleccion]=useState('');
  const [decisiones,setDecisiones]=useState([]);
  const [cargandoDecision,setCargandoDecision]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [modo,setModo]=useState('');
  const [comentario,setComentario]=useState('');
  const [confirmacion,setConfirmacion]=useState('');
  const [integracionGithub,setIntegracionGithub]=useState(false);
  const [puedePublicar,setPuedePublicar]=useState(false);
  const cache=useRef(new Map());

  async function servicio(accion,payload={}) {
    const {data,error:fnError}=await supabase.functions.invoke('seo-propuestas',{body:{accion,...payload}});
    if(fnError) {
      let detail=fnError.message||'Error en el servicio de propuestas.';
      if(fnError.context?.json){try{const e=await fnError.context.json();detail=e.error||detail;}catch{/* no json */}}
      throw Error(detail);
    }
    if(data?.error)throw Error(data.error);
    return data;
  }
  async function listar() {
    const r=await servicio('listar');
    setDecisiones(r.propuestas||[]);
    setIntegracionGithub(!!r.integracionGithubHabilitada);
    setPuedePublicar(!!r.puedePublicar);
  }
  const consultas=useMemo(()=>lista.filter(x=>x.clase==='consulta').slice(0,12),[lista]);
  const key=consultas.map(x=>x.id).join('|')+'|'+dias+'|'+(consultaPrioritaria||'');
  useEffect(()=>{
    let active=true;
    const analizar=async()=>{
      setCargando(true);setError('');setGrupos([]);setPendientes([]);
      try {
        // Consultar cada query de forma independiente y agrupar SÓLO si Google
        // atribuye exactamente la misma URL. No inventar relaciones por similitud.
        const resoluciones=await Promise.all(consultas.map(async(item)=>{
          const ckey='q|'+dias+'|'+item.consulta;
          try {
            let page=cache.current.get(ckey);
            if(page===undefined){
              const response=await invocar('consulta-paginas',{consulta:item.consulta,dias});
              page=response?.paginas?.[0]?.ruta||null;
              cache.current.set(ckey,page);
            }
            return {item,ruta:page};
          } catch(error) {
            return {item,ruta:null,error:error.message||'Error consultando Google.'};
          }
        }));
        if(!active)return;
        const byPath=new Map(),withoutPage=[];
        for(const r of resoluciones){
          if(!r.ruta){withoutPage.push(r);continue;}
          if(!byPath.has(r.ruta))byPath.set(r.ruta,[]);
          byPath.get(r.ruta).push(r.item);
        }
        const final=await Promise.all([...byPath.entries()].map(async([ruta,items])=>{
          const ckey='a|'+ruta;
          let audit=cache.current.get(ckey);
          try {
            if(!audit){audit=await invocar('auditoria',{ruta});cache.current.set(ckey,audit);}
          }catch(err){return {id:ruta,ruta,titulo:items.map(x=>x.consulta).join(', '),
            error:err.message||'No se pudo revisar la página.'};}
          return calcularGrupo(items,ruta,audit);
        }));
        if(active){setGrupos(final.sort((a,b)=>(b.metricas?.impresiones||0)-(a.metricas?.impresiones||0)));
          setPendientes(withoutPage);setSeleccion(prev=>final.some(x=>x.id===prev)?prev:(final.find(x=>x.consultas?.some(q=>q.consulta===consultaPrioritaria))||final[0])?.id||'');}
      }catch(err){if(active)setError(err.message||'No se pudo completar el diagnóstico.');}
      finally{if(active)setCargando(false);}
    };
    analizar();
    listar().catch(err=>{if(active)setError(err.message);});
    return()=>{active=false;};
  },[key,invocar]);

  const detalle=grupos.find(x=>x.id===seleccion);
  const ultima=detalle && decisiones.find(p=>p.ruta===detalle.ruta &&
    ['aprobada','preparada','publicada','error_preparacion'].includes(p.estado));
  const previo=detalle && (ultima || decisiones.find(p=>p.ruta===detalle.ruta && p.consulta_principal===detalle.consultas[0]?.consulta));
  function irDetalle(item) {
    setSeleccion(item.id);setModo('');setComentario('');setMensaje('');setConfirmacion('');
  }
  function payload(item) {
    const propuesta=item.propuesta;
    return {
      ruta:item.ruta,consulta_principal:item.consultas[0]?.consulta||'',
      consultas:item.consultas.map(x=>x.consulta),
      metricas:item.metricas,h1_actual:item.auditoria.h1s?.[0]||'',
      titulo_actual:propuesta.titulo.actual,
      titulo_propuesto:propuesta.titulo.propuesto,
      descripcion_actual:propuesta.description.actual,
      descripcion_propuesta:propuesta.description.propuesto,
      diagnostico:item.diagn,motivo:item.motivo
    };
  }
  async function decidir(accion) {
    if(!detalle)return;
    setCargandoDecision(accion);setError('');setMensaje('');
    try {
      let out;
      if(accion==='aprobar')out=await servicio('aprobar',{propuesta:payload(detalle)});
      else if(accion==='registrar_decision')out=await servicio('registrar_decision',{
        propuesta:payload(detalle),decision:modo,observaciones:comentario
      });
      else if(accion==='preparar')out=await servicio('preparar',{id:previo.id});
      else if(accion==='publicar')out=await servicio('publicar',{id:previo.id,confirmacion});
      else throw Error('Acción desconocida.');
      setMensaje(out.aviso||'La decisión quedó registrada correctamente.');
      setModo('');setComentario('');setConfirmacion('');
      await listar();
    }catch(err){setError(err.message||'No se pudo guardar la decisión.');}
    finally{setCargandoDecision('');}
  }
  const editable=detalle?.auditoria?.status===200 && detalle?.propuesta && !detalle.propuesta.error &&
    (detalle.propuesta.titulo?.cambiar||detalle.propuesta.description?.cambiar);
  const yaDecidido=!!(previo && ['aprobada','preparada','publicada','error_preparacion','descartada','ajustes_solicitados'].includes(previo.estado));
  return <div className="seo-reco-pantalla">
    <div className="seo-reco-contexto">
      <Icono name="search" size={24}/>
      <div><h2>Diagnóstico y recomendaciones SEO</h2>
        <p>Son búsquedas reales donde aparece coproactiva.cl. No es un estudio de la competencia ni una lista de palabras del sitio. La app identifica la URL, revisa su HTML y propone mejoras para tu aprobación.</p>
      </div>
    </div>
    <div className="seo-reco-cabecera">
      <div><span className="seleccion-area-etiqueta">OPORTUNIDADES VERIFICADAS</span>
        <h2>Qué podemos mejorar</h2>
        <p>Las búsquedas se agrupan cuando Google las relaciona con la misma página. Una página, una decisión.</p>
      </div>
      <span className="seo-reco-contador">{cargando?'Evaluando…':n(grupos.length)+' páginas detectadas'}</span>
    </div>
    {cargando && <div className="seo-reco-cargando" role="status">
      <Icono name="refresh"/> Buscando las páginas que Google posiciona, leyendo títulos y descripciones reales…
    </div>}
    {error && <div className="seo-aviso seo-aviso-error" role="alert">{error}</div>}
    {mensaje && <div className="seo-aviso seo-aviso-correcto" role="status">{mensaje}</div>}
    {(!cargando && !grupos.length) && <div className="seo-reco-vacio">
      <Icono name="search"/>
      <strong>No se encontraron diagnósticos completos para estas consultas.</strong>
      <p>Sin páginas atribuidas por Search Console y verificación del HTML, no podemos recomendar cambios con fundamento.</p>
    </div>}
    {grupos.map((item,i)=>{
      const p=item.propuesta,actual=decisiones.find(x=>x.ruta===item.ruta &&
        ['aprobada','preparada','publicada','error_preparacion'].includes(x.estado));
      return <article className={'seo-reco-card '+(item.id===seleccion?'expandida':'')} key={item.id}>
        <div className="seo-reco-card-header">
          <span className={'seo-reco-estado-prioridad '+(item.prioridad==='Alta'?'alta':'media')}>{item.prioridad||'Revisar'}</span>
          <span className="seo-reco-fuente">Búsqueda orgánica · Google Search Console</span>
        </div>
        <h3>{item.titulo}</h3>
        {item.consultas?.length>0 && <div className="seo-reco-chips">
          {item.consultas.map(x=><span key={x.consulta}>{x.consulta}</span>)}
        </div>}
        {item.error? <p className="seo-reco-alerta">{item.error}</p> :
          <><p className="seo-reco-descripcion">Google muestra esta página para {item.consultas.length===1?'esta búsqueda':'estas '+item.consultas.length+' búsquedas'}, pero su CTR es bajo. La aplicación las ha relacionado con una URL real y examinado su contenido.</p>
            <div className="seo-reco-metricas">
              <Clave nombre="Impresiones*" valor={n(item.metricas.impresiones)}/>
              <Clave nombre="Clics*" valor={n(item.metricas.clicks)}/>
              <Clave nombre="CTR*" valor={pct(item.metricas.ctr)}/>
              <Clave nombre="Posición media*" valor={decimal(item.metricas.posicion)}/>
            </div>
            <div className="seo-reco-url"><Icono name="link"/><div><small>Página identificada por Google</small>
              <a href={'https://www.coproactiva.cl'+item.ruta} target="_blank" rel="noopener noreferrer">{item.ruta}</a>
            </div></div>
            {actual && <p className="seo-reco-estado-texto"><Icono name="check"/>{estadosDisponibles(actual)}</p>}
          </>}
        {item.id===seleccion && !item.error && <>
          <div className="seo-reco-diagnostico-grid">
            <section><Icono name="target"/><div><h4>Qué detectamos</h4>
              <p>{item.diagn}</p></div></section>
            <section><Icono name="lightbulb"/><div><h4>Qué podría estar pasando</h4>
              <p>{item.motivo}</p></div></section>
            <section><Icono name="file"/><div><h4>Qué recomendamos</h4>
              <p>{editable?'Evaluar los textos propuestos y conservar el diseño del sitio.':'No se ha justificado modificar el título o la descripción.'}</p></div></section>
            <section><Icono name="settings"/><div><h4>Tu decisión</h4>
              <p>Revisa el texto actual frente al sugerido. Aprobar prepara un cambio en GitHub; no lo publica automáticamente.</p></div></section>
          </div>
          {p?.error && <p className="seo-reco-alerta">{p.error}</p>}
          {!editable && <div className="seo-reco-aviso">La revisión no encontró cambios editoriales justificables o faltan campos necesarios. No se permite aprobar una modificación vacía.</div>}
          {editable && <>
            <div className="seo-reco-propuesta-cabecera"><Icono name="eye"/><div><h4>Vista previa de cambios</h4>
              <p>Contenido recuperado del sitio público, comparado con la propuesta automática.</p></div></div>
            <Comparar titulo="Título SEO" actual={p.titulo.actual} propuesto={p.titulo.propuesto} cambia={p.titulo.cambiar}/>
            <Comparar titulo="Meta descripción" actual={p.description.actual} propuesto={p.description.propuesto} cambia={p.description.cambiar}/>
          </>}
          {!!previo && <div className="seo-reco-flujo">
            <div className="seo-reco-pasos">
              {['Diagnóstico','Propuesta','Revisión','Publicación'].map((x,j)=><div key={x} className={j<= (previo.estado==='publicada'?3:previo.estado==='preparada'?2:1)?'actual':''}>
                <span>{j<=(previo.estado==='publicada'?3:previo.estado==='preparada'?2:1)?'✓':j+1}</span><small>{x}</small>
              </div>)}
            </div>
            <p><Icono name="shield"/>{estadosDisponibles(previo)}</p>
            {previo.pr_url && <a href={previo.pr_url} target="_blank" rel="noopener noreferrer" className="seo-reco-linkgit">
              <Icono name="external"/> Abrir revisión de cambios en GitHub
            </a>}
            {previo.estado==='aprobada' && <button type="button" className="boton boton-secundario"
              disabled={!!cargandoDecision} onClick={()=>decidir('preparar')}>Preparar propuesta en GitHub</button>}
            {previo.estado==='error_preparacion' && <p className="seo-reco-alerta">{previo.observaciones}</p>}
            {previo.estado==='preparada' && puedePublicar && <div className="seo-reco-confirmar">
              <p><strong>Confirmación final:</strong> primero revisa el PR en GitHub y sus validaciones. Si estás conforme, escribe PUBLICAR. Se integrará el cambio en main y el sitio lo desplegará después.</p>
              <label>Escribe PUBLICAR para confirmar <input value={confirmacion} onChange={e=>setConfirmacion(e.target.value)}
                placeholder="PUBLICAR" autoComplete="off"/></label>
              <button type="button" className="boton boton-primario" disabled={confirmacion!=='PUBLICAR'||!!cargandoDecision}
                onClick={()=>decidir('publicar')}>Confirmar publicación en GitHub</button>
            </div>}
            {previo.estado==='preparada'&&!puedePublicar && <p className="seo-reco-aviso">La publicación requiere autorización de superadministrador.</p>}
            {previo.estado==='publicada' && <SeguimientoSeo invocar={invocar}
              ruta={previo.ruta} publicadaEn={previo.publicada_en}/>}

          </div>}
          {editable && !yaDecidido && <>
            {modo && <div className="seo-reco-pedir-ajuste">
              <label>{modo==='ajustes_solicitados'?'¿Qué debería cambiar de la propuesta?':'Motivo del descarte (opcional)'}
                <textarea rows={3} placeholder="Escribe tu observación…" value={comentario} onChange={e=>setComentario(e.target.value)} maxLength={1200}/></label>
              <div className="seo-reco-acciones">
                <button className="boton boton-primario" type="button" disabled={!!cargandoDecision||(modo==='ajustes_solicitados'&&!comentario.trim())}
                  onClick={()=>decidir('registrar_decision')}>{cargandoDecision?'Guardando…':'Registrar decisión'}</button>
                <button className="boton boton-secundario" type="button" onClick={()=>setModo('')}>Cancelar</button>
              </div>
            </div>}
            {!modo && <div className="seo-reco-acciones">
              <button className="boton boton-primario" disabled={!!cargandoDecision} type="button" onClick={()=>decidir('aprobar')}>
                <Icono name="check"/> {cargandoDecision?'Preparando…':'Aprobar y preparar'}
              </button>
              <button className="boton boton-secundario" type="button" onClick={()=>setModo('ajustes_solicitados')}><Icono name="pencil"/> Pedir ajuste</button>
              <button className="boton boton-secundario" type="button" onClick={()=>setModo('descartada')}><Icono name="trash"/> Descartar</button>
            </div>}
          </>}
          <p className="seo-reco-nota">* Cifras por consultas; si hay varias se suman sus impresiones y clics y se calcula posición ponderada. No representan visitantes únicos. Las hipótesis no garantizan mejoras de CTR.</p>
          {!integracionGithub && !previo && <p className="seo-reco-nota">La aprobación puede guardarse aun sin token GitHub; crear una rama y PR requiere autorizar previamente la integración en Configuración.</p>}
        </>}
        {item.id!==seleccion && !item.error && <button type="button" className="seo-reco-ver" onClick={()=>irDetalle(item)}>
          <Icono name="eye"/> Ver diagnóstico y propuesta →
        </button>}
      </article>;
    })}
    {pendientes.length>0 && <div className="seo-reco-pendientes">
      <h3>Búsquedas todavía sin página atribuida</h3>
      <p>Google no identificó una página en estas consultas. No se genera ni se aprueba una propuesta sin verificar primero la URL.</p>
      {pendientes.slice(0,10).map((p,i)=><div key={i}>{p.item.consulta}<small>{p.error||'Sin URL verificable en Search Console'}</small></div>)}
    </div>}
    <div className="seo-reco-ultima-leyenda"><Icono name="shield"/>
      <p>Diagnóstico automático no significa publicación automática. La aprobación prepara la propuesta; la publicación exige confirmación final.</p>
    </div>
    <button type="button" className="seo-reco-link-otros" onClick={()=>irVista('tecnico')}>Revisar otras incidencias de SEO técnico →</button>
  </div>;
}
