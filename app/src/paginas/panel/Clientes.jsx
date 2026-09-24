import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import './Clientes.css';

export default function Clientes() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const puedeAdministrar = perfil?.rol === 'superadmin';
  const [perfiles, setPerfiles] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [seleccionado, setSeleccionado] = useState('');
  const [asignaciones, setAsignaciones] = useState([]);
  const [visibilidades, setVisibilidades] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargarBase() {
    setError(null);
    const [rp, rc, rt] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, rol, activo').order('nombre'),
      supabase.from('comunidades').select('id, nombre, comuna').order('nombre'),
      supabase.from('plantillas_control').select('id, nombre, activa').eq('activa', true).order('nombre')
    ]);
    const fallo = [rp, rc, rt].find(r => r.error)?.error;
    if (fallo) return setError(fallo.message);
    setPerfiles(rp.data ?? []);
    setComunidades(rc.data ?? []);
    setPlantillas(rt.data ?? []);
    if (!seleccionado) {
      const primero = (rp.data ?? []).find(p => p.rol === 'cliente') ?? (rp.data ?? []).find(p => p.id !== perfil?.id);
      if (primero) setSeleccionado(primero.id);
    }
  }

  async function cargarAcceso(usuarioId) {
    if (!usuarioId) {
      setAsignaciones([]);
      setVisibilidades([]);
      return;
    }
    const [ra, rv] = await Promise.all([
      supabase.from('portal_cliente_comunidades').select('*').eq('usuario_id', usuarioId),
      supabase.from('portal_cliente_plantillas').select('*').eq('usuario_id', usuarioId)
    ]);
    const fallo = [ra, rv].find(r => r.error)?.error;
    if (fallo) return setError(fallo.message);
    setAsignaciones(ra.data ?? []);
    setVisibilidades(rv.data ?? []);
  }

  useEffect(() => { if (puedeAdministrar) cargarBase(); }, [puedeAdministrar]);
  useEffect(() => { cargarAcceso(seleccionado); }, [seleccionado]);

  const usuario = useMemo(() => perfiles.find(p => p.id === seleccionado) ?? null, [perfiles, seleccionado]);
  const asignacionPorComunidad = useMemo(() => new Map(asignaciones.map(a => [a.comunidad_id, a])), [asignaciones]);
  const visible = useMemo(() => new Map(visibilidades.map(v => [`${v.comunidad_id}:${v.plantilla_id}`, v])), [visibilidades]);

  if (!puedeAdministrar) {
    return (
      <div className="pantalla">
        <div className="cuerpo"><div className="aviso aviso-critico">Solo el superadministrador puede administrar clientes.</div></div>
      </div>
    );
  }

  async function convertirEnCliente() {
    if (!usuario || usuario.rol === 'cliente') return;
    const ok = window.confirm(`¿Convertir a ${usuario.nombre} en usuario Cliente? Su acceso interno quedará bloqueado.`);
    if (!ok) return;
    setGuardando(true);
    setError(null);
    const { error } = await supabase.rpc('asignar_rol_cliente', { p_usuario_id: usuario.id });
    setGuardando(false);
    if (error) return setError(error.message);
    setPerfiles(xs => xs.map(x => x.id === usuario.id ? { ...x, rol: 'cliente', activo: true } : x));
  }

  async function alternarComunidad(comunidadId, habilitar) {
    if (!usuario || usuario.rol !== 'cliente') return setError('Primero convierte esta cuenta en Cliente.');
    setGuardando(true);
    setError(null);
    let respuesta;
    const actual = asignacionPorComunidad.get(comunidadId);
    if (actual) {
      respuesta = await supabase.from('portal_cliente_comunidades')
        .update({ activa: habilitar })
        .eq('id', actual.id)
        .select().single();
    } else {
      respuesta = await supabase.from('portal_cliente_comunidades')
        .insert({ usuario_id: usuario.id, comunidad_id: comunidadId, activa: true })
        .select().single();
    }
    setGuardando(false);
    if (respuesta.error) return setError(respuesta.error.message);
    setAsignaciones(xs => {
      const existe = xs.some(x => x.comunidad_id === comunidadId);
      return existe
        ? xs.map(x => x.comunidad_id === comunidadId ? respuesta.data : x)
        : [...xs, respuesta.data];
    });
  }

  async function alternarPlantilla(comunidadId, plantillaId, habilitar) {
    if (!asignacionPorComunidad.get(comunidadId)?.activa) return;
    setGuardando(true);
    setError(null);
    const clave = `${comunidadId}:${plantillaId}`;
    const actual = visible.get(clave);
    let respuesta;
    if (actual) {
      respuesta = await supabase.from('portal_cliente_plantillas')
        .update({ visible: habilitar })
        .eq('id', actual.id)
        .select().single();
    } else {
      respuesta = await supabase.from('portal_cliente_plantillas')
        .insert({ usuario_id: usuario.id, comunidad_id: comunidadId, plantilla_id: plantillaId, visible: true })
        .select().single();
    }
    setGuardando(false);
    if (respuesta.error) return setError(respuesta.error.message);
    setVisibilidades(xs => {
      const existe = xs.some(x => x.comunidad_id === comunidadId && x.plantilla_id === plantillaId);
      return existe
        ? xs.map(x => x.comunidad_id === comunidadId && x.plantilla_id === plantillaId ? respuesta.data : x)
        : [...xs, respuesta.data];
    });
  }

  return (
    <div className="pantalla">
      <header className="encabezado">
        <button className="boton boton-texto" style={{ padding: '4px 8px 8px 0' }} onClick={() => navegar('/configuracion')}>
          ‹ Configuración
        </button>
        <h1 className="h3">Clientes y accesos</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          Asigna el rol Cliente, sus comunidades y los tipos de levantamiento que puede consultar.
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="usuario-cliente">Usuario</label>
          <select id="usuario-cliente" value={seleccionado} onChange={e => setSeleccionado(e.target.value)}>
            <option value="">Elegir…</option>
            {perfiles.filter(p => p.id !== perfil?.id).map(p => (
              <option key={p.id} value={p.id}>{p.nombre} — {p.rol}{p.activo ? '' : ' (inactivo)'}</option>
            ))}
          </select>
        </div>

        {usuario && (
          <>
            <section className="cliente-admin-cabecera tarjeta">
              <div>
                <strong>{usuario.nombre}</strong>
                <div className="micro apagado">Rol actual: {usuario.rol}</div>
              </div>
              {usuario.rol !== 'cliente' && (
                <button type="button" className="boton" onClick={convertirEnCliente} disabled={guardando}>
                  Convertir en Cliente
                </button>
              )}
              {usuario.rol === 'cliente' && <span className="cliente-admin-chip">Cliente</span>}
            </section>

            {usuario.rol === 'cliente' && (
              <section className="cliente-admin-seccion">
                <h2 className="h4">Comunidades autorizadas</h2>
                <p className="chico apagado">
                  Sin una asociación activa el cliente no ve la comunidad. Dentro de cada comunidad, los tipos de levantamiento parten ocultos.
                </p>

                <div className="cliente-admin-lista">
                  {comunidades.map(c => {
                    const activa = Boolean(asignacionPorComunidad.get(c.id)?.activa);
                    return (
                      <div key={c.id} className="tarjeta cliente-admin-comunidad">
                        <label className="cliente-admin-check">
                          <input type="checkbox" checked={activa} disabled={guardando}
                                 onChange={e => alternarComunidad(c.id, e.target.checked)} />
                          <span>
                            <strong>{c.nombre}</strong>
                            {c.comuna && <span className="micro apagado cliente-admin-bloque">{c.comuna}</span>}
                          </span>
                        </label>

                        {activa && (
                          <div className="cliente-admin-plantillas">
                            <strong className="micro">Levantamientos visibles</strong>
                            {plantillas.map(p => {
                              const v = visible.get(`${c.id}:${p.id}`);
                              return (
                                <label key={p.id} className="cliente-admin-check cliente-admin-check-secundario">
                                  <input type="checkbox" checked={Boolean(v?.visible)} disabled={guardando}
                                         onChange={e => alternarPlantilla(c.id, p.id, e.target.checked)} />
                                  <span>{p.nombre}</span>
                                </label>
                              );
                            })}
                            {plantillas.length === 0 && <span className="micro apagado">No hay plantillas activas.</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
