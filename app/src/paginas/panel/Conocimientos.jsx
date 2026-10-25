import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesion } from '../../lib/sesion';
import biblioteca from '../../datos/ley21442.contenidos.json';
import { obtenerLeccion } from '../../datos/ley21442.lecciones.js';
import './Conocimientos.css';

const contenidos = biblioteca.contenidos;
const materias = [...new Set(contenidos.map(item => item.categoria).filter(Boolean))];
const CLAVE_LEIDOS = 'coproactiva:conocimientos:leidos:';
export const EVENTO_BUSCAR = 'coproactiva:conocimientos:buscar';
export const EVENTO_ESTADO_BUSCAR = 'coproactiva:conocimientos:estado-busqueda';

function leerConsultados(usuarioId) {
  if (!usuarioId) return [];
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_LEIDOS + usuarioId) || '[]');
    return Array.isArray(datos) ? datos : [];
  } catch { return []; }
}

/**
 * Biblioteca de aprendizaje en formato acordeón. La pregunta, la respuesta
 * desarrollada y las advertencias se abren dentro de LA MISMA tarjeta.
 * La ruta ?capsula=ID permite acceder a la ficha desde «¿Sabías que…?».
 */
export default function Conocimientos() {
  const { sesion } = useSesion();
  const usuarioId = sesion?.user?.id;
  const [parametros, setParametros] = useSearchParams();
  const abiertoId = parametros.get('capsula') || '';
  const [busqueda, setBusqueda] = useState('');
  const [materia, setMateria] = useState('Todas');
  const [buscarVisible, setBuscarVisible] = useState(false);
  const [consultados, setConsultados] = useState(() => leerConsultados(usuarioId));
  const tarjetasRef = useRef(new Map());
  const buscadorRef = useRef(null);
  const listadoRef = useRef(null);
  const primeraApertura = useRef(false);
  const resultados = useMemo(() => {
    const palabra = busqueda.trim().toLocaleLowerCase('es');
    return contenidos.filter(item =>
      (materia === 'Todas' || item.categoria === materia) &&
      (!palabra || [item.titulo, item.texto, item.explicacion, item.precaucion, item.categoria, item.referencia, obtenerLeccion(item)?.desarrollo, obtenerLeccion(item)?.aplicacion, ...((obtenerLeccion(item)?.detalles || []).flat())]
        .some(valor => (valor || '').toLocaleLowerCase('es').includes(palabra)))
    );
  }, [busqueda, materia]);

  useEffect(() => {
    setConsultados(leerConsultados(usuarioId));
  }, [usuarioId]);

  useEffect(() => {
    const gestionar = evento => {
      if (evento.detail?.accion === 'inicio') {
        setBuscarVisible(false);
        setBusqueda('');
        setMateria('Todas');
        setParametros({}, { replace: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setBuscarVisible(valor => !valor);
      }
    };
    window.addEventListener(EVENTO_BUSCAR, gestionar);
    return () => window.removeEventListener(EVENTO_BUSCAR, gestionar);
  }, [setParametros]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_ESTADO_BUSCAR, { detail: { visible: buscarVisible } }));
    if (buscarVisible) window.requestAnimationFrame(() => buscadorRef.current?.focus());
    return () => window.dispatchEvent(new CustomEvent(EVENTO_ESTADO_BUSCAR, { detail: { visible: false } }));
  }, [buscarVisible]);

  useEffect(() => {
    if (!abiertoId || !contenidos.some(item => item.id === abiertoId)) return;
    if (!primeraApertura.current) {
      primeraApertura.current = true;
      const siguiente = window.requestAnimationFrame(() => {
        tarjetasRef.current.get(abiertoId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      return () => window.cancelAnimationFrame(siguiente);
    }
  }, [abiertoId]);

  useEffect(() => {
    if (!buscarVisible) return undefined;
    const cerrarConEscape = evento => {
      if (evento.key === 'Escape') setBuscarVisible(false);
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [buscarVisible]);

  function abrirTarjeta(item) {
    const siguiente = abiertoId === item.id ? '' : item.id;
    setParametros(siguiente ? { capsula: siguiente } : {}, { replace: false });
    if (siguiente && usuarioId && !consultados.includes(item.id)) {
      const nuevos = [...consultados, item.id];
      setConsultados(nuevos);
      try { localStorage.setItem(CLAVE_LEIDOS + usuarioId, JSON.stringify(nuevos)); } catch {}
    }
  }

  const filtros = (
    <>
      <label className="conocimientos-campo">
        <span>Buscar contenido</span>
        <input ref={buscadorRef} type="search" value={busqueda}
          onChange={evento => setBusqueda(evento.target.value)}
          placeholder="Busca por concepto, tema o artículo…" autoComplete="off" />
      </label>
      <label className="conocimientos-campo">
        <span>Materia</span>
        <select value={materia} onChange={evento => setMateria(evento.target.value)}>
          <option value="Todas">Todas las materias</option>
          {materias.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
        </select>
      </label>
    </>
  );

  return (
    <main className="pantalla modulo-unificado conocimientos-pantalla">
      <header className="conocimientos-cabecera">
        <h1>Base de conocimientos</h1>
        <p>Aprende sobre administración de comunidades y la Ley N° 21.442, artículo por artículo.</p>
        <div className="conocimientos-insignia">
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zM12 6v14"/>
          </svg>
          {contenidos.length} contenidos · Ley 21.442
        </div>
      </header>

      <div className="conocimientos-cuerpo">
        <section className="conocimientos-filtros-escritorio" aria-label="Filtros de la biblioteca">
          {filtros}
          <span className="conocimientos-resultado-cantidad">{resultados.length} contenidos encontrados</span>
        </section>

        <section ref={listadoRef} className="conocimientos-tarjetas" aria-label="Contenidos educativos">
          {resultados.length === 0 && (
            <div className="conocimientos-sin-resultados">
              <strong>No encontramos contenidos con esos filtros.</strong>
              <button type="button" onClick={() => { setBusqueda(''); setMateria('Todas'); }}>
                Mostrar todos los contenidos
              </button>
            </div>
          )}
          {resultados.map(item => {
            const desplegado = item.id === abiertoId;
            const leccion = obtenerLeccion(item);
            return (
              <article key={item.id}
                ref={elemento => {
                  if (elemento) tarjetasRef.current.set(item.id, elemento);
                  else tarjetasRef.current.delete(item.id);
                }}
                className={'conocimientos-tarjeta' + (desplegado ? ' abierta' : '')}>
                <button type="button"
                  className="conocimientos-tarjeta-resumen"
                  onClick={() => abrirTarjeta(item)}
                  aria-expanded={desplegado}
                  aria-controls={'detalle-conocimiento-' + item.id}>
                  <span className="conocimientos-tarjeta-titulos">
                    <span className="conocimientos-categoria">{item.categoria}</span>
                    <strong>{item.titulo}</strong>
                    <small>{item.referencia} · Ley N° 21.442</small>
                  </span>
                  <svg aria-hidden="true" className="conocimientos-chevron" width="20" height="20"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                {desplegado && (
                  <div id={'detalle-conocimiento-' + item.id} className="conocimientos-tarjeta-desarrollo">
                    <div className="conocimientos-referencia">{item.referencia} · Ley N° 21.442</div>
                    <section className="conocimientos-dato">
                      <div className="conocimientos-detalle-icono" aria-hidden="true">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18h6M10 21h4M9 15.5c0-2-3-3.4-3-7a6 6 0 0 1 12 0c0 3.6-3 5-3 7"/>
                          <path d="M12 1v2M4 8H2M20 8h2M5 3l1.5 1.5M19 3l-1.5 1.5"/>
                        </svg>
                      </div>
                      <div>
                        <h3>¿Sabías que…?</h3>
                        <p>{item.texto}</p>
                      </div>
                    </section>
                    <section className="conocimientos-seccion-desarrollo">
                      <div className="conocimientos-detalle-icono" aria-hidden="true">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 3h9l4 4v14H7zM16 3v5h4M10 12h7M10 16h7"/>
                        </svg>
                      </div>
                      <div>
                        <h3>¿Qué establece la ley?</h3>
                        <p>{leccion?.resumen || item.explicacion}</p>
                        {leccion?.desarrollo && (
                          <>
                            <h3 className="conocimientos-subtitulo">Desarrollo del tema</h3>
                            <p>{leccion.desarrollo}</p>
                          </>
                        )}
                      </div>
                    </section>
                    {leccion?.detalles?.length > 0 && (
                      <section className="conocimientos-seccion-desarrollo">
                        <div className="conocimientos-detalle-icono" aria-hidden="true">
                          <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 5h18M3 12h18M3 19h18M6 3v4M6 10v4M6 17v4"/>
                          </svg>
                        </div>
                        <div>
                          <h3>Conceptos y reglas principales</h3>
                          <dl className="conocimientos-definiciones">
                            {leccion.detalles.map(([concepto, contenido]) => (
                              <div key={concepto}>
                                <dt>{concepto}</dt>
                                <dd>{contenido}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </section>
                    )}
                    {leccion?.aplicacion && (
                      <section className="conocimientos-seccion-desarrollo">
                        <div className="conocimientos-detalle-icono" aria-hidden="true">
                          <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h4"/>
                          </svg>
                        </div>
                        <div>
                          <h3>Aplicación práctica</h3>
                          <p>{leccion.aplicacion}</p>
                        </div>
                      </section>
                    )}
                    {(leccion?.consideraciones?.length || item.precaucion) && (
                      <section className="conocimientos-seccion-desarrollo">
                        <div className="conocimientos-detalle-icono" aria-hidden="true">
                          <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 3 10 18H2L12 3zM12 9v5M12 18h.01"/>
                          </svg>
                        </div>
                        <div>
                          <h3>Consideraciones importantes</h3>
                          {(leccion?.consideraciones || [item.precaucion]).map((texto, n) => (
                            <p key={n} className={n ? 'conocimientos-consideracion-extra' : ''}>{texto}</p>
                          ))}
                        </div>
                      </section>
                    )}
                    <div className="conocimientos-fundamento">
                      <strong>Fundamento legal</strong>
                      <span>{leccion?.fundamento || (item.referencia + ' · Ley N° 21.442')}</span>
                      <small>Texto BCN, versión {leccion?.version || biblioteca.version_fuente}. La referencia permite contrastar el artículo y sus excepciones.</small>
                    </div>
                    {item.requiere_validacion && (
                      <p className="conocimientos-alerta">Verifica la vigencia de esta disposición antes de aplicarla.</p>
                    )}
                    <a className="conocimientos-ley-link" href={biblioteca.url_oficial}
                      target="_blank" rel="noopener noreferrer">
                      Consultar texto de la ley ↗
                    </a>
                    <p className="conocimientos-advertencia-fuente">{biblioteca.aviso}</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>

      {buscarVisible && (
        <div className="conocimientos-buscador-capa" role="presentation"
             onClick={() => setBuscarVisible(false)}>
          <section className="conocimientos-buscador-panel" role="dialog"
            aria-label="Buscar en Base de conocimientos" aria-modal="false"
            onClick={evento => evento.stopPropagation()}>
            <div className="conocimientos-buscador-titulo">
              <strong>Buscar contenidos</strong>
              <button type="button" onClick={() => setBuscarVisible(false)}
                aria-label="Cerrar búsqueda">×</button>
            </div>
            {filtros}
            <div className="conocimientos-buscador-acciones">
              <button type="button" onClick={() => { setBusqueda(''); setMateria('Todas'); }}>
                Limpiar
              </button>
              <button type="button" className="conocimientos-aplicar-filtros" onClick={() => {
                setBuscarVisible(false);
                listadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}>
                Ver {resultados.length} contenidos
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
