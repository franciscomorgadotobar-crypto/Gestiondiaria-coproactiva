import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import ProveedoresNavegacion from '../../componentes/ProveedoresNavegacion';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import './WhatsApp.css';

function fechaHora(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function alcanceTexto(v) {
  if (v === 'todos') return 'Todos';
  if (v === 'filtrados') return 'Filtrados';
  return 'Seleccionados';
}

export default function ProveedoresComunicaciones() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  const [comunicaciones, setComunicaciones] = useState(null);
  const [autores, setAutores] = useState({});
  const [seleccionada, setSeleccionada] = useState(null);
  const [destinatarios, setDestinatarios] = useState([]);
  const [error, setError] = useState(null);
  const puedeGestionar = ['superadmin','admin'].includes(perfil?.rol);

  useVolverGlobal(() => navegar('/proveedores'));

  async function cargar() {
    setError(null);
    const { data, error: e } = await supabase
      .from('proveedor_comunicaciones')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(100);
    if (e) return setError(e.message);

    const xs = data ?? [];
    setComunicaciones(xs);
    const ids = [...new Set(xs.map(x => x.creado_por).filter(Boolean))];
    if (ids.length) {
      const r = await supabase.from('perfiles').select('id,nombre').in('id', ids);
      if (!r.error) setAutores(Object.fromEntries((r.data ?? []).map(x => [x.id,x.nombre])));
    }
  }

  useEffect(() => { cargar(); }, []);

  async function abrir(c) {
    setSeleccionada(c);
    setDestinatarios([]);
    const { data, error: e } = await supabase
      .from('proveedor_comunicacion_destinatarios')
      .select('id,proveedor_id,empresa,contacto_nombre,email,estado,motivo_omision,error,enviado_en')
      .eq('comunicacion_id', c.id)
      .order('empresa');
    if (e) setError(e.message);
    else setDestinatarios(data ?? []);
  }

  if (!puedeGestionar) return <Navigate to="/inicio" replace />;

  return (
    <div className="pantalla proveedores-pantalla">
      <header className="encabezado">
        <div className="proveedores-intro">
          <div className="fila navegacion-interna" style={{ marginBottom: 6 }}>
            <button type="button" className="boton boton-texto" onClick={() => navegar('/proveedores')}>‹ Proveedores</button>
          </div>
          <h1 className="h3">Comunicaciones</h1>
          <p className="chico apagado proveedores-descripcion">
            Historial de comunicaciones enviadas a proveedores y resultado por destinatario.
          </p>
        </div>
        <div className="acciones-proveedores-cabecera">
          <button type="button" className="boton" onClick={() => navegar('/proveedores')}>
            Nueva comunicación
          </button>
        </div>
      </header>

      <div className="cuerpo">
        <ProveedoresNavegacion />

        {error && <div className="aviso aviso-critico">{error}</div>}

        {comunicaciones === null && <p className="cargando">Cargando comunicaciones…</p>}
        {comunicaciones?.length === 0 && (
          <div className="tarjeta comunicaciones-vacio">
            <strong>Todavía no hay comunicaciones registradas.</strong>
            <p className="chico apagado">Crea una comunicación desde el listado de proveedores.</p>
          </div>
        )}

        {comunicaciones?.length > 0 && (
          <div className="comunicaciones-layout">
            <section className="tarjeta comunicaciones-listado">
              <div className="comunicaciones-listado-cabecera">
                <strong>Historial</strong>
                <span className="micro apagado">{comunicaciones.length} comunicación{comunicaciones.length === 1 ? '' : 'es'}</span>
              </div>
              {comunicaciones.map(c => (
                <button type="button" key={c.id}
                        className={'comunicacion-fila' + (seleccionada?.id === c.id ? ' activa' : '')}
                        onClick={() => abrir(c)}>
                  <span className="comunicacion-fila-fecha">{fechaHora(c.creado_en)}</span>
                  <strong>{c.asunto}</strong>
                  <span>{autores[c.creado_por] || 'Usuario CoproActiva'} · {alcanceTexto(c.alcance)}</span>
                  <small>{c.enviados} enviados · {c.omitidos} omitidos · {c.fallidos} con error</small>
                </button>
              ))}
            </section>

            <section className="tarjeta comunicaciones-detalle">
              {!seleccionada ? (
                <div className="comunicaciones-placeholder">
                  <strong>Selecciona una comunicación</strong>
                  <p className="chico apagado">Verás el mensaje y el estado individual de cada destinatario.</p>
                </div>
              ) : (
                <>
                  <div className="comunicaciones-detalle-cabecera">
                    <div>
                      <span className="micro apagado">{fechaHora(seleccionada.creado_en)}</span>
                      <h2 className="h4">{seleccionada.asunto}</h2>
                      <p className="chico apagado">
                        {autores[seleccionada.creado_por] || 'Usuario CoproActiva'} · {alcanceTexto(seleccionada.alcance)}
                      </p>
                    </div>
                    <span className={'chip ' + (seleccionada.estado === 'enviada' ? 'chip-cumple' : seleccionada.estado === 'fallida' ? 'chip-critico' : 'chip-pendiente')}>
                      {seleccionada.estado}
                    </span>
                  </div>

                  <div className="comunicaciones-mensaje">
                    <span className="etiqueta-campo">Mensaje</span>
                    <p>{seleccionada.mensaje}</p>
                  </div>

                  <div className="comunicaciones-resumen">
                    <div><strong>{seleccionada.destinatarios_total}</strong><span>Objetivos</span></div>
                    <div><strong>{seleccionada.enviados}</strong><span>Enviados</span></div>
                    <div><strong>{seleccionada.omitidos}</strong><span>Omitidos</span></div>
                    <div><strong>{seleccionada.fallidos}</strong><span>Error</span></div>
                  </div>

                  <div className="tabla-responsive">
                    <table className="tabla comunicaciones-destinatarios">
                      <thead><tr><th>Proveedor</th><th>Contacto</th><th>Correo</th><th>Estado</th></tr></thead>
                      <tbody>
                        {destinatarios.map(d => (
                          <tr key={d.id}>
                            <td><strong>{d.empresa}</strong></td>
                            <td>{d.contacto_nombre || '—'}</td>
                            <td>{d.email || '—'}</td>
                            <td>
                              <span className={'chip ' + (d.estado === 'enviado' ? 'chip-cumple' : d.estado === 'error' ? 'chip-critico' : 'chip-pendiente')}>
                                {d.estado}
                              </span>
                              {(d.motivo_omision || d.error) && <small>{d.motivo_omision || d.error}</small>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
