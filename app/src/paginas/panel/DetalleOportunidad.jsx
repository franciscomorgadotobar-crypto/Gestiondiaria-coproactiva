import { useEffect, useState } from 'react';
import { propuestaEditorial } from '../../lib/seoOportunidades';

const num = n => Number(n || 0).toLocaleString('es-CL');
const pct = n => (Number(n || 0) * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%';
const d1 = n => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 });
const ORIGIN = 'https://www.coproactiva.cl';

function Comparacion({ etiqueta, valor }) {
  if (!valor) return null;
  return <div className="seo-comparacion">
    <h4>{etiqueta} <span className={'seo-prioridad ' + (valor.cambiar ? 'media' : 'pendiente')}>
      {valor.cambiar ? 'Cambio sugerido' : 'Mantener'}
    </span></h4>
    <div className="seo-comparacion-columnas">
      <div><span className="seo-antes">Texto actual (sitio web)</span>
        <p>{valor.actual || 'No encontrado en el HTML de esta página'}</p></div>
      <div><span className="seo-despues">{valor.cambiar ? 'Texto propuesto para revisión' : 'Texto que conservaría'}</span>
        <p>{valor.propuesto || 'Sin propuesta'}</p>
        <small>{valor.cambiar ? 'Sugerencia editorial: requiere aprobación antes de publicar.' :
          'No recomiendo modificar este campo solo por las métricas.'}</small></div>
    </div>
  </div>;
}

export default function DetalleOportunidad({ item, invocar, dias, rutasSitemap, alCerrar, irVista }) {
  const [paginas, setPaginas] = useState([]);
  const [ruta, setRuta] = useState('');
  const [auditoria, setAuditoria] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoPagina, setCargandoPagina] = useState(false);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    if (!item) return;
    setPaginas([]); setAuditoria(null); setRuta(''); setMensaje(''); setCopiado('');
    if (item.clase !== 'consulta') return;
    let vigente = true;
    setCargando(true);
    (async () => {
      try {
        const data = await invocar('consulta-paginas', { consulta: item.consulta, dias });
        if (!vigente) return;
        const candidatas = data?.paginas || [];
        setPaginas(candidatas);
        if (candidatas.length) {
          const elegida = candidatas[0].ruta;
          setRuta(elegida); setCargandoPagina(true);
          try {
            const audit = await invocar('auditoria', { ruta: elegida });
            if (vigente) setAuditoria(audit);
          } catch (e) {
            if (vigente) setMensaje(e.message || 'No se pudo recuperar el HTML.');
          } finally { if (vigente) setCargandoPagina(false); }
        } else setMensaje(data?.explicacion || 'Selecciona una página para auditarla.');
      } catch (e) { if (vigente) setMensaje(e.message || 'No fue posible identificar la página.'); }
      finally { if (vigente) setCargando(false); }
    })();
    return () => { vigente = false; };
  }, [item?.id, dias, invocar]);

  async function cambiarRuta(nueva) {
    setRuta(nueva); setAuditoria(null); setMensaje('');
    if (!nueva) return;
    setCargandoPagina(true);
    try {
      const resultado = await invocar('auditoria', { ruta: nueva });
      setAuditoria(resultado);
    } catch (e) { setMensaje(e.message || 'No se pudo leer el HTML.'); }
    finally { setCargandoPagina(false); }
  }
  async function copiar(texto, tipo) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
    } catch { setMensaje('No se pudo copiar automáticamente; selecciona el texto propuesto.'); }
  }

  if (!item) return null;
  const propuesta = item.clase === 'consulta' && auditoria ? propuestaEditorial(item.consulta, auditoria) : null;
  const disponibles = [...new Set([...paginas.map(p => p.ruta),
    ...rutasSitemap.filter(p => p.startsWith('/') && p.length < 180)])].slice(0, 150);
  const sinCandidata = item.clase === 'consulta' && !paginas.length;
  return <section id="seo-detalle-accion" className="tarjeta seo-detalle" aria-live="polite">
    <div className="seo-fila-separada seo-detalle-encabezado">
      <div><span className="seleccion-area-etiqueta">Análisis individual · {item.fuente}</span>
        <h2 className="h4">{item.titulo}</h2></div>
      <button type="button" className="boton boton-secundario" onClick={alCerrar}>Cerrar ×</button>
    </div>

    <p>{item.porQue || item.detalle}</p>
    {item.metricas && <div className="seo-kpis">
      <div className="seo-kpi"><span className="seo-kpi-titulo">Impresiones</span><strong className="seo-kpi-dato">{num(item.metricas.impresiones)}</strong></div>
      <div className="seo-kpi"><span className="seo-kpi-titulo">Clics</span><strong className="seo-kpi-dato">{num(item.metricas.clicks)}</strong></div>
      <div className="seo-kpi"><span className="seo-kpi-titulo">CTR</span><strong className="seo-kpi-dato">{pct(item.metricas.ctr)}</strong></div>
      <div className="seo-kpi"><span className="seo-kpi-titulo">Posición media</span><strong className="seo-kpi-dato">{d1(item.metricas.posicion)}</strong></div>
    </div>}
    {item.reglas && <p className="seo-explicacion-regla"><strong>Por qué apareció:</strong> {item.reglas}.
      <span> Estas reglas son heurísticas, no un diagnóstico SEO definitivo.</span></p>}

    {item.clase === 'consulta' && <>
      <h3 className="seo-subtitulo">1. ¿Qué página aparece para esta búsqueda?</h3>
      {(cargando || cargandoPagina) && <p className="chico apagado">Consultando páginas de Google y leyendo el HTML actual…</p>}
      {mensaje && <div className="seo-aviso seo-aviso-pendiente" role="status">{mensaje}</div>}
      {sinCandidata && !cargando && <p className="chico apagado">Sin una página atribuida por Google, no asumiré que debe cambiarse la portada. Selecciona una URL del sitio y confirma su pertinencia.</p>}
      {!!disponibles.length && <label className="seo-detalle-selector">Página a revisar
        <select value={ruta} onChange={e => cambiarRuta(e.target.value)}>
          <option value="">Seleccionar página…</option>
          {disponibles.map(p => <option key={p} value={p}>{ORIGIN + p}{paginas.some(x => x.ruta === p) ? ' · encontrada en Google' : ''}</option>)}
        </select>
      </label>}
      {!!paginas.length && <div className="seo-aterrizaje"><strong>URL asociada por Google</strong>
        {paginas.slice(0, 5).map((x, i) => <button type="button" key={i} className={'seo-url-opcion ' + (x.ruta === ruta ? 'seleccionada' : '')}
          onClick={() => cambiarRuta(x.ruta)}>
          <span>{x.ruta}</span><small>{num(x.impresiones)} impresiones · {num(x.clics)} clics · posición {d1(x.posicion)}</small>
        </button>)}</div>}
      {auditoria && <div className="seo-accion-url">
        <strong>URL comprobada: </strong><a href={auditoria.url} target="_blank" rel="noopener noreferrer">{auditoria.url} ↗</a>
        <span className="micro"> HTTP {auditoria.status} · {auditoria.fecha ? new Date(auditoria.fecha).toLocaleString('es-CL') : 'sin fecha'} · Texto extraído del HTML público</span>
      </div>}
      {propuesta && !propuesta.error && <>
        <h3 className="seo-subtitulo">2. Texto actual vs. propuesta</h3>
        <div className="seo-aviso"><div><strong>{propuesta.diagnostico}</strong><p>{propuesta.motivo}</p></div></div>
        <Comparacion etiqueta="Título SEO (<title>)" valor={propuesta.titulo} />
        <Comparacion etiqueta="Meta description" valor={propuesta.description} />
        <Comparacion etiqueta="H1 principal" valor={propuesta.h1} />
        <div className="seo-botones">
          {propuesta.titulo?.cambiar && <button type="button" className="boton boton-secundario"
            onClick={() => copiar(propuesta.titulo.propuesto, 'Título')}>{copiado === 'Título' ? 'Título copiado ✓' : 'Copiar título propuesto'}</button>}
          {propuesta.description?.cambiar && <button type="button" className="boton boton-secundario"
            onClick={() => copiar(propuesta.description.propuesto, 'Descripción')}>{copiado === 'Descripción' ? 'Descripción copiada ✓' : 'Copiar descripción propuesta'}</button>}
          <button type="button" className="boton boton-secundario" onClick={() => irVista('consultas')}>Ver búsquedas ↗</button>
        </div>
        <p className="micro">No se aplican cambios automáticos. Revisa si esta URL debe responder a la intención de la consulta y vuelve a medir tras publicar.</p>
      </>}
      {propuesta?.error && <p className="seo-aviso seo-aviso-error">{propuesta.error}</p>}
    </>}
    {item.clase === 'tecnico' && <>
      <div className="seo-accion-url"><strong>URL observada: </strong>
        <a href={ORIGIN + (item.ruta || '/')} target="_blank" rel="noopener noreferrer">{ORIGIN + (item.ruta || '/')} ↗</a>
      </div>
      <button type="button" className="boton boton-primario" onClick={() => irVista('tecnico', item.ruta)}>
        Auditar la página y ver campos técnicos →
      </button>
    </>}
    {item.clase === 'analytics' && <button type="button" className="boton boton-primario" onClick={() => irVista('analytics')}>
      Abrir Analytics y revisar canales →
    </button>}
    {item.clase === 'conexiones' && <button type="button" className="boton boton-primario" onClick={() => irVista('conexiones')}>
      Revisar conexiones →
    </button>}
  </section>;
}
