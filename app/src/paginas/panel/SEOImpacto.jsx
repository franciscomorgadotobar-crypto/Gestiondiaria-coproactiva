import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { nombreMejoraSEO, camposModificadosSEO } from '../../lib/seoNombresMejoras';
import './SEOImpacto.css';

const numero = v => Number(v ?? 0).toLocaleString('es-CL',{maximumFractionDigits:0});
const decimal = v => Number(v ?? 0).toLocaleString('es-CL',{maximumFractionDigits:1});
const porcentaje = v => (Number(v ?? 0)*100).toLocaleString('es-CL',{maximumFractionDigits:2})+'%';
const fecha = x => x ? new Date(x).toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'}) : 'Pendiente';
const ESTADOS = {
  aprobada:'Aprobada', preparada:'En revisión', integrada:'Integrada en GitHub',
  publicada:'Publicada', descartada:'Descartada',
  ajustes_solicitados:'Ajustes solicitados', error_preparacion:'Error de preparación'
};
async function servicio(accion,extra={}) {
  const {data,error}=await supabase.functions.invoke('seo-propuestas',{body:{accion,...extra}});
  if(error) {
    let detalle=error.message||'No se pudo consultar el historial.';
    if(error.context?.json)try{detalle=(await error.context.json())?.error||detalle;}catch{/* sin json */}
    throw Error(detalle);
  }
  if(data?.error)throw Error(data.error);
  return data;
}
function Diferencia({valor,sufijo='',invertido=false}) {
  if(valor==null)return null;
  const mejora=invertido?valor<0:valor>0;
  const clase=valor===0?'neutral':mejora?'positiva':'negativa';
  return <span className={'seo-impacto-diferencia '+clase}>
    {valor>0?'+':''}{decimal(valor)}{sufijo}
  </span>;
}
function Indicador({nombre,antes,despues,cambio,sufijo='',invertido=false}) {
  return <div className="seo-impacto-indicador">
    <small>{nombre}</small>
    <div className="seo-impacto-indicador-valores">
      <strong>{antes} → {despues}</strong>
      <Diferencia valor={cambio} sufijo={sufijo} invertido={invertido}/>
    </div>
  </div>;
}
function Medicion({item,invocar}) {
  const [plazo,setPlazo]=useState('7');
  const [datos,setDatos]=useState(null);
  const [cargando,setCargando]=useState(false);
  const [error,setError]=useState('');
  const actualizar=useCallback(async()=>{
    if(!item.verificada_en)return;
    setCargando(true);setError('');
    try {
      const r=await invocar('seguimiento-seo',{ruta:item.ruta,publicadaEn:item.verificada_en});
      if(r?.error)throw Error(r.error);
      setDatos(r);
    }catch(err){setError(err.message||'No se pudieron recuperar las métricas.');}
    finally{setCargando(false);}
  },[item.verificada_en,item.ruta,invocar]);
  useEffect(()=>{actualizar();},[actualizar]);
  const periodo=datos?.periodos?.find(x=>x.dias===Number(plazo));
  const listo=Boolean(periodo?.posterior && periodo?.diasFinalizados>0);
  const base=periodo?.anteriorComparable||periodo?.anterior;
  return <div className="seo-impacto-medicion">
    <div className="seo-impacto-herramientas">
      <label htmlFor={'seo-plazo-'+item.id}>Comparar a</label>
      <select id={'seo-plazo-'+item.id} value={plazo} onChange={e=>setPlazo(e.target.value)}>
        <option value="7">7 días</option>
        <option value="28">28 días</option>
        <option value="90">90 días</option>
      </select>
      <button type="button" onClick={actualizar} disabled={cargando}>
        {cargando?'Consultando…':'Actualizar'}
      </button>
    </div>
    {error&&<p role="alert" className="seo-impacto-error">{error}</p>}
    {!periodo&&!error&&<p className="seo-impacto-msg">{cargando?'Consultando Search Console…':'Sin datos disponibles.'}</p>}
    {periodo&&!listo&&<div className="seo-impacto-espera" role="status">
      <strong>Esperando datos posteriores al cambio</strong>
      <p>Google aún no ha procesado el período posterior. Última referencia: {numero(periodo.anterior?.clicks)} clics,
        {' '}{numero(periodo.anterior?.impresiones)} impresiones, CTR {porcentaje(periodo.anterior?.ctr)}
        {' '}y posición {decimal(periodo.anterior?.posicion)}.</p>
    </div>}
    {periodo&&listo&&<>
      <p className="seo-impacto-periodo-etapa">
        {periodo.completo?'Período completo':'Resultado provisional'}
        {' · '}{periodo.diasFinalizados} de {plazo} días procesados
      </p>
      <div className="seo-impacto-indicadores">
        <Indicador nombre="Clics" antes={numero(base?.clicks)} despues={numero(periodo.posterior.clicks)}
          cambio={periodo.cambioClics} sufijo="%"/>
        <Indicador nombre="Impresiones" antes={numero(base?.impresiones)} despues={numero(periodo.posterior.impresiones)}
          cambio={periodo.cambioImpresiones} sufijo="%"/>
        <Indicador nombre="CTR" antes={porcentaje(base?.ctr)} despues={porcentaje(periodo.posterior.ctr)}
          cambio={periodo.cambioCtrPuntos} sufijo=" pp"/>
        <Indicador nombre="Posición" antes={decimal(base?.posicion)} despues={decimal(periodo.posterior.posicion)}
          cambio={periodo.cambioPosicion} invertido/>
      </div>
      <small className="seo-impacto-lectura">Antes → después · Misma URL y períodos equivalentes. No implica causalidad.</small>
    </>}
  </div>;
}
function CambiosDeContenido({item}) {
  const cambios=camposModificadosSEO(item);
  if(!cambios.length)return null;
  return <section className="seo-impacto-cambios" aria-label="Texto original y cambio aprobado">
    {cambios.map(campo=><div className="seo-impacto-cambio-campo" key={campo.campo}>
      <h3>{campo.campo}</h3>
      <div className="seo-impacto-cambio-valores">
        <div className="seo-impacto-cambio-antes">
          <span className="seo-impacto-etiqueta original">Original</span>
          <p>{campo.original || 'Sin contenido'}</p>
        </div>
        <div className="seo-impacto-cambio-despues">
          <span className="seo-impacto-etiqueta cambio">Cambio</span>
          <p>{campo.cambio || 'Contenido eliminado'}</p>
        </div>
      </div>
    </div>)}
  </section>;
}

function Historial({item,onVerificar,cargando}) {
  const netlify=item.netlify_detalle||{};
  return <details className="seo-impacto-historial">
    <summary>Historial y enlaces</summary>
    <div className="seo-impacto-historial-contenido">
      <div><span>GitHub</span><strong>{fecha(item.fusionada_en)}</strong></div>
      <div><span>Publicación verificada</span><strong>{fecha(item.verificada_en)}</strong></div>
      {item.ultima_verificacion_en&&<div><span>Última comprobación</span><strong>{fecha(item.ultima_verificacion_en)}</strong></div>}
      {item.pr_url&&<a href={item.pr_url} target="_blank" rel="noopener noreferrer">Revisar cambios en GitHub ↗</a>}
      <a href={'https://www.coproactiva.cl'+item.ruta} target="_blank" rel="noopener noreferrer">Abrir página ↗</a>
      {item.estado==='integrada'&&
        <button type="button" disabled={cargando} onClick={onVerificar}>
          {cargando?'Comprobando…':'Comprobar publicación'}
        </button>}
      {netlify.conectado===true&&netlify.deploy?.url&&
        <a href={netlify.deploy.url} target="_blank" rel="noopener noreferrer">Ver despliegue Netlify ↗</a>}
    </div>
  </details>;
}
function Mejora({item,invocar,onActualizada}) {
  const [abierto,setAbierto]=useState(false);
  const [cargando,setCargando]=useState(false);
  const [error,setError]=useState('');
  async function verificar(){
    setCargando(true);setError('');
    try{
      const r=await servicio('sincronizar',{id:item.id});
      if(r.propuesta)onActualizada(r.propuesta);
      if(r.comprobacion?.error)setError(r.comprobacion.error);
      else if(r.propuesta?.estado!=='publicada')setError('El cambio aún no se confirma en la web.');
    }catch(e){setError(e.message||'No fue posible verificar la publicación.');}
    finally{setCargando(false);}
  }
  const estado=ESTADOS[item.estado]||item.estado;
  const publicada=item.estado==='publicada'&&!!item.verificada_en;
  return <article className="seo-impacto-mejora">
    <button type="button" className="seo-impacto-mejora-cabecera"
      onClick={()=>setAbierto(v=>!v)} aria-expanded={abierto}>
      <div className="seo-impacto-mejora-texto">
        <strong>{nombreMejoraSEO(item)}</strong>
        <small>{estado}{publicada?' · '+fecha(item.verificada_en):''}</small>
      </div>
      <span className="seo-impacto-flecha" aria-hidden="true">{abierto?'⌃':'⌄'}</span>
    </button>
    {abierto&&<div className="seo-impacto-mejora-detalle">
      <CambiosDeContenido item={item}/>
      {publicada
        ?<Medicion item={item} invocar={invocar}/>
        :<div className="seo-impacto-espera"><strong>Seguimiento pendiente</strong>
          <p>{item.estado==='integrada'?'El cambio ya está en GitHub; falta comprobar su publicación en la web.':
            'Primero se debe aprobar, integrar y verificar el cambio.'}</p>
          {item.estado==='integrada'&&<button type="button" disabled={cargando} onClick={verificar}>Comprobar publicación</button>}
        </div>}
      {error&&<p className="seo-impacto-error" role="alert">{error}</p>}
      <Historial item={item} onVerificar={verificar} cargando={cargando}/>
    </div>}
  </article>;
}
export default function SEOImpacto({invocar}) {
  const [propuestas,setPropuestas]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const cargar=useCallback(async()=>{
    setCargando(true);setError('');
    try {
      const resultado=await servicio('listar');
      setPropuestas(resultado.propuestas||[]);
      if(resultado.observaciones)setError(resultado.observaciones);
    }catch(e){setError(e.message||'No se pudo cargar el seguimiento.');}
    finally{setCargando(false);}
  },[]);
  useEffect(()=>{cargar();},[cargar]);
  const gestionadas=useMemo(()=>propuestas.filter(p=>!['descartada','ajustes_solicitados'].includes(p.estado)),[propuestas]);
  return <section className="seo-impacto">
    <div className="seo-impacto-top">
      <div><h2>Seguimiento SEO</h2>
        <p>{gestionadas.length} {gestionadas.length===1?'mejora registrada':'mejoras registradas'}</p>
      </div>
      <button type="button" onClick={cargar} disabled={cargando}>{cargando?'Actualizando…':'Actualizar'}</button>
    </div>
    {error&&<p role="alert" className="seo-impacto-error">{error}</p>}
    {!cargando&&!gestionadas.length&&<p className="seo-impacto-msg">Todavía no hay mejoras aprobadas.</p>}
    <div className="seo-impacto-listado">
      {gestionadas.map(p=><Mejora key={p.id} item={p} invocar={invocar}
        onActualizada={nuevo=>setPropuestas(actual=>actual.map(x=>x.id===nuevo.id?nuevo:x))}/>)}
    </div>
  </section>;
}
