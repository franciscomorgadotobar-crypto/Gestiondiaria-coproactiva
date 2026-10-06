import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import './Bitacora.css';

const NIVEL = {
  registro: { texto: 'Registro', clase: 'registro' },
  atencion: { texto: 'Requiere atención', clase: 'atencion' },
  urgente: { texto: 'Requiere atención urgente', clase: 'urgente' }
};

function fechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function nombreTipo(r) {
  return r.tipo_codigo === 'otro' ? (r.tipo_otro || 'Otro') : (r.tipo_nombre || r.tipo_codigo);
}

export default function Bitacora() {
  const { id } = useParams();
  const { pathname } = useLocation();

  if (pathname === '/bitacora/nueva') return <NuevaEntrada />;
  if (id) return <Detalle id={id} />;
  return <Listado />;
}

function Listado() {
  const navegar = useNavigate();
  useVolverGlobal(() => navegar('/inicio'));

  const [registros, setRegistros] = useState(null);
  const [comunidades, setComunidades] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [error, setError] = useState(null);

  const [buscar, setBuscar] = useState('');
  const [comunidadId, setComunidadId] = useState('');
  const [tipo, setTipo] = useState('');
  const [nivel, setNivel] = useState('');
  const [estado, setEstado] = useState('');
  const [periodo, setPeriodo] = useState('');

  useEffect(() => {
    (async () => {
      const [r, c, t] = await Promise.all([
        supabase.rpc('bitacora_listar'),
        supabase.rpc('bitacora_comunidades_disponibles'),
        supabase.from('bitacora_tipos').select('*').eq('activa', true).order('orden')
      ]);
      if (r.error) return setError(r.error.message);
      if (c.error) return setError(c.error.message);
      if (t.error) return setError(t.error.message);
      setRegistros(r.data ?? []);
      setComunidades(c.data ?? []);
      setTipos(t.data ?? []);
    })();
  }, []);

  const conteos = useMemo(() => {
    const xs = registros ?? [];
    return {
      urgente: xs.filter(x => x.nivel === 'urgente' && x.estado !== 'finalizada').length,
      atencion: xs.filter(x => x.nivel === 'atencion' && x.estado !== 'finalizada').length,
      registro: xs.filter(x => x.nivel === 'registro').length,
      finalizada: xs.filter(x => ['atencion','urgente'].includes(x.nivel) && x.estado === 'finalizada').length
    };
  }, [registros]);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const ahora = Date.now();
    const limite = periodo === '7' ? ahora - 7 * 86400000
      : periodo === '30' ? ahora - 30 * 86400000
      : periodo === 'hoy' ? new Date().setHours(0,0,0,0)
      : null;

    return (registros ?? []).filter(r => {
      if (comunidadId && r.comunidad_id !== comunidadId) return false;
      if (tipo && r.tipo_codigo !== tipo) return false;
      if (nivel && r.nivel !== nivel) return false;
      if (estado && r.estado !== estado) return false;
      if (limite && new Date(r.registrado_en).getTime() < limite) return false;
      if (!q) return true;
      return [
        r.correlativo, r.titulo, r.descripcion, r.comunidad_nombre,
        r.tipo_nombre, r.tipo_otro, r.registrado_por_nombre, r.finalizado_por_nombre
      ].some(v => String(v ?? '').toLowerCase().includes(q));
    });
  }, [registros, buscar, comunidadId, tipo, nivel, estado, periodo]);

  return (
    <div className="pantalla bitacora-pantalla">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto bitacora-volver" onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
        </div>
        <div className="bitacora-cabecera">
          <div>
            <h1 className="h3">Bitácora</h1>
            <p className="chico apagado">Registro de novedades en la comunidad.</p>
          </div>
          <Link to="/bitacora/nueva" className="boton boton-movil">+ Nuevo registro</Link>
        </div>
      </header>

      <div className="cuerpo bitacora-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}

        <section className="bitacora-kpis">
          <div className="urgente"><strong>{conteos.urgente}</strong><span>Urgentes</span></div>
          <div className="atencion"><strong>{conteos.atencion}</strong><span>Requieren atención</span></div>
          <div className="registro"><strong>{conteos.registro}</strong><span>Registros</span></div>
          <div className="finalizada"><strong>{conteos.finalizada}</strong><span>Finalizadas</span></div>
        </section>

        <section className="tarjeta bitacora-filtros">
          <label className="campo bitacora-buscar">
            <span className="etiqueta-campo">Buscar</span>
            <input value={buscar} onChange={e => setBuscar(e.target.value)}
                   placeholder="Correlativo, título, descripción o comunidad…" />
          </label>

          <label className="campo">
            <span className="etiqueta-campo">Comunidad</span>
            <select value={comunidadId} onChange={e => setComunidadId(e.target.value)}>
              <option value="">Todas las comunidades</option>
              {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta-campo">Tipo</span>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta-campo">Nivel</span>
            <select value={nivel} onChange={e => setNivel(e.target.value)}>
              <option value="">Todos los niveles</option>
              <option value="registro">Registro</option>
              <option value="atencion">Requiere atención</option>
              <option value="urgente">Requiere atención urgente</option>
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta-campo">Estado</span>
            <select value={estado} onChange={e => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="abierta">Pendiente</option>
              <option value="finalizada">Finalizada</option>
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta-campo">Fecha</span>
            <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
              <option value="">Todas</option>
              <option value="hoy">Hoy</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
          </label>
        </section>

        {registros === null && !error && <p className="cargando">Cargando…</p>}

        {registros && filtrados.length === 0 && (
          <div className="tarjeta bitacora-vacio">
            <h2 className="h3">No hay registros para mostrar</h2>
            <p className="chico apagado">Puedes crear una nueva entrada de Bitácora cuando ocurra o se observe una novedad.</p>
            <Link to="/bitacora/nueva" className="boton boton-movil">+ Nuevo registro</Link>
          </div>
        )}

        <div className="bitacora-lista">
          {filtrados.map(r => {
            const n = NIVEL[r.nivel] ?? NIVEL.registro;
            return (
              <Link key={r.id} to={`/bitacora/${r.id}`}
                    className={'tarjeta bitacora-card ' + n.clase + (r.estado === 'finalizada' ? ' finalizada' : '')}>
                <div className="bitacora-card-superior">
                  <div className="bitacora-card-etiquetas">
                    <span className="bitacora-correlativo">{r.correlativo}</span>
                    <span className={'bitacora-nivel ' + n.clase}>{n.texto}</span>
                    {r.estado === 'finalizada' && <span className="bitacora-estado-finalizada">Finalizada</span>}
                  </div>
                  <time>{fechaHora(r.registrado_en)}</time>
                </div>
                <h3>{r.titulo}</h3>
                <p className="bitacora-card-comunidad">{r.comunidad_nombre}</p>
                <div className="bitacora-card-meta">
                  <span>{nombreTipo(r)}</span>
                  <span>{r.registrado_por_nombre}</span>
                  {r.adjuntos > 0 && <span>{r.adjuntos} adjunto{r.adjuntos === 1 ? '' : 's'}</span>}
                  {r.estado === 'finalizada' && r.finalizado_por_nombre && <span>Finalizada por {r.finalizado_por_nombre}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NuevaEntrada() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  useVolverGlobal(() => navegar('/bitacora'));

  const [comunidades, setComunidades] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [comunidadId, setComunidadId] = useState('');
  const [tipoCodigo, setTipoCodigo] = useState('');
  const [tipoOtro, setTipoOtro] = useState('');
  const [nivel, setNivel] = useState('registro');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ultimoSugerido, setUltimoSugerido] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([
        supabase.rpc('bitacora_comunidades_disponibles'),
        supabase.from('bitacora_tipos').select('*').eq('activa', true).order('orden')
      ]);
      if (c.error) return setError(c.error.message);
      if (t.error) return setError(t.error.message);
      const cs = c.data ?? [];
      setComunidades(cs);
      if (cs.length === 1) setComunidadId(cs[0].id);
      setTipos(t.data ?? []);
    })();
  }, []);

  const tipo = tipos.find(t => t.codigo === tipoCodigo);

  function cambiarTipo(codigo) {
    const nuevo = tipos.find(t => t.codigo === codigo);
    setTipoCodigo(codigo);
    if (!nuevo) return;
    if (!titulo.trim() || titulo === ultimoSugerido) {
      setTitulo(nuevo.titulo_sugerido);
    }
    setUltimoSugerido(nuevo.titulo_sugerido);
  }

  function seleccionarArchivos(e) {
    const xs = [...(e.target.files ?? [])];
    const validos = xs.filter(f => f.size <= 10 * 1024 * 1024);
    if (validos.length !== xs.length) {
      setError('Cada adjunto puede pesar hasta 10 MB.');
    } else {
      setError(null);
    }
    setArchivos(validos);
    e.target.value = '';
  }

  async function guardar() {
    if (!comunidadId) return setError('Selecciona una comunidad.');
    if (!tipoCodigo) return setError('Selecciona un tipo.');
    if (tipoCodigo === 'otro' && !tipoOtro.trim()) return setError('Especifica el tipo de registro.');
    if (!titulo.trim()) return setError('El título es obligatorio.');
    if (!descripcion.trim()) return setError('La descripción es obligatoria.');

    setGuardando(true);
    setError(null);

    const { data, error } = await supabase.rpc('bitacora_crear', {
      p_comunidad_id: comunidadId,
      p_tipo_codigo: tipoCodigo,
      p_tipo_otro: tipoCodigo === 'otro' ? tipoOtro.trim() : null,
      p_nivel: nivel,
      p_titulo: titulo.trim(),
      p_descripcion: descripcion.trim()
    });

    if (error) {
      setGuardando(false);
      return setError(error.message);
    }

    const registro = Array.isArray(data) ? data[0] : data;
    const id = registro?.id;
    if (!id) {
      setGuardando(false);
      return setError('El registro se creó, pero no se pudo recuperar su identificador.');
    }

    let advertencia = null;

    for (const archivo of archivos) {
      const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `${id}/${crypto.randomUUID()}-${limpio}`;
      const { error: eSubida } = await supabase.storage.from('bitacora').upload(path, archivo, {
        upsert: false,
        contentType: archivo.type || undefined
      });
      if (eSubida) {
        advertencia = 'El registro se guardó, pero uno o más adjuntos no pudieron subirse.';
        continue;
      }
      const { error: eFila } = await supabase.from('bitacora_adjuntos').insert({
        bitacora_id: id,
        storage_path: path,
        nombre_original: archivo.name,
        mime: archivo.type || null,
        bytes: archivo.size,
        subido_por: perfil?.id ?? null
      });
      if (eFila) advertencia = 'El registro se guardó, pero uno o más adjuntos no pudieron registrarse.';
    }

    if (nivel === 'atencion' || nivel === 'urgente') {
      const { error: eCorreo } = await supabase.functions.invoke('notificar-bitacora', {
        body: { bitacora_id: id }
      });
      if (eCorreo) {
        advertencia = 'El registro y las notificaciones quedaron guardados, pero el correo no pudo enviarse.';
      }
    }

    setGuardando(false);
    navegar(`/bitacora/${id}`, {
      replace: true,
      state: {
        aviso: advertencia || (
          nivel === 'registro'
            ? 'Registro guardado.'
            : 'Registro guardado. Los superadministradores fueron notificados.'
        ),
        tipoAviso: advertencia ? 'advertencia' : 'ok'
      }
    });
  }

  return (
    <div className="pantalla bitacora-pantalla">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto bitacora-volver" onClick={() => navegar('/bitacora')}>
            ‹ Bitácora
          </button>
        </div>
        <h1 className="h3">Nueva entrada de Bitácora</h1>
        <p className="chico apagado">Registra una novedad, observación o situación de la comunidad.</p>
      </header>

      <div className="cuerpo bitacora-formulario">
        {error && <div className="aviso aviso-critico">{error}</div>}

        <label className="campo">
          <span className="etiqueta-campo">Comunidad *</span>
          <select value={comunidadId} onChange={e => setComunidadId(e.target.value)}>
            <option value="">Selecciona una comunidad</option>
            {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {comunidades.length === 1 && <span className="micro apagado">Tu comunidad asociada quedó seleccionada automáticamente.</span>}
        </label>

        <label className="campo">
          <span className="etiqueta-campo">Tipo *</span>
          <select value={tipoCodigo} onChange={e => cambiarTipo(e.target.value)}>
            <option value="">Selecciona un tipo</option>
            {tipos.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
          </select>
        </label>

        {tipoCodigo === 'otro' && (
          <label className="campo">
            <span className="etiqueta-campo">Especifica el tipo *</span>
            <input value={tipoOtro} onChange={e => setTipoOtro(e.target.value)} placeholder="Ej.: Correspondencia, mudanza…" />
          </label>
        )}

        {tipo && (
          <div className="bitacora-sugerencia">
            <strong>Título sugerido según el tipo seleccionado.</strong>
            <span>{tipo.ayuda_descripcion}</span>
          </div>
        )}

        <fieldset className="bitacora-niveles">
          <legend className="etiqueta-campo">Nivel de atención *</legend>
          {Object.entries(NIVEL).map(([id, n]) => (
            <label key={id} className={'bitacora-nivel-opcion ' + n.clase + (nivel === id ? ' activa' : '')}>
              <input type="radio" name="nivel" value={id} checked={nivel === id}
                     onChange={() => setNivel(id)} />
              <span>{n.texto}</span>
            </label>
          ))}
        </fieldset>

        <label className="campo">
          <span className="etiqueta-campo">Título *</span>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
                 placeholder={tipo?.titulo_sugerido || 'Título breve del registro'} />
        </label>

        <label className="campo">
          <span className="etiqueta-campo">Descripción *</span>
          <textarea rows={6} value={descripcion} onChange={e => setDescripcion(e.target.value)}
                    placeholder={tipo?.ayuda_descripcion || 'Describe qué ocurrió y cualquier antecedente relevante.'} />
        </label>

        <div className="campo">
          <span className="etiqueta-campo">Adjuntos <span className="apagado">(opcional)</span></span>
          <label className="bitacora-adjuntar">
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"
                   onChange={seleccionarArchivos} />
            <strong>Agregar foto o archivo</strong>
            <span>Puedes subir imágenes o PDF de hasta 10 MB cada uno.</span>
          </label>
          {archivos.length > 0 && (
            <div className="bitacora-archivos-seleccionados">
              {archivos.map((f, i) => (
                <div key={f.name + i}>
                  <span>{f.name}</span>
                  <button type="button" className="boton boton-texto"
                          onClick={() => setArchivos(xs => xs.filter((_, j) => j !== i))}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fila-botones bitacora-form-acciones">
          <button type="button" className="boton boton-secundario boton-movil"
                  disabled={guardando} onClick={() => navegar('/bitacora')}>
            Cancelar
          </button>
          <button type="button" className="boton boton-movil"
                  disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar registro'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Detalle({ id }) {
  const navegar = useNavigate();
  const location = useLocation();
  useVolverGlobal(() => navegar('/bitacora'));

  const [registro, setRegistro] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(location.state?.aviso ?? null);
  const [tipoAviso] = useState(location.state?.tipoAviso ?? 'ok');

  useEffect(() => {
    (async () => {
      const [r, a] = await Promise.all([
        supabase.rpc('bitacora_listar'),
        supabase.from('bitacora_adjuntos').select('*').eq('bitacora_id', id).order('creado_en')
      ]);
      if (r.error) return setError(r.error.message);
      if (a.error) return setError(a.error.message);
      const encontrado = (r.data ?? []).find(x => x.id === id);
      if (!encontrado) return setError('Este registro no existe o no tienes acceso.');
      setRegistro(encontrado);

      const conUrl = await Promise.all((a.data ?? []).map(async archivo => {
        const { data } = await supabase.storage.from('bitacora')
          .createSignedUrl(archivo.storage_path, 60 * 20);
        return { ...archivo, url: data?.signedUrl ?? null };
      }));
      setAdjuntos(conUrl);
    })();
  }, [id]);

  if (error && !registro) {
    return (
      <div className="cuerpo">
        <div className="aviso aviso-critico">{error}</div>
        <button className="boton boton-secundario boton-movil" style={{ marginTop: 12 }}
                onClick={() => navegar('/bitacora')}>Volver</button>
      </div>
    );
  }
  if (!registro) return <p className="cargando">Cargando…</p>;

  const n = NIVEL[registro.nivel] ?? NIVEL.registro;

  return (
    <div className="pantalla bitacora-pantalla">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto bitacora-volver" onClick={() => navegar('/bitacora')}>
            ‹ Bitácora
          </button>
        </div>
        <h1 className="h3">Detalle de registro</h1>
      </header>

      <div className="cuerpo bitacora-detalle">
        {aviso && (
          <div className={'aviso ' + (tipoAviso === 'advertencia' ? '' : 'aviso-ok')}>
            <span>{aviso}</span>
            <button className="boton boton-texto" onClick={() => setAviso(null)}>Cerrar</button>
          </div>
        )}
        {error && <div className="aviso aviso-critico">{error}</div>}

        <div className="bitacora-detalle-titulo">
          <div>
            <span className={'bitacora-nivel ' + n.clase}>{n.texto}</span>
            <h2>{registro.titulo}</h2>
          </div>
          <time>{fechaHora(registro.registrado_en)}</time>
        </div>

        <section className="tarjeta bitacora-detalle-datos">
          <div><span>Comunidad</span><strong>{registro.comunidad_nombre}</strong></div>
          <div><span>Tipo</span><strong>{nombreTipo(registro)}</strong></div>
          <div><span>Registrado por</span><strong>{registro.registrado_por_nombre}</strong></div>
          <div><span>Nivel de atención</span><strong>{n.texto}</strong></div>
        </section>

        <section className="bitacora-detalle-seccion">
          <h3>Descripción</h3>
          <p>{registro.descripcion}</p>
        </section>

        {adjuntos.length > 0 && (
          <section className="bitacora-detalle-seccion">
            <h3>Adjuntos ({adjuntos.length})</h3>
            <div className="bitacora-adjuntos-grid">
              {adjuntos.map(a => (
                <a key={a.id} href={a.url || '#'} target="_blank" rel="noreferrer"
                   className="tarjeta bitacora-adjunto">
                  {a.mime?.startsWith('image/') && a.url
                    ? <img src={a.url} alt="" />
                    : <div className="bitacora-adjunto-documento">PDF</div>}
                  <span>{a.nombre_original}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="bitacora-detalle-seccion">
          <h3>Información</h3>
          <div className="tarjeta bitacora-detalle-datos">
            <div><span>Fecha de registro</span><strong>{fechaHora(registro.registrado_en)}</strong></div>
            <div><span>Registrado por</span><strong>{registro.registrado_por_nombre}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}
