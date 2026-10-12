import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './SEOImpacto.css';
const n = v => v==null ? '—' : Number(v).toLocaleString('es-CL',{maximumFractionDigits:0});
const d = v => v==null ? '—' : Number(v).toLocaleString('es-CL',{maximumFractionDigits:1});
const pct = v => v==null?'—':(Number(v)*100).toLocaleString('es-CL',{maximumFractionDigits:2})+'%';
const date = x=>x?new Date(x).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'}):'Pendiente';
const estado = {
  aprobada:['Aprobación guardada','Falta preparar PR'],
  preparada:['En revisión','Propuesta abierta en GitHub'],
  integrada:['Integrada en GitHub','Hosting no verificado'],
  publicada:['Publicada y comprobada','Medición en curso'],
  descartada:['Descartada','Sin cambios en web'],
  ajustes_solicitados:['Ajustes solicitados','Esperando nueva propuesta'],
  error_preparacion:['Error de preparación','Revisar integración']
};
async function llamar(accion,extra={}) {
  const {data,error}=await supabase.functions.invoke('seo-propuestas',{body:{accion,...extra}});
  if(error){let msg=error.message;
    if(error.context?.json)try{msg=(await error.context.json())?.error||msg;}catch{}
    throw Error(msg||'No fue posible consultar propuestas.');
  }
  if(data?.error)throw Error(data.error);
  return data;
}
function Delta({num,suffix='',negativoMejora=false}) {
  if(num==null)return <span className="seo-impacto-neutro">Sin referencia comparable</span>;
  const bueno=negativoMejora?num<0:num>0;
  return <strong className={num===0?'seo-impacto-neutro':bueno?'seo-impacto-bueno':'seo-impacto-malo'}>
    {num>0?'+':''}{d(num)}{suffix}
  </strong>;
}
function Grafico({periodo}) {
  const anterior=periodo.anteriorComparable||periodo.anterior;
  const posterior=periodo.posterior;
  if(!posterior)return <p className="seo-impacto-help">Esperando los primeros días procesados por Google.</p>;
  const max=Math.max(1,anterior?.clicks||0,posterior.clicks);
  return <div className="seo-impacto-bars" aria-label="Clics antes y después">
    {[['Antes',anterior?.clicks||0],['Después',posterior.clicks]].map(([etiqueta,valor])=><div key={etiqueta}>
      <span>{etiqueta}</span>
      <div className="seo-impacto-bar"><span style={{width:(100*valor/max)+'%'}}/></div>
      <strong>{n(valor)} clics</strong>
    </div>)}
  </div>;
}
function Detalle({item,invocar}) {
  const [dias,setDias]=useState(7),[datos,setDatos]=useState(null);
  const [error,setError]=useState(''),[cargando,setCargando]=useState(false);
  const [comprobacion,setComprobacion]=useState(null);
  const medir=useCallback(async()=> {
    if(!item.verificada_en)return;
    setCargando(true);setError('');
    try {
      const r=await invocar('seguimiento-seo',{ruta:item.ruta,publicadaEn:item.verificada_en});
      if(r.error)throw Error(r.error);
      setDatos(r);
    }catch(e){setError(e.message||'No fue posible medir el impacto SEO.');}
    finally{setCargando(false);}
  },[item.verificada_en,item.ruta,invocar]);
  useEffect(()=>{medir();},[medir]);
  async function sincronizar() {
    setCargando(true);setError('');
    try{
      const r=await llamar('sincronizar',{id:item.id});
      setComprobacion(r.comprobacion||null);
      if(r.propuesta?.estado==='publicada') {
        setError('Publicación comprobada. Actualiza el historial para iniciar el seguimiento.');
      }else if(r.comprobacion?.error){
        setError(r.comprobacion.error);
      }else if(r.propuesta?.verificacion_detalle)setError(r.propuesta.verificacion_detalle);
    }catch(e){setError(e.message);}
    finally{setCargando(false);}
  }
  const periodo=datos?.periodos?.find(x=>x.dias===dias);
  return <section className="seo-impacto-detail">
    <div className="seo-impacto-dates">
      <div><small>Fusionada en GitHub</small><strong>{date(item.fusionada_en)}</strong></div>
      <div><small>Primera comprobación en web</small><strong>{date(item.verificada_en)}</strong></div>
      <div><small>Última verificación</small><strong>{date(item.ultima_verificacion_en)}</strong></div>
    </div>
    {!!item.verificacion_detalle && <p className="seo-impacto-help">{item.verificacion_detalle}</p>}
    <div className="seo-impacto-buttons">
      {item.pr_url&&<a href={item.pr_url} target="_blank" rel="noopener noreferrer">Ver cambios aprobados ↗</a>}
      <a href={'https://www.coproactiva.cl'+item.ruta} target="_blank" rel="noopener noreferrer">Abrir página ↗</a>
      <button type="button" disabled={cargando} onClick={sincronizar}>
        {cargando?'Verificando…':'Verificar publicación'}
      </button>
    </div>
    {error&&<p role="status" className="seo-impacto-aviso">{error}</p>}
    {comprobacion?.coinciden&&<p className="seo-impacto-bueno">El servidor confirmó que el título y la descripción ya están en la web.</p>}
    {item.estado!=='publicada'||!item.verificada_en?
      <div className="seo-impacto-pendiente">
        <strong>El seguimiento todavía no ha comenzado.</strong>
        <p>El cambio está integrado en GitHub, pero el sitio público debe entregar el nuevo título y descripción antes de fijar la fecha inicial. No se atribuirán resultados a cambios que aún no vemos en la web.</p>
      </div>
      :<>
        <div className="seo-impacto-periodos" role="group" aria-label="Plazo de seguimiento">
          {[7,28,90].map(x=><button type="button" key={x}
            className={dias===x?'activo':''} onClick={()=>setDias(x)}>{x} días</button>)}
          <button type="button" onClick={medir} disabled={cargando} className="seo-impacto-refresh">
            {cargando?'Consultando…':'Actualizar datos'}
          </button>
        </div>
        {!datos&&!error&&<p className="seo-impacto-help">Consultando Search Console…</p>}
        {periodo&&<div className="seo-impacto-periodo-contenido">
          <div className="seo-impacto-periodo-cabecera">
            <strong>{periodo.completo?'Comparación completa':'Seguimiento en desarrollo'}</strong>
            <span>{periodo.diasFinalizados} de {dias} días procesados</span>
          </div>
          <div className="seo-impacto-progreso"><span style={{width:(100*periodo.diasFinalizados/dias)+'%'}}/></div>
          <div className="seo-impacto-metricas">
            <div><small>Clics</small><strong>{n(periodo.anteriorComparable?.clicks ?? periodo.anterior?.clicks)}
              {' → '}{n(periodo.posterior?.clicks)}</strong>
              <Delta num={periodo.cambioClics} suffix="%"/></div>
            <div><small>Impresiones</small><strong>{n(periodo.anteriorComparable?.impresiones ?? periodo.anterior?.impresiones)}
              {' → '}{n(periodo.posterior?.impresiones)}</strong>
              <Delta num={periodo.cambioImpresiones} suffix="%"/></div>
            <div><small>CTR</small><strong>{pct(periodo.anteriorComparable?.ctr ?? periodo.anterior?.ctr)}
              {' → '}{pct(periodo.posterior?.ctr)}</strong>
              <Delta num={periodo.cambioCtrPuntos} suffix=" pp"/></div>
            <div><small>Posición promedio</small><strong>{d(periodo.anteriorComparable?.posicion ?? periodo.anterior?.posicion)}
              {' → '}{d(periodo.posterior?.posicion)}</strong>
              <Delta num={periodo.cambioPosicion} negativoMejora/></div>
          </div>
          <Grafico periodo={periodo}/>
          <p className="seo-impacto-help">{periodo.diasFinalizados===0
            ? 'Google todavía no ha finalizado datos posteriores a la fecha de verificación.'
            : periodo.completo?'Se compararon ventanas completas de igual duración.'
              :'Comparación provisional con el mismo número de días antes y después del cambio.'}</p>
          <p className="seo-impacto-help">Ventana anterior: {periodo.desdeAnterior} al {periodo.hastaAnterior}.
            {periodo.hastaPosterior&&' Ventana posterior: '+periodo.desdePosterior+' al '+periodo.hastaPosterior+'.'}</p>
        </div>}
        {datos&&<p className="seo-impacto-help">{datos.nota}</p>}
      </>}
  </section>;
}
export default function SEOImpacto({invocar}) {
  const [items,setItems]=useState([]),[seleccion,setSeleccion]=useState('');
  const [error,setError]=useState(''),[cargando,setCargando]=useState(true),[fecha,setFecha]=useState('');
  const refrescar=useCallback(async()=>{
    setCargando(true);setError('');
    try {
      const r=await llamar('listar');
      setItems(r.propuestas||[]);
      setFecha(r.ultimaSincronizacion||new Date().toISOString());
      if(r.observaciones)setError(r.observaciones);
      setSeleccion(prev=>r.propuestas?.some(x=>x.id===prev)?prev:r.propuestas?.[0]?.id||'');
    }catch(e){setError(e.message||'Sin historial disponible.');}
    finally{setCargando(false);}
  },[]);
  useEffect(()=>{refrescar();},[refrescar]);
  const aprobadas=useMemo(()=>items.filter(x=>x.estado!=='descartada'&&x.estado!=='ajustes_solicitados'),[items]);
  return <div className="seo-impacto">
    <header className="seo-impacto-top">
      <div><h2>Seguimiento de mejoras SEO</h2>
        <p>Cada modificación conserva su fecha, cambios exactos y la evolución real posterior.</p></div>
      <button type="button" onClick={refrescar} disabled={cargando}>
        {cargando?'Sincronizando…':'Sincronizar'}
      </button>
    </header>
    <div className="seo-impacto-totales">
      <div><strong>{n(aprobadas.length)}</strong><small>Propuestas registradas</small></div>
      <div><strong>{n(aprobadas.filter(x=>x.estado==='integrada').length)}</strong><small>Integradas, por verificar</small></div>
      <div><strong>{n(aprobadas.filter(x=>x.estado==='publicada').length)}</strong><small>Publicadas verificadas</small></div>
    </div>
    {fecha&&<p className="seo-impacto-help">Última sincronización: {date(fecha)}</p>}
    {error&&<p className="seo-impacto-aviso" role="status">{error}</p>}
    {aprobadas.length===0&&!cargando&&<p>Sin modificaciones aprobadas todavía.</p>}
    {aprobadas.map(p=>{
      const activo=p.id===seleccion;const state=estado[p.estado]||[p.estado,''];
      return <article key={p.id} className="seo-impacto-card">
        <div className="seo-impacto-header">
          <div>
            <span className={'seo-impacto-estado estado-'+p.estado}>{state[0]}</span>
            <h3>{p.consulta_principal}</h3>
            <p>{p.ruta} · {state[1]}</p>
          </div>
          <button type="button" onClick={()=>setSeleccion(activo?'':p.id)}>
            {activo?'Contraer':'Ver evolución →'}
          </button>
        </div>
        {activo&&<Detalle item={p} invocar={invocar}/>}
      </article>;
    })}
    <p className="seo-impacto-help">Los indicadores proceden de Google Search Console y corresponden a la URL evaluada, no a ventas ni visitantes únicos. Las variaciones no prueban que la mejora sea la única causa.</p>
  </div>;
}
