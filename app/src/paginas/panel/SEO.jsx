import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { construirOportunidades } from '../../lib/seoOportunidades';
import DetalleOportunidad from './DetalleOportunidad';
import './SEO.css';

const SECCIONES = [
  ['resumen', 'Resumen'],
  ['consultas', 'Búsquedas'],
  ['analytics', 'Analytics'],
  ['tagmanager', 'Tag Manager'],
  ['tecnico', 'SEO técnico'],
  ['velocidad', 'Velocidad'],
  ['oportunidades', 'Oportunidades'],
  ['historico', 'Histórico'],
  ['conexiones', 'Conexiones']
];
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
function Tabla({ columnas, filas, sinDatos = 'No hay registros en el período.', archivo }) {
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
    <span className="micro">{numeral(filtradas.length)} resultados visibles. Las API de Google pueden limitar el detalle de consultas.</span>
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
const COL_SC = [
  { id: 'clave', etiqueta: 'Consulta / página' }, { id: 'clicks', etiqueta: 'Clics', texto: numeral },
  { id: 'impresiones', etiqueta: 'Impresiones', texto: numeral },
  { id: 'ctr', etiqueta: 'CTR', texto: porcentaje }, { id: 'posicion', etiqueta: 'Posición media', texto: n => decimal(n, 1) }
];
function Barra({ titulo, valor, max, detalle }) {
  return <div className="seo-barra-item"><div className="seo-fila-separada"><span>{titulo}</span><strong>{detalle || numeral(valor)}</strong></div>
    <div className="seo-barra-fondo"><span style={{ width: (100 * Number(valor || 0) / Math.max(1, max)) + '%' }} /></div></div>;
}
function SEOInterno() {
  const [vista, setVista] = useState('resumen');
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
  const [auditoriaInicio, setAuditoriaInicio] = useState(null);
  const [accionSeleccionada, setAccionSeleccionada] = useState(null);

  const invocar = useCallback(async (accion, extras = {}) => {
    const { data, error: err } = await supabase.functions.invoke('seo-analitica', { body: { accion, ...extras } });
    if (err) {
      let detalle = err.message || 'No se pudo consultar el servicio SEO.';
      if (err.context?.json) {
        try { const json = await err.context.json(); detalle = json.error || detalle; } catch { /* respuesta vacía */ }
      }
      throw new Error(detalle);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const recargar = useCallback(async (manual = false) => {
    setCargando(true); setError(''); setAvisoActualizacion(null);
    try {
      const resultados = await Promise.allSettled([
        invocar('estado'), invocar('resumen', { dias }),
        invocar('tag-manager'), invocar('auditoria', { ruta: '/' })
      ]);
      if (resultados[0].status !== 'fulfilled') throw resultados[0].reason;
      if (resultados[1].status !== 'fulfilled') throw resultados[1].reason;
      const e = resultados[0].value, resumen = resultados[1].value;
      setEstado(e); setDatos(resumen);
      if (resultados[2].status === 'fulfilled') {
        setTagManager(resultados[2].value); setTagError('');
      } else setTagError('La verificación de Tag Manager no pudo completarse.');
      if (resultados[3].status === 'fulfilled') setAuditoriaInicio(resultados[3].value);
      else setAuditoriaInicio(null);
      if (manual) {
        const sinConexion = [
          !resumen?.searchConsole?.disponible && 'Search Console',
          !resumen?.analytics?.disponible && 'Analytics 4'
        ].filter(Boolean);
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setAvisoActualizacion(sinConexion.length
          ? { tipo: 'pendiente', texto: 'Consulta realizada a las ' + hora + '. Sin conexión a ' +
              sinConexion.join(' y ') + '. No hay datos nuevos que mostrar: utiliza «Configurar conexiones».' }
          : { tipo: 'correcto', texto: 'Datos de Google actualizados correctamente a las ' + hora + '.' });
      }
    } catch (err) {
      setError(err.message || 'No fue posible recuperar las métricas.');
      if (manual) setAvisoActualizacion({ tipo: 'error', texto: 'No se pudo actualizar. Revisa el detalle del error.' });
    } finally { setCargando(false); }
  }, [dias, invocar]);

  useEffect(() => { recargar(false); }, [recargar]);

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
  const lista = useMemo(() => construirOportunidades(sc, auditoriaInicio || auditoria, ga),
    [sc, auditoriaInicio, auditoria, ga]);
  const rutasSitemap = useMemo(() => (auditoriaInicio?.sitemap?.urls || []).map(u => {
    try { return new URL(u).pathname; } catch { return ''; }
  }).filter(Boolean), [auditoriaInicio]);
  const sesionesOrganicas = ga?.canales?.find(c => c.clave?.toLowerCase() === 'organic search')?.valores?.[0];
  const variacionClics = sc?.disponible && sc?.anterior?.clics > 0
    ? ((sc.totales.clics - sc.anterior.clics) / sc.anterior.clics) * 100 : null;
  function abrirAccion(item) {
    setAccionSeleccionada(item); setVista('oportunidades');
  }
  function irVista(vistaNueva, rutaNueva) {
    if (rutaNueva) setRuta(rutaNueva);
    setVista(vistaNueva);
  }
  useEffect(() => {
    if (vista === 'oportunidades' && accionSeleccionada) {
      const id = requestAnimationFrame(() => document.getElementById('seo-detalle-accion')?.scrollIntoView({
        behavior: 'smooth', block: 'start'
      }));
      return () => cancelAnimationFrame(id);
    }
  }, [vista, accionSeleccionada?.id]);

  return <div className="pantalla seo-pantalla">
    <header className="encabezado seo-cabecera">
      <div><span className="seleccion-area-etiqueta">Marketing · posicionamiento orgánico</span>
        <h1 className="h3">SEO y Analítica</h1>
        <p className="chico apagado">Rendimiento real de coproactiva.cl, posicionamiento en Google y oportunidades de mejora.</p>
      </div>
      <div className="seo-cabecera-acciones">
        <select aria-label="Período de análisis" value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={7}>7 días</option><option value={28}>28 días</option><option value={90}>90 días</option>
        </select>
        <button className="boton boton-secundario" type="button" onClick={() => recargar(true)} disabled={cargando}>
          {cargando ? 'Consultando…' : 'Actualizar'}
        </button>
      </div>
    </header>

    <div className="cuerpo seo-cuerpo">
      <nav className="seo-pestanas" aria-label="Secciones SEO">{SECCIONES.map(([id, label]) =>
        <button key={id} type="button" className={vista === id ? 'activo' : ''} onClick={() => setVista(id)}>{label}</button>
      )}</nav>
      {!!error && <div className="aviso aviso-critico" role="alert">{error}</div>}
      {avisoActualizacion && <div className={'seo-aviso seo-aviso-' + avisoActualizacion.tipo} role="status">
        <span>{avisoActualizacion.texto}</span>
        {avisoActualizacion.tipo === 'pendiente' &&
          <button type="button" className="boton boton-secundario" onClick={() => setVista('conexiones')}>
            Configurar conexiones →
          </button>}
      </div>}
      {!estado && cargando && <p className="chico apagado">Cargando fuentes e indicadores…</p>}

      {vista === 'resumen' && <>
        {!cargando && datos && (!sc?.disponible || !ga?.disponible) &&
          <div className="seo-aviso seo-aviso-pendiente">
            <div><strong>Para mostrar estadísticas reales falta autorizar Google.</strong>
              <p>«Actualizar» no conecta las cuentas. La autorización se configura una sola vez y luego podrás consultar las métricas.</p>
            </div>
            <button type="button" className="boton boton-secundario" onClick={() => setVista('conexiones')}>
              Configurar conexiones →
            </button>
          </div>}
        <section className="seo-centro-control" aria-label="Visión general">
          <div className="seo-titulo-seccion"><div>
            <h2 className="h4">Centro de control</h2>
            <p className="chico apagado">Búsqueda → visitas → contactos y salud técnica. Cada dato indica su fuente.</p>
          </div><span className="micro">{sc?.disponible ? sc.desde + ' al ' + sc.hasta : dias + ' días seleccionados'}</span></div>
          <div className="seo-kpis">
            <KPI titulo="Clics orgánicos · Search Console" valor={sc?.disponible ? numeral(sc.totales?.clics) : '—'}
              nota={variacionClics === null ? 'Sin comparación disponible' : (variacionClics >= 0 ? '+' : '') + decimal(variacionClics) + '% vs período anterior'} />
            <KPI titulo="Sesiones Organic Search · GA4" valor={ga?.disponible ? numeral(sesionesOrganicas || 0) : '—'}
              nota="Sesiones atribuidas a búsqueda orgánica" />
            <KPI titulo="Eventos clave · GA4" valor={ga?.disponible ? numeral(ga.totales?.eventosClave) : '—'}
              nota="No equivale automáticamente a nuevos leads" />
            <KPI titulo="Incidencias técnicas · portada" valor={auditoriaInicio ? numeral(auditoriaInicio.problemas?.length) : '—'}
              nota={auditoriaInicio ? 'Revisión HTML inicial · solo portada' : 'Auditoría pendiente'} />
          </div>
          <div className="seo-pulso-grid">
            <button type="button" className="seo-pulso" onClick={() => setVista('consultas')}>
              <span>Search Console</span><strong>{sc?.disponible ? porcentaje(sc.totales?.ctr) + ' CTR' : 'Sin conexión'}</strong>
              <small>Posición media: {sc?.disponible ? decimal(sc.totales?.posicion) : '—'} · Ver búsquedas →</small>
            </button>
            <button type="button" className="seo-pulso" onClick={() => setVista('analytics')}>
              <span>Google Analytics 4</span><strong>{ga?.disponible ? numeral(ga.totales?.sesiones) + ' sesiones' : 'Sin conexión'}</strong>
              <small>Engagement: {ga?.disponible ? porcentaje(ga.totales?.engagement) : '—'} · Ver canales →</small>
            </button>
            <button type="button" className="seo-pulso" onClick={() => setVista('tagmanager')}>
              <span>Google Tag Manager</span><strong>{tagManager?.codigoGtm ? 'Código detectado' : 'Sin confirmar'}</strong>
              <small>{tagManager?.contenedores?.join(', ') || 'Sin ID comprobado'} · Validar eventos →</small>
            </button>
            <button type="button" className="seo-pulso" onClick={() => setVista('tecnico')}>
              <span>SEO técnico</span><strong>{auditoriaInicio ? 'HTTP ' + auditoriaInicio.status : 'Pendiente'}</strong>
              <small>{auditoriaInicio ? numeral(auditoriaInicio.sitemap?.urls?.length) + ' URLs en sitemap' : 'Sin auditoría'} · Examinar →</small>
            </button>
            <button type="button" className="seo-pulso" onClick={() => setVista('velocidad')}>
              <span>PageSpeed Insights</span><strong>{velocidad ? velocidad.puntajes?.rendimiento + '/100' : 'Sin medición'}</strong>
              <small>{velocidad ? 'Última medición en esta sesión' : 'Medición bajo demanda'} · Evaluar →</small>
            </button>
          </div>
          <div className="seo-panel-criterio"><strong>¿Cómo interpretar el panel?</strong>
            <p>{sc?.disponible && ga?.disponible
              ? 'Search Console explica visibilidad y clics; GA4 explica sesiones y comportamiento. Sus cifras no tienen que coincidir.'
              : 'Hay fuentes pendientes de autorizar. El análisis técnico es independiente y puede utilizarse sin conectar Analytics.'}
              {' '}Tag Manager muestra comprobaciones de instalación, no la confirmación de eventos recibidos en GA4.</p>
          </div>
        </section>
        <div className="seo-integraciones">
          <EstadoIntegracion nombre="Google Search Console" disponible={!!sc?.disponible} mensaje={sc?.error}
            onClick={() => setVista('conexiones')} accion="Configurar Search Console" />
          <EstadoIntegracion nombre="Google Analytics 4" disponible={!!ga?.disponible} mensaje={ga?.error}
            onClick={() => setVista('conexiones')} accion="Configurar Analytics" />
          <EstadoIntegracion nombre="Auditoría técnica" disponible={!!auditoriaInicio?.status}
            mensaje={auditoriaInicio ? 'HTTP ' + auditoriaInicio.status : 'Sin comprobar'}
            onClick={() => setVista('tecnico')} accion="Abrir auditoría técnica" />
        </div>
        <section><div className="seo-titulo-seccion"><h2 className="h4">Búsqueda orgánica · Search Console</h2>
          <span className="micro">{sc?.disponible ? sc.desde + ' al ' + sc.hasta : 'Conexión pendiente'}</span></div>
          <div className="seo-kpis">
            <KPI titulo="Clics desde Google" valor={sc?.disponible ? numeral(sc.totales?.clics) : '—'} />
            <KPI titulo="Impresiones" valor={sc?.disponible ? numeral(sc.totales?.impresiones) : '—'} />
            <KPI titulo="CTR orgánico" valor={sc?.disponible ? porcentaje(sc.totales?.ctr) : '—'} />
            <KPI titulo="Posición promedio" valor={sc?.disponible ? decimal(sc.totales?.posicion) : '—'} nota="Menor posición es mejor" />
          </div>
          {sc?.disponible ? <Evolucion filas={sc.tendencia || []} titulo="Clics diarios desde Google" /> :
            <Vacio titulo="Search Console sin conexión" descripcion={sc?.error || 'Autoriza el acceso para consultar datos reales.'} />}
        </section>
        <section><div className="seo-titulo-seccion"><h2 className="h4">Tráfico del sitio · Analytics 4</h2></div>
          <div className="seo-kpis">
            <KPI titulo="Usuarios" valor={ga?.disponible ? numeral(ga.totales?.usuarios) : '—'} />
            <KPI titulo="Sesiones" valor={ga?.disponible ? numeral(ga.totales?.sesiones) : '—'} />
            <KPI titulo="Vistas de páginas" valor={ga?.disponible ? numeral(ga.totales?.vistas) : '—'} />
            <KPI titulo="Eventos clave GA4" valor={ga?.disponible ? numeral(ga.totales?.eventosClave) : '—'} nota="No equivalen necesariamente a leads" />
          </div>
          {ga?.disponible ? <Evolucion filas={ga.tendencia || []} atributo="sesiones" titulo="Sesiones diarias" /> :
            <Vacio titulo="Analytics 4 sin conexión" descripcion={ga?.error || 'Autoriza el acceso a la propiedad GA4.'} />}
        </section>
        <section className="seo-dos-columnas">
          <div className="tarjeta seo-mini-card"><h2 className="h4">Acciones prioritarias</h2>
            <p className="micro">Señales ordenadas por umbrales objetivos. Haz clic para consultar la URL y el texto real.</p>
            {lista.slice(0, 4).map(item => <button type="button" className="seo-accion-mini seo-accion-clic" key={item.id}
              onClick={() => abrirAccion(item)}>
              <span className={'seo-prioridad ' + item.prioridad.toLowerCase()}>{item.prioridad}</span>
              <strong>{item.titulo}</strong>
              {item.metricas && <small>{numeral(item.metricas.impresiones)} impresiones · CTR {porcentaje(item.metricas.ctr)} · Pos. {decimal(item.metricas.posicion)}</small>}
              <span className="seo-link-inline">Analizar la recomendación →</span>
            </button>)}
            <button type="button" className="boton boton-texto" onClick={() => setVista('oportunidades')}>Ver todas las oportunidades →</button>
          </div>
          <div className="tarjeta seo-mini-card"><h2 className="h4">Lectura ejecutiva</h2>
            <p><strong>Visibilidad:</strong> {sc?.disponible
              ? numeral(sc.totales?.impresiones) + ' impresiones, ' + numeral(sc.totales?.clics) + ' clics y ' + porcentaje(sc.totales?.ctr) + ' de CTR en el período.'
              : 'Falta información de Search Console.'}</p>
            <p><strong>Conversión:</strong> {ga?.disponible
              ? numeral(ga.totales?.eventosClave) + ' eventos clave en GA4. Confirmar cuáles corresponden a formularios.'
              : 'Falta información de GA4.'}</p>
            <p><strong>Medición:</strong> {tagManager?.codigoGtm
              ? 'El código de Tag Manager está presente. Su publicación y el disparo real requieren validación con Tag Assistant.'
              : 'La instalación de Tag Manager no se ha confirmado.'}</p>
            <p className="chico apagado">Las prioridades son hipótesis basadas en señales de Google y auditorías, no resultados garantizados. No se editará el sitio automáticamente.</p>
          </div>
        </section>
      </>}

      {vista === 'consultas' && <section>
        <h2 className="h4">Rendimiento en Google Search</h2>
        {!sc?.disponible ? <Vacio titulo="Falta conectar Search Console" descripcion={sc?.error || 'Sin datos.'} /> : <>
          <div className="seo-kpis">
            <KPI titulo="Clics" valor={numeral(sc.totales?.clics)} nota={'Período previo: ' + numeral(sc.anterior?.clics)} />
            <KPI titulo="Impresiones" valor={numeral(sc.totales?.impresiones)} nota={'Período previo: ' + numeral(sc.anterior?.impresiones)} />
            <KPI titulo="CTR" valor={porcentaje(sc.totales?.ctr)} />
            <KPI titulo="Posición media" valor={decimal(sc.totales?.posicion)} />
          </div>
          <h3 className="seo-subtitulo">Consultas principales</h3>
          <Tabla columnas={COL_SC} filas={sc.consultas || []} archivo="coproactiva-search-console-consultas.csv" />
          <h3 className="seo-subtitulo">Páginas en búsqueda</h3>
          <Tabla columnas={COL_SC} filas={sc.paginas || []} archivo="coproactiva-search-console-paginas.csv" />
          <div className="seo-dos-columnas">
            <div className="tarjeta seo-mini-card"><h3 className="h4">Dispositivos</h3>
              {(sc.dispositivos || []).map(d => <Barra key={d.clave} titulo={d.clave} valor={d.clicks} max={Math.max(...sc.dispositivos.map(x => x.clicks),1)} />)}
            </div>
            <div className="tarjeta seo-mini-card"><h3 className="h4">Países principales</h3>
              {(sc.paises || []).slice(0, 8).map(d => <Barra key={d.clave} titulo={d.clave} valor={d.clicks} max={Math.max(...sc.paises.map(x => x.clicks),1)} />)}
            </div>
          </div>
          <p className="micro">{sc.nota}</p>
        </>}
      </section>}

      {vista === 'analytics' && <section>
        <h2 className="h4">Audiencia y comportamiento · GA4</h2>
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

      {vista === 'oportunidades' && <section>
        <h2 className="h4">Oportunidades priorizadas</h2>
        <p className="chico apagado">Cada sugerencia muestra su origen, métricas y regla aplicada. «Analizar» identifica primero qué URL aparece en Google y lee su título, descripción y H1 actuales antes de sugerir un cambio.</p>
        {accionSeleccionada && <DetalleOportunidad key={accionSeleccionada.id} item={accionSeleccionada}
          invocar={invocar} dias={dias} rutasSitemap={rutasSitemap}
          alCerrar={() => setAccionSeleccionada(null)} irVista={irVista} />}
        <div className="seo-aviso">
          <strong>Regla de oportunidad por consulta:</strong> al menos 30 impresiones, posición media de 4 a 20 y CTR inferior al 4%.
          La prioridad Alta comienza en 100 impresiones. Son umbrales iniciales editables en el código; no justifican cambiar el texto por sí solos.
        </div>
        {lista.map(x => <div className="tarjeta seo-oportunidad" key={x.id}>
          <div className="seo-fila-separada"><span className={'seo-prioridad ' + x.prioridad.toLowerCase()}>{x.prioridad}</span><span className="micro">{x.tipo} · {x.fuente}</span></div>
          <h3>{x.titulo}</h3><p>{x.detalle}</p>
          {x.metricas && <div className="seo-metricas-inline">
            <span>{numeral(x.metricas.impresiones)} impresiones</span>
            <span>{numeral(x.metricas.clicks)} clics</span>
            <span>CTR {porcentaje(x.metricas.ctr)}</span>
            <span>Posición {decimal(x.metricas.posicion)}</span>
          </div>}
          <button type="button" className="boton boton-secundario" onClick={() => abrirAccion(x)}>
            Analizar · ver URL, texto actual y propuesta →
          </button>
        </div>)}
      </section>}

      {vista === 'tagmanager' && <section>
        <h2 className="h4">Google Tag Manager · seguimiento y conversiones</h2>
        <p className="chico apagado">Se comprueba el código público del sitio. La configuración de etiquetas, activadores y versiones publicadas requiere acceso al contenedor de Google; detectar código no demuestra recepción de eventos.</p>
        <div className="seo-kpis">
          <KPI titulo="Contenedor GTM" valor={tagManager?.codigoGtm ? 'Detectado' : 'Sin confirmar'}
            nota={tagManager?.contenedores?.join(', ') || 'No identificado'} />
          <KPI titulo="Data Layer" valor={tagManager?.dataLayer ? 'Detectada' : 'Sin confirmar'} nota="Señal en código" />
          <KPI titulo="Consent Mode" valor={tagManager?.consentimiento ? 'Código detectado' : 'Sin confirmar'} nota="Confirmar señales en navegador" />
          <KPI titulo="generate_lead" valor={tagManager?.eventoLeadEnCodigo ? 'Implementado' : 'Sin confirmar'} nota="Recepción en GA4 no verificada" />
        </div>
        {tagError && <div className="seo-aviso seo-aviso-pendiente">{tagError}</div>}
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

      {vista === 'historico' && <section>
        <h2 className="h4">Antecedentes históricos</h2>
        <p className="chico apagado">Informes almacenados en Coproactiva (Jarvis): Search Console, Semrush y Google Business Profile. No son una integración en tiempo real ni se mezclan con los indicadores de GA4.</p>
        <Tabla columnas={[
          {id:'fuente',etiqueta:'Fuente'}, {id:'metrica',etiqueta:'Indicador'},
          {id:'valor',etiqueta:'Valor',texto:(n,row) => n == null ? (row.valor_texto || 'Sin valor numérico') : decimal(n, 2)},
          {id:'periodo_inicio',etiqueta:'Inicio'}, {id:'periodo_fin',etiqueta:'Fin'}
        ]} filas={estado?.historico || []} archivo="coproactiva-seo-historico.csv" />
      </section>}

      {vista === 'conexiones' && <section>
        <h2 className="h4">Conexiones y fuentes de datos</h2>
        <div className="seo-integraciones">
          <EstadoIntegracion nombre="Search Console" disponible={!!sc?.disponible} mensaje={sc?.error} />
          <EstadoIntegracion nombre="Google Analytics 4" disponible={!!ga?.disponible} mensaje={ga?.error} />
          <EstadoIntegracion nombre="Registros históricos" disponible={!!estado?.historico?.length} mensaje="Sin registros históricos disponibles" />
          <EstadoIntegracion nombre="Tag Manager (código)" disponible={!!tagManager?.codigoGtm}
            mensaje="No se pudo detectar el contenedor desde el sitio" onClick={() => setVista('tagmanager')}
            accion="Revisar seguimiento" />
        </div>
        <div className="tarjeta seo-mini-card">
          <h3 className="h4">Conectar con permisos de lectura</h3>
          <ol className="seo-pasos">
            <li>Crear una cuenta de servicio en <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud ↗</a> y habilitar Google Analytics Data API, Search Console API y URL Inspection API.</li>
            <li>Agregar el correo de esa cuenta como lector en <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Search Console ↗</a> para la propiedad <strong>coproactiva.cl</strong>.</li>
            <li>Agregar la misma cuenta como <strong>Viewer</strong> en la propiedad correspondiente de <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">GA4 ↗</a>.</li>
            <li>En Supabase, configurar los secretos <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>, <code>GA4_PROPERTY_ID</code> y, de ser necesario, <code>GSC_SITE_URL</code>.</li>
            <li>Seleccionar <strong>Actualizar</strong> para comprobar acceso y consultar datos reales.</li>
          </ol>
          <p className="micro">Las credenciales privadas deben instalarse exclusivamente como secretos del servidor. Nunca pegarlas en este formulario, en GitHub ni en archivos VITE_*.</p>
        </div>
        <div className="tarjeta seo-mini-card">
          <h3 className="h4">Conversiones de contactos comerciales</h3>
          <p>El sitio utiliza Google Tag Manager y controles de consentimiento. Verificar que el evento de envío exitoso del formulario active <code>generate_lead</code> en GA4 y esté marcado como evento clave. Las solicitudes por teléfono o WhatsApp se deben medir por separado.</p>
          <p className="chico apagado">Una sesión orgánica, un clic en Google y un lead no son el mismo dato; este módulo no atribuye ventas automáticamente.</p>
        </div>
      </section>}

      <footer className="seo-pie">
        <span>Fuente: Google APIs y registros históricos internos.</span>
        <a href={sitio} target="_blank" rel="noopener noreferrer">Abrir sitio web ↗</a>
      </footer>
    </div>
  </div>;
}
export default function SEO() {
  const { perfil, cargando } = useSesion();
  if (cargando) return <p className="cargando">Validando acceso…</p>;
  if (!perfil?.activo || !['admin', 'superadmin'].includes(perfil.rol)) return <Navigate to="/" replace />;
  return <SEOInterno />;
}
