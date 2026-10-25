import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesion } from '../../lib/sesion';
import biblioteca from '../../datos/ley21442.contenidos.json';
import { EVENTO_PREFERENCIA, guardarAutomaticas, leerAutomaticas } from '../../lib/conocimientos';
import './Conocimientos.css';

const capsulas = biblioteca.contenidos;
const categorias = [...new Set(capsulas.map(c => c.categoria))].filter(Boolean);
const LEIDOS = 'coproactiva:conocimientos:leidos:';

function obtenerLeidos(usuarioId) {
  try {
    const valor = JSON.parse(localStorage.getItem(LEIDOS + usuarioId) || '[]');
    return Array.isArray(valor) ? valor : [];
  } catch { return []; }
}

export default function Conocimientos() {
  const { sesion } = useSesion();
  const usuarioId = sesion?.user?.id;
  const [parametros, setParametros] = useSearchParams();
  const idActual = parametros.get('capsula') || '';
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [leidos, setLeidos] = useState(() => obtenerLeidos(usuarioId));
  const [automaticas, setAutomaticas] = useState(() => leerAutomaticas(usuarioId));
  const actual = capsulas.find(c => c.id === idActual) || null;
  const filtradas = useMemo(() => capsulas.filter(item => {
    const validaCategoria = categoria === 'Todas' || item.categoria === categoria;
    const q = busqueda.trim().toLocaleLowerCase('es');
    const validaBusqueda = !q || [item.titulo, item.texto, item.explicacion, item.referencia, item.categoria]
      .some(texto => (texto || '').toLocaleLowerCase('es').includes(q));
    return validaCategoria && validaBusqueda;
  }), [busqueda, categoria]);

  useEffect(() => {
    setLeidos(obtenerLeidos(usuarioId));
    setAutomaticas(leerAutomaticas(usuarioId));
    const recibir = e => { if (e.detail?.usuarioId === usuarioId) setAutomaticas(e.detail.activas); };
    window.addEventListener(EVENTO_PREFERENCIA, recibir);
    return () => window.removeEventListener(EVENTO_PREFERENCIA, recibir);
  }, [usuarioId]);

  function seleccionar(item) {
    setParametros({ capsula: item.id });
    if (!leidos.includes(item.id)) {
      const siguientes = [...leidos, item.id];
      setLeidos(siguientes);
      try { localStorage.setItem(LEIDOS + usuarioId, JSON.stringify(siguientes)); } catch {}
    }
  }

  function cambiarAutomaticas() {
    const siguiente = !automaticas;
    setAutomaticas(siguiente);
    guardarAutomaticas(usuarioId, siguiente);
  }

  return (
    <main className="pantalla modulo-unificado conocimientos-pantalla">
      <header className="encabezado modulo-cabecera">
        <span className="etiqueta-grupo">APRENDIZAJE</span>
        <h1>Base de conocimientos</h1>
        <p className="chico apagado">Aprende sobre administración de comunidades y la Ley N° 21.442, artículo por artículo.</p>
      </header>
      <div className="cuerpo modulo-contenido conocimientos-cuerpo">
        <div className="conocimientos-resumen ui-panel">
          <div>
            <span className="conocimientos-kicker">BIBLIOTECA EDUCATIVA</span>
            <h2>Ley de Copropiedad Inmobiliaria</h2>
            <p>{capsulas.length} cápsulas con explicaciones, referencias legales y ejemplos de aplicación.</p>
            <small>Fuente: Ley 21.442 · Versión consultada: {biblioteca.version_fuente}. Verifica modificaciones posteriores.</small>
          </div>
          <label className="conocimientos-preferencia">
            <input type="checkbox" checked={automaticas} onChange={cambiarAutomaticas} />
            <span>Mostrar “¿Sabías que…?” automáticamente</span>
            <small>Mensajes breves al costado derecho, como las mascotas del CRM, cada 5 minutos.</small>
          </label>
        </div>
        <div className="conocimientos-herramientas ui-panel">
          <label>
            <span>Buscar contenido</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              type="search" placeholder="Busca por concepto, tema o artículo…" />
          </label>
          <label>
            <span>Materia</span>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="Todas">Todas las materias</option>
              {categorias.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </label>
          <span className="conocimientos-contador">{filtradas.length} resultados · {leidos.length} consultadas</span>
        </div>
        <div className="conocimientos-columnas">
          <section className="conocimientos-listado ui-panel" aria-label="Cápsulas disponibles">
            {filtradas.length === 0
              ? <p>No hay contenidos que coincidan con la búsqueda.</p>
              : filtradas.map(item => (
                <button type="button" key={item.id}
                  className={'conocimientos-item' + (actual?.id === item.id ? ' activo' : '')}
                  onClick={() => seleccionar(item)}>
                  <span className="conocimientos-item-top">
                    <small>{item.categoria}</small>
                    {leidos.includes(item.id) && <span aria-label="Consultada">✓</span>}
                  </span>
                  <strong>{item.titulo}</strong>
                  <span>{item.referencia} <span aria-hidden="true">›</span></span>
                </button>
              ))}
          </section>
          <article className="conocimientos-lectura ui-panel" aria-label="Lección">
            {actual ? (
              <>
                <span className="conocimientos-kicker">{actual.categoria}</span>
                <h2>{actual.titulo}</h2>
                <div className="conocimientos-articulo">{actual.referencia} · Ley N° 21.442</div>
                <h3>¿Sabías que…?</h3>
                <p className="conocimientos-dato">{actual.texto}</p>
                <h3>Conoce más</h3>
                <p>{actual.explicacion}</p>
                {actual.precaucion && <>
                  <h3>Consideraciones importantes</h3>
                  <p>{actual.precaucion}</p>
                </>}
                {actual.requiere_validacion && (
                  <p className="conocimientos-advertencia">Esta disposición requiere verificar su vigencia antes de aplicarla.</p>
                )}
                <a href={biblioteca.url_oficial} target="_blank" rel="noopener noreferrer">
                  Consultar texto de la ley ↗
                </a>
                <p className="conocimientos-aviso">{biblioteca.aviso}</p>
                <div className="conocimientos-acciones">
                  <button type="button" className="boton boton-secundario"
                    onClick={() => {
                      const pos = capsulas.findIndex(c => c.id === actual.id);
                      seleccionar(capsulas[(pos + 1) % capsulas.length]);
                    }}>Siguiente contenido →</button>
                  <button type="button" className="boton boton-secundario"
                    onClick={() => setParametros({})}>Volver al listado</button>
                </div>
              </>
            ) : (
              <div className="conocimientos-vacio">
                <span aria-hidden="true">✧</span>
                <h2>Selecciona un contenido</h2>
                <p>Explora las materias o utiliza el buscador. Aquí encontrarás la explicación y el artículo de origen de cada cápsula.</p>
                {filtradas.length > 0 && <button type="button" className="boton"
                    onClick={() => seleccionar(filtradas[0])}>Comenzar a aprender</button>}
              </div>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}
