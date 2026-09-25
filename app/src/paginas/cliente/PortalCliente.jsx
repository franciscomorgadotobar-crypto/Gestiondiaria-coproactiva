import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import MapaPortalCliente from './MapaPortalCliente';
import './PortalCliente.css';

const TABS = [
  ['resumen', 'Resumen'],
  ['incidencias', 'Incidencias'],
  ['levantamientos', 'Levantamientos'],
  ['mantencion', 'Mantenciones'],
  ['documentos', 'Documentos']
];

const ESTADOS_CERRADOS_INCIDENCIA = ['resuelta', 'resuelto', 'cerrada', 'cerrado', 'finalizada', 'finalizado', 'completada', 'completado'];

function fechaCL(valor, conHora = false) {
  if (!valor) return 'Sin fecha';
  const soloFecha = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloFecha ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', conHora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function fechaCorta(valor) {
  if (!valor) return 'Sin fecha';
  const soloFecha = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloFecha ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
}

function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function fechaValida(valor) {
  if (!valor) return null;
  const soloFecha = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloFecha ? `${valor}T12:00:00` : valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function compararFechaAsc(a, b) {
  return (fechaValida(a?.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (fechaValida(b?.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER);
}

function compararFechaDesc(a, b) {
  return (fechaValida(b?.fecha)?.getTime() ?? 0) - (fechaValida(a?.fecha)?.getTime() ?? 0);
}

function esEsteMes(valor) {
  const d = fechaValida(valor);
  if (!d) return false;
  const ahora = new Date();
  return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
}

function normalizarTexto(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

function incidenciaCerrada(i) {
  return ESTADOS_CERRADOS_INCIDENCIA.includes(normalizarTexto(i.estado));
}

function frecuencia(m) {
  if (m.frecuencia_unidad === 'unica') return 'Intervención única';
  if (!m.frecuencia_valor) return 'Frecuencia sin definir';
  const nombres = { dias: 'día', semanas: 'semana', meses: 'mes', anos: 'año' };
  const n = nombres[m.frecuencia_unidad] ?? m.frecuencia_unidad;
  return `Cada ${m.frecuencia_valor} ${n}${m.frecuencia_valor === 1 ? '' : 's'}`;
}

function etiquetaEstado(valor) {
  const mapa = {
    pendiente: 'Pendiente',
    en_curso: 'En curso',
    pausado: 'En pausa',
    enviado: 'Realizado',
    finalizado: 'Realizado',
    agendada: 'Programada',
    completada: 'Realizada',
    cancelada: 'Cancelada',
    resuelta: 'Resuelta',
    resuelto: 'Resuelta',
    cerrada: 'Cerrada',
    cerrado: 'Cerrada',
    programada: 'Programada',
    programado: 'Programado'
  };
  return mapa[normalizarTexto(valor)] ?? valor ?? 'Sin estado';
}

/* Color del estado: los mismos chips que el panel usa para un levantamiento
 * (pendiente, en curso, realizado, vencido). */
function claseEstado(texto) {
  const t = normalizarTexto(texto);
  if (['realizado', 'realizada', 'resuelta', 'cerrada'].includes(t)) return ' chip-cumple';
  if (t === 'en curso') return ' chip-alerta';
  if (['vencida', 'fecha vencida'].includes(t)) return ' chip-critico';
  if (['pendiente', 'sin programar'].includes(t)) return ' chip-pendiente';
  return '';
}

function urlDocumento(documento) {
  const valor = String(documento?.url ?? '').trim();
  if (/^https?:\/\//i.test(valor) || valor.startsWith('/')) return valor;
  return null;
}

function documentoEsPdf(documento) {
  const mime = normalizarTexto(documento?.tipo_mime);
  const nombre = normalizarTexto(documento?.nombre_archivo);
  const url = normalizarTexto(documento?.url);
  return mime.includes('pdf') || nombre.endsWith('.pdf') || url.includes('.pdf');
}

async function cargarDetalleComunidad(comunidadId) {
  const [rl, rm, rr, ri, rd] = await Promise.all([
    supabase.rpc('portal_cliente_levantamientos', { p_comunidad_id: comunidadId }),
    supabase.rpc('portal_cliente_mantenciones', { p_comunidad_id: comunidadId }),
    supabase.rpc('portal_cliente_requerimientos', { p_comunidad_id: comunidadId }),
    supabase.rpc('portal_cliente_incidencias', { p_comunidad_id: comunidadId }),
    supabase.rpc('portal_cliente_documentos', { p_comunidad_id: comunidadId })
  ]);

  const fallo = [rl, rm, rr, ri, rd].find(r => r.error)?.error;
  if (fallo) throw fallo;

  return {
    levantamientos: rl.data ?? [],
    mantenciones: rm.data ?? [],
    requerimientos: rr.data ?? [],
    incidencias: ri.data ?? [],
    documentos: rd.data ?? []
  };
}

function construirVista(comunidad, datos) {
  const hoy = hoyChile();
  const ahora = new Date();
  const { levantamientos, mantenciones, requerimientos, incidencias, documentos } = datos;
  const documentosPorReferencia = new Map();

  documentos.forEach(d => {
    const clave = String(d.referencia_id ?? '');
    if (!clave) return;
    if (!documentosPorReferencia.has(clave)) documentosPorReferencia.set(clave, []);
    documentosPorReferencia.get(clave).push(d);
  });

  const atencion = [];
  const proximos = [];
  const realizados = [];

  incidencias.forEach(i => {
    const cerrada = incidenciaCerrada(i);
    const fechaProgramada = i.programado_para;
    const programada = fechaValida(fechaProgramada);
    const programadaFuturo = programada && programada > ahora;
    const titulo = i.titulo || 'Incidencia';
    const base = {
      id: `inc-${i.id}`,
      referenciaId: i.id,
      comunidadId: comunidad.comunidad_id,
      comunidadNombre: comunidad.nombre,
      tipo: 'Incidencia',
      titulo,
      detalle: i.descripcion || 'Incidencia registrada en la comunidad.',
      estado: etiquetaEstado(i.estado),
      seccion: 'incidencias'
    };

    if (cerrada) {
      realizados.push({ ...base, fecha: i.resuelto_en || i.creado_en, estado: 'Resuelta' });
    } else if (programadaFuturo) {
      proximos.push({ ...base, fecha: fechaProgramada, estado: 'Programada' });
    } else {
      atencion.push({
        ...base,
        fecha: i.creado_en,
        estado: programada ? 'Fecha vencida' : 'Sin programar',
        detalle: programada
          ? `La intervención estaba programada para ${fechaCL(fechaProgramada, true)} y sigue abierta.`
          : (i.descripcion || 'Incidencia abierta pendiente de programación o resolución.')
      });
    }
  });

  requerimientos.filter(r => !r.tiene_agendamiento).forEach(r => {
    atencion.push({
      id: `req-${r.id}`,
      referenciaId: r.id,
      comunidadId: comunidad.comunidad_id,
      comunidadNombre: comunidad.nombre,
      tipo: 'Levantamiento',
      titulo: r.nombre || r.plantilla_nombre || 'Levantamiento requerido',
      detalle: r.proxima_exigible ? `Requerido para ${fechaCL(r.proxima_exigible)}.` : 'Pendiente de programación.',
      fecha: r.proxima_exigible,
      estado: 'Sin programar',
      seccion: 'levantamientos'
    });
  });

  levantamientos.forEach(l => {
    const estado = normalizarTexto(l.estado);
    const finalizado = ['enviado', 'finalizado', 'completado', 'completada'].includes(estado);
    const programado = fechaValida(l.programado_para);
    const docs = documentosPorReferencia.get(String(l.id)) ?? [];
    const informe = docs.find(documentoEsPdf) || docs[0] || null;
    const base = {
      id: `lev-${l.id}`,
      referenciaId: l.id,
      comunidadId: comunidad.comunidad_id,
      comunidadNombre: comunidad.nombre,
      tipo: 'Levantamiento',
      titulo: l.plantilla_nombre || 'Levantamiento',
      detalle: l.periodo ? `Periodo: ${l.periodo}` : 'Levantamiento de la comunidad.',
      seccion: 'levantamientos',
      documento: informe
    };

    if (finalizado) {
      realizados.push({ ...base, fecha: l.enviado_en || l.checkin_en || l.creado_en, estado: 'Realizado' });
    } else if (programado && programado > ahora) {
      proximos.push({ ...base, fecha: l.programado_para, estado: 'Programado' });
    } else if (programado && programado <= ahora) {
      atencion.push({
        ...base,
        fecha: l.programado_para,
        estado: 'Pendiente',
        detalle: `Estaba programado para ${fechaCL(l.programado_para, true)} y aún no figura finalizado.`
      });
    }
  });

  mantenciones.forEach(m => {
    const vencimiento = m.vencimiento_original || m.proxima_exigible;
    const programado = fechaValida(m.programado_para);
    const vencida = Boolean(vencimiento && vencimiento < hoy);
    const titulo = m.activo_nombre ? `${m.activo_nombre}: ${m.trabajo}` : m.trabajo;
    const base = {
      id: `man-${m.actividad_id}`,
      referenciaId: m.actividad_id,
      comunidadId: comunidad.comunidad_id,
      comunidadNombre: comunidad.nombre,
      tipo: 'Mantención',
      titulo: titulo || 'Mantención',
      detalle: m.proveedor ? `Proveedor: ${m.proveedor}` : frecuencia(m),
      seccion: 'mantencion'
    };

    if (vencida) {
      atencion.push({
        ...base,
        fecha: vencimiento,
        estado: 'Vencida',
        detalle: programado && programado > ahora
          ? `Venció el ${fechaCL(vencimiento)}. Hay una visita reprogramada para ${fechaCL(m.programado_para, true)}.`
          : `Venció el ${fechaCL(vencimiento)} y requiere seguimiento.`
      });
    } else if (programado && programado > ahora) {
      proximos.push({ ...base, fecha: m.programado_para, estado: 'Programada' });
    }

    if (m.ultima_ejecucion) {
      realizados.push({
        ...base,
        id: `maneje-${m.actividad_id}`,
        fecha: m.ultima_ejecucion,
        estado: 'Realizada',
        detalle: m.observaciones || (m.ejecutor ? `Realizada por ${m.ejecutor}.` : 'Mantención ejecutada.')
      });
    }
  });

  atencion.sort(compararFechaAsc);
  proximos.sort(compararFechaAsc);
  realizados.sort(compararFechaDesc);

  const informes = documentos
    .filter(documentoEsPdf)
    .sort((a, b) => compararFechaDesc({ fecha: a.fecha }, { fecha: b.fecha }));

  return {
    comunidad,
    ...datos,
    atencion,
    proximos,
    realizados,
    realizadosMes: realizados.filter(x => esEsteMes(x.fecha)),
    informes,
    documentosPorReferencia
  };
}

export default function PortalCliente() {
  const { id } = useParams();
  return id ? <DetalleCliente id={id} /> : <DashboardCliente />;
}

function DashboardCliente() {
  const { perfil, salir } = useSesion();
  const [vistas, setVistas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;

    async function cargar() {
      setError(null);
      const rd = await supabase.rpc('portal_cliente_dashboard');
      if (!vigente) return;
      if (rd.error) {
        setError(rd.error.message);
        setVistas([]);
        return;
      }

      try {
        const comunidades = rd.data ?? [];
        const detalles = await Promise.all(comunidades.map(async comunidad => {
          const datos = await cargarDetalleComunidad(comunidad.comunidad_id);
          return construirVista(comunidad, datos);
        }));
        if (vigente) setVistas(detalles);
      } catch (e) {
        if (vigente) {
          setError(e?.message || 'No se pudo cargar el portal.');
          setVistas([]);
        }
      }
    }

    cargar();
    return () => { vigente = false; };
  }, [perfil?.id]);

  const resumen = useMemo(() => {
    const xs = vistas ?? [];
    const atencion = xs.flatMap(v => v.atencion);
    const proximos = xs.flatMap(v => v.proximos).sort(compararFechaAsc);
    const realizados = xs.flatMap(v => v.realizados).sort(compararFechaDesc);
    const informes = xs.flatMap(v => v.informes.map(d => ({ ...d, comunidadNombre: v.comunidad.nombre, comunidadId: v.comunidad.comunidad_id })))
      .sort((a, b) => compararFechaDesc({ fecha: a.fecha }, { fecha: b.fecha }));
    return {
      atencion,
      proximos,
      realizados,
      informes,
      realizadosMes: realizados.filter(x => esEsteMes(x.fecha))
    };
  }, [vistas]);

  return (
    <div className="pantalla portal-pantalla">
      <header className="encabezado portal-encabezado">
        <div className="fila" style={{ alignItems: 'flex-start' }}>
          <div className="crece">
            <h1 className="h3">Mi portal</h1>
            <p className="chico apagado" style={{ margin: '4px 0 0' }}>
              Lo que requiere atención, lo que viene y lo que ya se realizó en tus comunidades.
            </p>
          </div>
          <button className="boton boton-texto" onClick={salir}>Salir</button>
        </div>
      </header>

      <div className="cuerpo portal-cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 14 }}>{error}</div>}
        {vistas === null && !error && <p className="cargando">Cargando…</p>}

        {vistas && (
          <>
            <section className="portal-resumen" aria-label="Resumen del portal">
              <Kpi valor={resumen.atencion.length} etiqueta="Requieren atención" tono={resumen.atencion.length ? 'alerta' : 'ok'} />
              <Kpi valor={resumen.proximos.length} etiqueta="Próximamente" tono="proximo" />
              <Kpi valor={resumen.realizadosMes.length} etiqueta="Realizados este mes" tono="ok" />
            </section>

            <section className="portal-seccion portal-seccion-principal">
              <EncabezadoSeccion titulo="Requiere atención" cantidad={resumen.atencion.length} />
              {resumen.atencion.length === 0 ? (
                <EstadoVacio tipo="ok" titulo="Todo al día" texto="No hay incidencias, levantamientos o mantenciones vencidas que requieran atención." />
              ) : (
                <div className="portal-lista">
                  {resumen.atencion.slice(0, 5).map(item => <TarjetaActividad key={item.id} item={item} mostrarComunidad />)}
                </div>
              )}
            </section>

            <section className="portal-seccion">
              <EncabezadoSeccion titulo="Próximamente" cantidad={resumen.proximos.length} />
              {resumen.proximos.length === 0 ? (
                <EstadoVacio titulo="Sin actividades programadas" texto="Cuando se programe un levantamiento, una intervención o una mantención aparecerá aquí." />
              ) : (
                <div className="portal-lista">
                  {resumen.proximos.slice(0, 5).map(item => <TarjetaActividad key={item.id} item={item} mostrarComunidad fechaDestacada />)}
                </div>
              )}
            </section>

            <section className="portal-seccion">
              <EncabezadoSeccion titulo="Últimos informes" cantidad={resumen.informes.length} />
              {resumen.informes.length === 0 ? (
                <EstadoVacio titulo="Aún no hay informes publicados" texto="Los PDF disponibles para tu cuenta quedarán reunidos en esta sección." />
              ) : (
                <div className="portal-documentos-resumen">
                  {resumen.informes.slice(0, 4).map((d, indice) => (
                    <TarjetaDocumento key={`${d.id}-${indice}`} documento={d} mostrarComunidad />
                  ))}
                </div>
              )}
            </section>

            <section className="portal-seccion">
              <EncabezadoSeccion titulo="Tus comunidades" cantidad={vistas.length} />
              {vistas.length === 0 ? (
                <p className="vacio">Tu cuenta aún no tiene comunidades asociadas.</p>
              ) : (
                <div className="portal-comunidades">
                  {vistas.map(v => <TarjetaComunidad key={v.comunidad.comunidad_id} vista={v} />)}
                </div>
              )}
            </section>

            {vistas.some(v => v.comunidad.latitud != null && v.comunidad.longitud != null) && (
              <section className="portal-seccion">
                <h2 className="h4">Ubicación de tus comunidades</h2>
                <MapaPortalCliente comunidades={vistas.map(v => v.comunidad)} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ valor, etiqueta, tono = 'neutro' }) {
  return (
    <div className={`portal-kpi portal-kpi-${tono}`}>
      <strong>{valor}</strong>
      <span>{etiqueta}</span>
    </div>
  );
}

function EncabezadoSeccion({ titulo, cantidad }) {
  return (
    <div className="portal-seccion-titulo">
      <h2 className="h4">{titulo}</h2>
      {Number.isFinite(cantidad) && <span className="portal-contador">{cantidad}</span>}
    </div>
  );
}

function EstadoVacio({ titulo, texto, tipo = 'neutro' }) {
  return (
    <div className={`portal-vacio portal-vacio-${tipo}`}>
      <strong>{titulo}</strong>
      <span>{texto}</span>
    </div>
  );
}

function TarjetaComunidad({ vista }) {
  const { comunidad, atencion, proximos, informes, realizados } = vista;
  const proximo = proximos[0] || null;
  const ultimo = realizados[0] || null;
  const estadoOk = atencion.length === 0;

  return (
    <Link to={`/portal/comunidades/${comunidad.comunidad_id}`} className="tarjeta portal-comunidad">
      <div className="portal-comunidad-cabecera">
        <div className="crece">
          <strong className="portal-comunidad-nombre">{comunidad.nombre}</strong>
          <div className="micro apagado portal-meta">
            {comunidad.direccion && <span>{comunidad.direccion}</span>}
            {comunidad.comuna && <span>{comunidad.comuna}</span>}
          </div>
        </div>
        <span className="portal-flecha" aria-hidden="true">›</span>
      </div>

      <div className={`portal-estado-general ${estadoOk ? 'ok' : 'alerta'}`}>
        <span className="portal-punto" aria-hidden="true" />
        <strong>{estadoOk ? 'Sin asuntos vencidos' : `${atencion.length} ${atencion.length === 1 ? 'asunto requiere' : 'asuntos requieren'} atención`}</strong>
      </div>

      <div className="portal-comunidad-resumen">
        <ResumenDato etiqueta="Próxima actividad" valor={proximo ? `${proximo.tipo} · ${fechaCL(proximo.fecha, true)}` : 'Sin actividades programadas'} />
        <ResumenDato etiqueta="Última actividad" valor={ultimo ? `${ultimo.tipo} · ${fechaCL(ultimo.fecha)}` : 'Sin actividad reciente'} />
        <ResumenDato etiqueta="Informes disponibles" valor={`${informes.length}`} />
      </div>
    </Link>
  );
}

function ResumenDato({ etiqueta, valor }) {
  return (
    <div className="portal-resumen-dato">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function TarjetaActividad({ item, mostrarComunidad = false, fechaDestacada = false }) {
  const destino = `/portal/comunidades/${item.comunidadId}?seccion=${item.seccion || 'resumen'}`;
  const documentoUrl = urlDocumento(item.documento);

  return (
    <div className={`tarjeta portal-actividad ${item.estado === 'Vencida' || item.estado === 'Pendiente' || item.estado === 'Sin programar' || item.estado === 'Fecha vencida' ? 'portal-actividad-alerta' : ''}`}>
      {fechaDestacada && item.fecha && (
        <div className="portal-fecha-chip" aria-label={`Fecha ${fechaCL(item.fecha, true)}`}>
          {fechaCorta(item.fecha)}
        </div>
      )}
      <div className="portal-actividad-contenido">
        <div className="portal-etiquetas">
          <span className="portal-tipo">{item.tipo}</span>
          {item.estado && <span className={'portal-estado' + claseEstado(item.estado)}>{item.estado}</span>}
        </div>
        <strong className="portal-actividad-titulo">{item.titulo}</strong>
        {mostrarComunidad && <span className="micro portal-comunidad-ref">{item.comunidadNombre}</span>}
        {item.detalle && <p className="micro apagado portal-actividad-detalle">{item.detalle}</p>}
        {!fechaDestacada && item.fecha && <span className="micro apagado">{fechaCL(item.fecha, true)}</span>}
        <div className="portal-acciones">
          <Link className="portal-enlace" to={destino}>Ver detalle</Link>
          {documentoUrl && (
            <a className="portal-enlace portal-enlace-secundario" href={documentoUrl} target="_blank" rel="noreferrer">Abrir PDF</a>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaDocumento({ documento, mostrarComunidad = false }) {
  const url = urlDocumento(documento);
  const esPdf = documentoEsPdf(documento);
  return (
    <div className="tarjeta portal-documento">
      <div className="portal-doc-icon" aria-hidden="true">{esPdf ? 'PDF' : 'DOC'}</div>
      <div className="portal-documento-contenido">
        <strong>{documento.titulo || documento.nombre_archivo || 'Documento'}</strong>
        {mostrarComunidad && documento.comunidadNombre && <span className="micro">{documento.comunidadNombre}</span>}
        <div className="micro apagado portal-meta">
          {documento.nombre_archivo && documento.nombre_archivo !== documento.titulo && <span>{documento.nombre_archivo}</span>}
          {documento.fecha && <span>{fechaCL(documento.fecha)}</span>}
          {documento.origen && <span>{documento.origen}</span>}
        </div>
        {url ? (
          <a className="portal-enlace" href={url} target="_blank" rel="noreferrer">{esPdf ? 'Abrir PDF' : 'Abrir documento'}</a>
        ) : (
          <span className="micro apagado">Documento registrado sin enlace público.</span>
        )}
      </div>
    </div>
  );
}

function DetalleCliente({ id }) {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const [params, setParams] = useSearchParams();
  const tabInicial = TABS.some(([x]) => x === params.get('seccion')) ? params.get('seccion') : 'resumen';
  const [tab, setTab] = useState(tabInicial);
  const [vista, setVista] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      const rd = await supabase.rpc('portal_cliente_dashboard');
      if (!vigente) return;
      if (rd.error) {
        setError(rd.error.message);
        setCargando(false);
        return;
      }

      const comunidad = (rd.data ?? []).find(x => x.comunidad_id === id);
      if (!comunidad) {
        setError('Esta comunidad no está asociada a tu cuenta.');
        setCargando(false);
        return;
      }

      try {
        const datos = await cargarDetalleComunidad(id);
        if (vigente) setVista(construirVista(comunidad, datos));
      } catch (e) {
        if (vigente) setError(e?.message || 'No se pudo cargar la comunidad.');
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => { vigente = false; };
  }, [id, perfil?.id]);

  useEffect(() => {
    const seccion = params.get('seccion');
    if (TABS.some(([x]) => x === seccion)) setTab(seccion);
  }, [params]);

  function cambiarTab(nuevo) {
    setTab(nuevo);
    setParams({ seccion: nuevo }, { replace: true });
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  return (
    <div className="pantalla portal-pantalla">
      <header className="encabezado portal-encabezado">
        <button className="boton boton-texto portal-volver" onClick={() => navegar('/portal')}>
          ‹ Mis comunidades
        </button>
        <h1 className="h3">{vista?.comunidad?.nombre ?? 'Comunidad'}</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          {[vista?.comunidad?.direccion, vista?.comunidad?.comuna].filter(Boolean).join(' · ')}
        </p>
      </header>

      <div className="cuerpo portal-cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 14 }}>{error}</div>}
        {!vista ? null : (
          <>
            <nav className="pestanas" aria-label="Secciones de la comunidad">
              {TABS.map(([clave, texto]) => (
                <button key={clave} type="button" className={tab === clave ? 'activo' : ''} aria-pressed={tab === clave}
                        onClick={() => cambiarTab(clave)}>
                  {texto}
                </button>
              ))}
            </nav>

            {tab === 'resumen' && <ResumenComunidad vista={vista} cambiarTab={cambiarTab} />}
            {tab === 'incidencias' && <IncidenciasComunidad vista={vista} />}
            {tab === 'levantamientos' && <LevantamientosComunidad vista={vista} />}
            {tab === 'mantencion' && <MantencionesComunidad vista={vista} />}
            {tab === 'documentos' && <DocumentosComunidad vista={vista} />}
          </>
        )}
      </div>
    </div>
  );
}

function ResumenComunidad({ vista, cambiarTab }) {
  const { atencion, proximos, realizadosMes, realizados, informes } = vista;
  return (
    <>
      <section className="portal-resumen" aria-label="Resumen de la comunidad">
        <Kpi valor={atencion.length} etiqueta="Requieren atención" tono={atencion.length ? 'alerta' : 'ok'} />
        <Kpi valor={proximos.length} etiqueta="Próximamente" tono="proximo" />
        <Kpi valor={realizadosMes.length} etiqueta="Realizados este mes" tono="ok" />
      </section>

      <section className="portal-seccion portal-seccion-principal">
        <div className="portal-seccion-titulo portal-seccion-titulo-accion">
          <div className="fila crece"><h2 className="h4">Requiere atención</h2><span className="portal-contador">{atencion.length}</span></div>
        </div>
        {atencion.length === 0 ? (
          <EstadoVacio tipo="ok" titulo="Sin asuntos vencidos" texto="No hay incidencias abiertas sin programar ni trabajos vencidos." />
        ) : (
          <div className="portal-lista">
            {atencion.slice(0, 5).map(item => <TarjetaActividad key={item.id} item={item} />)}
          </div>
        )}
      </section>

      <section className="portal-seccion">
        <EncabezadoSeccion titulo="Qué viene" cantidad={proximos.length} />
        {proximos.length === 0 ? (
          <EstadoVacio titulo="Sin próximas actividades" texto="No hay intervenciones programadas para esta comunidad." />
        ) : (
          <div className="portal-lista">
            {proximos.slice(0, 6).map(item => <TarjetaActividad key={item.id} item={item} fechaDestacada />)}
          </div>
        )}
      </section>

      <section className="portal-seccion">
        <EncabezadoSeccion titulo="Qué se hizo" cantidad={realizados.length} />
        {realizados.length === 0 ? (
          <EstadoVacio titulo="Sin actividad reciente" texto="Los levantamientos, incidencias resueltas y mantenciones realizadas aparecerán aquí." />
        ) : (
          <div className="portal-timeline">
            {realizados.slice(0, 6).map(item => <FilaTimeline key={item.id} item={item} />)}
          </div>
        )}
      </section>

      <section className="portal-seccion">
        <div className="portal-seccion-titulo portal-seccion-titulo-accion">
          <div className="fila crece"><h2 className="h4">Informes recientes</h2><span className="portal-contador">{informes.length}</span></div>
          {informes.length > 0 && <button type="button" className="portal-enlace portal-enlace-boton" onClick={() => cambiarTab('documentos')}>Ver todos</button>}
        </div>
        {informes.length === 0 ? (
          <EstadoVacio titulo="Sin PDF publicados" texto="Cuando exista un informe disponible para el cliente aparecerá aquí." />
        ) : (
          <div className="portal-documentos-resumen">
            {informes.slice(0, 3).map((d, indice) => <TarjetaDocumento key={`${d.id}-${indice}`} documento={d} />)}
          </div>
        )}
      </section>
    </>
  );
}

function FilaTimeline({ item }) {
  return (
    <div className="portal-timeline-item">
      <div className="portal-timeline-marca" aria-hidden="true" />
      <div className="portal-timeline-contenido">
        <div className="portal-etiquetas">
          <span className="portal-tipo">{item.tipo}</span>
          <span className="micro apagado">{fechaCL(item.fecha)}</span>
        </div>
        <strong className="portal-actividad-titulo">{item.titulo}</strong>
        {item.detalle && <p className="micro apagado">{item.detalle}</p>}
        {urlDocumento(item.documento) && (
          <a className="portal-enlace" href={urlDocumento(item.documento)} target="_blank" rel="noreferrer">Abrir PDF</a>
        )}
      </div>
    </div>
  );
}

function IncidenciasComunidad({ vista }) {
  const abiertas = vista.incidencias.filter(i => !incidenciaCerrada(i));
  const cerradas = vista.incidencias.filter(incidenciaCerrada);

  return (
    <section className="portal-seccion portal-seccion-sin-margen">
      <EncabezadoSeccion titulo="Incidencias abiertas" cantidad={abiertas.length} />
      {abiertas.length === 0 ? (
        <EstadoVacio tipo="ok" titulo="No hay incidencias abiertas" texto="Las incidencias pendientes o programadas aparecerán aquí." />
      ) : (
        <div className="portal-lista">
          {abiertas.map(i => <TarjetaIncidencia key={i.id} incidencia={i} />)}
        </div>
      )}

      <div className="portal-bloque-separado">
        <EncabezadoSeccion titulo="Incidencias resueltas" cantidad={cerradas.length} />
        {cerradas.length === 0 ? (
          <EstadoVacio titulo="Sin incidencias resueltas registradas" texto="El historial de soluciones quedará disponible aquí." />
        ) : (
          <div className="portal-lista">
            {cerradas.map(i => <TarjetaIncidencia key={i.id} incidencia={i} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function TarjetaIncidencia({ incidencia }) {
  const cerrada = incidenciaCerrada(incidencia);
  return (
    <div className={`tarjeta portal-item ${cerrada ? '' : 'portal-item-pendiente'}`}>
      <div className="portal-etiquetas">
        <span className="portal-tipo">Incidencia</span>
        <span className={'portal-estado' + claseEstado(etiquetaEstado(incidencia.estado))}>{etiquetaEstado(incidencia.estado)}</span>
        {incidencia.prioridad && <span className="portal-estado">{incidencia.prioridad}</span>}
      </div>
      <strong className="portal-actividad-titulo">{incidencia.titulo || 'Incidencia'}</strong>
      {incidencia.descripcion && <p className="portal-item-texto">{incidencia.descripcion}</p>}
      <div className="micro apagado portal-meta">
        {incidencia.creado_en && <span>Detectada: {fechaCL(incidencia.creado_en)}</span>}
        {incidencia.programado_para && !cerrada && <span>Programada: {fechaCL(incidencia.programado_para, true)}</span>}
        {incidencia.resuelto_en && cerrada && <span>Resuelta: {fechaCL(incidencia.resuelto_en, true)}</span>}
      </div>
    </div>
  );
}

function LevantamientosComunidad({ vista }) {
  const docs = vista.documentosPorReferencia;
  return (
    <section className="portal-seccion portal-seccion-sin-margen">
      <EncabezadoSeccion titulo="Levantamientos" cantidad={vista.levantamientos.length} />
      {vista.levantamientos.length === 0 ? (
        <EstadoVacio titulo="Sin levantamientos visibles" texto="No hay levantamientos habilitados para tu cuenta en esta comunidad." />
      ) : (
        <div className="portal-lista">
          {vista.levantamientos.map(l => {
            const documentos = docs.get(String(l.id)) ?? [];
            const pdf = documentos.find(documentoEsPdf) || documentos[0] || null;
            const pdfUrl = urlDocumento(pdf);
            return (
              <div key={l.id} className="tarjeta portal-item">
                <div className="fila portal-item-cabecera">
                  <strong className="crece portal-actividad-titulo">{l.plantilla_nombre}</strong>
                  <span className={'portal-estado' + claseEstado(etiquetaEstado(l.estado))}>{etiquetaEstado(l.estado)}</span>
                </div>
                <div className="micro apagado portal-meta">
                  {l.periodo && <span>{l.periodo}</span>}
                  {l.programado_para && <span>Programado: {fechaCL(l.programado_para, true)}</span>}
                  {l.enviado_en && <span>Realizado: {fechaCL(l.enviado_en, true)}</span>}
                  {!l.programado_para && <span>Creado: {fechaCL(l.creado_en)}</span>}
                </div>
                {pdfUrl && (
                  <div className="portal-acciones">
                    <a className="portal-enlace" href={pdfUrl} target="_blank" rel="noreferrer">Abrir informe PDF</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vista.requerimientos.filter(r => !r.tiene_agendamiento).length > 0 && (
        <div className="portal-bloque-separado">
          <EncabezadoSeccion titulo="Pendientes de programación" cantidad={vista.requerimientos.filter(r => !r.tiene_agendamiento).length} />
          <div className="portal-lista">
            {vista.requerimientos.filter(r => !r.tiene_agendamiento).map(r => (
              <div key={r.id} className="tarjeta portal-item portal-item-pendiente">
                <div className="portal-etiquetas"><span className="portal-tipo">Levantamiento</span><span className="portal-estado chip-pendiente">Sin programar</span></div>
                <strong className="portal-actividad-titulo">{r.nombre || r.plantilla_nombre}</strong>
                <span className="micro apagado">{r.proxima_exigible ? `Fecha límite: ${fechaCL(r.proxima_exigible)}` : 'Aún sin fecha programada'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MantencionesComunidad({ vista }) {
  return (
    <section className="portal-seccion portal-seccion-sin-margen">
      <EncabezadoSeccion titulo="Mantenciones" cantidad={vista.mantenciones.length} />
      {vista.mantenciones.length === 0 ? (
        <EstadoVacio titulo="Sin mantenciones registradas" texto="Cuando exista un plan de mantención visible aparecerá aquí." />
      ) : (
        <div className="portal-lista">
          {vista.mantenciones.map(m => {
            const vencimiento = m.vencimiento_original || m.proxima_exigible;
            const vencida = Boolean(vencimiento && vencimiento < hoyChile());
            return (
              <div key={m.actividad_id} className={`tarjeta portal-item ${vencida ? 'portal-item-pendiente' : ''}`}>
                <div className="fila portal-item-cabecera">
                  <strong className="crece portal-actividad-titulo">{m.activo_nombre}</strong>
                  {m.activo_categoria && <span className="portal-estado">{m.activo_categoria}</span>}
                </div>
                <p className="portal-item-texto">{m.trabajo}</p>
                <div className="micro apagado portal-meta">
                  <span>{frecuencia(m)}</span>
                  {vencimiento && <span>{vencida ? 'Vencida' : 'Fecha límite'}: {fechaCL(vencimiento)}</span>}
                  {m.programado_para && <span>Programada: {fechaCL(m.programado_para, true)}</span>}
                  {m.proveedor && <span>Proveedor: {m.proveedor}</span>}
                </div>
                {m.ultima_ejecucion && (
                  <div className="portal-ejecucion">
                    <strong className="micro">Última ejecución: {fechaCL(m.ultima_ejecucion, true)}</strong>
                    {m.ejecutor && <span className="micro">Realizada por {m.ejecutor}</span>}
                    {m.observaciones && <span className="micro apagado">{m.observaciones}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DocumentosComunidad({ vista }) {
  const pdfs = vista.documentos.filter(documentoEsPdf);
  const otros = vista.documentos.filter(d => !documentoEsPdf(d));
  return (
    <section className="portal-seccion portal-seccion-sin-margen">
      <EncabezadoSeccion titulo="Informes PDF" cantidad={pdfs.length} />
      {pdfs.length === 0 ? (
        <EstadoVacio titulo="Aún no hay PDF publicados" texto="Los informes autorizados para el cliente quedarán disponibles aquí para consulta." />
      ) : (
        <div className="portal-documentos-resumen">
          {pdfs.map((d, indice) => <TarjetaDocumento key={`${d.id}-${indice}`} documento={d} />)}
        </div>
      )}

      {otros.length > 0 && (
        <div className="portal-bloque-separado">
          <EncabezadoSeccion titulo="Otros respaldos" cantidad={otros.length} />
          <div className="portal-documentos-resumen">
            {otros.map((d, indice) => <TarjetaDocumento key={`${d.id}-${indice}`} documento={d} />)}
          </div>
        </div>
      )}
    </section>
  );
}
