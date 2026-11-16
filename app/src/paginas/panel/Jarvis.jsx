import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import {
  AMBITOS, VISTAS, TIPOS_ASUMIDO, nombreAmbito, vistaValida, textoPlazo, fechaCorta,
  filtrar, contar, agruparAgenda, brechasPorComunidad, proximaFechaCiclo, textoFrecuencia
} from '../../lib/jarvis';
import './Jarvis.css';

const CHIP_URGENCIA = {
  vencido: 'chip-critico', hoy: 'chip-alerta', semana: 'chip-pendiente',
  proximo: 'chip-cumple', brecha: 'chip-pendiente'
};
const ASUMIDO_VACIO = { titulo: '', tipo: 'seguimiento', contraparte: '', fecha_limite: '' };

/* Jarvis: qué viene y qué hay que hacer en toda la gestión.
 * La agenda la calcula la base (jarvis_agenda); esta pantalla la ordena,
 * permite completar las variables que faltan y cerrar lo comprometido. */
export default function Jarvis() {
  const navegar = useNavigate();
  useVolverGlobal(() => navegar('/'));
  const { perfil } = useSesion();
  const [parametros, setParametros] = useSearchParams();
  const vista = vistaValida(parametros.get('vista'));

  const [agenda, setAgenda] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [comunidades, setComunidades] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [ciclo, setCiclo] = useState([]);
  const [asumidos, setAsumidos] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ambito, setAmbito] = useState('todos');
  const [comunidadId, setComunidadId] = useState('');
  const [guardando, setGuardando] = useState('');
  const [nuevo, setNuevo] = useState(ASUMIDO_VACIO);

  const cargar = useCallback(async () => {
    const [a, l, c, r, cc, j] = await Promise.all([
      supabase.rpc('jarvis_agenda', { p_dias: 30 }),
      supabase.from('jarvis_analisis')
        .select('fecha,resumen,prioridades,riesgos,generado_en')
        .order('fecha', { ascending: false }).limit(1),
      supabase.from('comunidades').select('id,nombre,estado')
        .in('estado', ['activo', 'marcha_blanca']).order('nombre'),
      supabase.from('jarvis_ciclo_reglas')
        .select('id,codigo,titulo,descripcion,base,frecuencia_meses,anticipo_dias')
        .eq('activa', true).order('orden'),
      supabase.from('jarvis_ciclo_comunidad')
        .select('comunidad_id,regla_id,aplica,ultima_fecha,proxima_fecha'),
      supabase.from('jarvis_compromisos')
        .select('id,titulo,tipo,contraparte,fecha_limite,prioridad,estado,responsable')
        .in('estado', ['pendiente', 'en_curso'])
        .order('fecha_limite', { ascending: true, nullsFirst: false })
    ]);
    const fallo = [a, l, c, r, cc, j].find(x => x.error);
    setError(fallo ? fallo.error.message : '');
    setAgenda(a.data ?? []);
    setAnalisis(l.data?.[0] ?? null);
    setComunidades(c.data ?? []);
    setReglas(r.data ?? []);
    setCiclo(cc.data ?? []);
    setAsumidos(j.data ?? []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(
    () => filtrar(agenda, { ambito, comunidadId }), [agenda, ambito, comunidadId]);
  const totales = useMemo(() => contar(visibles), [visibles]);
  const grupos = useMemo(() => agruparAgenda(visibles), [visibles]);
  const brechas = useMemo(() => brechasPorComunidad(visibles), [visibles]);
  const cicloPorClave = useMemo(
    () => new Map(ciclo.map(f => [f.comunidad_id + ':' + f.regla_id, f])), [ciclo]);

  function cambiarVista(id) {
    setAviso('');
    setParametros(id === 'agenda' ? {} : { vista: id }, { replace: true });
  }

  async function guardarCiclo(comunidad, regla, cambios) {
    const clave = comunidad.id + ':' + regla.id;
    const actual = cicloPorClave.get(clave) ?? { aplica: true, ultima_fecha: null, proxima_fecha: null };
    const fila = {
      comunidad_id: comunidad.id, regla_id: regla.id,
      aplica: actual.aplica, ultima_fecha: actual.ultima_fecha, proxima_fecha: actual.proxima_fecha,
      ...cambios,
      actualizado_por: perfil?.id ?? null, actualizado_en: new Date().toISOString()
    };
    setGuardando(clave);
    const { error: e } = await supabase.from('jarvis_ciclo_comunidad')
      .upsert(fila, { onConflict: 'comunidad_id,regla_id' });
    setGuardando('');
    if (e) return setError(e.message);
    setAviso('Fecha guardada: ' + regla.titulo + ' · ' + comunidad.nombre);
    await cargar();
  }

  async function cerrarAsumido(item, estado) {
    setGuardando(item.id);
    const { error: e } = await supabase.from('jarvis_compromisos')
      .update({ estado, cerrado_en: new Date().toISOString(), editado_en: new Date().toISOString() })
      .eq('id', item.id);
    setGuardando('');
    if (e) return setError(e.message);
    setAviso(estado === 'cumplido' ? 'Compromiso marcado como cumplido.' : 'Compromiso descartado.');
    await cargar();
  }

  async function crearAsumido(evento) {
    evento.preventDefault();
    if (!nuevo.titulo.trim()) return;
    setGuardando('nuevo');
    const { error: e } = await supabase.from('jarvis_compromisos').insert({
      titulo: nuevo.titulo.trim(), tipo: nuevo.tipo,
      contraparte: nuevo.contraparte.trim() || null,
      fecha_limite: nuevo.fecha_limite || null,
      origen: 'manual', responsable: perfil?.nombre ?? null
    });
    setGuardando('');
    if (e) return setError(e.message);
    setNuevo(ASUMIDO_VACIO);
    setAviso('Compromiso registrado.');
    await cargar();
  }

  const indicadores = [
    ['vencido', 'Con atraso', 'agenda'],
    ['hoy', 'Para hoy', 'agenda'],
    ['semana', 'Próximos 7 días', 'agenda'],
    ['brecha', 'Datos por completar', 'brechas']
  ];

  return (
    <div className="pantalla modulo-unificado jarvis">
      <header className="encabezado modulo-cabecera">
        <div>
          <h1 className="h3">Jarvis</h1>
          <p className="chico apagado">
            Lo que viene y lo que hay que hacer en la gestión de Coproactiva.
          </p>
        </div>
      </header>

      <div className="cuerpo modulo-contenido jarvis-cuerpo">
        {error && <div className="aviso aviso-critico" role="alert">{error}</div>}
        {aviso && <div className="aviso" role="status">{aviso}</div>}

        {agenda === null ? <p className="cargando">Cargando…</p> : <>
          <div className="jarvis-indicadores">
            {indicadores.map(([id, titulo, destino]) => (
              <button type="button" key={id}
                className={'tarjeta jarvis-indicador jarvis-indicador-' + id}
                onClick={() => cambiarVista(destino)}>
                <strong>{totales[id]}</strong>
                <span>{titulo}</span>
              </button>
            ))}
          </div>

          {analisis && (
            <section className="tarjeta jarvis-lectura" aria-labelledby="jarvis-lectura-titulo">
              <h2 id="jarvis-lectura-titulo" className="modulo-seccion-titulo">
                Lectura del {fechaCorta(analisis.fecha)}
              </h2>
              <p>{analisis.resumen}</p>
              {analisis.prioridades?.length > 0 && (
                <ol className="jarvis-lectura-lista">
                  {analisis.prioridades.map((p, i) => (
                    <li key={i}>
                      {p.ruta
                        ? <Link to={p.ruta}><strong>{p.titulo}</strong></Link>
                        : <strong>{p.titulo}</strong>}
                      {p.detalle && <span>{p.detalle}</span>}
                    </li>
                  ))}
                </ol>
              )}
              {analisis.riesgos?.length > 0 && (
                <ul className="jarvis-lectura-riesgos">
                  {analisis.riesgos.map((r, i) => (
                    <li key={i}><strong>{r.titulo}</strong>{r.detalle && <span>{r.detalle}</span>}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <nav className="ui-pestanas jarvis-vistas" aria-label="Vistas de Jarvis">
            {VISTAS.map(([id, titulo]) => (
              <button type="button" key={id} aria-current={vista === id ? 'page' : undefined}
                onClick={() => cambiarVista(id)}>
                {titulo}
              </button>
            ))}
          </nav>

          {(vista === 'agenda' || vista === 'brechas') && (
            <div className="jarvis-filtros">
              <label className="campo">Ámbito
                <select value={ambito} onChange={e => setAmbito(e.target.value)}>
                  {AMBITOS.map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
                </select>
              </label>
              <label className="campo">Comunidad
                <select value={comunidadId} onChange={e => setComunidadId(e.target.value)}>
                  <option value="">Todas</option>
                  {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
          )}

          {vista === 'agenda' && (
            <div className="jarvis-grupos">
              {grupos.map(grupo => (
                <section key={grupo.id} aria-labelledby={'jarvis-grupo-' + grupo.id}>
                  <h2 id={'jarvis-grupo-' + grupo.id} className="modulo-seccion-titulo jarvis-grupo-titulo">
                    {grupo.titulo} <span>{grupo.items.length}</span>
                  </h2>
                  <div className="jarvis-lista">
                    {grupo.items.map(item => <Entrada key={item.clave} item={item} />)}
                  </div>
                </section>
              ))}
              {!grupos.length && (
                <p className="vacio">No hay gestiones con fecha para este filtro.</p>
              )}
            </div>
          )}

          {vista === 'brechas' && (
            <div className="jarvis-grupos">
              <p className="chico apagado">
                Variables que faltan para anticipar. Mientras no estén cargadas, Jarvis no puede avisar de ellas.
              </p>
              {brechas.map(grupo => (
                <section key={grupo.id} aria-labelledby={'jarvis-brecha-' + grupo.id}>
                  <h2 id={'jarvis-brecha-' + grupo.id} className="modulo-seccion-titulo jarvis-grupo-titulo">
                    {grupo.nombre} <span>{grupo.items.length}</span>
                  </h2>
                  <div className="jarvis-lista">
                    {grupo.items.map(item => <Entrada key={item.clave} item={item} />)}
                  </div>
                </section>
              ))}
              {!brechas.length && <p className="vacio">No faltan datos para este filtro.</p>}
            </div>
          )}

          {vista === 'ciclo' && (
            <div className="jarvis-grupos">
              <p className="chico apagado">
                Obligaciones recurrentes por comunidad. Registre la última vez que se cumplió o la próxima fecha; Jarvis avisa con la anticipación indicada.
              </p>
              {comunidades.map(comunidad => (
                <section key={comunidad.id} className="tarjeta jarvis-ciclo"
                  aria-labelledby={'jarvis-ciclo-' + comunidad.id}>
                  <h2 id={'jarvis-ciclo-' + comunidad.id} className="modulo-seccion-titulo">
                    {comunidad.nombre}
                  </h2>
                  {reglas.map(regla => {
                    const clave = comunidad.id + ':' + regla.id;
                    const fila = cicloPorClave.get(clave);
                    const aplica = fila?.aplica ?? true;
                    const proxima = proximaFechaCiclo(regla, fila);
                    return (
                      <div key={regla.id} className={'jarvis-ciclo-fila' + (aplica ? '' : ' no-aplica')}>
                        <div className="jarvis-ciclo-texto">
                          <strong>{regla.titulo}</strong>
                          <span>{regla.base} · {textoFrecuencia(regla.frecuencia_meses)} · aviso {regla.anticipo_dias} días antes</span>
                          {aplica && <span className={'chip ' + (proxima ? 'chip-cumple' : 'chip-pendiente')}>
                            {proxima ? 'Próxima: ' + fechaCorta(proxima) : 'Sin fecha'}
                          </span>}
                        </div>
                        {aplica && (
                          <div className="jarvis-ciclo-campos">
                            <label className="campo">Última vez
                              <input type="date" key={'u' + (fila?.ultima_fecha ?? '')} defaultValue={fila?.ultima_fecha ?? ''}
                                disabled={guardando === clave}
                                onBlur={e => {
                                  const valor = e.target.value || null;
                                  if (valor !== (fila?.ultima_fecha ?? null)) guardarCiclo(comunidad, regla, { ultima_fecha: valor });
                                }} />
                            </label>
                            <label className="campo">Próxima fecha
                              <input type="date" key={'p' + (fila?.proxima_fecha ?? '')} defaultValue={fila?.proxima_fecha ?? ''}
                                disabled={guardando === clave}
                                onBlur={e => {
                                  const valor = e.target.value || null;
                                  if (valor !== (fila?.proxima_fecha ?? null)) guardarCiclo(comunidad, regla, { proxima_fecha: valor });
                                }} />
                            </label>
                          </div>
                        )}
                        <button type="button" className="boton boton-secundario jarvis-ciclo-aplica"
                          disabled={guardando === clave}
                          onClick={() => guardarCiclo(comunidad, regla, { aplica: !aplica })}>
                          {aplica ? 'No aplica' : 'Sí aplica'}
                        </button>
                      </div>
                    );
                  })}
                </section>
              ))}
              {!comunidades.length && <p className="vacio">No hay comunidades activas.</p>}
            </div>
          )}

          {vista === 'asumidos' && (
            <div className="jarvis-grupos">
              <p className="chico apagado">
                Lo que Coproactiva comprometió a clientes, prospectos y proveedores: informes, visitas, propuestas y respuestas.
              </p>
              <form className="tarjeta jarvis-nuevo" onSubmit={crearAsumido}>
                <label className="campo jarvis-nuevo-titulo">Compromiso
                  <input type="text" value={nuevo.titulo} maxLength={180} required
                    placeholder="Ej.: Enviar informe de visita"
                    onChange={e => setNuevo(n => ({ ...n, titulo: e.target.value }))} />
                </label>
                <label className="campo">Tipo
                  <select value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value }))}>
                    {TIPOS_ASUMIDO.map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
                  </select>
                </label>
                <label className="campo">Con quién
                  <input type="text" value={nuevo.contraparte} maxLength={120}
                    onChange={e => setNuevo(n => ({ ...n, contraparte: e.target.value }))} />
                </label>
                <label className="campo">Fecha límite
                  <input type="date" value={nuevo.fecha_limite}
                    onChange={e => setNuevo(n => ({ ...n, fecha_limite: e.target.value }))} />
                </label>
                <button type="submit" className="boton" disabled={guardando === 'nuevo'}>
                  Registrar
                </button>
              </form>
              <div className="jarvis-lista">
                {asumidos.map(item => (
                  <article key={item.id} className="tarjeta jarvis-asumido">
                    <div className="jarvis-entrada-texto">
                      <strong>{item.titulo}</strong>
                      <span>{[item.contraparte, item.responsable].filter(Boolean).join(' · ')}</span>
                      <span>{item.fecha_limite ? 'Fecha límite: ' + fechaCorta(item.fecha_limite) : 'Sin fecha límite'}</span>
                    </div>
                    <div className="jarvis-asumido-acciones">
                      <button type="button" className="boton" disabled={guardando === item.id}
                        onClick={() => cerrarAsumido(item, 'cumplido')}>Cumplido</button>
                      <button type="button" className="boton boton-secundario" disabled={guardando === item.id}
                        onClick={() => cerrarAsumido(item, 'descartado')}>Descartar</button>
                    </div>
                  </article>
                ))}
                {!asumidos.length && <p className="vacio">No hay compromisos asumidos pendientes.</p>}
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}

function Entrada({ item }) {
  return (
    <Link to={item.ruta || '/jarvis'} className="tarjeta jarvis-entrada">
      <div className="jarvis-entrada-superior">
        <span className={'chip ' + (CHIP_URGENCIA[item.urgencia] ?? 'chip-pendiente')}>
          {item.urgencia === 'brecha' ? 'Falta el dato' : textoPlazo(item.dias)}
        </span>
        <span className="jarvis-entrada-ambito">{nombreAmbito(item.ambito)}</span>
      </div>
      <div className="jarvis-entrada-texto">
        <strong>{item.titulo}</strong>
        <span>
          {[item.comunidad, item.detalle, item.fecha && fechaCorta(item.fecha)].filter(Boolean).join(' · ')}
        </span>
      </div>
      <p className="jarvis-entrada-accion"><b>Qué hacer:</b> {item.accion}</p>
    </Link>
  );
}
