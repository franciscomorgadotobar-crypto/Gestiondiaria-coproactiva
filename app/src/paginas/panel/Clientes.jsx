import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import Confirmar from '../../componentes/Confirmar';
import './Clientes.css';

export default function Clientes() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const [parametros, setParametros] = useSearchParams();
  const seleccionado = parametros.get('cliente') || '';
  const seccion = ['resumen', 'permisos', 'actividad'].includes(parametros.get('seccion'))
    ? parametros.get('seccion') : 'resumen';

  function abrirCliente(id) {
    setParametros(actual => {
      const siguientes = new URLSearchParams(actual);
      siguientes.set('cliente', id);
      siguientes.delete('seccion');
      return siguientes;
    }, { preventScrollReset: false });
  }
  function cerrarCliente() {
    setParametros(actual => {
      const siguientes = new URLSearchParams(actual);
      siguientes.delete('cliente');
      siguientes.delete('seccion');
      return siguientes;
    }, { replace: true, preventScrollReset: false });
  }
  function cambiarSeccion(destino) {
    setParametros(actual => {
      const siguientes = new URLSearchParams(actual);
      if (destino === 'resumen') siguientes.delete('seccion');
      else siguientes.set('seccion', destino);
      return siguientes;
    }, { replace: true, preventScrollReset: true });
  }

  useVolverGlobal(() => seleccionado ? cerrarCliente() : navegar('/configuracion'));
  const puedeAdministrar = perfil?.rol === 'superadmin';
  const [perfiles, setPerfiles] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [comunidades, setComunidades] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [asignacionesGlobales, setAsignacionesGlobales] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const peticionAcceso = useRef(0);
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
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [confirmarReenvio, setConfirmarReenvio] = useState(false);

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

  /* Esta pantalla es solo de clientes: alguien del equipo no aparece acá, ni
   * para "convertir" a cliente —eso ya no hace falta, "Agregar cliente" crea
   * la cuenta directo con ese rol— ni por ningún otro motivo. */
  async function cargarBase() {
    setError(null);
    setCargandoLista(true);
    const [rp, rc, rt, rg] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, email, rol, activo, ultimo_acceso, creado_en').eq('rol', 'cliente').order('nombre'),
      supabase.from('comunidades').select('id, nombre, comuna').order('nombre'),
      supabase.from('plantillas_control').select('id, nombre, activa, codigo').eq('activa', true).order('nombre'),
      supabase.from('portal_cliente_comunidades').select('usuario_id, comunidad_id, activa')
    ]);
    const fallo = [rp, rc, rt, rg].find(r => r.error)?.error;
    if (fallo) { setError(fallo.message); setCargandoLista(false); return; }
    setPerfiles(rp.data ?? []);
    setAsignacionesGlobales(rg.data ?? []);
    setComunidades(rc.data ?? []);
    // El diagnóstico comercial es previo a ganar la comunidad y de uso
    // interno: un cliente nunca lo ve, así que no se ofrece como permiso.
    setPlantillas((rt.data ?? []).filter(p => p.codigo !== 'diagnostico_comercial'));
    // La pantalla inicia en el listado, nunca abre un cliente por defecto.
    setCargandoLista(false);
  }

  async function cargarAcceso(usuarioId) {
    const numero = ++peticionAcceso.current;
    if (!usuarioId) {
      setAsignaciones([]);
      setVisibilidades([]);
      return;
    }
    const [ra, rv] = await Promise.all([
      supabase.from('portal_cliente_comunidades').select('*').eq('usuario_id', usuarioId),
      supabase.from('portal_cliente_plantillas').select('*').eq('usuario_id', usuarioId)
    ]);
    if (numero !== peticionAcceso.current) return;
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
  const clientesFiltrados = useMemo(() => perfiles.filter(p => {
    if (!mostrarInactivos && !p.activo) return false;
    const texto = (p.nombre + ' ' + p.email).toLocaleLowerCase('es-CL');
    return texto.includes(buscar.trim().toLocaleLowerCase('es-CL'));
  }), [perfiles, buscar, mostrarInactivos]);
  const comunidadesPorCliente = useMemo(() => {
    const mapa = new Map();
    for (const asignacion of asignacionesGlobales) {
      if (asignacion.activa) mapa.set(asignacion.usuario_id, (mapa.get(asignacion.usuario_id) || 0) + 1);
    }
    return mapa;
  }, [asignacionesGlobales]);
  const cantidadActivos = perfiles.filter(p => p.activo).length;
  const cantidadInactivos = perfiles.length - cantidadActivos;
  const autorizadas = comunidades.filter(c => asignaciones.some(a => a.comunidad_id === c.id && a.activa));
  const sinAutorizar = comunidades.filter(c => !asignaciones.some(a => a.comunidad_id === c.id && a.activa));
  const [mostrarDisponibles, setMostrarDisponibles] = useState(false);
  const [comunidadAbierta, setComunidadAbierta] = useState(null);
  useEffect(() => { setMostrarDisponibles(false); setComunidadAbierta(null); }, [seleccionado]);
  const fechaCorta = valor => valor
    ? new Date(valor).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Sin registro';
  const fechaLarga = valor => valor
    ? new Date(valor).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin registro';
  const asignacionPorComunidad = useMemo(() => new Map(asignaciones.map(a => [a.comunidad_id, a])), [asignaciones]);
  const visible = useMemo(() => new Map(visibilidades.map(v => [`${v.comunidad_id}:${v.plantilla_id}`, v])), [visibilidades]);

  if (!puedeAdministrar) {
    return (
      <div className="pantalla modulo-unificado">
        <div className="cuerpo"><div className="aviso aviso-critico">Solo el superadministrador puede administrar clientes.</div></div>
      </div>
    );
  }

  /* No se borra a nadie, ni siquiera a un cliente: se da de baja, igual que
   * en Equipo. Borrar la cuenta perdería qué comunidades y levantamientos
   * podía ver, y esa historia importa aunque ya no tenga acceso. */
  async function cambiarEstado(confirmado = false) {
    if (!usuario) return;
    if (usuario.activo && !confirmado) {
      setConfirmarBaja(true);
      return;
    }
    setConfirmarBaja(false);
    setGuardando(true);
    setError(null);
    try {
      await servidor({ accion: usuario.activo ? 'baja' : 'alta', id: usuario.id });
      setPerfiles(xs => xs.map(x => x.id === usuario.id ? { ...x, activo: !x.activo } : x));
      setAviso(usuario.activo
        ? `${usuario.nombre} quedó fuera. Su sesión se cerró en todos sus dispositivos.`
        : `${usuario.nombre} puede volver a entrar.`);
    } catch (e) { setError(e.message); }
    setGuardando(false);
  }

  async function reenviarAcceso(confirmado = false) {
    if (!usuario) return;
    if (!confirmado) {
      setConfirmarReenvio(true);
      return;
    }
    setConfirmarReenvio(false);
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
    if (!usuario) return;
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
    setAsignacionesGlobales(xs => {
      const existe = xs.some(x => x.usuario_id === usuario.id && x.comunidad_id === comunidadId);
      const nueva = { ...respuesta.data, usuario_id: usuario.id };
      return existe
        ? xs.map(x => x.usuario_id === usuario.id && x.comunidad_id === comunidadId ? nueva : x)
        : [...xs, nueva];
    });
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
    <div className="pantalla modulo-unificado clientes-pantalla">
      <header className="encabezado modulo-cabecera">
        <div>
          <span className="seleccion-area-etiqueta">Administración y ajustes</span>
          <h1 className="h3">Clientes y accesos</h1>
          <p className="chico apagado">
            Usuarios del portal, comunidades autorizadas, permisos y actividad registrada.
          </p>
        </div>
      </header>

      <div className="cuerpo modulo-contenido clientes-cuerpo">
        {error && <div className="aviso aviso-critico" role="alert">{error}</div>}
        {aviso && (
          <div className="aviso clientes-aviso" role="status">
            <span>{aviso}</span>
            <button type="button" className="boton boton-texto" onClick={() => setAviso(null)}>Cerrar</button>
          </div>
        )}
        {enlace?.url && (
          <div className="aviso clientes-aviso">
            <p>Enlace de acceso de {enlace.persona}: se usa una sola vez y vence en {horas} horas.</p>
            <p className="enlace-acceso">{enlace.url}</p>
            <button className="boton boton-secundario" onClick={() => {
              navigator.clipboard?.writeText(enlace.url);
              setEnlace(null);
            }}>Copiar enlace y cerrar</button>
          </div>
        )}
        {correoListo === false && (
          <div className="aviso aviso-critico">
            El correo de invitación no está configurado. No es posible crear clientes hasta configurar el envío.
          </div>
        )}

        {!usuario ? (
          <section className="clientes-listado" aria-label="Listado de clientes">
            <div className="clientes-listado-cabecera">
              <div>
                <h2 className="h4">Clientes activos</h2>
                <p className="chico apagado">Selecciona un cliente para consultar su ficha y administrar lo que puede ver.</p>
              </div>
              <button type="button" className="boton boton-primario clientes-crear"
                      disabled={guardando} onClick={() => setAgregando(x => !x)}>
                {agregando ? 'Cerrar formulario' : '+ Agregar cliente'}
              </button>
            </div>

            {agregando && (
              <AltaCliente
                correoListo={correoListo}
                onCancelar={() => setAgregando(false)}
                onCrear={async datos => {
                  setGuardando(true);
                  setError(null);
                  try {
                    const r = await servidor({
                      accion: 'crear', nombre: datos.nombre, email: datos.email, rol: 'cliente'
                    });
                    setAgregando(false);
                    setAviso(r.correo?.enviado
                      ? 'Invitación enviada a ' + datos.email + '. Tiene ' + horas + ' horas para crear su contraseña.'
                      : 'La cuenta quedó creada, pero el correo no salió (' + (r.correo?.motivo || 'sin detalle') + ').');
                    await cargarBase();
                    if (r.id) abrirCliente(r.id);
                  } catch (e) { setError(e.message); }
                  setGuardando(false);
                }}
              />
            )}

            <div className="clientes-resumen-metricas" role="group" aria-label="Estado de los clientes">
              <div className="clientes-resumen-metrica"><strong>{cantidadActivos}</strong><span>Activos</span></div>
              <div className="clientes-resumen-metrica"><strong>{cantidadInactivos}</strong><span>Inactivos</span></div>
              <div className="clientes-resumen-metrica"><strong>{perfiles.length}</strong><span>Total</span></div>
            </div>

            <div className="clientes-filtros">
              <label className="clientes-buscador">
                <span>Buscar cliente</span>
                <input type="search" value={buscar} placeholder="Nombre o correo…"
                       onChange={e => setBuscar(e.target.value)} />
              </label>
              <label className="clientes-mostrar-inactivos">
                <input type="checkbox" checked={mostrarInactivos}
                       onChange={e => setMostrarInactivos(e.target.checked)} />
                Mostrar inactivos
              </label>
            </div>

            {cargandoLista ? <p className="cargando" role="status">Cargando clientes…</p>
              : <div className="clientes-lista">
                {clientesFiltrados.map(cliente => (
                  <button type="button" key={cliente.id} className="clientes-lista-item"
                          aria-label={'Abrir ficha de ' + cliente.nombre}
                          onClick={() => abrirCliente(cliente.id)}>
                    <span className="clientes-avatar" aria-hidden="true">
                      {(cliente.nombre || 'C').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="clientes-lista-contenido">
                      <strong>{cliente.nombre}</strong>
                      <small>{cliente.email}</small>
                      <span className="clientes-lista-meta">
                        {comunidadesPorCliente.get(cliente.id) || 0} comunidades autorizadas
                        <span aria-hidden="true"> · </span>
                        Último acceso: {fechaCorta(cliente.ultimo_acceso)}
                      </span>
                    </span>
                    <span className="clientes-lista-derecha">
                      <span className={'clientes-estado ' + (cliente.activo ? 'clientes-estado-activo' : 'clientes-estado-inactivo')}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="clientes-lista-flecha" aria-hidden="true">›</span>
                    </span>
                  </button>
                ))}
                {!clientesFiltrados.length && (
                  <div className="clientes-vacio" role="status">
                    {perfiles.length ? 'No hay clientes que coincidan con los filtros.'
                      : 'Todavía no hay clientes registrados.'}
                  </div>
                )}
              </div>}
          </section>
        ) : (
          <section className="clientes-ficha" aria-label={'Ficha de ' + usuario.nombre}>
            <button type="button" className="clientes-volver-lista"
                    onClick={cerrarCliente}>‹ Lista de clientes</button>
            <div className="clientes-ficha-cabecera">
              <span className="clientes-avatar clientes-avatar-grande" aria-hidden="true">
                {(usuario.nombre || 'C').trim().charAt(0).toUpperCase()}
              </span>
              <div className="clientes-ficha-identidad">
                <h2 className="h4">{usuario.nombre}</h2>
                <p>{usuario.email}</p>
                <span className={'clientes-estado ' + (usuario.activo ? 'clientes-estado-activo' : 'clientes-estado-inactivo')}>
                  {usuario.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
                </span>
              </div>
            </div>

            <nav className="clientes-ficha-tabs" role="tablist" aria-label="Secciones del cliente">
              {[
                ['resumen', 'Resumen'],
                ['permisos', 'Comunidades y permisos'],
                ['actividad', 'Actividad']
              ].map(([id, etiqueta]) => (
                <button key={id} type="button" role="tab"
                        aria-selected={seccion === id}
                        className={seccion === id ? 'activo' : ''}
                        onClick={() => cambiarSeccion(id)}>{etiqueta}</button>
              ))}
            </nav>

            {seccion === 'resumen' && (
              <div className="clientes-ficha-contenido" role="tabpanel">
                <div className="clientes-ficha-resumen">
                  <div className="tarjeta clientes-tarjeta-dato">
                    <span>Comunidades autorizadas</span>
                    <strong>{autorizadas.length}</strong>
                    <small>{comunidades.length} comunidades registradas en el sistema</small>
                  </div>
                  <div className="tarjeta clientes-tarjeta-dato">
                    <span>Último acceso registrado</span>
                    <strong className="clientes-dato-fecha">{fechaLarga(usuario.ultimo_acceso)}</strong>
                    <small>Según la fecha disponible en el perfil</small>
                  </div>
                  <div className="tarjeta clientes-tarjeta-dato">
                    <span>Fecha de incorporación</span>
                    <strong className="clientes-dato-fecha">{fechaCorta(usuario.creado_en)}</strong>
                    <small>Registro de la cuenta en Coproactiva</small>
                  </div>
                </div>
                <div className="tarjeta clientes-ficha-acciones">
                  <div>
                    <h3 className="h4">Administración del acceso</h3>
                    <p className="chico apagado">Modifica comunidades y permisos sin alterar la información histórica.</p>
                  </div>
                  <div className="clientes-acciones-botones">
                    <button type="button" className="boton boton-secundario"
                            onClick={() => cambiarSeccion('permisos')}>Administrar permisos</button>
                    <button type="button" className="boton boton-secundario" disabled={guardando || !usuario.activo}
                            onClick={reenviarAcceso}>Reenviar acceso</button>
                    <button type="button" className="boton boton-secundario" disabled={guardando}
                            onClick={cambiarEstado}>{usuario.activo ? 'Dar de baja' : 'Reactivar cliente'}</button>
                  </div>
                </div>
              </div>
            )}

            {seccion === 'permisos' && (
              <div className="clientes-ficha-contenido" role="tabpanel">
                <div className="clientes-seccion-cabecera">
                  <div>
                    <h3 className="h4">Comunidades autorizadas ({autorizadas.length})</h3>
                    <p className="chico apagado">Los tipos de levantamiento se configuran por comunidad. Solo los marcados serán visibles en el portal.</p>
                  </div>
                  <button type="button" className="boton boton-secundario"
                          aria-expanded={mostrarDisponibles}
                          onClick={() => setMostrarDisponibles(x => !x)}>
                    {mostrarDisponibles ? 'Ocultar disponibles' : '+ Asignar comunidad'}
                  </button>
                </div>
                {mostrarDisponibles && (
                  <div className="tarjeta clientes-disponibles">
                    <h4>Comunidades disponibles</h4>
                    <p className="chico apagado">Marca una comunidad para habilitarla al cliente.</p>
                    {sinAutorizar.length === 0 && <p className="micro apagado">Todas las comunidades están asignadas.</p>}
                    {sinAutorizar.map(c => (
                      <label key={c.id} className="cliente-admin-check">
                        <input type="checkbox" checked={false} disabled={guardando}
                               onChange={() => alternarComunidad(c.id, true)} />
                        <span><strong>{c.nombre}</strong>
                          {c.comuna && <small className="cliente-admin-bloque apagado">{c.comuna}</small>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {autorizadas.length === 0 && (
                  <div className="clientes-vacio">Este cliente no tiene comunidades autorizadas.</div>
                )}
                <div className="clientes-comunidades">
                  {autorizadas.map(c => {
                    const abierta = comunidadAbierta === c.id;
                    const habilitadas = plantillas.filter(p => visible.get(c.id + ':' + p.id)?.visible).length;
                    return (
                      <article key={c.id} className="tarjeta clientes-comunidad-item">
                        <div className="clientes-comunidad-fila">
                          <button type="button" className="clientes-comunidad-boton"
                                  aria-expanded={abierta}
                                  onClick={() => setComunidadAbierta(abierta ? null : c.id)}>
                            <strong>{c.nombre}</strong>
                            <span>{c.comuna ? c.comuna + ' · ' : ''}{habilitadas} tipos de levantamiento visibles</span>
                          </button>
                          <span className="clientes-comunidad-controles">
                            <label title={'Autorizar comunidad ' + c.nombre}>
                              <input type="checkbox" checked={true} disabled={guardando}
                                     aria-label={'Acceso a ' + c.nombre}
                                     onChange={() => alternarComunidad(c.id, false)} />
                            </label>
                            <button type="button" className="clientes-comunidad-expandir"
                                    aria-label={(abierta ? 'Ocultar permisos de ' : 'Ver permisos de ') + c.nombre}
                                    onClick={() => setComunidadAbierta(abierta ? null : c.id)}>{abierta ? '⌃' : '⌄'}</button>
                          </span>
                        </div>
                        {abierta && (
                          <div className="clientes-plantillas">
                            <strong>Levantamientos visibles</strong>
                            {plantillas.map(p => (
                              <label key={p.id} className="cliente-admin-check cliente-admin-check-secundario">
                                <input type="checkbox" checked={Boolean(visible.get(c.id + ':' + p.id)?.visible)}
                                       disabled={guardando}
                                       onChange={e => alternarPlantilla(c.id, p.id, e.target.checked)} />
                                <span>{p.nombre}</span>
                              </label>
                            ))}
                            {!plantillas.length && <p className="micro apagado">No hay tipos de levantamiento activos.</p>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {seccion === 'actividad' && (
              <div className="clientes-ficha-contenido" role="tabpanel">
                <div className="clientes-seccion-cabecera">
                  <div>
                    <h3 className="h4">Actividad registrada</h3>
                    <p className="chico apagado">Información disponible actualmente para esta cuenta del portal.</p>
                  </div>
                </div>
                <div className="clientes-actividad-resumen">
                  <div className="tarjeta clientes-actividad-item">
                    <span>Último acceso registrado</span>
                    <strong>{fechaLarga(usuario.ultimo_acceso)}</strong>
                  </div>
                  <div className="tarjeta clientes-actividad-item">
                    <span>Cuenta creada</span>
                    <strong>{fechaLarga(usuario.creado_en)}</strong>
                  </div>
                  <div className="tarjeta clientes-actividad-item">
                    <span>Estado actual</span>
                    <strong>{usuario.activo ? 'Activa' : 'Inactiva'}</strong>
                  </div>
                </div>
                <div className="clientes-aviso-actividad">
                  <strong>Detalle de uso todavía no disponible</strong>
                  <p>La aplicación aún no dispone de un historial individual de visitas, documentos consultados o descargas. No se muestran acciones ni cifras estimadas como si estuvieran registradas.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      {confirmarBaja && usuario && (
        <Confirmar
          titulo="Dar de baja cliente"
          mensaje={`“${usuario.nombre}” quedará sin acceso al portal. Sus comunidades y permisos se conservan para poder reactivarlo después.`}
          textoConfirmar="Dar de baja"
          textoCancelar="Cancelar"
          onConfirmar={() => cambiarEstado(true)}
          onCancelar={() => setConfirmarBaja(false)}
        />
      )}

      {confirmarReenvio && usuario && (
        <Confirmar
          titulo="Reenviar acceso"
          mensaje={`Enviaremos a ${usuario.email} un enlace para crear una contraseña nueva. El enlace anterior dejará de funcionar.`}
          textoConfirmar="Reenviar acceso"
          textoCancelar="Cancelar"
          onConfirmar={() => reenviarAcceso(true)}
          onCancelar={() => setConfirmarReenvio(false)}
        />
      )}
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
