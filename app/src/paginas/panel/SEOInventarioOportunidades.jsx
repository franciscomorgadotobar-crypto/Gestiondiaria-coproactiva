import { useMemo, useState } from 'react';
import { normalizarConsultaSEO } from '../../lib/seoEstadoOportunidades';
import './SEOInventarioOportunidades.css';

const n = valor => Number(valor || 0).toLocaleString('es-CL', {maximumFractionDigits:0});
const ctr = valor => (Number(valor || 0) * 100).toLocaleString('es-CL',{maximumFractionDigits:1})+'%';
const ETIQUETAS={consulta:'Búsqueda en Google',tecnico:'SEO técnico',analytics:'Medición',conexiones:'Configuración'};
const ESTADOS={
  aprobada:'Aprobada · por preparar',preparada:'Propuesta en revisión',
  integrada:'Integrada · verificar web',publicada:'Publicada · en seguimiento',
  descartada:'Descartada',ajustes_solicitados:'Ajustes solicitados'
};
function Icono({nombre}) {
  if(nombre==='check')return <span className="seo-inv-ico verde" aria-hidden="true">✓</span>;
  if(nombre==='lupa')return <span className="seo-inv-ico" aria-hidden="true">⌕</span>;
  return <span className="seo-inv-ico" aria-hidden="true">!</span>;
}

export default function SEOInventarioOportunidades({
  gestionSEO,lista,sc,dias,onAnalizar,onVerSeguimiento,onVerBusquedas
}) {
  const [filtro,setFiltro]=useState('pendientes');
  const sinHistorial=!gestionSEO?.disponibles;
  const nuevas=useMemo(()=>gestionSEO?.disponibles
    ? (gestionSEO.nuevas||[]).filter(x=>x.prioridad!=='Pendiente')
    : [],[gestionSEO]);
  const gestionadas=gestionSEO?.enGestion || [];
  const observadas=useMemo(()=>{
    if(!sc?.disponible||!gestionSEO?.disponibles)return [];
    const detectadas=new Set(lista.filter(x=>x.clase==='consulta')
      .map(x=>normalizarConsultaSEO(x.consulta)));
    const yaTrabajadas=new Set((gestionSEO.coincidencias||[])
      .map(x=>normalizarConsultaSEO(x.oportunidad.consulta)));
    return (sc.consultas||[]).filter(q=>!detectadas.has(normalizarConsultaSEO(q.clave)) &&
      !yaTrabajadas.has(normalizarConsultaSEO(q.clave)));
  },[sc,lista,gestionSEO]);
  const inicio=sc?.desde||'—',fin=sc?.hasta||'—';
  const resumen=[
    {id:'pendientes',cantidad:nuevas.length,titulo:'Prioritarias'},
    {id:'gestion',cantidad:gestionadas.length,titulo:'En gestión'},
    {id:'observacion',cantidad:observadas.length,titulo:'Bajo observación'}
  ];
  return <div className="seo-inventario">
    <div className="seo-inventario-cabecera">
      <div><span className="seleccion-area-etiqueta">OPORTUNIDADES SEO</span>
        <h2>Todo lo que detectamos</h2>
        <p>Aquí aparecen todas las oportunidades priorizadas, las ya trabajadas y otras
          búsquedas observadas. El Home solo muestra un resumen.</p>
      </div>
      <small>{dias} días · Search Console {inicio} al {fin}</small>
    </div>
    <div className="seo-inventario-filtros" role="group" aria-label="Clasificar oportunidades SEO">
      {resumen.map(x=><button key={x.id} type="button"
        className={filtro===x.id?'activo':''} onClick={()=>setFiltro(x.id)}
        aria-pressed={filtro===x.id}>
        <strong>{x.cantidad}</strong><span>{x.titulo}</span>
      </button>)}
    </div>
    {sinHistorial&&<div className="seo-inventario-aviso" role="status">
      No se pudo comprobar el historial de mejoras. Para evitar recomendaciones duplicadas,
      el listado de oportunidades nuevas permanecerá oculto hasta sincronizar.
    </div>}
    {!sinHistorial&&filtro==='pendientes'&&<>
      <p className="seo-inventario-explica">Estas {nuevas.length} señales cumplen las reglas
        actuales de prioridad. No se generan recomendaciones adicionales sin evidencia.</p>
      {nuevas.map(item=><article className="seo-inventario-item" key={item.id}>
        <div className="seo-inventario-item-cuerpo">
          <Icono nombre={item.clase==='consulta'?'lupa':'alerta'}/>
          <div>
            <div className="seo-inventario-chips">
              <span className={'seo-prioridad '+String(item.prioridad||'Media').toLowerCase()}>
                {item.prioridad||'Revisar'}</span>
              <small>{ETIQUETAS[item.clase]||item.tipo||'Análisis SEO'}</small>
            </div>
            <h3>{item.titulo}</h3>
            <p>{item.clase==='consulta'
              ? n(item.metricas?.impresiones)+' impresiones · CTR '+ctr(item.metricas?.ctr)+
                ' · posición '+Number(item.metricas?.posicion||0).toLocaleString('es-CL',{maximumFractionDigits:1})
              : item.detalle}</p>
          </div>
        </div>
        <button type="button" onClick={()=>onAnalizar(item)}>Ver diagnóstico →</button>
      </article>)}
      {!nuevas.length&&<p className="seo-inventario-vacio">No hay nuevas acciones priorizadas con los datos
        disponibles. Esto no significa que el sitio esté completamente optimizado; revisa
        las búsquedas bajo observación y los indicadores de rendimiento.</p>}
    </>}
    {!sinHistorial&&filtro==='gestion'&&<>
      <p className="seo-inventario-explica">Estas propuestas ya fueron aprobadas o publicadas.
        Sus resultados se evalúan en Seguimiento, no se generan como tareas nuevas.</p>
      {gestionadas.map(p=><article key={p.id} className="seo-inventario-item">
        <div className="seo-inventario-item-cuerpo"><Icono nombre="check"/>
          <div><div className="seo-inventario-chips"><small>{ESTADOS[p.estado]||p.estado}</small></div>
            <h3>{p.consulta_principal}</h3>
            <p>{p.ruta==='/'?'Portada':p.ruta} · {Array.isArray(p.consultas)?p.consultas.length:1} búsquedas vinculadas</p>
          </div>
        </div>
        <button type="button" onClick={onVerSeguimiento}>Ver seguimiento →</button>
      </article>)}
      {!gestionadas.length&&<p className="seo-inventario-vacio">Aún no existen mejoras en gestión.</p>}
    </>}
    {!sinHistorial&&filtro==='observacion'&&<>
      <p className="seo-inventario-explica">Búsquedas reales que aparecen en Search Console pero
        no cumplen las reglas para generar una nueva acción. No son diagnósticos ni mejoras aprobadas.</p>
      {observadas.slice(0,20).map(q=><div className="seo-inventario-observada" key={q.clave}>
        <span>{q.clave}</span>
        <small>{n(q.impresiones)} impresiones · {n(q.clicks)} clics · CTR {ctr(q.ctr)}</small>
      </div>)}
      {!observadas.length&&<p className="seo-inventario-vacio">No se identificaron otras consultas
        en la muestra disponible. Search Console entrega las principales búsquedas, no un inventario exhaustivo.</p>}
      {observadas.length>20&&<p className="seo-inventario-explica">
        Se muestran 20 de {observadas.length} búsquedas observadas. Puedes revisar la lista de Google en Búsquedas.</p>}
      <button type="button" className="seo-inventario-enlace" onClick={onVerBusquedas}>
        Ver búsquedas e indicadores completos →
      </button>
    </>}
    <p className="seo-inventario-fuente">Fuentes: Search Console, Google Analytics 4 y auditoría
      HTML de la portada. La muestra de búsqueda se limita a los principales resultados
      y la auditoría técnica de otras páginas se consulta por URL, no se presupone realizada.</p>
  </div>;
}
