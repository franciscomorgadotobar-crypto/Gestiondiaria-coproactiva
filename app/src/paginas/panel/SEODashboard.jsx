import { useMemo, useState } from 'react';
import './SEODashboard.css';

const numero = n => Number(n ?? 0).toLocaleString('es-CL', {maximumFractionDigits:0});
const porcentaje = n => (Number(n ?? 0) * 100).toLocaleString('es-CL',{maximumFractionDigits:1})+'%';
const decimal = n => Number(n ?? 0).toLocaleString('es-CL',{maximumFractionDigits:1});
const fechaCL = valor => {
  const v = String(valor || '');
  const normal = /^\d{8}$/.test(v) ? v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8) : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normal)) return v;
  return new Date(normal+'T12:00:00').toLocaleDateString('es-CL',{day:'2-digit',month:'short'});
};
function Metrica({nombre, valor, detalle, cambio, onClick}) {
  const contenido = <>
    <span className="seo-exec-kpi-etiqueta">{nombre}</span>
    <strong className="seo-exec-kpi-numero">{valor}</strong>
    {cambio != null && <span className={'seo-exec-cambio '+(cambio >= 0 ? 'sube':'baja')}>
      {cambio > 0 ? '+':''}{decimal(cambio)}% frente al período anterior
    </span>}
    {detalle && <small>{detalle}</small>}
  </>;
  return onClick
    ? <button type="button" className="seo-exec-kpi accion" onClick={onClick}>{contenido}<span className="seo-exec-link">Ver detalles →</span></button>
    : <div className="seo-exec-kpi">{contenido}</div>;
}
function SerieInteractiva({sc,ga}) {
  const [metrica,setMetrica] = useState('clicks');
  const [seleccion,setSeleccion] = useState(null);
  const opciones = [
    {id:'clicks',texto:'Clics Google',fuente:'Search Console',disponible:!!sc?.disponible},
    {id:'impresiones',texto:'Impresiones',fuente:'Search Console',disponible:!!sc?.disponible},
    {id:'sesiones',texto:'Sesiones',fuente:'Google Analytics 4',disponible:!!ga?.disponible}
  ];
  const vigente = opciones.find(x=>x.id===metrica);
  const filas = useMemo(()=>{
    if(metrica==='sesiones')return ga?.disponible ? (ga.tendencia||[]).map(x=>({fecha:x.clave,valor:Number(x.valores?.[0]||0)})) : [];
    return sc?.disponible ? (sc.tendencia||[]).map(x=>({fecha:x.clave,valor:Number(x[metrica]||0)})) : [];
  },[metrica,sc,ga]);
  const puntos = filas.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const max = Math.max(1,...puntos.map(x=>x.valor));
  const W=640,H=190,L=20,R=20,T=23,B=30;
  const coords = puntos.map((p,i)=>({
    ...p,x:L+(i/Math.max(1,puntos.length-1))*(W-L-R),y:T+(1-p.valor/max)*(H-T-B)
  }));
  const focus = coords[seleccion != null && seleccion < coords.length ? seleccion : coords.length-1];
  const path = coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  return <section className="seo-exec-grafico seo-exec-superficie">
    <div className="seo-exec-seccion-cabecera">
      <div><h3>Evolución del rendimiento</h3><p>Selecciona un indicador para comparar su comportamiento diario.</p></div>
      <span className="seo-exec-fuente">{vigente?.fuente}</span>
    </div>
    <div className="seo-exec-selector" role="group" aria-label="Indicador para el gráfico">
      {opciones.map(o=><button key={o.id} type="button" className={metrica===o.id?'activo':''}
        onClick={()=>{setMetrica(o.id);setSeleccion(null);}}>{o.texto}</button>)}
    </div>
    {puntos.length ? <>
      <div className="seo-exec-chart-kpi">
        <strong>{numero(puntos.reduce((acc,p)=>acc+p.valor,0))}</strong>
        <span>{vigente?.texto?.toLowerCase()} en los días representados</span>
      </div>
      <svg className="seo-exec-chart-svg" viewBox={'0 0 '+W+' '+H} role="img" aria-label={'Evolución diaria de '+vigente.texto}>
        {[0,0.5,1].map(v=><line key={v} x1={L} y1={T+v*(H-T-B)} x2={W-R} y2={T+v*(H-T-B)} stroke="#eae4dc" strokeWidth="1"/>)}
        <path d={path} stroke="#bd7636" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        {coords.map((p,i)=><circle key={p.fecha+i} cx={p.x} cy={p.y} r={focus===p?5:3} fill="#bd7636"
            tabIndex="0" role="button" aria-label={fechaCL(p.fecha)+': '+numero(p.valor)}
            onClick={()=>setSeleccion(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSeleccion(i);}}}>
          <title>{fechaCL(p.fecha)+': '+numero(p.valor)}</title></circle>)}
      </svg>
      <div className="seo-exec-chart-leyenda">
        <span>{fechaCL(puntos[0]?.fecha)}</span>
        <strong>{focus ? fechaCL(focus.fecha)+' · '+numero(focus.valor) : ''}</strong>
        <span>{fechaCL(puntos[puntos.length-1]?.fecha)}</span>
      </div>
    </>:<div className="seo-exec-sin-datos">
      {vigente?.disponible ? 'La API no entregó una serie diaria para este período.' : 'Este indicador estará disponible al autorizar su fuente en Configuración.'}
    </div>}
  </section>;
}
function BarrasCanal({ga,onNavigate}) {
  const canales=(ga?.canales||[]).map(c=>({nombre:c.clave,valor:Number(c.valores?.[0]||0)}))
    .sort((a,b)=>b.valor-a.valor).slice(0,6);
  const max=Math.max(1,...canales.map(x=>x.valor));
  return <section className="seo-exec-superficie">
    <div className="seo-exec-seccion-cabecera"><div><h3>¿De dónde llegan las visitas?</h3><p>Canales de adquisición según GA4.</p></div></div>
    {ga?.disponible && canales.length? <div className="seo-exec-barras">
      {canales.map((x,i)=><div key={x.nombre+i} className="seo-exec-barra">
        <div><span>{x.nombre}</span><strong>{numero(x.valor)}</strong></div>
        <div className="seo-exec-pista"><span style={{width:(100*x.valor/max)+'%'}}/></div>
      </div>)}
    </div>:<p className="seo-exec-ayuda">No hay datos de canales disponibles para el período.</p>}
    <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('analytics')}>Explorar Analytics →</button>
  </section>;
}
function ListaConsultas({sc,onNavigate}) {
  const consultas=(sc?.consultas||[]).slice().sort((a,b)=>b.clicks-a.clicks).slice(0,6);
  return <section className="seo-exec-superficie">
    <div className="seo-exec-seccion-cabecera"><div><h3>¿Cómo nos encuentran?</h3><p>Búsquedas que generan clics en Google.</p></div></div>
    {sc?.disponible && consultas.length ? <div className="seo-exec-renglones">
      {consultas.map((c,i)=><div className="seo-exec-renglon" key={c.clave+i}>
        <span title={c.clave}>{c.clave}</span>
        <strong>{numero(c.clicks)} <small>clics</small></strong>
      </div>)}
    </div>:<p className="seo-exec-ayuda">Sin consultas disponibles en este período.</p>}
    <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('consultas')}>Ver palabras clave y posiciones →</button>
  </section>;
}
function TopPaginas({ga,sc,onNavigate}) {
  const gaPages=(ga?.paginas||[]).map(p=>({url:p.clave,valor:Number(p.valores?.[0]||0)}))
    .sort((a,b)=>b.valor-a.valor).slice(0,5);
  const searchPages=(sc?.paginas||[]).map(p=>({url:p.clave,valor:Number(p.clicks||0)}))
    .sort((a,b)=>b.valor-a.valor).slice(0,5);
  const usarGA=!!ga?.disponible && gaPages.length>0;
  const rows=usarGA?gaPages:searchPages;
  const disponible=usarGA || (!!sc?.disponible && searchPages.length>0);
  return <section className="seo-exec-superficie">
    <div className="seo-exec-seccion-cabecera"><div><h3>Páginas más visitadas</h3>
      <p>{usarGA?'Vistas de páginas según GA4.':'Clics a páginas desde Google según Search Console.'}</p></div></div>
    {disponible ? <div className="seo-exec-renglones">
      {rows.map((p,i)=><div className="seo-exec-renglon" key={p.url+i}>
        <span title={p.url}>{p.url.replace(/^https?:\/\/(?:www\.)?coproactiva\.cl/,'') || '/'}</span>
        <strong>{numero(p.valor)} <small>{usarGA?'vistas':'clics'}</small></strong>
      </div>)}
    </div> : <p className="seo-exec-ayuda">Google no ha entregado todavía datos de páginas para este período.</p>}
    <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate(usarGA?'analytics':'consultas')}>Analizar páginas →</button>
  </section>;
}
function Prioridades({gestionSEO,onNavigate,onAnalyze}) {
  const acciones=(gestionSEO?.nuevas || []).filter(x=>x.prioridad!=='Pendiente').slice(0,4);
  const gestionadas=[...(gestionSEO?.enGestion||[])].sort((a,b)=>
    Number(b.estado==='publicada')-Number(a.estado==='publicada'));
  const publicada=gestionadas.find(x=>x.estado==='publicada');
  const primeras=publicada ? [publicada] : gestionadas.slice(0,1);
  return <section className="seo-exec-superficie">
    <div className="seo-exec-seccion-cabecera"><div><h3>Qué debemos mejorar</h3>
      <p>Recomendaciones nuevas y cambios que ya están en seguimiento.</p></div></div>
    {!gestionSEO?.disponibles && <div className="seo-exec-historial-aviso" role="status">
      No fue posible cruzar Search Console con el historial de mejoras. Para evitar duplicar
      recomendaciones, vuelve a actualizar o revisa Seguimiento.
    </div>}
    {gestionSEO?.disponibles && <>
      {primeras.map(p=><div className="seo-exec-mejora-curso" key={p.id}>
        <div className="seo-exec-mejora-encabezado">
          <span className="seo-exec-mejora-icono" aria-hidden="true">✓</span>
          <span className="seo-exec-mejora-badge">
            {p.estado==='publicada'?'Publicada · En seguimiento':
              p.estado==='integrada'?'Integrada · Verificar publicación':
              p.estado==='preparada'?'En revisión':'Aprobada · En preparación'}
          </span>
        </div>
        <strong>{p.estado==='publicada'?'Ya implementamos una mejora SEO':'Ya existe una mejora para esta página'}</strong>
        <p>{p.ruta==='/'?'Portada de Coproactiva':p.ruta}: {p.consulta_principal}.
          {' '}{Array.isArray(p.consultas) ? p.consultas.length : 1} búsquedas asociadas ya se gestionan
          en esa propuesta; no corresponde repetirlas como recomendaciones nuevas.</p>
        <small>{p.estado==='publicada'&&p.verificada_en
          ? 'Publicación comprobada el '+new Date(p.verificada_en).toLocaleDateString('es-CL')+'.'
          : 'Consulta el estado de esta modificación en Seguimiento.'}
          {' '}Las métricas históricas todavía pueden reflejar el período anterior al cambio.</small>
        <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('seguimiento')}>
          {p.estado==='publicada'?'Ver evolución de resultados →':'Ver estado de la propuesta →'}
        </button>
      </div>)}
      {gestionadas.length>1&&<button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('seguimiento')}>
        Ver las {gestionadas.length} mejoras en gestión →
      </button>}
      {!!acciones.length && <h4 className="seo-exec-otras-titulo">Otras oportunidades sin una mejora aprobada</h4>}
      {acciones.length ? <div className="seo-exec-acciones">
        {acciones.map(x=><button key={x.id} type="button" onClick={()=>onAnalyze(x)}>
          <span className={'seo-prioridad '+(x.prioridad||'media').toLowerCase()}>{x.prioridad}</span>
          <strong>{x.titulo}</strong>
          <small>{x.metricas?numero(x.metricas.impresiones)+' impresiones · CTR '+porcentaje(x.metricas.ctr):x.tipo}</small>
          <span className="seo-exec-enlace">Ver análisis →</span>
        </button>)}
      </div>:<p className="seo-exec-ayuda">No hay otras oportunidades nuevas priorizadas con los datos procesados disponibles. Seguimos midiendo los cambios anteriores.</p>}
      <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('oportunidades')}>
        Ver otras oportunidades →
      </button>
    </>}
  </section>;
}
export default function SEODashboard({sc,ga,perfilEmpresa,tiempoReal,auditoriaInicio,lista,gestionSEO,dias,datosHasta,consultadoEn,onNavigate,onAnalyze}) {
  const lead=(ga?.eventos||[]).find(e=>e.clave==='generate_lead');
  const leads=lead ? Number(lead.valores?.[0]||0) : null;
  const total=sc?.totales||{};
  const anterior=sc?.anterior||{};
  const cambioClics=sc?.disponible && anterior.clics>0
    ? 100*(total.clics-anterior.clics)/anterior.clics : null;
  const cambioImpresiones=sc?.disponible && anterior.impresiones>0
    ? 100*(total.impresiones-anterior.impresiones)/anterior.impresiones : null;
  const last=consultadoEn ? new Date(consultadoEn).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}) : null;
  const perfil=perfilEmpresa?.disponible;
  return <div className="seo-exec-dashboard">
    <div className="seo-exec-encabezado">
      <div><span className="seleccion-area-etiqueta">VISIÓN EJECUTIVA</span>
        <h2>Así va coproactiva.cl</h2>
        <p>{dias} días de rendimiento web, visibilidad en Google y oportunidades comerciales.</p>
        {datosHasta && <p className="seo-exec-ventana">Search Console: datos finalizados hasta el
          {' '}{new Date(datosHasta+'T12:00:00').toLocaleDateString('es-CL')}.
          No son indicadores en tiempo real.</p>}
      </div>
      {last && <span className="seo-exec-actualizado">Última consulta: {last}</span>}
    </div>
    <div className="seo-exec-grid-kpis">
      <Metrica nombre="Clics desde Google" valor={sc?.disponible?numero(total.clics):'—'}
        cambio={cambioClics} detalle="Search Console · búsqueda orgánica" onClick={()=>onNavigate('consultas')} />
      <Metrica nombre="Impresiones en Google" valor={sc?.disponible?numero(total.impresiones):'—'}
        cambio={cambioImpresiones} detalle="Veces que aparecimos en resultados" onClick={()=>onNavigate('consultas')} />
      <Metrica nombre="CTR orgánico" valor={sc?.disponible?porcentaje(total.ctr):'—'}
        detalle={'Posición media: '+(sc?.disponible?decimal(total.posicion):'—')} onClick={()=>onNavigate('consultas')} />
      <Metrica nombre="Sesiones del sitio" valor={ga?.disponible?numero(ga.totales?.sesiones):'—'}
        detalle="Todas las fuentes · Google Analytics 4" onClick={()=>onNavigate('analytics')} />
      <Metrica nombre="Usuarios del sitio" valor={ga?.disponible?numero(ga.totales?.usuarios):'—'}
        detalle="Usuarios en el período · GA4" onClick={()=>onNavigate('analytics')} />
      <Metrica nombre="Formularios registrados" valor={leads!==null?numero(leads):'—'}
        detalle="Eventos generate_lead · GA4, no ventas" onClick={()=>onNavigate('analytics')} />
    </div>
    <div className="seo-exec-principal">
      <SerieInteractiva sc={sc} ga={ga}/>
      <section className="seo-exec-superficie seo-exec-actividad">
        <div className="seo-exec-seccion-cabecera"><div><h3>Actividad reciente</h3>
          <p>Últimos 30 minutos · GA4 Realtime</p></div></div>
        <strong className="seo-exec-actividad-numero">{tiempoReal?.disponible?numero(tiempoReal.usuariosActivos):'—'}</strong>
        <span className="seo-exec-ayuda">Usuarios activos</span>
        <div className="seo-exec-actividad-sep"/>
        <div className="seo-exec-fila"><span>Eventos recientes</span>
          <strong>{tiempoReal?.disponible?numero(tiempoReal.eventos):'—'}</strong></div>
        <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('analytics')}>Abrir tiempo real →</button>
      </section>
    </div>
    <div className="seo-exec-grid-pares">
      <BarrasCanal ga={ga} onNavigate={onNavigate}/>
      <ListaConsultas sc={sc} onNavigate={onNavigate}/>
      <TopPaginas ga={ga} sc={sc} onNavigate={onNavigate}/>
      <Prioridades gestionSEO={gestionSEO} onNavigate={onNavigate} onAnalyze={onAnalyze}/>
    </div>
    <div className="seo-exec-grid-pares seo-exec-resumen-final">
      <section className="seo-exec-superficie">
        <div className="seo-exec-seccion-cabecera"><div><h3>Presencia en Google Maps</h3>
          <p>Actividad del Perfil de Empresa · Google Business Profile.</p></div></div>
        {perfil?<div className="seo-exec-mini-metricas">
          <div><strong>{numero(perfilEmpresa.resumen?.impresionesMaps)}</strong><small>Impresiones en Maps</small></div>
          <div><strong>{numero(perfilEmpresa.resumen?.clicsWeb)}</strong><small>Clics al sitio</small></div>
          <div><strong>{numero(perfilEmpresa.resumen?.clicsTelefono)}</strong><small>Clics de llamada</small></div>
        </div>:<p className="seo-exec-ayuda">Los indicadores del perfil estarán disponibles al autorizar su API. No se mezclan cifras de informes antiguos.</p>}
        <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('business')}>Ver Perfil de Empresa →</button>
      </section>
      <section className="seo-exec-superficie">
        <div className="seo-exec-seccion-cabecera"><div><h3>Salud técnica de la web</h3><p>Revisión técnica inicial de la portada.</p></div></div>
        <div className="seo-exec-mini-metricas">
          <div><strong>{auditoriaInicio?.status ?? '—'}</strong><small>Respuesta HTTP</small></div>
          <div><strong>{auditoriaInicio?numero(auditoriaInicio.problemas?.length):'—'}</strong><small>Observaciones detectadas</small></div>
          <div><strong>{auditoriaInicio?numero(auditoriaInicio.sitemap?.urls?.length):'—'}</strong><small>URLs en sitemap</small></div>
        </div>
        <p className="seo-exec-ayuda">La revisión HTML no reemplaza a PageSpeed ni a la indexación reportada por Google.</p>
        <button type="button" className="seo-exec-enlace" onClick={()=>onNavigate('tecnico')}>Revisar SEO técnico →</button>
      </section>
    </div>
    <p className="seo-exec-nota">Datos consultados directamente a Google cuando la integración está autorizada. Search Console y Business Profile muestran períodos procesados; GA4 Realtime consulta actividad reciente. «—» significa que no se dispone de la métrica.</p>
  </div>;
}
