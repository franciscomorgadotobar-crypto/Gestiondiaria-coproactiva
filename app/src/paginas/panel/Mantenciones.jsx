import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import Confirmar from '../../componentes/Confirmar';
import './Mantenciones.css';

function fechaISOChile(valor = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(valor));
  const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}

function fechaCL(valor, hora = false) {
  if (!valor) return 'Sin fecha';
  const soloFecha = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloFecha ? valor + 'T12:00:00' : valor);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', hora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizar(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sumarDiasISO(iso, dias) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default function Mantenciones() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  useVolverGlobal(() => navegar('/inicio'));

  const puedeGestionar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);

  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState('vencidas');
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setError(null);

    supabase.rpc('mantenimiento_resumen_global')
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          setError(error.message);
          setFilas([]);
          return;
        }
        setFilas(data ?? []);
      });

    return () => { vigente = false; };
  }, []);

  const hoy = fechaISOChile();
  const limite30 = sumarDiasISO(hoy, 30);
  const ahora = Date.now();

  function estadoFila(x) {
    const vencimiento = x.vencimiento_original || x.proxima_exigible;
    const visitaPasada = x.programado_para
      && new Date(x.programado_para).getTime() < ahora
      && ['agendada', 'en_curso'].includes(x.estado_agendamiento);
    const vencida = Boolean(vencimiento && vencimiento < hoy);
    const programada = Boolean(
      x.agendamiento_id
      && ['agendada', 'en_curso'].includes(x.estado_agendamiento)
      && x.programado_para
      && new Date(x.programado_para).getTime() >= ahora
    );
    const sinAgendar = !x.agendamiento_id;
    const proxima = Boolean(
      vencimiento
      && vencimiento >= hoy
      && vencimiento <= limite30
    );

    return { vencida: vencida || visitaPasada, programada, sinAgendar, proxima };
  }

  const conteos = useMemo(() => {
    const r = { todas: filas?.length ?? 0, vencidas: 0, proximas: 0, sin_agendar: 0, programadas: 0, realizadas: 0 };
    for (const x of filas ?? []) {
      const e = estadoFila(x);
      if (e.vencida) r.vencidas++;
      if (e.proxima) r.proximas++;
      if (e.sinAgendar) r.sin_agendar++;
      if (e.programada) r.programadas++;
      if (x.ultima_ejecucion) r.realizadas++;
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, hoy, limite30]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar);
    let lista = (filas ?? []).filter(x => {
      if (q) {
        const bolsa = normalizar([
          x.comunidad_nombre,
          x.comuna,
          x.activo_nombre,
          x.activo_categoria,
          x.trabajo,
          x.proveedor_nombre,
          x.ejecutor
        ].filter(Boolean).join(' '));
        if (!bolsa.includes(q)) return false;
      }

      const e = estadoFila(x);
      if (filtro === 'vencidas') return e.vencida;
      if (filtro === 'proximas') return e.proxima && !e.vencida;
      if (filtro === 'sin_agendar') return e.sinAgendar;
      if (filtro === 'programadas') return e.programada;
      if (filtro === 'realizadas') return Boolean(x.ultima_ejecucion);
      return true;
    });

    return lista.sort((a, b) => {
      if (filtro === 'realizadas') {
        return new Date(b.ultima_ejecucion ?? 0) - new Date(a.ultima_ejecucion ?? 0);
      }
      const fa = a.vencimiento_original || a.proxima_exigible || a.programado_para || '9999-12-31';
      const fb = b.vencimiento_original || b.proxima_exigible || b.programado_para || '9999-12-31';
      return String(fa).localeCompare(String(fb));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, buscar, filtro, hoy, limite30]);

  const filtrosSecundarios = [
    ['realizadas', 'Realizadas', conteos.realizadas],
    ['todas', 'Todas', conteos.todas]
  ];

  async function confirmarEliminar() {
    const actividad = porEliminar;
    if (!actividad) return;
    setPorEliminar(null);
    setEliminando(true);
    setError(null);
    setAviso(null);

    const { data, error } = await supabase.rpc('mantenimiento_eliminar_actividad', {
      p_actividad_id: actividad.actividad_id
    });

    setEliminando(false);
    if (error) {
      setError(error.message);
      return;
    }

    setFilas(xs => (xs ?? []).filter(x => x.actividad_id !== actividad.actividad_id));
    setAviso(data?.mensaje || 'Mantención eliminada.');
  }

  return (
    <div className="pantalla mantenciones-pantalla">
      {porEliminar && (
        <Confirmar
          titulo="Eliminar mantención"
          mensaje={porEliminar.ultima_ejecucion
            ? `“${porEliminar.activo_nombre}: ${porEliminar.trabajo}” tiene historial de ejecución. Se retirará de uso, pero el historial se conservará.`
            : `“${porEliminar.activo_nombre}: ${porEliminar.trabajo}” se eliminará junto con su agenda pendiente. Esta acción no se puede deshacer.`}
          textoConfirmar="Eliminar"
          textoCancelar="Cancelar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}

      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }} onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
        </div>
        <h1 className="h3">Mantenciones</h1>
        <p className="chico apagado mantenciones-intro">
          Control global de fechas límite, visitas programadas, proveedores y ejecuciones de todas las comunidades.
        </p>
      </header>

      <div className="cuerpo mantenciones-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {aviso && (
          <div className="aviso aviso-ok">
            <span>{aviso}</span>
            <button type="button" className="boton boton-texto" onClick={() => setAviso(null)}>Cerrar</button>
          </div>
        )}

        <section className="mantenciones-kpis" aria-label="Resumen de mantenciones">
          <button type="button" className={filtro === 'vencidas' ? 'critico activo' : 'critico'} onClick={() => setFiltro('vencidas')}>
            <strong>{conteos.vencidas}</strong><span>Vencidas</span>
          </button>
          <button type="button" className={filtro === 'proximas' ? 'activo' : ''} onClick={() => setFiltro('proximas')}>
            <strong>{conteos.proximas}</strong><span>Próximos 30 días</span>
          </button>
          <button type="button" className={filtro === 'sin_agendar' ? 'activo' : ''} onClick={() => setFiltro('sin_agendar')}>
            <strong>{conteos.sin_agendar}</strong><span>Sin agendar</span>
          </button>
          <button type="button" className={filtro === 'programadas' ? 'activo' : ''} onClick={() => setFiltro('programadas')}>
            <strong>{conteos.programadas}</strong><span>Programadas</span>
          </button>
        </section>

        <section className="tarjeta mantenciones-herramientas">
          <div className="mantenciones-busqueda">
            <label className="campo">
              <span className="etiqueta-campo">Buscar</span>
              <input
                type="search"
                value={buscar}
                placeholder="Comunidad, activo, trabajo o proveedor"
                onChange={e => setBuscar(e.target.value)}
              />
            </label>
          </div>

          <div className="mantenciones-vistas-secundarias">
            <span className="micro apagado">Otras vistas</span>
            <div className="pestanas mantenciones-filtros" role="tablist" aria-label="Otras vistas de mantenciones">
              {filtrosSecundarios.map(([id, texto, cantidad]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === id}
                  className={filtro === id ? 'activo' : ''}
                  onClick={() => setFiltro(id)}
                >
                  {texto} <span>{cantidad}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {filas === null && !error && <p className="cargando">Cargando mantenciones…</p>}

        {filas && visibles.length === 0 && (
          <div className="tarjeta mantenciones-vacio">
            <span className="mantenciones-vacio-icono" aria-hidden="true">✓</span>
            <strong>No hay mantenciones en esta vista.</strong>
            <p className="chico apagado">
              {filtro === 'vencidas'
                ? 'No existen mantenciones vencidas. Puedes revisar las próximas o todas.'
                : 'Cambia la vista o revisa los planes dentro de cada comunidad.'}
            </p>
            {filtro !== 'todas' && (
              <button type="button" className="boton boton-secundario" onClick={() => setFiltro('todas')}>
                Ver todas
              </button>
            )}
          </div>
        )}

        <div className="mantenciones-lista">
          {visibles.map(x => {
            const e = estadoFila(x);
            const fechaLimite = x.vencimiento_original || x.proxima_exigible;
            return (
              <article key={x.actividad_id} className={'tarjeta mantencion-global' + (e.vencida ? ' vencida' : '')}>
                <div className="mantencion-global-cabecera">
                  <div className="crece">
                    <p className="micro apagado" style={{ margin: 0 }}>{x.comunidad_nombre}</p>
                    <h2 className="h4" style={{ margin: '3px 0 0' }}>{x.activo_nombre}: {x.trabajo}</h2>
                  </div>
                  {e.vencida
                    ? <span className="chip chip-critico">Vencida</span>
                    : e.programada
                      ? <span className="chip chip-cumple">Programada</span>
                      : <span className="chip chip-pendiente">Sin agendar</span>}
                </div>

                <div className="mantencion-global-datos">
                  <div>
                    <span className="micro apagado">Fecha límite</span>
                    <strong>{fechaCL(fechaLimite)}</strong>
                  </div>
                  <div>
                    <span className="micro apagado">Visita</span>
                    <strong>{x.programado_para ? fechaCL(x.programado_para, true) : 'Sin programar'}</strong>
                  </div>
                  <div>
                    <span className="micro apagado">Proveedor</span>
                    <strong>{x.proveedor_nombre || 'Sin proveedor'}</strong>
                  </div>
                  <div>
                    <span className="micro apagado">Última ejecución</span>
                    <strong>{x.ultima_ejecucion ? fechaCL(x.ultima_ejecucion, true) : 'Sin ejecución registrada'}</strong>
                  </div>
                </div>

                <div className="mantencion-global-acciones">
                  <Link to={'/comunidades/' + x.comunidad_id + '?seccion=agenda'} className="boton boton-secundario">
                    Abrir comunidad
                  </Link>
                  {x.proveedor_id && (
                    <Link to={'/proveedores/' + x.proveedor_id} className="boton boton-texto">
                      Ver proveedor
                    </Link>
                  )}
                  {x.proveedor_telefono && (
                    <a href={'tel:' + x.proveedor_telefono} className="boton boton-texto">Llamar</a>
                  )}
                  {x.proveedor_email && (
                    <a href={'mailto:' + x.proveedor_email} className="boton boton-texto">Correo</a>
                  )}
                  {puedeGestionar && (
                    <button
                      type="button"
                      className="boton boton-texto peligro"
                      disabled={eliminando}
                      onClick={() => setPorEliminar(x)}
                    >
                      Eliminar
                    </button>
                  )}
                  {x.documentos > 0 && <span className="micro apagado">{x.documentos} documento{x.documentos === 1 ? '' : 's'}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
