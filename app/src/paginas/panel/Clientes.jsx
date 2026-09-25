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
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  // null = todavía no se sabe. Se consulta al servidor porque la clave del
  // correo vive ahí; el navegador no tiene cómo saberlo por su cuenta.
  const [correoListo, setCorreoListo] = useState(null);
  const [horas, setHoras] = useState(24);
  // Cuando el correo falla, el enlace igual sirve: se muestra para poder
  // entregarlo por otro medio en vez de dejar a alguien sin acceso.
  const [enlace, setEnlace] = useState(null);

  /* Llama a la función del servidor con el token de la sesión actual. Ella
   * verifica el permiso contra la base: acá no se decide nada, solo se pide.
   * Es la misma función que usa Equipo: crear un cliente no es distinto de
   * crear a alguien del equipo, salvo por el rol que se le da. */
  async function servidor(cuerpo) {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/equipo`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cuerpo)
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error ?? 'No se pudo completar la operación');
    return datos;
  }

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

  useEffect(() => {
    if (!puedeAdministrar) return;
    cargarBase();
    servidor({ accion: 'estado' })
      .then(r => { setCorreoListo(Boolean(r.correo)); if (r.horas) setHoras(r.horas); })
      .catch(() => setCorreoListo(false));
  }, [puedeAdministrar]);
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

  /* La conversión sigue existiendo para el caso poco común de alguien que ya
   * tenía cuenta interna y pasa a ser cliente. El camino normal para un
   * cliente nuevo es "Agregar cliente": crea la cuenta directo con ese rol,
   * sin el rodeo de darlo de alta como equipo primero. */
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

  async function reenviarAcceso() {
    if (!usuario) return;
    if (!confirm(
      `Se le enviará a ${usuario.email} un enlace para crear una contraseña nueva. ` +
      'El enlace anterior, si lo había, deja de servir.'
    )) return;

    setGuardando(true);
    setError(null);
    try {
      const r = await servidor({ accion: 'reenviar', id: usuario.id });
      if (r.correo?.enviado) {
        setEnlace(null);
        setAviso(`Enlace enviado a ${usuario.email}. Vence en ${horas} horas.`);
      } else {
        setEnlace({ persona: usuario.nombre, url: r.enlace });
        setAviso(`El correo no salió (${r.correo?.motivo ?? 'sin detalle'}).`);
      }
    } catch (e) { setError(e.message); }
    setGuardando(false);
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
        {aviso && (
          <div className="aviso" style={{ marginBottom: 14 }}>
            {aviso}
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={() => setAviso(null)}>Entendido</button>
          </div>
        )}
        {enlace?.url && (
          <div className="aviso" style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px' }}>
              Este es el enlace de acceso de {enlace.persona}. Sirve una sola vez y
              vence en {horas} horas: entrégaselo por WhatsApp o dictándoselo.
            </p>
            <p className="enlace-acceso">{enlace.url}</p>
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={() => { navigator.clipboard?.writeText(enlace.url); setEnlace(null); }}>
              Copiar y cerrar
            </button>
          </div>
        )}
        {correoListo === false && (
          <div className="aviso aviso-critico" style={{ marginBottom: 14 }}>
            El envío de correo no está configurado. Sin él no hay cómo entregar el
            enlace de acceso, así que no se pueden crear clientes todavía.
          </div>
        )}

        {agregando ? (
          <AltaCliente
            correoListo={correoListo}
            onCancelar={() => setAgregando(false)}
            onCrear={async datos => {
              setGuardando(true);
              setError(null);
              try {
                const r = await servidor({ accion: 'crear', nombre: datos.nombre, email: datos.email, rol: 'cliente' });
                setAgregando(false);
                setAviso(r.correo?.enviado
                  ? `Invitación enviada a ${datos.email}. Tiene ${horas} horas para crear su contraseña.`
                  : `La cuenta quedó creada, pero el correo no salió (${r.correo?.motivo ?? 'sin detalle'}). Usa "Reenviar acceso" cuando esté resuelto.`);
                await cargarBase();
                setSeleccionado(r.id);
              } catch (e) { setError(e.message); }
              setGuardando(false);
            }}
          />
        ) : (
          <button className="boton boton-movil boton-ancho" style={{ marginBottom: 16 }}
                  onClick={() => setAgregando(true)}>
            Agregar cliente
          </button>
        )}

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="usuario-cliente">Usuario</label>
          <select id="usuario-cliente" value={seleccionado} onChange={e => setSeleccionado(e.target.value)}>
            <option value="">Elegir…</option>
            {perfiles
              // Un dado de baja no se ofrece para convertir en Cliente. Pero
              // si ya es Cliente sigue en la lista aunque esté inactivo: acá
              // es donde se gestiona y reactiva su acceso al portal.
              .filter(p => p.id !== perfil?.id && (p.activo || p.rol === 'cliente' || p.id === seleccionado))
              .map(p => (
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
              {usuario.rol === 'cliente' && (
                <div className="fila" style={{ gap: 8 }}>
                  <span className="cliente-admin-chip">Cliente</span>
                  <button type="button" className="boton boton-secundario" disabled={guardando || !usuario.activo}
                          onClick={reenviarAcceso}>
                    Reenviar acceso
                  </button>
                </div>
              )}
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

function AltaCliente({ correoListo, onCrear, onCancelar }) {
  const [datos, setDatos] = useState({ nombre: '', email: '' });

  return (
    <div className="tarjeta" style={{ padding: 16, marginBottom: 16 }}>
      <h2 className="h4" style={{ margin: '0 0 14px' }}>Agregar cliente</h2>

      <div className="campo">
        <label className="etiqueta-campo" htmlFor="nombre-cliente">Nombre</label>
        <input id="nombre-cliente" type="text" value={datos.nombre}
               onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
      </div>

      <div className="campo">
        <label className="etiqueta-campo" htmlFor="correo-cliente">Correo</label>
        <input id="correo-cliente" type="email" inputMode="email" value={datos.email}
               onChange={e => setDatos({ ...datos, email: e.target.value })} />
      </div>

      <p className="micro apagado" style={{ margin: '0 0 14px' }}>
        No se define contraseña acá. Le llega un enlace de un solo uso para que
        cree la suya, y nadie más llega a conocerla. Las comunidades que verá se
        asignan después de crear la cuenta.
      </p>

      <div className="fila" style={{ gap: 8, marginTop: 6 }}>
        <button className="boton boton-secundario crece" onClick={onCancelar}>Cancelar</button>
        <button className="boton crece"
                disabled={!datos.nombre || !datos.email.includes('@') || correoListo === false}
                onClick={() => onCrear(datos)}>
          Crear e invitar
        </button>
      </div>
    </div>
  );
}
