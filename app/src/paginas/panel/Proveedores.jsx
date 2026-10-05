import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import Confirmar from '../../componentes/Confirmar';

const MOTIVOS_LISTA_NEGRA = [
  'Mala experiencia',
  'Incumplimiento',
  'No responde',
  'Problema documental',
  'Reclamo de comunidad',
  'Fraude / información falsa',
  'Otro'
];

function normalizar(texto) {
  return (texto ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function soloDigitos(texto) {
  return (texto ?? '').replace(/[^0-9]/g, '');
}

function fechaCorta(valor) {
  if (!valor) return 'Sin fecha';
  return new Date(valor).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function fechaHora(valor) {
  if (!valor) return 'Sin registro';
  return new Date(valor).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function Proveedores() {
  const { perfil } = useSesion();
  const { id } = useParams();
  const navegar = useNavigate();
  const [proveedores, setProveedores] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [rubro, setRubro] = useState('');
  const [comuna, setComuna] = useState('');
  const [origen, setOrigen] = useState('');
  const [mostrarListaNegra, setMostrarListaNegra] = useState(false);
  const [orden, setOrden] = useState('reciente');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [formulario, setFormulario] = useState(null);
  const [blacklist, setBlacklist] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [correos, setCorreos] = useState([]);
  const [cargandoCorreos, setCargandoCorreos] = useState(false);
  const [syncEstado, setSyncEstado] = useState(null);

  const puedeGestionar = ['superadmin', 'admin'].includes(perfil?.rol);
  const puedeEliminar = perfil?.rol === 'superadmin';

  async function cargar({ mostrarResultado = false } = {}) {
    setSincronizando(true);
    setError(null);
    const [proveedoresResp, syncResp] = await Promise.all([
      supabase
        .from('proveedores')
        .select('*')
        .order('editado_en', { ascending: false }),
      supabase
        .from('proveedor_sync_estado')
        .select('ultima_revision,ultimo_exito,ultimo_error,en_ejecucion_desde,correos_procesados,proveedores_actualizados')
        .eq('clave', 'gmail_proveedores')
        .maybeSingle()
    ]);

    const { data, error } = proveedoresResp;
    if (!syncResp.error) setSyncEstado(syncResp.data ?? null);

    if (error) {
      setError(error.message);
      setSincronizando(false);
      return;
    }

    const lista = data ?? [];
    if (mostrarResultado) {
      let anterior = {};
      try {
        anterior = JSON.parse(localStorage.getItem('coproactiva_proveedores_snapshot') || '{}');
      } catch { anterior = {}; }

      const nuevos = lista.filter(p => !anterior[p.id]).length;
      const actualizados = lista.filter(p => anterior[p.id] && anterior[p.id] !== p.editado_en).length;
      const sinCambios = Math.max(0, lista.length - nuevos - actualizados);
      setResultadoSync({
        revisados: lista.length,
        nuevos,
        actualizados,
        sinCambios,
        excluidos: lista.filter(p => p.lista_negra).length
      });
    }

    setProveedores(lista);
    try {
      const snapshot = Object.fromEntries(lista.map(p => [p.id, p.editado_en]));
      localStorage.setItem('coproactiva_proveedores_snapshot', JSON.stringify(snapshot));
      localStorage.setItem('coproactiva_proveedores_ultima_carga', new Date().toISOString());
    } catch { /* navegador sin almacenamiento */ }
    setSincronizando(false);
  }

  useEffect(() => {
    cargar();
    const cadaDia = window.setInterval(() => cargar(), 24 * 60 * 60 * 1000);
    return () => window.clearInterval(cadaDia);
  }, []);

  const seleccionado = useMemo(
    () => id ? proveedores?.find(p => p.id === id) ?? null : null,
    [id, proveedores]
  );

  useEffect(() => {
    if (!seleccionado) {
      setCorreos([]);
      return;
    }

    let vigente = true;
    setCargandoCorreos(true);

    supabase
      .from('proveedor_correos')
      .select('id,asunto,fecha_correo,remitente_nombre,remitente_email,snippet,cuerpo_texto,adjuntos,storage_path_eml')
      .eq('proveedor_id', seleccionado.id)
      .order('fecha_correo', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!vigente) return;
        if (!error) setCorreos(data ?? []);
        setCargandoCorreos(false);
      });

    return () => { vigente = false; };
  }, [seleccionado?.id]);

  const rubros = useMemo(
    () => [...new Set((proveedores ?? []).map(p => p.rubro).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')),
    [proveedores]
  );
  const comunas = useMemo(() => {
    const todas = [];
    for (const p of proveedores ?? []) {
      for (const c of (p.comunas ?? '').split(/[,;]+/).map(x => x.trim()).filter(Boolean)) todas.push(c);
    }
    return [...new Set(todas)].sort((a,b) => a.localeCompare(b, 'es'));
  }, [proveedores]);
  const origenes = useMemo(
    () => [...new Set((proveedores ?? []).map(p => p.origen).filter(Boolean))].sort(),
    [proveedores]
  );

  const resumen = useMemo(() => {
    const lista = proveedores ?? [];
    const especialidades = new Set();
    for (const p of lista) {
      if (p.rubro) especialidades.add(normalizar(p.rubro));
      for (const e of p.especialidades ?? []) {
        if (e) especialidades.add(normalizar(e));
      }
    }
    return {
      proveedores: lista.length,
      especialidades: especialidades.size,
      listaNegra: lista.filter(p => p.lista_negra).length
    };
  }, [proveedores]);

  const listaFiltrada = useMemo(() => {
    const q = normalizar(busqueda);

    let lista = (proveedores ?? []).filter(p => {
      if (!mostrarListaNegra && p.lista_negra) return false;
      if (rubro && p.rubro !== rubro) return false;
      if (origen && p.origen !== origen) return false;
      if (comuna && !normalizar([p.comunas, ...(p.regiones ?? [])].filter(Boolean).join(' ')).includes(normalizar(comuna))) return false;

      if (!q) return true;
      const bolsa = [
        p.empresa, p.rut, p.contacto_nombre, p.contacto_cargo, p.email,
        p.telefono, p.sitio_web, p.rubro, p.servicios, p.comunas, p.notas,
        p.direccion, p.condiciones_comerciales, p.gmail_asunto_ultimo,
        ...(p.regiones ?? []), ...(p.especialidades ?? []),
        ...(p.palabras_clave ?? []), ...(p.certificaciones ?? []), ...(p.marcas ?? []),
        JSON.stringify(p.contactos ?? [])
      ].map(normalizar).join(' ');
      return bolsa.includes(q);
    });

    lista = [...lista].sort((a, b) => {
      if (orden === 'empresa') return (a.empresa ?? '').localeCompare(b.empresa ?? '', 'es');
      if (orden === 'especialidad') return (a.rubro ?? '').localeCompare(b.rubro ?? '', 'es');
      return new Date(b.editado_en ?? b.creado_en ?? 0) - new Date(a.editado_en ?? a.creado_en ?? 0);
    });
    return lista;
  }, [proveedores, busqueda, rubro, comuna, origen, mostrarListaNegra, orden]);

  function limpiarFiltros() {
    setRubro('');
    setComuna('');
    setOrigen('');
    setMostrarListaNegra(false);
  }

  async function guardarProveedor(datos) {
    setError(null);
    const ahora = new Date().toISOString();
    const payload = {
      empresa: datos.empresa.trim(),
      rut: datos.rut.trim() || null,
      rubro: datos.rubro.trim(),
      servicios: datos.servicios.trim() || null,
      contacto_nombre: datos.contacto_nombre.trim() || null,
      contacto_cargo: datos.contacto_cargo.trim() || null,
      telefono: datos.telefono.trim() || null,
      email: datos.email.trim() || null,
      sitio_web: datos.sitio_web.trim() || null,
      comunas: datos.comunas.trim() || null,
      notas: datos.notas.trim() || null,
      origen: datos.origen || 'manual',
      editado_en: ahora,
      editado_por: perfil.id
    };

    let respuesta;
    if (datos.id) {
      respuesta = await supabase.from('proveedores').update(payload).eq('id', datos.id).select().single();
    } else {
      respuesta = await supabase.from('proveedores').insert({
        ...payload,
        creado_por: perfil.id
      }).select().single();
    }

    if (respuesta.error) {
      setError(respuesta.error.message);
      return false;
    }

    setFormulario(null);
    await cargar();
    setAviso(datos.id ? 'Proveedor actualizado.' : 'Proveedor agregado.');
    if (!datos.id) navegar('/proveedores/' + respuesta.data.id);
    return true;
  }

  async function cambiarListaNegra(p, datos = null) {
    setError(null);
    const ahora = new Date().toISOString();
    const activar = !p.lista_negra;
    const cambios = activar ? {
      lista_negra: true,
      lista_negra_en: ahora,
      lista_negra_por: perfil.id,
      lista_negra_motivo: datos.motivo,
      lista_negra_detalle: datos.detalle?.trim() || null,
      editado_en: ahora,
      editado_por: perfil.id
    } : {
      lista_negra: false,
      lista_negra_en: null,
      lista_negra_por: null,
      lista_negra_motivo: null,
      lista_negra_detalle: null,
      editado_en: ahora,
      editado_por: perfil.id
    };

    const { error } = await supabase.from('proveedores').update(cambios).eq('id', p.id);
    if (error) {
      setError(error.message);
      return;
    }
    setBlacklist(null);
    await cargar();
    setAviso(activar ? 'Proveedor agregado a lista negra.' : 'Proveedor retirado de lista negra.');
  }

  async function eliminarProveedor(p) {
    setPorEliminar(null);
    setError(null);
    const { error } = await supabase.from('proveedores').delete().eq('id', p.id);
    if (error) {
      setError(error.message);
      return;
    }
    navegar('/proveedores');
    await cargar();
    setAviso('Proveedor eliminado.');
  }

  function abrirContacto(p, canal) {
    if (canal === 'llamada' && p.telefono) {
      window.location.href = 'tel:' + p.telefono.replace(/\s+/g, '');
    } else if (canal === 'whatsapp' && p.telefono) {
      const digitos = soloDigitos(p.telefono);
      window.location.href = 'https://wa.me/' + digitos;
    } else if (canal === 'correo' && p.email) {
      window.location.href = 'mailto:' + p.email;
    }
  }

  async function sincronizarGmail() {
    setSincronizando(true);
    setError(null);
    setResultadoSync(null);
    setAviso(null);

    const { data, error: e } = await supabase.functions.invoke('sincronizar-proveedores-gmail', {
      body: { origen: 'manual', limite_backfill: 6 }
    });

    if (e || !data?.ok) {
      setError(data?.error || e?.message || 'No se pudo sincronizar Gmail.');
      setSincronizando(false);
      return;
    }

    await cargar({ mostrarResultado: true });
    const partes = [];
    if (data.correos_nuevos) partes.push(`${data.correos_nuevos} correo${data.correos_nuevos === 1 ? '' : 's'} nuevo${data.correos_nuevos === 1 ? '' : 's'}`);
    if (data.adjuntos_guardados) partes.push(`${data.adjuntos_guardados} adjunto${data.adjuntos_guardados === 1 ? '' : 's'} guardado${data.adjuntos_guardados === 1 ? '' : 's'}`);
    if (data.proveedores_actualizados) partes.push(`${data.proveedores_actualizados} proveedor${data.proveedores_actualizados === 1 ? '' : 'es'} actualizado${data.proveedores_actualizados === 1 ? '' : 's'}`);
    if (Number.isFinite(data.faltan_backfill) && data.faltan_backfill > 0) {
      partes.push(`${data.faltan_backfill} proveedor${data.faltan_backfill === 1 ? '' : 'es'} pendiente${data.faltan_backfill === 1 ? '' : 's'} de reprocesar`);
    }
    setAviso(partes.length ? 'Gmail actualizado: ' + partes.join(' · ') + '.' : 'Gmail revisado. No había información nueva.');
    setSincronizando(false);
  }

  async function abrirArchivoCorreo(storagePath) {
    if (!storagePath) return;
    const { data, error: e } = await supabase.storage
      .from('proveedores-correo')
      .createSignedUrl(storagePath, 300);
    if (e || !data?.signedUrl) {
      setError(e?.message || 'No se pudo abrir el archivo.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  if (!puedeGestionar) return <Navigate to="/inicio" replace />;

  if (id && proveedores && !seleccionado) {
    return (
      <div className="pantalla">
        <div className="cuerpo">
          <div className="aviso aviso-critico">Este proveedor no existe o ya fue eliminado.</div>
          <button className="boton boton-secundario" onClick={() => navegar('/proveedores')}>Volver a proveedores</button>
        </div>
      </div>
    );
  }

  if (seleccionado) {
    return (
      <FichaProveedor
        p={seleccionado}
        correos={correos}
        cargandoCorreos={cargandoCorreos}
        onAbrirArchivo={abrirArchivoCorreo}
        puedeEliminar={puedeEliminar}
        onVolver={() => navegar('/proveedores')}
        onEditar={() => setFormulario({ ...seleccionado })}
        onBlacklist={() => seleccionado.lista_negra ? cambiarListaNegra(seleccionado) : setBlacklist(seleccionado)}
        onEliminar={() => setPorEliminar(seleccionado)}
        onContacto={canal => abrirContacto(seleccionado, canal)}
        aviso={aviso}
        error={error}
        onCerrarAviso={() => setAviso(null)}
      >
        {formulario && (
          <Modal>
            <FormularioProveedor inicial={formulario} onCancelar={() => setFormulario(null)} onGuardar={guardarProveedor} />
          </Modal>
        )}
        {blacklist && (
          <Modal>
            <FormularioBlacklist proveedor={blacklist} onCancelar={() => setBlacklist(null)}
                                onGuardar={datos => cambiarListaNegra(blacklist, datos)} />
          </Modal>
        )}
        {porEliminar && (
          <Confirmar
            titulo="Eliminar proveedor"
            mensaje={`“${porEliminar.empresa}” y su información asociada se eliminarán definitivamente. Esta acción está reservada al superadministrador.`}
            textoConfirmar="Eliminar"
            textoCancelar="Cancelar"
            onConfirmar={() => eliminarProveedor(porEliminar)}
            onCancelar={() => setPorEliminar(null)}
          />
        )}
      </FichaProveedor>
    );
  }

  return (
    <div className="pantalla proveedores-pantalla">
      <header className="encabezado">
        <div className="proveedores-intro">
          <h1 className="h3">Proveedores</h1>
          <p className="chico apagado proveedores-descripcion">
            Repositorio de proveedores alimentado automáticamente desde Gmail y también de forma manual.
          </p>
        </div>
        <div className="acciones-proveedores-cabecera">
          <button type="button" className="boton" onClick={() => setFormulario({})}>
            + Agregar proveedor
          </button>
          <button type="button" className="boton boton-secundario"
                  disabled={sincronizando}
                  onClick={sincronizarGmail}>
            {sincronizando ? 'Actualizando…' : '↻ Actualizar ahora'}
          </button>
        </div>
        <p className="micro apagado proveedores-ultima">
          Gmail automático · Última sincronización: {syncEstado?.ultimo_exito ? fechaHora(syncEstado.ultimo_exito) : 'pendiente'}
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}
        {aviso && (
          <div className="aviso aviso-ok" style={{ marginBottom: 12 }}>
            {aviso}
            <button className="boton boton-texto" onClick={() => setAviso(null)}>Cerrar</button>
          </div>
        )}

        {proveedores && (
          <div className="tablero proveedores-resumen proveedores-resumen-tres">
            <div>
              <p className="n">{resumen.proveedores}</p>
              <p className="r">Proveedores</p>
            </div>
            <div>
              <p className="n">{resumen.especialidades}</p>
              <p className="r">Especialidades</p>
            </div>
            <div className={resumen.listaNegra ? 'critico' : ''}>
              <p className="n">{resumen.listaNegra}</p>
              <p className="r">Lista negra</p>
            </div>
          </div>
        )}

        <div className="proveedores-busqueda-fila">
          <label className="buscador-proveedores crece">
            <span aria-hidden="true">⌕</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                   placeholder="Buscar empresa, contacto, servicio, rubro, comuna, teléfono o correo…" />
          </label>
          <button type="button" className={'boton boton-secundario filtro-toggle' + (filtrosAbiertos ? ' activo' : '')}
                  onClick={() => setFiltrosAbiertos(x => !x)}>
            Filtros
          </button>
        </div>

        {filtrosAbiertos && (
          <div className="tarjeta proveedores-filtros">
            <div className="campo">
              <label className="etiqueta-campo">Rubro</label>
              <select value={rubro} onChange={e => setRubro(e.target.value)}>
                <option value="">Todos los rubros</option>
                {rubros.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="campo">
              <label className="etiqueta-campo">Comuna</label>
              <select value={comuna} onChange={e => setComuna(e.target.value)}>
                <option value="">Todas las comunas</option>
                {comunas.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="campo">
              <label className="etiqueta-campo">Origen</label>
              <select value={origen} onChange={e => setOrigen(e.target.value)}>
                <option value="">Todos los orígenes</option>
                {origenes.map(x => <option key={x} value={x}>{x === 'correo' ? 'Correo' : 'Manual'}</option>)}
              </select>
            </div>
            <label className="marca proveedor-filtro-lista-negra">
              <input type="checkbox" checked={mostrarListaNegra}
                     onChange={e => setMostrarListaNegra(e.target.checked)} />
              <span>Incluir proveedores en lista negra</span>
            </label>
            <button type="button" className="boton boton-texto proveedores-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        )}

        <div className="fila proveedores-resultado-cabecera">
          <span className="micro crece">{listaFiltrada.length} proveedor{listaFiltrada.length === 1 ? '' : 'es'}</span>
          <label className="micro">
            Ordenar por{' '}
            <select value={orden} onChange={e => setOrden(e.target.value)} className="select-inline">
              <option value="reciente">Más reciente</option>
              <option value="empresa">Empresa</option>
              <option value="especialidad">Especialidad</option>
            </select>
          </label>
        </div>

        {proveedores === null && <p className="cargando">Cargando proveedores…</p>}
        {proveedores && listaFiltrada.length === 0 && (
          <p className="vacio">No hay proveedores que coincidan con la búsqueda y filtros.</p>
        )}

        <div className="proveedores-lista-movil">
          {listaFiltrada.map(p => (
            <TarjetaProveedor key={p.id} p={p}
              onAbrir={() => navegar('/proveedores/' + p.id)}
              onContacto={canal => abrirContacto(p, canal)} />
          ))}
        </div>

        <div className="proveedores-tabla-wrap">
          <table className="proveedores-tabla">
            <thead>
              <tr>
                <th>Empresa / Contacto</th>
                <th>Especialidad / Servicios</th>
                <th>Cobertura</th>
                <th>Origen</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(p => (
                <tr key={p.id} onClick={() => navegar('/proveedores/' + p.id)}>
                  <td>
                    <strong>{p.empresa}</strong>
                    <span>{p.contacto_nombre || 'Sin contacto'}</span>
                    <span>{p.email || p.telefono || 'Sin datos de contacto'}</span>
                  </td>
                  <td><strong>{p.rubro || p.especialidades?.[0] || 'Sin especialidad'}</strong><span>{p.servicios || 'Sin servicios informados'}</span></td>
                  <td>{[p.comunas, ...(p.regiones ?? [])].filter(Boolean).join(', ') || 'Sin cobertura informada'}</td>
                  <td>
                    <span>{p.origen === 'correo' ? 'Gmail' : 'Manual'}</span>
                    {p.lista_negra && <span className="chip chip-critico">Lista negra</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="acciones-contacto-mini">
                      <button disabled={!p.telefono} onClick={() => abrirContacto(p, 'llamada')} title="Llamar">☎</button>
                      <button disabled={!p.telefono} onClick={() => abrirContacto(p, 'whatsapp')} title="WhatsApp">WA</button>
                      <button disabled={!p.email} onClick={() => abrirContacto(p, 'correo')} title="Correo">✉</button>
                      <button onClick={() => navegar('/proveedores/' + p.id)} title="Ver ficha">›</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formulario && (
        <Modal>
          <FormularioProveedor inicial={formulario} onCancelar={() => setFormulario(null)} onGuardar={guardarProveedor} />
        </Modal>
      )}

      {resultadoSync && (
        <Modal>
          <div className="proveedor-modal">
            <button className="modal-cerrar" onClick={() => setResultadoSync(null)} aria-label="Cerrar">×</button>
            <div className="sync-ok">✓</div>
            <h2 className="h3" style={{ textAlign: 'center' }}>Actualización terminada</h2>
            <p className="chico apagado" style={{ textAlign: 'center', marginTop: 4 }}>
              Se actualizaron los datos disponibles del repositorio.
            </p>
            <div className="sync-resumen">
              <div><strong>{resultadoSync.revisados}</strong><span>Revisados</span></div>
              <div><strong>{resultadoSync.nuevos}</strong><span>Nuevos</span></div>
              <div><strong>{resultadoSync.actualizados}</strong><span>Actualizados</span></div>
              <div><strong>{resultadoSync.sinCambios}</strong><span>Sin cambios</span></div>
              <div><strong>{resultadoSync.excluidos}</strong><span>Lista negra</span></div>
            </div>
            <button className="boton boton-ancho" onClick={() => setResultadoSync(null)}>Aceptar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TarjetaProveedor({ p, onAbrir, onContacto }) {
  return (
    <article className="tarjeta proveedor-tarjeta">
      <button type="button" className="proveedor-tarjeta-principal" onClick={onAbrir}>
        <span className="crece proveedor-tarjeta-contenido">
          <strong>{p.empresa}</strong>
          <span className="proveedor-servicios-resumen">
            {p.servicios || p.notas || 'Sin descripción de servicios'}
          </span>
          <small>
            {p.rubro || 'Sin rubro'}
            {p.comunas ? ' · ' + p.comunas : ''}
            {p.contacto_nombre ? ' · ' + p.contacto_nombre : ''}
          </small>
          {p.origen === 'correo' && (
            <small className="proveedor-origen-resumen">
              Correo de origen · {fechaCorta(p.fecha_contacto)}
            </small>
          )}
        </span>
        {p.lista_negra && <span className="chip chip-critico">Lista negra</span>}
        <span className="flecha">›</span>
      </button>
      <div className="proveedor-contactos">
        <button disabled={!p.telefono} onClick={() => onContacto('llamada')}>☎ Llamar</button>
        <button disabled={!p.telefono} onClick={() => onContacto('whatsapp')}>WhatsApp</button>
        <button disabled={!p.email} onClick={() => onContacto('correo')}>✉ Correo</button>
      </div>
    </article>
  );
}

function FichaProveedor({ p, correos, cargandoCorreos, onAbrirArchivo, puedeEliminar, onVolver, onEditar, onBlacklist, onEliminar, onContacto, aviso, error, onCerrarAviso, children }) {
  return (
    <div className="pantalla proveedor-ficha">
      <header className="encabezado">
        <div className="fila" style={{ alignItems: 'flex-start', gap: 10 }}>
          <div className="crece">
            <div className="fila" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <h1 className="h3" style={{ margin: 0 }}>{p.empresa}</h1>
              {p.lista_negra && <span className="chip chip-critico">Lista negra</span>}
            </div>
            <p className="chico apagado" style={{ margin: '4px 0 0' }}>
              {[p.rut, p.rubro].filter(Boolean).join(' · ') || 'Proveedor'}
            </p>
          </div>
          <button type="button" className="boton boton-secundario" onClick={onEditar}>Editar</button>
        </div>
        <div className="acciones-proveedor-ficha">
          <button disabled={!p.telefono} onClick={() => onContacto('llamada')}>☎ Llamar</button>
          <button disabled={!p.telefono} onClick={() => onContacto('whatsapp')}>WhatsApp</button>
          <button disabled={!p.email} onClick={() => onContacto('correo')}>✉ Correo</button>
          {p.sitio_web && <a href={p.sitio_web.match(/^https?:/i) ? p.sitio_web : 'https://' + p.sitio_web} target="_blank" rel="noreferrer">Sitio web</a>}
        </div>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}
        {aviso && <div className="aviso aviso-ok" style={{ marginBottom: 12 }}>{aviso}<button className="boton boton-texto" onClick={onCerrarAviso}>Cerrar</button></div>}

        {p.lista_negra && (
          <div className="aviso aviso-critico proveedor-blacklist-aviso">
            <strong>Lista negra</strong>
            <span>{p.lista_negra_motivo || 'Sin motivo informado'}</span>
            {p.lista_negra_detalle && <span>{p.lista_negra_detalle}</span>}
          </div>
        )}

        <div className="proveedor-ficha-grid">
          <Seccion titulo="Contacto">
            <Dato etiqueta="Nombre" valor={p.contacto_nombre} />
            <Dato etiqueta="Cargo" valor={p.contacto_cargo} />
            <Dato etiqueta="Teléfono" valor={p.telefono} />
            <Dato etiqueta="Correo" valor={p.email} />
          </Seccion>

          <Seccion titulo="Datos del proveedor">
            <Dato etiqueta="RUT" valor={p.rut} />
            <Dato etiqueta="Especialidad" valor={p.rubro || p.especialidades?.[0]} />
            <Dato etiqueta="Origen" valor={p.origen === 'correo' ? 'Gmail' : 'Manual'} />
            <Dato etiqueta="Sitio web" valor={p.sitio_web} />
          </Seccion>

          <Seccion titulo="Servicios">
            <p className="chico proveedor-texto-largo">{p.servicios || 'Sin servicios informados.'}</p>
          </Seccion>

          <Seccion titulo="Cobertura">
            <p className="chico proveedor-texto-largo">
              {[p.comunas, ...(p.regiones ?? []), p.direccion].filter(Boolean).join(' · ') || 'Sin cobertura informada.'}
            </p>
          </Seccion>

          {(p.especialidades?.length > 0 || p.palabras_clave?.length > 0) && (
            <Seccion titulo="Especialidades y búsqueda" ancho>
              <p className="chico proveedor-texto-largo">
                {[...(p.especialidades ?? []), ...(p.palabras_clave ?? [])].join(' · ')}
              </p>
            </Seccion>
          )}

          {p.contactos?.length > 0 && (
            <Seccion titulo="Contactos adicionales" ancho>
              <div className="proveedor-historial">
                {p.contactos.map((contacto, i) => (
                  <div key={(contacto.email || contacto.telefono || contacto.nombre || '') + i}>
                    <strong>{contacto.nombre || contacto.email || contacto.telefono || 'Contacto'}</strong>
                    {contacto.cargo && <p>{contacto.cargo}</p>}
                    <p>{[contacto.email, contacto.telefono].filter(Boolean).join(' · ')}</p>
                  </div>
                ))}
              </div>
            </Seccion>
          )}

          {(p.certificaciones?.length > 0 || p.marcas?.length > 0 || p.condiciones_comerciales) && (
            <Seccion titulo="Información adicional" ancho>
              {p.certificaciones?.length > 0 && <Dato etiqueta="Certificaciones" valor={p.certificaciones.join(', ')} />}
              {p.marcas?.length > 0 && <Dato etiqueta="Marcas" valor={p.marcas.join(', ')} />}
              {p.condiciones_comerciales && <Dato etiqueta="Condiciones comerciales" valor={p.condiciones_comerciales} />}
            </Seccion>
          )}

          <Seccion titulo="Notas" ancho>
            <p className="chico proveedor-texto-largo">{p.notas || 'Sin notas.'}</p>
          </Seccion>

          <Seccion titulo="Correos y documentos" ancho>
            {cargandoCorreos && <p className="micro apagado">Cargando correos…</p>}
            {!cargandoCorreos && correos.length === 0 && (
              <p className="micro apagado">No hay correos guardados todavía.</p>
            )}
            <div className="proveedor-correos">
              {correos.map(correo => (
                <article key={correo.id} className="proveedor-correo">
                  <div className="proveedor-correo-cabecera">
                    <strong>{correo.asunto || 'Correo sin asunto'}</strong>
                    <span className="micro apagado">{fechaHora(correo.fecha_correo)}</span>
                  </div>
                  <p className="micro apagado">
                    {[correo.remitente_nombre, correo.remitente_email].filter(Boolean).join(' · ') || 'Remitente no informado'}
                  </p>
                  {correo.snippet && <p className="chico proveedor-texto-largo">{correo.snippet}</p>}

                  <div className="proveedor-correo-archivos">
                    {correo.storage_path_eml && (
                      <button type="button" className="boton boton-secundario"
                              onClick={() => onAbrirArchivo(correo.storage_path_eml)}>
                        Correo original
                      </button>
                    )}
                    {(correo.adjuntos ?? []).filter(a => a.storage_path).map((a, i) => (
                      <button key={(a.storage_path || a.filename || '') + i} type="button"
                              className="boton boton-secundario"
                              onClick={() => onAbrirArchivo(a.storage_path)}>
                        {a.filename || 'Adjunto'}
                      </button>
                    ))}
                  </div>

                  {correo.cuerpo_texto && (
                    <details className="proveedor-correo-contenido">
                      <summary>Ver contenido del correo</summary>
                      <pre>{correo.cuerpo_texto}</pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </Seccion>

          {p.origen === 'correo' && (
            <Seccion titulo="Origen del registro" ancho>
              <div className="proveedor-origen-correo">
                <div className="crece">
                  <strong>Creado desde correo</strong>
                  <p className="chico apagado">
                    La ficha conserva el origen del correo y los datos estructurados extraídos.
                    Los nuevos correos pueden complementar contactos, especialidades, cobertura y documentos.
                  </p>
                </div>
                {p.gmail_thread_id && (
                  <a
                    className="boton boton-secundario"
                    href={`https://mail.google.com/mail/u/0/#all/${p.gmail_thread_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver correo original
                  </a>
                )}
              </div>
            </Seccion>
          )}

        </div>

        <div className="proveedor-acciones-peligro">
          <button type="button" className={p.lista_negra ? 'boton boton-secundario' : 'boton boton-peligro'}
                  onClick={onBlacklist}>
            {p.lista_negra ? 'Quitar de lista negra' : 'Agregar a lista negra'}
          </button>
          {puedeEliminar && (
            <button type="button" className="boton boton-texto peligro" onClick={onEliminar}>
              Eliminar proveedor
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Seccion({ titulo, ancho = false, children }) {
  return (
    <section className={'tarjeta proveedor-seccion' + (ancho ? ' ancho' : '')}>
      <h2 className="etiqueta-grupo">{titulo}</h2>
      {children}
    </section>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="proveedor-dato">
      <span>{etiqueta}</span>
      <strong>{valor || 'No informado'}</strong>
    </div>
  );
}

function FormularioProveedor({ inicial, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState({
    id: inicial.id,
    empresa: inicial.empresa ?? '',
    rut: inicial.rut ?? '',
    rubro: inicial.rubro ?? '',
    servicios: inicial.servicios ?? '',
    contacto_nombre: inicial.contacto_nombre ?? '',
    contacto_cargo: inicial.contacto_cargo ?? '',
    telefono: inicial.telefono ?? '',
    email: inicial.email ?? '',
    sitio_web: inicial.sitio_web ?? '',
    comunas: inicial.comunas ?? '',
    notas: inicial.notas ?? '',
    origen: inicial.origen ?? 'manual'
  });
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo, valor) => setDatos(d => ({ ...d, [campo]: valor }));
  const valido = datos.empresa.trim() && datos.rut.trim() && datos.rubro.trim();

  async function guardar() {
    if (!valido || guardando) return;
    setGuardando(true);
    const ok = await onGuardar(datos);
    if (!ok) setGuardando(false);
  }

  return (
    <div className="proveedor-modal proveedor-formulario">
      <button className="modal-cerrar" onClick={onCancelar} aria-label="Cerrar">×</button>
      <h2 className="h3">{datos.id ? 'Editar proveedor' : 'Agregar proveedor'}</h2>
      <div className="formulario-grid">
        <div className="campo ancho-total">
          <label className="etiqueta-campo">Empresa *</label>
          <input value={datos.empresa} onChange={e => cambiar('empresa', e.target.value)} placeholder="Nombre de la empresa" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">RUT *</label>
          <input value={datos.rut} onChange={e => cambiar('rut', e.target.value)} placeholder="12.345.678-9" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Rubro *</label>
          <input value={datos.rubro} onChange={e => cambiar('rubro', e.target.value)} placeholder="Mantención, aseo, ascensores…" />
        </div>
        <div className="campo ancho-total">
          <label className="etiqueta-campo">Servicios</label>
          <textarea value={datos.servicios} onChange={e => cambiar('servicios', e.target.value)} placeholder="Describe los servicios que ofrece" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Contacto</label>
          <input value={datos.contacto_nombre} onChange={e => cambiar('contacto_nombre', e.target.value)} placeholder="Nombre del contacto" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Cargo</label>
          <input value={datos.contacto_cargo} onChange={e => cambiar('contacto_cargo', e.target.value)} placeholder="Cargo" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Teléfono</label>
          <input value={datos.telefono} onChange={e => cambiar('telefono', e.target.value)} placeholder="+56 9 1234 5678" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Email</label>
          <input type="email" value={datos.email} onChange={e => cambiar('email', e.target.value)} placeholder="correo@empresa.cl" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Sitio web</label>
          <input value={datos.sitio_web} onChange={e => cambiar('sitio_web', e.target.value)} placeholder="https://empresa.cl" />
        </div>
        <div className="campo">
          <label className="etiqueta-campo">Cobertura</label>
          <input value={datos.comunas} onChange={e => cambiar('comunas', e.target.value)} placeholder="Santiago, Ñuñoa, Providencia…" />
        </div>
        <div className="campo ancho-total">
          <label className="etiqueta-campo">Notas</label>
          <textarea value={datos.notas} onChange={e => cambiar('notas', e.target.value)} placeholder="Información adicional…" />
        </div>
      </div>
      <div className="fila-botones">
        <button type="button" className="boton boton-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="boton" disabled={!valido || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar proveedor'}
        </button>
      </div>
    </div>
  );
}

function FormularioBlacklist({ proveedor, onCancelar, onGuardar }) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  return (
    <div className="proveedor-modal proveedor-blacklist-modal">
      <button className="modal-cerrar" onClick={onCancelar} aria-label="Cerrar">×</button>
      <span className="lista-negra-icono">⊘</span>
      <h2 className="h3">Agregar a lista negra</h2>
      <p className="chico apagado">
        {proveedor.empresa} no aparecerá en las búsquedas normales. El motivo quedará registrado en su ficha.
      </p>
      <div className="campo">
        <label className="etiqueta-campo">Motivo *</label>
        <select value={motivo} onChange={e => setMotivo(e.target.value)}>
          <option value="">Seleccionar motivo</option>
          {MOTIVOS_LISTA_NEGRA.map(x => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="campo">
        <label className="etiqueta-campo">Observaciones</label>
        <textarea value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Describe brevemente el motivo…" />
      </div>
      <div className="fila-botones">
        <button className="boton boton-secundario" onClick={onCancelar}>Cancelar</button>
        <button className="boton boton-peligro" disabled={!motivo}
                onClick={() => onGuardar({ motivo, detalle })}>
          Agregar a lista negra
        </button>
      </div>
    </div>
  );
}

function Modal({ children }) {
  return <div className="proveedor-modal-fondo" role="dialog" aria-modal="true">{children}</div>;
}
