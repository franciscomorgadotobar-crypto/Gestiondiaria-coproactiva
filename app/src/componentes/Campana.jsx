import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* Campana de actividad pendiente.
 *
 * No es notificación de teléfono —eso llega con la app cerrada, y hoy no hay
 * ni claves ni servidor para eso—. Es un resumen que se abre al tocarla: qué
 * se te asignó, cuánto hay para hoy, cuánto queda en total.
 *
 * "Se te asignó" se calcula comparando cuándo se creó cada levantamiento
 * contra la última vez que esta persona abrió la campana en este mismo
 * teléfono —guardado en localStorage, nada en el servidor—. Es un cálculo
 * honesto pero limitado: vale para este dispositivo y se olvida si se borran
 * los datos del sitio. No hay, todavía, un registro de "quién vio qué" que
 * viaje entre dispositivos.
 */

const CLAVE_ULTIMA_VISTA = 'coproactiva:campana:ultima_vista';

function esHoy(fechaIso) {
  if (!fechaIso) return false;
  const a = new Date(fechaIso);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fechaHora(iso) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export default function Campana({ pendientes, miId }) {
  const [abierta, setAbierta] = useState(false);
  const [ultimaVista, setUltimaVista] = useState(undefined); // undefined = todavía no se leyó
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    try { setUltimaVista(localStorage.getItem(CLAVE_ULTIMA_VISTA)); }
    catch { setUltimaVista(null); }
  }, []);

  useEffect(() => {
    if (!miId) return;
    let vigente = true;
    supabase.from('notificaciones')
      .select('id, tipo, titulo, mensaje, bitacora_id, leida, creado_en')
      .eq('destinatario_id', miId)
      .eq('leida', false)
      .order('creado_en', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (vigente) setNotificaciones(data ?? []);
      });
    return () => { vigente = false; };
  }, [miId]);

  function cerrar() {
    setAbierta(false);
    try { localStorage.setItem(CLAVE_ULTIMA_VISTA, new Date().toISOString()); }
    catch { /* modo privado, o el navegador bloqueó el storage: no es grave, solo no recuerda */ }
  }

  function verTodas() {
    cerrar();
    document.getElementById('por-hacer')?.scrollIntoView({ behavior: 'smooth' });
  }

  const totalPendientes = pendientes.length;
  const total = totalPendientes + notificaciones.length;
  const criticos = pendientes.filter(p => p.items_criticos > 0).length
    + notificaciones.filter(n => n.tipo === 'bitacora_urgente').length;
  const hoy = pendientes.filter(p => esHoy(p.programado_para));
  // Sin una vista anterior registrada no hay con qué comparar: mostrar todo
  // como "nuevo" la primera vez sería una alarma falsa sobre nada.
  const nuevas = ultimaVista
    ? pendientes.filter(p => p.responsable_id === miId && p.creado_en && p.creado_en > ultimaVista)
    : [];

  async function abrirNotificacion(n) {
    setNotificaciones(xs => xs.filter(x => x.id !== n.id));
    await supabase.from('notificaciones')
      .update({ leida: true, leida_en: new Date().toISOString() })
      .eq('id', n.id);
    cerrar();
  }

  return (
    <>
      <button type="button"
              className={'campana' + (total === 0 ? ' sin-pendientes' : '')}
              onClick={() => setAbierta(true)}
              aria-label={total === 0 ? 'Sin pendientes' : `${total} pendientes, tocar para ver el detalle`}>
        🔔
        {total > 0 && (
          <span className={'globo' + (criticos > 0 ? ' critico' : '')}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierta && (
        <div className="modal-fondo" role="presentation" onClick={cerrar}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="campana-titulo"
               onClick={e => e.stopPropagation()}>
            <h2 id="campana-titulo" className="h3">Novedades</h2>

            {total === 0 ? (
              <p className="chico apagado" style={{ margin: '4px 0 4px' }}>
                Sin pendientes. Al día.
              </p>
            ) : (
              <>
                {notificaciones.length > 0 && (
                  <div className="aviso" style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                      Bitácora
                    </p>
                    {notificaciones.map(n => (
                      <Link
                        key={n.id}
                        to={n.bitacora_id ? `/bitacora/${n.bitacora_id}` : '/bitacora'}
                        onClick={() => abrirNotificacion(n)}
                        className="chico"
                        style={{ display: 'block', margin: '6px 0' }}
                      >
                        {n.tipo === 'bitacora_urgente' ? '🔴 ' : '🟠 '}
                        {n.mensaje || n.titulo}
                      </Link>
                    ))}
                  </div>
                )}
                {nuevas.length > 0 && (
                  <div className="aviso" style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                      {nuevas.length === 1
                        ? 'Se te asignó una tarea'
                        : `Se te asignaron ${nuevas.length} tareas nuevas`}
                    </p>
                    {nuevas.map(p => (
                      <Link key={p.id} to={`/control/${p.id}`} onClick={cerrar}
                            className="chico" style={{ display: 'block', margin: '4px 0' }}>
                        {p.destino_nombre}
                      </Link>
                    ))}
                  </div>
                )}

                <p className="chico" style={{ margin: '0 0 4px' }}>
                  {hoy.length > 0
                    ? `Tienes ${hoy.length} tarea${hoy.length > 1 ? 's' : ''} para hoy.`
                    : 'Nada agendado para hoy.'}
                </p>
                {hoy.length > 0 && (
                  <div style={{ margin: '8px 0 14px' }}>
                    {hoy.map(p => (
                      <Link key={p.id} to={`/control/${p.id}`} onClick={cerrar}
                            className="chico" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                        <span>{p.destino_nombre}</span>
                        {p.programado_para && <span className="apagado">{fechaHora(p.programado_para)}</span>}
                      </Link>
                    ))}
                  </div>
                )}

                <p className="chico apagado" style={{ margin: '0 0 14px' }}>
                  {totalPendientes} levantamiento{totalPendientes === 1 ? '' : 's'} pendiente{totalPendientes === 1 ? '' : 's'}
                  {notificaciones.length > 0 && ` · ${notificaciones.length} alerta${notificaciones.length === 1 ? '' : 's'} de Bitácora`}
                  {criticos > 0 && ` · ${criticos} crítico${criticos === 1 ? '' : 's'}`}.
                </p>
              </>
            )}

            <div className="fila-botones">
              <button type="button" className="boton boton-secundario boton-movil" onClick={cerrar}>
                Cerrar
              </button>
              {totalPendientes > 0 && (
                <button type="button" className="boton boton-movil" onClick={verTodas}>
                  Ver levantamientos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
