import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePestanaHistorial } from '../../lib/pestanasHistorial';
import { useSesion } from '../../lib/sesion';
import { construirOportunidades, destinoOportunidadSEO, rutasParaAuditoriaSEO } from '../../lib/seoOportunidades';
import { clasificarOportunidadesSEO } from '../../lib/seoEstadoOportunidades';
import { ejecutarConReintentosSEO } from '../../lib/seoRecuperacion';
import SEORecomendaciones from './SEORecomendaciones';
import SEOInventarioOportunidades from './SEOInventarioOportunidades';
import SEODashboard from './SEODashboard';
import SEOImpacto from './SEOImpacto';
import BarraNavegacionSEO from '../../componentes/BarraNavegacionSEO';
import './SEO.css';
import { nombrePaisSEO, nombreDispositivoSEO } from '../../lib/seoEtiquetas';

const SECCIONES = [
  ['resumen', 'Dashboard'],
  ['consultas', 'Búsquedas'],
  ['analytics', 'Audiencia'],
  ['business', 'Google Maps'],
  ['oportunidades', 'Oportunidades'],
  ['seguimiento', 'Seguimiento'],
  ['tecnico', 'SEO técnico'],
  ['velocidad', 'PageSpeed'],
  ['tagmanager', 'Medición'],
  ['conexiones', 'Configuración']
];
const VISTAS_SEO = [...SECCIONES.map(([id]) => id), 'diagnostico'];
const numeral = n => Number(n ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const decimal = (n, digits = 1) => Number(n ?? 0).toLocaleString('es-CL', { maximumFractionDigits: digits });
const porcentaje = n => decimal(Number(n ?? 0) * 100) + '%';
const sitio = 'https://www.coproactiva.cl';

function KPI({ titulo, valor, nota, advertencia = false }) {
  return <div className="seo-kpi">
    <span className="seo-kpi-titulo">{titulo}</span>
    <strong className={advertencia ? 'seo-kpi-dato seo-atencion' : 'seo-kpi-dato'}>{valor ?? '—'}</strong>
    {nota && <span className="seo-kpi-nota">{nota}</span>}
  </div>;
}
function EstadoIntegracion({ nombre, disponible, mensaje, onClick, accion }) {
  const contenido = <>
    <span className={'seo-punto ' + (disponible ? 'correcto' : '')} aria-hidden="true" />
    <div className="seo-integracion-contenido">
      <strong>{nombre}</strong>
      <small>{disponible ? 'Conectado' : (mensaje || 'Pendiente de conectar')}</small>
      {onClick && <span className="seo-integracion-accion-texto">{accion || 'Ver configuración'} →</span>}
    </div>
  </>;
  const clase = 'seo-integracion ' + (disponible ? 'correcto' : 'pendiente');
  return onClick
    ? <button type="button" className={clase + ' seo-integracion-boton'} onClick={onClick}
        aria-label={nombre + ': ' + (disponible ? 'conectado' : 'pendiente') + '. ' + (accion || 'Ver configuración')}>
        {contenido}
      </button>
    : <div className={clase}>{contenido}</div>;
}
function Vacio({ titulo, descripcion }) {
  return <div className="seo-vacio"><strong>{titulo}</strong><p>{descripcion}</p></div>;
}
function Tabla({ columnas, filas, sinDatos = 'No hay registros en el período.', archivo, nota = 'Google puede limitar el detalle disponible.' }) {
  const [buscar, setBuscar] = useState('');
  const filtradas = filas.filter(f => Object.values(f).some(v => String(v ?? '').toLowerCase().includes(buscar.toLowerCase())));
  function csv() {
    const celda = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csvText = '\ufeff' + [columnas.map(c => celda(c.etiqueta)), ...filtradas.map(f => columnas.map(c => celda(c.texto ? c.texto(f[c.id], f) : f[c.id])))]
      .map(fila => fila.join(';')).join('\r\n');
    const objectURL = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = objectURL; a.download = archivo || 'coproactiva-seo.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  }
  return <div className="seo-tabla-contenedor">
    <div className="seo-tabla-acciones">
      <input aria-label="Filtrar registros" placeholder="Buscar en la tabla…" value={buscar} onChange={e => setBuscar(e.target.value)} />
      <button type="button" className="boton boton-secundario" onClick={csv} disabled={!filtradas.length}>Exportar CSV</button>
    </div>
    <div className="seo-tabla-scroll"><table className="seo-tabla"><thead><tr>{columnas.map(c => <th key={c.id}>{c.etiqueta}</th>)}</tr></thead>
      <tbody>{filtradas.map((f, i) => <tr key={i}>{columnas.map(c => <td key={c.id} className={c.id === 'clave' ? 'seo-texto-clave' : ''}>{c.texto ? c.texto(f[c.id], f) : f[c.id]}</td>)}</tr>)}</tbody>
    </table></div>
    {!filtradas.length && <p className="chico apagado" style={{ padding: 12 }}>{sinDatos}</p>}
    <span className="micro">{numeral(filtradas.length)} resultados visibles. {nota}</span>
  </div>;
}
function Evolucion({ filas, atributo = 'clicks', titulo = 'Evolución diaria' }) {
  const valores = filas.map(f => Number(atributo === 'sesiones' ? f.valores?.[0] : f[atributo]) || 0);
  const max = Math.max(1, ...valores), alto = 120, ancho = 600;
  const puntos = valores.map((v, i) => (20 + i * (ancho - 40) / Math.max(1, valores.length - 1)) + ',' +
    (alto - 18 - v * (alto - 36) / max)).join(' ');
  return <section className="seo-grafico">
    <div className="seo-fila-separada"><strong>{titulo}</strong><span className="micro">Máximo diario: {numeral(max)}</span></div>
    {valores.length ? <svg viewBox={'0 0 ' + ancho + ' ' + alto} preserveAspectRatio="none"
      role="img" aria-label={'Gráfico de ' + titulo} className="seo-linea">
      <line x1="20" x2="580" y1="102" y2="102" stroke="#d9d4cd" />
      <line x1="20" x2="580" y1="55" y2="55" stroke="#eae5de" strokeDasharray="4 4" />
      {valores.length > 1 ? <polyline points={puntos} fill="none" stroke="#d5863b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        : <circle cx="20" cy={102 - valores[0] * 84 / max} r="4" fill="#d5863b" />}
    </svg> : <Vacio titulo="Sin serie temporal" descripcion="Conecta la fuente para obtener el gráfico." />}
    {!!filas.length && <div className="seo-fila-separada micro"><span>{filas[0]?.clave}</span><span>{filas[filas.length - 1]?.clave}</span></div>}
  </section>;
}
const columnasBusqueda = etiqueta => [
  { id: 'clave', etiqueta }, { id: 'clicks', etiqueta: 'Clics hacia el sitio', texto: numeral },
  { id: 'impresiones', etiqueta: 'Apariciones en Google (impresiones)', texto: numeral },
  { id: 'ctr', etiqueta: 'Porcentaje de clics (CTR)', texto: porcentaje }, { id: 'posicion', etiqueta: 'Posición promedio en Google (posición media)', texto: n => decimal(n, 1) }
];
function Barra({ titulo, valor, max, detalle }) {
  return <div className="seo-barra-item"><div className="seo-fila-separada"><span>{titulo}</span><strong>{detalle || numeral(valor)}</strong></div>
    <div className="seo-barra-fondo"><span style={{ width: (100 * Number(valor || 0) / Math.max(1, max)) + '%' }} /></div></div>;
}
function SEOInterno() {
  const [vista, setVista] = usePestanaHistorial('vista', 'resumen', VISTAS_SEO);
  const [dias, setDias] = useState(28);
  const [estado, setEstado] = useState(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [avisoActualizacion, setAvisoActualizacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [accionActiva, setAccionActiva] = useState('');
  const [ruta, setRuta] = useState('/');
  const [auditoria, setAuditoria] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [velocidad, setVelocidad] = useState(null);
  const [dispositivo, setDispositivo] = useState('mobile');
  const [tagManager, setTagManager] = useState(null);
  const [tagError, setTagError] = useState('');
  const [perfilEmpresa, setPerfilEmpresa] = useState(null);
  const [perfilError, setPerfilError] = useState('');
  const [tiempoReal, setTiempoReal] = useState(null);
  const [auditoriaInicio, setAuditoriaInicio] = useState(null);
  const [accionSeleccionada, setAccionSeleccionada] = useState(null);
  const [propuestasSEO, setPropuestasSEO] = useState(null);
  const [auditoriasExtras, setAuditoriasExtras] = useState({});
  const [revisionPaginas, setRevisionPaginas] = useState({cargando:false,terminadas:0,error:''});

  const invocar = useCallback((accion, extras = {}) => ejecutarConReintentosSEO(async () => {
    const { data, error: err } = await supabase.functions.invoke('seo-analitica', { body: { accion, ...extras } });
    if (err) {
      const status = Number(err.context?.status || 0);
      let detalle = err.message || 'No se pudo consultar el servicio SEO.';
      if (err.context?.json && status !== 503) {
        try { const json = await err.context.json(); detalle = json.error || detalle; } catch { /* respuesta vacía */ }
      }
      const problema = new Error(status === 503
        ? 'El servicio SEO está temporalmente ocupado. Vuelve a actualizar.'
        : detalle);
      problema.status = status;
      throw problema;
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }), []);

  const cargarHistorialSEO = useCallback(async () => {
    try {
      const {data,error:err} = await supabase.functions.invoke('seo-propuestas',{body:{accion:'listar'}});
      if(err || data?.error || !Array.isArray(data?.propuestas)) throw Error('No se pudo sincronizar el historial SEO.');
      setPropuestasSEO(data.propuestas);
    } catch {
      // Sin historial NO volver a afirmar que una recomendación es nueva.
      setPropuestasSEO(null);
    }
  }, []);

  const recargar = useCallback(async (manual = false) => {
    setCargando(true); setError(''); setAvisoActualizacion(null);
    try {
      const resultados = await Promise.allSettled([
        invocar('estado'), invocar('resumen', { dias }),
        invocar('tag-manager'), invocar('auditoria', { ruta: '/' }),
        invocar('business-profile', { dias }), invocar('ga4-tiempo-real'),
        cargarHistorialSEO()
      ]);
      // Cada fuente se recupera independientemente. Un 503 no debe vaciar
      // métricas ya visibles ni impedir cargar otros paneles.
      const estadoOk = resultados[0].status === 'fulfilled';
      const resumenOk = resultados[1].status === 'fulfilled';
      const e = estadoOk ? resultados[0].value : null;
      const resumen = resumenOk ? resultados[1].value : null;
      if (estadoOk) setEstado(e);
      if (resumenOk) setDatos(resumen);
      if (!resumenOk) {
        setError('No se pudieron actualizar los datos de Google. Intenta nuevamente.');
      } else if (!estadoOk) {
        setError('No se pudo actualizar el estado de las conexiones. Las métricas siguen disponibles.');
      }
      if (resultados[2].status === 'fulfilled') {
        setTagManager(resultados[2].value); setTagError('');
      } else setTagError('La verificación de Tag Manager no pudo completarse.');
      if (resultados[3].status === 'fulfilled') setAuditoriaInicio(resultados[3].value);
      else setAuditoriaInicio(null);
      if (resultados[4].status === 'fulfilled') {
        setPerfilEmpresa(resultados[4].value); setPerfilError('');
      } else {
        setPerfilEmpresa(null); setPerfilError('No se pudo consultar Google Business Profile.');
      }
      if (resultados[5].status === 'fulfilled') setTiempoReal(resultados[5].value);
      else setTiempoReal({disponible:false, error:'No se pudo consultar GA4 en tiempo real.'});
      if (manual) {
        const sinConexion = [
          !resumen?.searchConsole?.disponible && 'Search Console',
          !resumen?.analytics?.disponible && 'Analytics 4',
          !(resultados[4]?.status === 'fulfilled' && resultados[4].value?.disponible) && 'Business Profile',
          !(resultados[2]?.status === 'fulfilled' && resultados[2].value?.version?.conectado) && 'Tag Manager API'
        ].filter(Boolean);
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setAvisoActualizacion(!resumenOk
          ? { tipo: 'error', texto: 'La consulta principal no respondió. Puedes reintentar sin perder los datos previos.' }
          : sinConexion.length
            ? { tipo: 'pendiente', texto: 'Actualización a las ' + hora + '. Fuentes pendientes: ' + sinConexion.join(', ') + '.' }
            : { tipo: 'correcto', texto: 'Datos de Google actualizados a las ' + hora + '.' });
      }
    } catch (err) {
      setError(err.message || 'No fue posible recuperar las métricas.');
      if (manual) setAvisoActualizacion({ tipo: 'error', texto: 'No se pudo actualizar. Revisa el detalle del error.' });
    } finally { setCargando(false); }
  }, [dias, invocar, cargarHistorialSEO]);

  useEffect(() => { recargar(false); }, [recargar]);

  // Únicamente el endpoint de GA4 Realtime tiene sentido con actualización cada minuto.
  // Search Console y Business Profile publican series procesadas con otro ritmo.
  useEffect(() => {
    if (!datos?.analytics?.disponible) return;
    let activo = true;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      invocar('ga4-tiempo-real').then(data => { if (activo) setTiempoReal(data); })
        .catch(() => { if (activo) setTiempoReal({ disponible:false, error:'Sin lectura reciente de GA4.' }); });
    }, 60000);
    return () => { activo = false; clearInterval(timer); };
  }, [datos?.analytics?.disponible, invocar]);

  async function ejecutar(accion) {
    setAccionActiva(accion); setError('');
    try {
      const resultado = await invocar(accion, { ruta, dispositivo });
      if (accion === 'auditoria') setAuditoria(resultado);
      if (accion === 'indexacion') setInspeccion(resultado);
      if (accion === 'velocidad') setVelocidad(resultado);
    } catch (err) { setError(err.message || 'Error al consultar el servicio.'); }
    finally { setAccionActiva(''); }
  }

  const sc = datos?.searchConsole;
  const ga = datos?.analytics;
  const alternativas = useMemo(() => {
    const caminos = ['/', '/blog/', '/servicios/administracion-de-condominios/', '/servicios/auditoria-de-condominios/'];
    (sc?.paginas || []).forEach(x => {
      try { const p = new URL(x.clave).pathname; if (!caminos.includes(p)) caminos.push(p); } catch { /* URL externa */ }
    });
    return caminos.slice(0, 80);
  }, [sc]);
  const lista = useMemo(() => {
    const portada = auditoriaInicio || (auditoria?.url === sitio+'/' ? auditoria : null);
    const generadas = construirOportunidades(sc, portada, ga);
    // Además de la portada, incorporar hallazgos de cada URL auditada.
    for (const resultado of Object.values(auditoriasExtras)) {
      generadas.push(...construirOportunidades(null, resultado, null));
    }
    return generadas.filter((o,indice,todas)=>todas.findIndex(x=>x.id===o.id)===indice);
  }, [sc, auditoriaInicio, auditoria, ga, auditoriasExtras]);
  const rutasPendientesSEO = useMemo(() =>
    rutasParaAuditoriaSEO(sc, Object.keys(auditoriasExtras), 5),
    [sc, auditoriasExtras]);
  const paginasRevisadasSEO = (auditoriaInicio?.status===200 ? 1 : 0) +
    Object.keys(auditoriasExtras).length;
  async function analizarMasPaginas() {
    if (revisionPaginas.cargando || !rutasPendientesSEO.length) return;
    const pendientes=[...rutasPendientesSEO];
    setRevisionPaginas({cargando:true,terminadas:0,error:''});
    let fallidas=0;
    for (const rutaSiguiente of pendientes) {
      try {
        const respuesta=await invocar('auditoria',{ruta:rutaSiguiente});
        if (!respuesta?.url || !Array.isArray(respuesta.problemas)) throw Error('Auditoría incompleta');
        setAuditoriasExtras(anteriores=>({...anteriores,[rutaSiguiente]:respuesta}));
      } catch { fallidas++; }
      setRevisionPaginas({cargando:true,terminadas:pendientes.indexOf(rutaSiguiente)+1,error:''});
    }
    setRevisionPaginas({cargando:false,terminadas:pendientes.length,
      error:fallidas ? fallidas+' páginas no pudieron revisarse. Puedes reintentar.' : ''});
  }
  const gestionSEO = useMemo(() => clasificarOportunidadesSEO(lista, propuestasSEO),
    [lista, propuestasSEO]);
  const consultasParaDiagnostico = useMemo(() => {
    if(accionSeleccionada?.clase === 'consulta') return [accionSeleccionada];
    return (gestionSEO.nuevas || []).filter(x=>x.clase === 'consulta');
  }, [accionSeleccionada, gestionSEO]);
  const sesionesOrganicas = ga?.canales?.find(c => c.clave?.toLowerCase() === 'organic search')?.valores?.[0];
  const eventoLeadGA4 = ga?.eventos?.find(e => e.clave === 'generate_lead');
  const leadsMedidos = eventoLeadGA4?.valores?.[1];
  const perfilClicks = perfilEmpresa?.disponible ? perfilEmpresa.resumen?.clicsWeb : null;
  const variacionClics = sc?.disponible && sc?.anterior?.clics > 0
    ? ((sc.totales.clics - sc.anterior.clics) / sc.anterior.clics) * 100 : null;
  async function abrirAccion(item) {
    const destino = destinoOportunidadSEO(item);
    setAccionSeleccionada(item);
    const rutaDetectada = item?.ruta || '/';
    if (destino === 'tecnico') {
      setRuta(rutaDetectada);
      setAuditoria(null);
      setInspeccion(null);
      setAccionActiva('auditoria');
      irVista('tecnico');
      // La incidencia técnica abre SU página y hace una nueva auditoría del HTML.
      // No se confunde con una consulta de Search Console ni con un PR existente.
      try {
        const resultado = await invocar('auditoria', { ruta: rutaDetectada });
        setAuditoria(resultado);
      } catch (err) {
        setError(err.message || 'No fue posible verificar esta incidencia.');
      } finally {
        setAccionActiva('');
      }
      return;
    }
    irVista(destino === 'oportunidades' ? 'diagnostico' : destino);
  }
  function irVista(vistaNueva, rutaNueva) {
    if (rutaNueva) setRuta(rutaNueva);
    setVista(vistaNueva);
    if (vistaNueva === 'resumen') void cargarHistorialSEO();
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 899px)').matches) {
        document.querySelector('.seo-cuerpo')?.scrollIntoView({
          behavior: 'smooth', block: 'start'
        });
        return;
      }
      const nav = document.getElementById('seo-navegacion');
      nav?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nav?.querySelector('[aria-selected="true"]')?.scrollIntoView({
        behavior: 'smooth', block: 'nearest', inline: 'center'
      });
    });
  }
  return <div className="pantalla seo-pantalla modulo-unificado">
    <header className="encabezado seo-cabecera modulo-cabecera">
      <div><span className="seleccion-area-etiqueta">Marketing · posicionamiento orgánico</span>
        <h1 className="h3">SEO y Analítica</h1>
        <p className="chico apagado">Resultados, audiencia, posicionamiento y decisiones para coproactiva.cl.</p>
      </div>
      <div className="seo-cabecera-acciones">
        <select aria-label="Período de análisis" value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={7}>7 días</option><option value={28}>28 días</option><option value={90}>90 días</option>
        </select>
        <button className="boton boton-secundario" type="button" onClick={() => recargar(true)} disabled={cargando}>
          {cargando ? 'Consultando…' : 'Actualizar'}
        </button>
        <button className="boton boton-texto seo-boton-configuracion" type="button" aria-label="Configuración SEO" title="Configuración SEO" onClick={() => irVista('conexiones')}>
          <span aria-hidden="true">⚙</span> <span className="seo-ajustes-etiqueta">Configuración</span>
        </button>
      </div>
    </header>

    <div className="cuerpo seo-cuerpo modulo-contenido">
      <nav id="seo-navegacion" className="seo-pestanas ui-pestanas" aria-label="Secciones SEO" role="tablist">{SECCIONES.map(([id, label]) =>
        <button key={id} type="button" role="tab" aria-selected={vista === id}
          className={vista === id ? 'activo' : ''}
          onClick={e => {
            setVista(id);
            if (id === 'resumen') void cargarHistorialSEO();
            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }}>{label}</button>
      )}</nav>
      {!!error && <div className="aviso aviso-critico seo-error-recuperable" role="alert">
        <span>{error}</span>
        <button type="button" className="boton boton-secundario"
          disabled={cargando} onClick={()=>recargar(true)}>Reintentar</button>
      </div>}
      {avisoActualizacion && <div className={'seo-aviso seo-aviso-' + avisoActualizacion.tipo + ' seo-aviso-sincronizacion'} role="status">
        <span>{avisoActualizacion.texto}</span>
        {avisoActualizacion.tipo === 'pendiente' &&
          <button type="button" className="boton boton-secundario" onClick={() => setVista('conexiones')}>
            Ver configuración →
          </button>}
      </div>}
      {!estado && cargando && <p className="chico apagado">Cargando fuentes e indicadores…</p>}

      {vista === 'resumen' && !datos && !cargando
        ? <div className="seo-vacio" role="status">
            <strong>No hay métricas disponibles en este momento.</strong>
            <p>El servicio de Google puede estar temporalmente ocupado. Reintenta para consultar las cifras actuales.</p>
            <button type="button" className="boton boton-primario"
              onClick={()=>recargar(true)}>Volver a consultar</button>
          </div>
        : null}
      {vista === 'resumen' && (datos || cargando) && <SEODashboard
        sc={sc} ga={ga} perfilEmpresa={perfilEmpresa} tiempoReal={tiempoReal}
        auditoriaInicio={auditoriaInicio} lista={lista} gestionSEO={gestionSEO}
        dias={dias} datosHasta={sc?.hasta} consultadoEn={estado?.consultadoEn}
        paginasRevisadas={paginasRevisadasSEO} paginasPendientes={rutasPendientesSEO.length}
        revisandoPaginas={revisionPaginas.cargando} onRevisarPaginas={analizarMasPaginas}
        onNavigate={irVista} onAnalyze={abrirAccion} />}

      {vista === 'consultas' && <section>
        <h2 className="h4">Cómo aparece tu sitio en las búsquedas de Google</h2>
        {!sc?.disponible ? <Vacio titulo="Falta conectar Search Console" descripcion={sc?.error || 'Sin datos.'} /> : <>
          <div className="seo-kpis">
            <KPI titulo="Clics desde Google hacia el sitio" valor={numeral(sc.totales?.clics)} nota={'Período previo: ' + numeral(sc.anterior?.clics)} />
            <KPI titulo="Apariciones del sitio en Google (impresiones)" valor={numeral(sc.totales?.impresiones)} nota={'Período previo: ' + numeral(sc.anterior?.impresiones)} />
            <KPI titulo="Porcentaje de apariciones que generan clics (CTR)" valor={porcentaje(sc.totales?.ctr)} nota="Clics divididos por apariciones." />
            <KPI titulo="Posición promedio del sitio en Google (posición media)" valor={decimal(sc.totales?.posicion)} nota="Un número menor indica una posición más alta en los resultados." />
          </div>
          <h3 className="seo-subtitulo">Qué buscaron para que apareciéramos en Google (consultas)</h3>
          <p className="chico apagado">Estas búsquedas mostraron tu sitio en Google. Los clics indican cuántas veces entraron desde esos resultados.</p>
          <Tabla columnas={columnasBusqueda('Búsqueda realizada (consulta)')} nota="Google no muestra todas las búsquedas por motivos de privacidad." filas={sc.consultas || []} archivo="coproactiva-search-console-consultas.csv" />
          <h3 className="seo-subtitulo">Páginas del sitio que aparecen en Google</h3>
          <p className="chico apagado">Direcciones de tu sitio mostradas en los resultados y los clics que recibió cada una.</p>
          <Tabla columnas={columnasBusqueda('Dirección de la página del sitio')} filas={sc.paginas || []} archivo="coproactiva-search-console-paginas.csv" />
          <div className="seo-dos-columnas">
            <div className="tarjeta seo-mini-card"><h3 className="h4">Clics desde Google por dispositivo</h3>
              {(sc.dispositivos || []).map(d => <Barra key={d.clave} titulo={nombreDispositivoSEO(d.clave)} detalle={numeral(d.clicks) + (Number(d.clicks) === 1 ? ' clic' : ' clics')} valor={d.clicks} max={Math.max(...sc.dispositivos.map(x => x.clicks),1)} />)}
            </div>
            <div className="tarjeta seo-mini-card"><h3 className="h4">Clics desde Google por país</h3>
              <p className="chico apagado">País desde donde se realizó la búsqueda.</p>
              {(sc.paises || []).slice(0, 8).map(d => <Barra key={d.clave} titulo={nombrePaisSEO(d.clave)} detalle={numeral(d.clicks) + (Number(d.clicks) === 1 ? ' clic' : ' clics')} valor={d.clicks} max={Math.max(...sc.paises.map(x => x.clicks),1)} />)}
            </div>
          </div>
          <p className="micro">{sc.nota}</p>
        </>}
      </section>}

      {vista === 'analytics' && <section>
        <h2 className="h4">Audiencia y comportamiento · GA4</h2>
        <div className="tarjeta seo-mini-card" style={{marginBottom:16}}>
          <div className="seo-fila-separada">
            <h3 className="h4" style={{margin:0}}>Actividad reciente · últimos 30 minutos</h3>
            <span className="micro">{tiempoReal?.disponible ? new Date(tiempoReal.consultadoEn).toLocaleTimeString('es-CL') : 'Sin conexión'}</span>
          </div>
          {tiempoReal?.disponible ? <>
            <div className="seo-kpis" style={{marginTop:15}}>
              <KPI titulo="Usuarios activos recientes" valor={numeral(tiempoReal.usuariosActivos)} />
              <KPI titulo="Eventos últimos 30 min" valor={numeral(tiempoReal.eventos)} />
            </div>
            <Tabla columnas={[{id:'nombre',etiqueta:'Evento'},{id:'cantidad',etiqueta:'Repeticiones',texto:numeral}]}
              filas={tiempoReal.eventosPorNombre || []} archivo="coproactiva-ga4-tiempo-real.csv" />
            <p className="micro">Consulta directa a Google Analytics Realtime API. Esta sección se refresca cada 60 segundos con la pestaña abierta.</p>
          </> : <p className="chico apagado">{tiempoReal?.error || 'Requiere conexión GA4 autorizada.'}</p>}
        </div>

        {!ga?.disponible ? <Vacio titulo="Falta conectar Google Analytics 4" descripcion={ga?.error || 'Sin datos.'} /> : <>
          <div className="seo-kpis">
            <KPI titulo="Usuarios" valor={numeral(ga.totales?.usuarios)} />
            <KPI titulo="Sesiones" valor={numeral(ga.totales?.sesiones)} />
            <KPI titulo="Engagement" valor={porcentaje(ga.totales?.engagement)} />
            <KPI titulo="Eventos clave" valor={numeral(ga.totales?.eventosClave)} />
          </div>
          <h3 className="seo-subtitulo">Adquisición de tráfico</h3>
          <div className="tarjeta seo-mini-card">{(ga.canales || []).map(x =>
            <Barra key={x.clave} titulo={x.clave} valor={x.valores?.[0] || 0} max={Math.max(...(ga.canales || []).map(c => c.valores?.[0] || 0),1)} detalle={numeral(x.valores?.[0]) + ' sesiones'} />)}
          </div>
          <h3 className="seo-subtitulo">Páginas vistas</h3>
          <Tabla columnas={[{id:'clave',etiqueta:'Ruta'},{id:'vistas',etiqueta:'Vistas',texto:numeral},{id:'usuarios',etiqueta:'Usuarios',texto:numeral}]}
            filas={(ga.paginas || []).map(p => ({ clave: p.clave, vistas: p.valores?.[0], usuarios: p.valores?.[1] }))} archivo="coproactiva-ga4-paginas.csv" />
          <h3 className="seo-subtitulo">Eventos registrados</h3>
          <Tabla columnas={[{id:'clave',etiqueta:'Evento'},{id:'cantidad',etiqueta:'Repeticiones',texto:numeral}]}
            filas={(ga.eventos || []).map(p => ({ clave:p.clave, cantidad:p.valores?.[0] }))} archivo="coproactiva-ga4-eventos.csv" />
          <p className="micro">Un contacto comercial se debe configurar como evento clave específico (por ejemplo, generate_lead); no todo evento es una conversión.</p>
        </>}
      </section>}

      {(vista === 'tecnico' || vista === 'velocidad') && <section>
        <h2 className="h4">{vista === 'tecnico' ? 'Auditoría técnica e indexación' : 'PageSpeed y experiencia web'}</h2>
        <p className="chico apagado">Analiza páginas de www.coproactiva.cl. El servidor verifica el dominio y no acepta URLs externas.</p>
        {vista === 'tecnico' && accionSeleccionada?.clase === 'tecnico' && (
          <div className="seo-hallazgo-dirigido" role="region" aria-label="Incidencia SEO técnica seleccionada">
            <span className="seo-hallazgo-dirigido-categoria">Auditoría de HTML · Incidencia seleccionada</span>
            <h3>{accionSeleccionada.titulo}</h3>
            <p><strong>Página:</strong> {accionSeleccionada.ruta || '/'}</p>
            {accionActiva === 'auditoria' && <p>Verificando el HTML publicado…</p>}
            {auditoria && <div className="seo-hallazgo-dirigido-resultado">
              {(() => {
                const tituloAlerta = /t[ií]tulo (extenso|muy largo)/i.test(accionSeleccionada.titulo);
                const vigente = (auditoria.problemas || []).some(problema =>
                  tituloAlerta
                    ? /t[ií]tulo (extenso|muy largo)/i.test(problema.texto)
                    : problema.texto === accionSeleccionada.titulo
                );
                return <strong className={vigente?'seo-hallazgo-vigente':'seo-hallazgo-resuelto'}>
                  {vigente?'Incidencia confirmada en el HTML actual':'La incidencia anterior ya no se detecta'}
                </strong>;
              })()}
              <span><strong>Título actual:</strong> {auditoria.titulo || 'Sin título'}</span>
              <span><strong>Longitud:</strong> {(auditoria.titulo || '').length} caracteres.</span>
              <small>La longitud por sí sola no constituye una penalización SEO.
                Si un hallazgo ya no aparece, no corresponde recomendar otra modificación.
                Los resultados comerciales se comprueban en Seguimiento.</small>
            </div>}
            <p className="seo-hallazgo-dirigido-ayuda">
              Se revisó automáticamente el HTML de {accionSeleccionada.ruta || '/'}.
              Para el detalle técnico completo, consulta los resultados de la auditoría más abajo.
            </p>
          </div>
        )}
        <div className="seo-herramientas">
          <label>URL del sitio
            <select value={alternativas.includes(ruta) ? ruta : '__otra'} onChange={e => { if (e.target.value !== '__otra') { setRuta(e.target.value); setInspeccion(null); setVelocidad(null); setAuditoria(null); } }}>
              {alternativas.map(p => <option key={p} value={p}>{p}</option>)}<option value="__otra">Otra URL (editar)</option>
            </select>
          </label>
          <label>Ruta de la página
            <input type="text" value={ruta} onChange={e => { setRuta(e.target.value); setInspeccion(null); setVelocidad(null); setAuditoria(null); }} placeholder="/blog/" />
          </label>
          {vista === 'velocidad' && <label>Dispositivo
            <select value={dispositivo} onChange={e => setDispositivo(e.target.value)}>
              <option value="mobile">Móvil</option><option value="desktop">Escritorio</option>
            </select></label>}
        </div>
        <div className="seo-botones">
          {vista === 'tecnico' ? <>
            <button className="boton boton-primario" disabled={!!accionActiva} onClick={() => ejecutar('auditoria')}>{accionActiva === 'auditoria' ? 'Revisando…' : 'Analizar página'}</button>
            <button className="boton boton-secundario" disabled={!!accionActiva} onClick={() => ejecutar('indexacion')}>{accionActiva === 'indexacion' ? 'Consultando Google…' : 'Consultar indexación Google'}</button>
          </> : <button className="boton boton-primario" disabled={!!accionActiva} onClick={() => ejecutar('velocidad')}>{accionActiva === 'velocidad' ? 'Analizando…' : 'Medir con PageSpeed'}</button>}
        </div>
        {vista === 'tecnico' && <>
          {auditoria ? <>
            <div className="seo-kpis"><KPI titulo="HTTP" valor={auditoria.status} />
              <KPI titulo="H1" valor={auditoria.h1s?.length} />
              <KPI titulo="URLs en sitemap" valor={numeral(auditoria.sitemap?.urls?.length)} />
              <KPI titulo="Problemas detectados" valor={numeral(auditoria.problemas?.length)} advertencia={!!auditoria.problemas?.length} /></div>
            <div className="tarjeta seo-mini-card seo-audit">
              <dl>
                <div><dt>Título SEO</dt><dd>{auditoria.titulo || 'Falta'}</dd></div>
                <div><dt>Meta descripción</dt><dd>{auditoria.description || 'Falta'}</dd></div>
                <div><dt>Canonical</dt><dd>{auditoria.canonical || 'Falta'}</dd></div>
                <div><dt>Robots meta</dt><dd>{auditoria.robotsMeta || 'Sin directiva'}</dd></div>
                <div><dt>H1</dt><dd>{(auditoria.h1s || []).join(' · ') || 'Falta'}</dd></div>
                <div><dt>JSON-LD</dt><dd>{auditoria.jsonLd} bloques</dd></div>
                <div><dt>robots.txt</dt><dd>HTTP {auditoria.robots?.status}</dd></div>
                <div><dt>sitemap.xml</dt><dd>HTTP {auditoria.sitemap?.status}</dd></div>
              </dl>
            </div>
            <h3 className="seo-subtitulo">Observaciones</h3>
            {(auditoria.problemas || []).length ? auditoria.problemas.map((p,i) =>
              <div className="seo-hallazgo" key={i}><span className={'seo-prioridad ' + (p.nivel === 'alto' ? 'alta' : 'media')}>{p.nivel}</span>{p.texto}</div>)
              : <p className="chico apagado">Las comprobaciones implementadas no detectaron problemas para esta URL; no constituye una auditoría SEO exhaustiva.</p>}
          </> : <Vacio titulo="Selecciona una página y analiza" descripcion="Se revisarán título, metadatos, encabezados, canonical, robots y sitemap del HTML recibido." />}
          {inspeccion && <div className="tarjeta seo-mini-card seo-audit">
            <h3 className="h4">Estado reportado por el índice de Google</h3>
            <dl><div><dt>Cobertura</dt><dd>{inspeccion.indexacion?.coverageState || 'Sin dato'}</dd></div>
              <div><dt>Indexación</dt><dd>{inspeccion.indexacion?.indexingState || 'Sin dato'}</dd></div>
              <div><dt>Último rastreo</dt><dd>{inspeccion.indexacion?.lastCrawlTime || 'Sin dato'}</dd></div>
              <div><dt>Canonical elegida por Google</dt><dd>{inspeccion.indexacion?.googleCanonical || 'Sin dato'}</dd></div></dl>
            {!!inspeccion.enlace && <a href={inspeccion.enlace} target="_blank" rel="noopener noreferrer">Abrir en Search Console ↗</a>}
            <p className="micro">Esta API consulta la versión conocida por Google, no hace una prueba de indexabilidad en vivo.</p>
          </div>}
        </>}
        {vista === 'velocidad' && (velocidad ? <>
          <div className="seo-kpis">
            <KPI titulo="Rendimiento" valor={velocidad.puntajes?.rendimiento + '/100'} />
            <KPI titulo="SEO Lighthouse" valor={velocidad.puntajes?.seo + '/100'} />
            <KPI titulo="Accesibilidad" valor={velocidad.puntajes?.accesibilidad + '/100'} />
            <KPI titulo="Buenas prácticas" valor={velocidad.puntajes?.buenasPracticas + '/100'} />
          </div>
          <div className="seo-kpis">
            <KPI titulo="LCP (laboratorio)" valor={velocidad.lcp} />
            <KPI titulo="CLS (laboratorio)" valor={velocidad.cls} />
            <KPI titulo="FCP (laboratorio)" valor={velocidad.fcp} />
            <KPI titulo="INP (campo, si existe)" valor={velocidad.inp == null ? 'Sin datos' : velocidad.inp + ' ms'} />
          </div>
          <h3 className="seo-subtitulo">Oportunidades técnicas</h3>
          {(velocidad.sugerencias || []).map((x,i) => <div key={i} className="seo-hallazgo">{x.titulo} · ahorro estimado: {numeral(x.ahorroMs)} ms</div>)}
          <p className="micro">Lighthouse entrega mediciones de laboratorio. INP sólo aparece cuando Google dispone de suficientes datos reales.</p>
        </> : <Vacio titulo="Medir experiencia de página" descripcion="PageSpeed evalúa rendimiento, SEO, accesibilidad y buenas prácticas del dispositivo seleccionado." />)}
      </section>}

      {vista === 'oportunidades' && <SEOInventarioOportunidades
        gestionSEO={gestionSEO} lista={lista} sc={sc} dias={dias}
        paginasRevisadas={paginasRevisadasSEO} paginasPendientes={rutasPendientesSEO.length}
        revisionPaginas={revisionPaginas} onRevisarPaginas={analizarMasPaginas}
        onAnalizar={abrirAccion}
        onVerSeguimiento={()=>irVista('seguimiento')}
        onVerBusquedas={()=>irVista('consultas')}/>}

      {vista === 'diagnostico' && <>
        <button type="button" className="boton boton-texto seo-volver-oportunidades"
          onClick={()=>irVista('oportunidades')}>← Volver a todas las oportunidades</button>
        <SEORecomendaciones lista={consultasParaDiagnostico}
          invocar={invocar} dias={dias} irVista={irVista}
          consultaPrioritaria={accionSeleccionada?.consulta || null}/>
      </>}

      {vista === 'seguimiento' && <SEOImpacto invocar={invocar} />}

      {vista === 'business' && <section>
        <div className="seo-titulo-seccion">
          <div>
            <h2 className="h4">Google Business Profile · métricas oficiales</h2>
            <p className="chico apagado">Actividad de la ficha de Coproactiva en Google Maps y la Búsqueda. Consultado directamente con Business Profile Performance API.</p>
          </div>
          <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer">Administrar perfil ↗</a>
        </div>
        {perfilError && <div className="seo-aviso seo-aviso-error">{perfilError}</div>}
        {!perfilEmpresa?.disponible ? <div className="seo-vacio">
          <strong>Google Business Profile pendiente de autorización</strong>
          <p>{perfilEmpresa?.error || 'Aún no hay conexión autorizada con el perfil comercial.'}</p>
          <button type="button" className="boton boton-secundario" style={{marginTop:12}} onClick={() => setVista('conexiones')}>
            Ver instrucciones de conexión →
          </button>
        </div> : <>
          <p className="micro">Última consulta: {new Date(perfilEmpresa.consultadoEn).toLocaleString('es-CL')} · datos diarios del {perfilEmpresa.inicio} al {perfilEmpresa.fin}</p>
          <div className="seo-kpis">
            <KPI titulo="Impresiones en Búsqueda" valor={numeral(perfilEmpresa.resumen?.impresionesBusqueda)} nota="Desktop y móvil" />
            <KPI titulo="Impresiones en Google Maps" valor={numeral(perfilEmpresa.resumen?.impresionesMaps)} nota="Desktop y móvil" />
            <KPI titulo="Clics hacia el sitio" valor={numeral(perfilEmpresa.resumen?.clicsWeb)} nota="Desde el perfil de empresa" />
            <KPI titulo="Clics de llamada" valor={numeral(perfilEmpresa.resumen?.clicsTelefono)} nota="No necesariamente llamadas atendidas" />
            <KPI titulo="Solicitudes de indicaciones" valor={numeral(perfilEmpresa.resumen?.indicaciones)} nota="Rutas solicitadas" />
          </div>
          <h3 className="seo-subtitulo">Indicadores por fecha</h3>
          <Tabla columnas={[
            {id:'fecha',etiqueta:'Día'},
            {id:'busqueda',etiqueta:'Búsqueda',texto:numeral},
            {id:'maps',etiqueta:'Maps',texto:numeral},
            {id:'web',etiqueta:'Clics web',texto:numeral},
            {id:'llamadas',etiqueta:'Clics de llamadas',texto:numeral},
            {id:'direcciones',etiqueta:'Indicaciones',texto:numeral}
          ]} filas={(() => {
            const datos = perfilEmpresa.metricas || {};
            const porFecha = {};
            const cols = {
              BUSINESS_IMPRESSIONS_DESKTOP_SEARCH:'busqueda', BUSINESS_IMPRESSIONS_MOBILE_SEARCH:'busqueda',
              BUSINESS_IMPRESSIONS_DESKTOP_MAPS:'maps', BUSINESS_IMPRESSIONS_MOBILE_MAPS:'maps',
              WEBSITE_CLICKS:'web', CALL_CLICKS:'llamadas', BUSINESS_DIRECTION_REQUESTS:'direcciones'
            };
            Object.entries(cols).forEach(([metric,col]) => (datos[metric]?.serie || []).forEach(p => {
              if(!porFecha[p.fecha]) porFecha[p.fecha] = {fecha:p.fecha,busqueda:0,maps:0,web:0,llamadas:0,direcciones:0};
              porFecha[p.fecha][col] += p.valor;
            }));
            return Object.values(porFecha).sort((a,b) => b.fecha.localeCompare(a.fecha));
          })()} archivo="coproactiva-google-business-profile-diario.csv" />
          <h3 className="seo-subtitulo">Palabras clave que encuentran el negocio</h3>
          <p className="chico apagado">Google ofrece esta métrica agregada por mes, aunque se consulte al momento.</p>
          <Tabla columnas={[
            {id:'nombre',etiqueta:'Palabra de búsqueda'},
            {id:'impresiones',etiqueta:'Impresiones',texto:(n,row) => n == null ? (row.umbral == null ? 'Sin dato' : 'Menos de ' + numeral(row.umbral)) : numeral(n)}
          ]} filas={perfilEmpresa.palabras || []} archivo="coproactiva-google-business-profile-busquedas.csv" />
          {perfilEmpresa.errorPalabras && <p className="micro">{perfilEmpresa.errorPalabras}</p>}
          <p className="micro">{perfilEmpresa.nota}</p>
        </>}
      </section>}

      {vista === 'tagmanager' && <section>
        <h2 className="h4">Google Tag Manager · seguimiento y conversiones</h2>
        <p className="chico apagado">Se comprueba el código público del sitio. La configuración de etiquetas, activadores y versiones publicadas requiere acceso al contenedor de Google; detectar código no demuestra recepción de eventos.</p>
        <div className="seo-kpis">
          <KPI titulo="Contenedor GTM" valor={tagManager?.codigoGtm ? 'Detectado' : 'Sin confirmar'}
            nota={tagManager?.contenedores?.join(', ') || 'No identificado'} />
          <KPI titulo="Data Layer" valor={tagManager?.dataLayer ? 'Detectada' : 'Sin confirmar'} nota="Señal en código" />
          <KPI titulo="Consent Mode" valor={tagManager?.consentimiento ? 'Código detectado' : 'Sin confirmar'} nota="Confirmar señales en navegador" />
          <KPI titulo="generate_lead" valor={tagManager?.eventoLeadEnCodigo ? 'En código' : 'Sin confirmar'}
            nota={eventoLeadGA4 ? 'GA4 recibió ' + numeral(eventoLeadGA4.valores?.[0]) + ' eventos en este período' : 'Recepción en GA4 no verificada'} />
        </div>
        {tagError && <div className="seo-aviso seo-aviso-pendiente">{tagError}</div>}
        <div className="tarjeta seo-mini-card">
          <h3 className="h4">Contenedor publicado · GTM API</h3>
          {tagManager?.version?.conectado ? <>
            <p><strong>Versión publicada: {tagManager.version.versionPublicada}</strong> · {tagManager.version.nombreVersion}.
              {' '}{numeral(tagManager.version.cantidadEtiquetas)} etiquetas y {numeral(tagManager.version.cantidadActivadores)} activadores.</p>
            <Tabla columnas={[{ id: 'nombre', etiqueta: 'Etiqueta publicada' }, { id: 'tipo', etiqueta: 'Tipo' }]}
              filas={tagManager.version.etiquetas || []} archivo="coproactiva-gtm-etiquetas.csv" />
            <p className="micro">{tagManager.version.nota}</p>
          </> : <p className="chico apagado">{tagManager?.version?.detalle ||
            'Para leer las etiquetas y versiones publicadas se necesita autorizar GTM_CONTAINER_PATH y permisos de solo lectura en Google Tag Manager.'}</p>}
        </div>
        <div className="seo-dos-columnas">
          <div className="tarjeta seo-mini-card">
            <h3 className="h4">Qué está comprobado</h3>
            <p>{tagManager?.codigoGtm ? 'El sitio incluye el contenedor ' + tagManager.contenedores.join(', ') + '.' : 'Todavía no se ha podido confirmar un contenedor GTM.'}</p>
            <p>{tagManager?.eventoLeadEnCodigo
              ? 'El código contiene generate_lead y la llamada del formulario tras una respuesta exitosa.'
              : 'No se pudo comprobar el evento generate_lead en los recursos analizados.'}</p>
            <p className="micro">Auditoría: {tagManager?.fecha ? new Date(tagManager.fecha).toLocaleString('es-CL') : 'Pendiente'}.</p>
          </div>
          <div className="tarjeta seo-mini-card">
            <h3 className="h4">Qué falta verificar</h3>
            <p>Activar <strong>Vista previa</strong> en GTM, enviar un formulario de prueba con autorización, comprobar el evento en Tag Assistant y luego en <strong>GA4 DebugView</strong>. Verificar que figure como evento clave solo si corresponde.</p>
            <div className="seo-botones">
              <a className="boton boton-secundario" href="https://tagmanager.google.com/" rel="noopener noreferrer" target="_blank">Abrir Tag Manager ↗</a>
              <a className="boton boton-secundario" href="https://analytics.google.com/" rel="noopener noreferrer" target="_blank">Abrir Analytics ↗</a>
            </div>
          </div>
        </div>
      </section>}

      {vista === 'conexiones' && <section>
        <div className="seo-fila-separada seo-configuracion-titulo">
          <div><h2 className="h4">Configuración de fuentes</h2>
            <p className="chico apagado">Permisos, integraciones y diagnóstico de conexiones. No afectan la visualización de las métricas ya disponibles.</p>
          </div>
          <button type="button" className="boton boton-secundario" onClick={() => irVista('resumen')}>← Volver al dashboard</button>
        </div>
        <div className="seo-integraciones">
          <EstadoIntegracion nombre="Search Console" disponible={!!sc?.disponible} mensaje={sc?.error} />
          <EstadoIntegracion nombre="Google Analytics 4" disponible={!!ga?.disponible} mensaje={ga?.error} />
          <EstadoIntegracion nombre="Google Business Profile" disponible={!!perfilEmpresa?.disponible}
            mensaje={perfilEmpresa?.error || perfilError || 'Falta autorizar acceso OAuth del perfil'} onClick={() => setVista('business')}
            accion="Ver panel del perfil" />
          <EstadoIntegracion nombre="Tag Manager API" disponible={!!tagManager?.version?.conectado}
            mensaje={tagManager?.version?.detalle || 'No hay acceso a la versión publicada'} onClick={() => setVista('tagmanager')}
            accion="Revisar etiquetas publicadas" />
          <EstadoIntegracion nombre="GA4 Realtime" disponible={!!tiempoReal?.disponible}
            mensaje={tiempoReal?.error || 'Sin lectura reciente'} onClick={() => setVista('analytics')}
            accion="Ver actividad de 30 minutos" />
        </div>
        <div className="tarjeta seo-mini-card">
          <h3 className="h4">Conectar con permisos de lectura</h3>
          <ol className="seo-pasos">
            <li>Crear una cuenta de servicio en <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud ↗</a> y habilitar Google Analytics Data API, Search Console API y URL Inspection API.</li>
            <li>Agregar el correo de esa cuenta como lector en <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Search Console ↗</a> para la propiedad <strong>coproactiva.cl</strong>.</li>
            <li>Agregar la misma cuenta como <strong>Viewer</strong> en la propiedad correspondiente de <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">GA4 ↗</a>.</li>
            <li>En Supabase, configurar los secretos <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>, <code>GA4_PROPERTY_ID</code> y, de ser necesario, <code>GSC_SITE_URL</code>.</li>
            <li>Para leer versiones publicadas en GTM, autorizar la cuenta de servicio en Tag Manager (permiso de lectura), habilitar Tag Manager API y configurar el secreto <code>GTM_CONTAINER_PATH</code> (ejemplo: <code>accounts/123/containers/456</code>).</li>
            <li>Para Business Profile, habilitar la API Business Profile Performance y obtener autorización OAuth <code>business.manage</code> de la cuenta propietaria. En los secretos del servidor configurar <code>GBP_OAUTH_CLIENT_ID</code>, <code>GBP_OAUTH_CLIENT_SECRET</code>, <code>GBP_OAUTH_REFRESH_TOKEN</code> y <code>GBP_LOCATION_ID</code> (ID numérico real de la ficha). Si Google asigna cuota cero, solicitar acceso a esa API.</li>
            <li>Seleccionar <strong>Actualizar</strong> para consultar las APIs y sus estados. GA4 Realtime se actualiza cada minuto cuando la pestaña está visible.</li>
          </ol>
          <p className="micro">Las credenciales privadas deben instalarse exclusivamente como secretos del servidor. Nunca pegarlas en este formulario, en GitHub ni en archivos VITE_*.</p>
        </div>
        <div className="tarjeta seo-mini-card">
          <h3 className="h4">Conversiones de contactos comerciales</h3>
          <p>El sitio utiliza Google Tag Manager y controles de consentimiento. Verificar que el evento de envío exitoso del formulario active <code>generate_lead</code> en GA4 y esté marcado como evento clave. Las solicitudes por teléfono o WhatsApp se deben medir por separado.</p>
          <p className="chico apagado">Una sesión orgánica, un clic en Google y un lead no son el mismo dato; este módulo no atribuye ventas automáticamente.</p>
        </div>
      </section>}


    </div>
    <BarraNavegacionSEO
      vista={vista}
      secciones={SECCIONES}
      vistasValidas={VISTAS_SEO}
      onSeleccionar={id => { if (id === 'resumen') void cargarHistorialSEO(); }}
    />
  </div>;
}
export default function SEO() {
  const { perfil, cargando } = useSesion();
  if (cargando) return <p className="cargando">Validando acceso…</p>;
  if (!perfil?.activo || !['admin', 'superadmin'].includes(perfil.rol)) return <Navigate to="/" replace />;
  return <SEOInterno />;
}
