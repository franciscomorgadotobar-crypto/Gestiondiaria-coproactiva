import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Confirmar from '../../componentes/Confirmar';
import { NIVELES_EVIDENCIA, normalizarOpcion, nivelPosible } from '../../lib/opciones';
import { nuevoId } from '../../lib/local';
import { TIPOS, ORIGENES_FOTO } from '../../lib/tiposDePunto';

/* Editor de una plantilla de levantamiento.
 *
 * Acá se define qué se pregunta, en qué orden y de qué forma se responde. Es lo
 * que hace que la app sirva para más de un tipo de recorrido sin tocar código:
 * un levantamiento de entrega, una revisión mensual y una auditoría preguntan
 * cosas distintas.
 *
 * El orden importa y no es decorativo: el recorrido de un edificio tiene una
 * secuencia —se entra por el acceso y se termina en la azotea— y el informe
 * sale en ese mismo orden.
 *
 * Todo se edita sobre un borrador de la plantilla completa —puntos, categorías,
 * orden, lo que se quita y el orden obligatorio— y un solo botón "Guardar
 * plantilla" lo lleva a la base. Se pidió así: se arma o corrige la plantilla
 * entera y se guarda una vez, no punto por punto. Salir con cambios sin
 * guardar pregunta antes.
 */

/* Un punto tal como se guarda. Todas las filas llevan los mismos campos: el
 * guardado va en un solo upsert, y PostgREST arma las columnas con todas las
 * filas. Texto y descripción van sin espacios sobrantes, y las opciones,
 * normalizadas y sin filas vacías. */
function filaGuardable(item) {
  const config = { ...(item.config ?? {}) };
  if (item.tipo_ingreso === 'opciones') config.opciones = opcionesLimpias(item);
  return {
    id: item.id,
    plantilla_id: item.plantilla_id,
    grupo: item.grupo,
    orden_grupo: item.orden_grupo ?? 0,
    orden: item.orden ?? 0,
    texto: (item.texto ?? '').trim(),
    ayuda: (item.ayuda ?? '').trim() || null,
    tipo_ingreso: item.tipo_ingreso ?? 'estado',
    config,
    requiere_foto: Boolean(item.requiere_foto),
    obligatorio: item.obligatorio !== false,
    es_critico: Boolean(item.es_critico),
    activo: item.activo !== false
  };
}

function opcionesLimpias(item) {
  const admiteFotos = item.config?.origen !== 'ninguna';
  return (item.config?.opciones ?? [])
    .map(normalizarOpcion)
    .map(o => ({ texto: o.texto.trim(), evidencia: nivelPosible(o.evidencia, admiteFotos) }))
    .filter(o => o.texto);
}

/* Por qué un punto no se puede guardar, o null si se puede. */
function problemaDe(item) {
  if (!(item.texto ?? '').trim()) return 'Escribe qué se pregunta.';
  if (item.tipo_ingreso === 'opciones') {
    const opciones = opcionesLimpias(item);
    if (!opciones.length) return 'Agrega al menos una opción.';
    // El levantamiento guarda el texto de la opción elegida: dos opciones con
    // el mismo texto no se podrían distinguir después.
    const vistas = new Set();
    for (const o of opciones) {
      const clave = o.texto.toLowerCase();
      if (vistas.has(clave)) return `La opción "${o.texto}" está repetida.`;
      vistas.add(clave);
    }
  }
  return null;
}

/* Una versión comparable de un valor: con las claves ordenadas, dos versiones
 * iguales dan lo mismo aunque sus campos se hayan escrito en otro orden. */
function huella(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(huella).join(',') + ']';
  if (valor && typeof valor === 'object') {
    return '{' + Object.keys(valor).sort()
      .map(k => JSON.stringify(k) + ':' + huella(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor ?? null);
}
const huellaPunto = item => huella(filaGuardable(item));

export default function EditorPlantilla() {
  const { id } = useParams();
  const navegar = useNavigate();

  // Lo último guardado, tal como está en la base: contra esto se compara.
  const [guardada, setGuardada] = useState(null);          // { plantilla, items }
  // El borrador: lo que se ve y se edita. Nada llega a la base hasta Guardar.
  const [plantilla, setPlantilla] = useState(null);
  const [items, setItems] = useState([]);

  const [abierto, setAbierto] = useState(null);            // id del punto desplegado
  const [aviso, setAviso] = useState(null);                // { id, mensaje }: por qué un punto no se puede guardar
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState(null);  // qué hacer si se confirma salir sin guardar

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([
        supabase.from('plantillas_control').select('*').eq('id', id).maybeSingle(),
        supabase.from('plantilla_items').select('*').eq('plantilla_id', id)
          .order('orden_grupo').order('orden')
      ]);
      if (p.error) return setError(p.error.message);
      if (i.error) return setError(i.error.message);
      if (!p.data) return setError('Esta plantilla no existe o no tienes acceso.');
      const lista = i.data ?? [];
      setGuardada({ plantilla: p.data, items: lista });
      setPlantilla(p.data);
      setItems(lista);
    })();
  }, [id]);

  /* Las categorías salen de los ítems: `grupo` con su `orden_grupo`. No hay
   * tabla aparte porque una categoría sin ningún punto no significa nada. */
  const categorias = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      if (!m.has(it.grupo)) m.set(it.grupo, { nombre: it.grupo, orden: it.orden_grupo, items: [] });
      m.get(it.grupo).items.push(it);
    }
    for (const cat of m.values()) cat.items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    return [...m.values()].sort((a, b) => a.orden - b.orden);
  }, [items]);

  /* Qué cambió respecto de lo guardado: puntos nuevos, modificados y quitados,
   * y el orden obligatorio de la plantilla. */
  const cambios = useMemo(() => {
    if (!guardada) return { nuevos: [], modificados: [], borrados: [], plantilla: false, total: 0 };
    const antes = new Map(guardada.items.map(x => [x.id, huellaPunto(x)]));
    const ahora = new Set(items.map(x => x.id));
    const nuevos = items.filter(x => !antes.has(x.id));
    const modificados = items.filter(x => antes.has(x.id) && antes.get(x.id) !== huellaPunto(x));
    const borrados = guardada.items.filter(x => !ahora.has(x.id)).map(x => x.id);
    const cambioPlantilla = Boolean(guardada.plantilla.secuencial) !== Boolean(plantilla?.secuencial);
    return {
      nuevos, modificados, borrados, plantilla: cambioPlantilla,
      total: nuevos.length + modificados.length + borrados.length + (cambioPlantilla ? 1 : 0)
    };
  }, [guardada, items, plantilla]);
  const sucio = cambios.total > 0;
  const sinGuardar = useMemo(
    () => new Set([...cambios.nuevos, ...cambios.modificados].map(x => x.id)),
    [cambios]
  );

  /* Salir con cambios sin guardar pregunta antes: el botón de volver, los
   * enlaces del menú lateral y cerrar o recargar la pestaña. */
  function conAviso(luego) {
    if (sucio) setPorConfirmar(() => luego);
    else luego();
  }
  const volver = () => conAviso(() => navegar('/plantillas'));

  useEffect(() => {
    if (!sucio) return;
    const alCerrar = e => { e.preventDefault(); e.returnValue = ''; };
    /* Los enlaces (menú lateral, logotipo) navegan sin pasar por este
     * componente: se detienen antes de que React Router los vea. */
    const alClic = e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = e.target.closest?.('a[href]');
      if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return;
      const url = new URL(enlace.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      const raiz = import.meta.env.BASE_URL.replace(/\/$/, '');
      const ruta = (url.pathname.slice(raiz.length) || '/') + url.search + url.hash;
      setPorConfirmar(() => () => navegar(ruta));
    };
    window.addEventListener('beforeunload', alCerrar);
    document.addEventListener('click', alClic, true);
    return () => {
      window.removeEventListener('beforeunload', alCerrar);
      document.removeEventListener('click', alClic, true);
    };
  }, [sucio, navegar]);

  function confirmarSalida() {
    const luego = porConfirmar;
    setPorConfirmar(null);
    luego?.();
  }

  const abrir = itemId => setAbierto(a => (a === itemId ? null : itemId));

  // Despliega un punto y lo trae a la vista, después del render.
  function mostrar(itemId) {
    setAbierto(itemId);
    setTimeout(() => document.getElementById('punto-' + itemId)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  }

  function cambiarPunto(itemId, cambio) {
    if (aviso?.id === itemId) setAviso(null);
    setItems(xs => xs.map(x => (x.id === itemId ? cambio(x) : x)));
  }

  function puntoNuevo(datos) {
    return {
      id: nuevoId(), plantilla_id: id, texto: 'Punto nuevo', ayuda: null,
      tipo_ingreso: 'estado', config: {}, requiere_foto: false, obligatorio: true,
      es_critico: false, activo: true, ...datos
    };
  }

  function agregarPunto(cat) {
    const orden = Math.max(-1, ...cat.items.map(x => x.orden ?? 0)) + 1;
    const nuevo = puntoNuevo({ grupo: cat.nombre, orden_grupo: cat.orden, orden });
    setItems(xs => [...xs, nuevo]);
    mostrar(nuevo.id);
  }

  function agregarCategoria() {
    const nombre = prompt('Nombre de la categoría')?.trim();
    if (!nombre) return;
    if (categorias.some(c => c.nombre === nombre)) return alert('Ya hay una categoría con ese nombre.');
    const orden = categorias.length ? Math.max(...categorias.map(c => c.orden)) + 1 : 0;
    const nuevo = puntoNuevo({ grupo: nombre, orden_grupo: orden, orden: 0 });
    setItems(xs => [...xs, nuevo]);
    mostrar(nuevo.id);
  }

  function renombrarCategoria(cat) {
    const nombre = prompt('Nuevo nombre de la categoría', cat.nombre)?.trim();
    if (!nombre || nombre === cat.nombre) return;
    if (categorias.some(c => c.nombre === nombre)) return alert('Ya hay una categoría con ese nombre.');
    setItems(xs => xs.map(x => (x.grupo === cat.nombre ? { ...x, grupo: nombre } : x)));
  }

  /* Mover una categoría intercambia su orden con la vecina en todos sus
   * puntos: el orden vive en cada fila porque es la plantilla la que se
   * consulta al armar el levantamiento. */
  function moverCategoria(cat, direccion) {
    const i = categorias.findIndex(c => c.nombre === cat.nombre);
    const vecina = categorias[i + direccion];
    if (!vecina) return;
    const [a, b] = [cat.orden, vecina.orden];
    setItems(xs => xs.map(x =>
      x.grupo === cat.nombre ? { ...x, orden_grupo: b }
      : x.grupo === vecina.nombre ? { ...x, orden_grupo: a }
      : x));
  }

  function quitarPunto(item) {
    if (!confirm(`¿Quitar "${item.texto}"? Se elimina al guardar la plantilla.`)) return;
    if (abierto === item.id) setAbierto(null);
    if (aviso?.id === item.id) setAviso(null);
    setItems(xs => xs.filter(x => x.id !== item.id));
  }

  /* Guarda la plantilla entera: los puntos nuevos y modificados en un solo
   * upsert, los quitados en un solo delete y, si cambió, la plantilla. Antes
   * se revisa todo: si un punto tiene un problema no se guarda nada y se abre
   * ese punto con el aviso. Cada paso que sale bien pasa a lo guardado, así
   * que si algo falla, el reintento manda solo lo que faltó. */
  async function guardar() {
    const porGuardar = [...cambios.nuevos, ...cambios.modificados];
    for (const item of porGuardar) {
      const problema = problemaDe(item);
      if (problema) {
        setAviso({ id: item.id, mensaje: problema });
        mostrar(item.id);
        return;
      }
    }

    setAviso(null);
    setError(null);
    setGuardando(true);
    try {
      if (porGuardar.length) {
        const filas = porGuardar.map(filaGuardable);
        const { error: e } = await supabase.from('plantilla_items').upsert(filas);
        if (e) throw e;
        const porId = new Map(filas.map(f => [f.id, f]));
        setGuardada(g => ({ ...g, items: [...g.items.filter(x => !porId.has(x.id)), ...filas] }));
        // Lo que se ve queda igual a lo guardado (sin espacios de más ni
        // opciones vacías), salvo que se haya seguido editando mientras tanto.
        setItems(xs => xs.map(x => {
          const f = porId.get(x.id);
          return f && huellaPunto(x) === huella(f) ? { ...x, ...f } : x;
        }));
      }
      if (cambios.borrados.length) {
        const { error: e } = await supabase.from('plantilla_items').delete().in('id', cambios.borrados);
        if (e) throw e;
        const quitados = new Set(cambios.borrados);
        setGuardada(g => ({ ...g, items: g.items.filter(x => !quitados.has(x.id)) }));
      }
      if (cambios.plantilla) {
        const secuencial = Boolean(plantilla.secuencial);
        const { error: e } = await supabase.from('plantillas_control').update({ secuencial }).eq('id', id);
        if (e) throw e;
        setGuardada(g => ({ ...g, plantilla: { ...g.plantilla, secuencial } }));
      }
    } catch (e) {
      setError(`No se pudo guardar: ${e?.message ?? e}`);
    } finally {
      setGuardando(false);
    }
  }

  if (error && !plantilla) {
    return (
      <div className="cuerpo">
        <div className="aviso aviso-critico">{error}</div>
        <button className="boton boton-secundario boton-movil boton-ancho"
                style={{ marginTop: 14 }} onClick={() => navegar('/plantillas')}>
          Volver
        </button>
      </div>
    );
  }
  if (!plantilla) return <p className="cargando">Cargando…</p>;

  return (
    <div className="pantalla pantalla-angosta">
      {porConfirmar && (
        <Confirmar
          titulo="Hay cambios sin guardar"
          mensaje="Los cambios de esta plantilla se van a perder si sales ahora."
          textoConfirmar="Salir sin guardar"
          textoCancelar="Volver a editar"
          onConfirmar={confirmarSalida}
          onCancelar={() => setPorConfirmar(null)}
        />
      )}

      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={volver}>
            ‹ Plantillas
          </button>
        </div>
        <h1 className="h3">{plantilla.nombre}</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0 0' }}>
          {items.length} puntos en {categorias.length} categorías
        </p>

        {/* Se pide el orden completo, no solo "no dejar en blanco": exigir
            respuesta sin exigir orden ya lo hace cada punto por su cuenta con
            "Responder es obligatorio". Esto es lo que impide adelantarse. */}
        <label className="marca" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={Boolean(plantilla.secuencial)}
                 onChange={e => setPlantilla(p => ({ ...p, secuencial: e.target.checked }))} />
          <span>Obliga a responder en orden, sin saltarse preguntas</span>
        </label>
      </header>

      <div className="cuerpo">
        {categorias.map((cat, i) => (
          <section key={cat.nombre} className="categoria">
            <div className="categoria-editable">
              <button type="button" className="crece nombre" onClick={() => renombrarCategoria(cat)}>
                {cat.nombre}
              </button>
              <button type="button" className="mover" aria-label="Subir categoría"
                      disabled={i === 0} onClick={() => moverCategoria(cat, -1)}>↑</button>
              <button type="button" className="mover" aria-label="Bajar categoría"
                      disabled={i === categorias.length - 1} onClick={() => moverCategoria(cat, 1)}>↓</button>
            </div>

            {cat.items.map(item => (
              <ItemPlantilla
                key={item.id}
                item={item}
                abierto={abierto === item.id}
                sinGuardar={sinGuardar.has(item.id)}
                aviso={aviso?.id === item.id ? aviso.mensaje : null}
                onCambiar={(campo, valor) => cambiarPunto(item.id, x => ({ ...x, [campo]: valor }))}
                onCambiarConfig={(clave, valor) =>
                  cambiarPunto(item.id, x => ({ ...x, config: { ...x.config, [clave]: valor } }))}
                onAbrir={() => abrir(item.id)}
                onBorrar={() => quitarPunto(item)}
              />
            ))}

            <button type="button" className="boton boton-texto agregar-punto"
                    onClick={() => agregarPunto(cat)}>
              + Agregar punto a {cat.nombre}
            </button>
          </section>
        ))}

        <button className="boton boton-secundario boton-movil boton-ancho"
                style={{ marginTop: 12 }} onClick={agregarCategoria}>
          Nueva categoría
        </button>
      </div>

      {/* El guardado es de la plantilla entera y queda siempre a la vista. */}
      <footer className="pie-fijo pie-plantilla">
        {error && <p className="aviso aviso-critico pie-error">{error}</p>}
        <span className="chico apagado crece" aria-live="polite">
          {!sucio ? 'Todo guardado'
           : cambios.total === 1 ? '1 cambio sin guardar'
           : `${cambios.total} cambios sin guardar`}
        </span>
        <button type="button" className="boton boton-movil" disabled={!sucio || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar plantilla'}
        </button>
      </footer>
    </div>
  );
}

/* Un punto de la plantilla: qué se pregunta y cómo se responde.
 *
 * `item` es la versión del borrador: lo que se escribe acá queda en la
 * plantilla en edición y se guarda con todo lo demás en "Guardar plantilla". */
function ItemPlantilla({
  item, abierto, sinGuardar, aviso,
  onCambiar, onCambiarConfig, onAbrir, onBorrar
}) {
  const etiquetaTipo = TIPOS.find(([v]) => v === item.tipo_ingreso)?.[1] ?? item.tipo_ingreso;

  if (!abierto) {
    return (
      <article id={'punto-' + item.id} className="tarjeta item-plantilla">
        <button type="button" className="cabecera" onClick={onAbrir} aria-expanded={false}>
          <span className="crece">
            {item.texto || 'Sin pregunta'}
            <span className="tipo">
              {etiquetaTipo}
              {sinGuardar && <span className="sin-guardar"> · Sin guardar</span>}
            </span>
          </span>
          <span className="flecha" aria-hidden="true">+</span>
        </button>
      </article>
    );
  }

  const cfg = item.config ?? {};

  return (
    <article id={'punto-' + item.id} className="tarjeta item-plantilla abierto">
      <button type="button" className="cabecera" onClick={onAbrir} aria-expanded={true}>
        <span className="crece">
          {item.texto || 'Sin pregunta'}
          <span className="tipo">
            {etiquetaTipo}
            {sinGuardar && <span className="sin-guardar"> · Sin guardar</span>}
          </span>
        </span>
        <span className="flecha" aria-hidden="true">−</span>
      </button>

      <div className="detalle">
        <div className="campo">
          <label className="etiqueta-campo">Qué se pregunta</label>
          <input type="text" value={item.texto}
                 onChange={e => onCambiar('texto', e.target.value)} />
        </div>

        {/* Lo que verá quien hace el levantamiento bajo la pregunta: qué
            revisar, dónde, por qué importa. Va antes de cómo se responde,
            en el mismo orden en que se lee en terreno. */}
        <div className="campo">
          <label className="etiqueta-campo" htmlFor={'ayuda-' + item.id}>Descripción</label>
          <textarea id={'ayuda-' + item.id} rows={2} value={item.ayuda ?? ''}
                    placeholder="Qué revisar o cómo responder. Aparece bajo la pregunta en el levantamiento."
                    onChange={e => onCambiar('ayuda', e.target.value)} />
        </div>

        <div className="campo">
          <label className="etiqueta-campo">Cómo se responde</label>
          <select value={item.tipo_ingreso}
                  onChange={e => {
                    onCambiar('tipo_ingreso', e.target.value);
                    onCambiar('config', {});
                  }}>
            {TIPOS.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>

        {/* Parámetros propios del tipo elegido */}
        {item.tipo_ingreso === 'opciones' && (
          <EditorOpciones opciones={cfg.opciones ?? []} conFoto={cfg.origen !== 'ninguna'}
                          onCambiar={opciones => onCambiarConfig('opciones', opciones)} />
        )}

        {(item.tipo_ingreso === 'seleccion' || item.tipo_ingreso === 'checklist') && (
          <div className="campo">
            <label className="etiqueta-campo" htmlFor={'opciones-' + item.id}>Opciones, una por línea</label>
            {/* key: al cambiar de tipo las opciones se vacían, y el campo
                tiene que partir de nuevo desde esa lista. */}
            <OpcionesPorLinea key={item.tipo_ingreso} id={'opciones-' + item.id}
                              opciones={cfg.opciones ?? []}
                              onCambiar={opciones => onCambiarConfig('opciones', opciones)} />
          </div>
        )}

        {item.tipo_ingreso === 'escala' && (
          <div className="fila" style={{ gap: 8 }}>
            <div className="campo crece">
              <label className="etiqueta-campo">Desde</label>
              <input type="number" value={cfg.min ?? 1}
                     onChange={e => onCambiarConfig('min', Number(e.target.value))} />
            </div>
            <div className="campo crece">
              <label className="etiqueta-campo">Hasta</label>
              <input type="number" value={cfg.max ?? 10}
                     onChange={e => onCambiarConfig('max', Number(e.target.value))} />
            </div>
          </div>
        )}

        {item.tipo_ingreso === 'numero' && (
          <div className="campo">
            <label className="etiqueta-campo">Unidad</label>
            <input type="text" value={cfg.unidad ?? ''} placeholder="m³, bar, °C"
                   onChange={e => onCambiarConfig('unidad', e.target.value)} />
          </div>
        )}

        {item.tipo_ingreso === 'texto' && (
          <div className="campo">
            <label className="etiqueta-campo">Texto de ayuda</label>
            <input type="text" value={cfg.ejemplo ?? ''}
                   placeholder="Marca, modelo y año"
                   onChange={e => onCambiarConfig('ejemplo', e.target.value)} />
          </div>
        )}

        {/* La foto se puede pedir en cualquier tipo de punto, no solo en los
            de tipo "foto": una lectura de medidor también quiere su respaldo.
            "Sin foto" no se ofrece en un punto de tipo Foto: ahí la fotografía
            es la respuesta, y sin ella el punto no tendría cómo contestarse. */}
        <div className="campo">
          <label className="etiqueta-campo">Fotografías</label>
          <select value={cfg.origen ?? 'ambas'}
                  onChange={e => {
                    const origen = e.target.value;
                    onCambiarConfig('origen', origen);
                    if (origen === 'ninguna' && item.requiere_foto) onCambiar('requiere_foto', false);
                  }}>
            {ORIGENES_FOTO
              .filter(([valor]) => valor !== 'ninguna' || item.tipo_ingreso !== 'foto')
              .map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </div>

        {cfg.origen !== 'ninguna' && (
          <label className="marca">
            <input type="checkbox" checked={!!item.requiere_foto}
                   onChange={e => onCambiar('requiere_foto', e.target.checked)} />
            <span>Exigir al menos una foto</span>
          </label>
        )}

        <label className="marca">
          <input type="checkbox" checked={item.obligatorio !== false}
                 onChange={e => onCambiar('obligatorio', e.target.checked)} />
          <span>Responder es obligatorio</span>
        </label>

        <label className="marca">
          <input type="checkbox" checked={!!item.es_critico}
                 onChange={e => onCambiar('es_critico', e.target.checked)} />
          <span>Es un punto crítico</span>
        </label>

        {aviso && <div className="aviso aviso-critico" style={{ marginTop: 14 }}>{aviso}</div>}

        <button type="button" className="boton boton-texto peligro"
                style={{ marginTop: 14 }} onClick={onBorrar}>
          Eliminar este punto
        </button>
      </div>
    </article>
  );
}

/* Opciones de "Una opción de varias" y "Varias opciones", una por línea.
 *
 * El campo guarda el texto tal como se escribe y la lista limpia se arma
 * aparte. Si el campo se reconstruyera desde la lista en cada tecla, el
 * salto de línea recién escrito (y un espacio al final) se borraría al
 * instante: Enter no bajaba de línea y "Bueno", Enter, "Malo" quedaba
 * "BuenoMalo". */
function OpcionesPorLinea({ id, opciones, onCambiar }) {
  const [texto, setTexto] = useState(() => opciones
    .map(o => (typeof o === 'string' ? o : o?.etiqueta ?? o?.texto ?? ''))
    .join('\n'));

  return (
    <textarea id={id} rows={4} value={texto} placeholder={'Bueno\nRegular\nMalo'}
              onChange={e => {
                setTexto(e.target.value);
                onCambiar(e.target.value.split('\n').map(l => l.trim()).filter(Boolean));
              }} />
  );
}

/* Juegos de opciones de uso frecuente, para no escribirlos cada vez. Cada
 * opción trae una sugerencia de si exige evidencia; se cambia opción por
 * opción después de cargarlas. */
const OPCIONES_TIPICAS = [
  ['Cumple / No cumple', [
    { texto: 'Cumple', evidencia: 'ninguna' },
    { texto: 'No cumple', evidencia: 'comentario_foto' },
    { texto: 'Cumple con observaciones', evidencia: 'comentario' },
    { texto: 'No aplica', evidencia: 'ninguna' }
  ]],
  ['Sí / No', [
    { texto: 'Sí', evidencia: 'ninguna' },
    { texto: 'No', evidencia: 'ninguna' },
    { texto: 'No aplica', evidencia: 'ninguna' }
  ]]
];

/* Las opciones de un punto de tipo "Opciones con evidencia". Cada una dice qué
 * evidencia pide al elegirla en el levantamiento: ninguna, un comentario, o
 * un comentario y al menos una foto. Si el punto no admite fotos, la foto no
 * se ofrece y lo que la pedía queda en comentario. */
function EditorOpciones({ opciones, conFoto, onCambiar }) {
  const lista = opciones.map(normalizarOpcion);
  const niveles = NIVELES_EVIDENCIA.filter(([valor]) => conFoto || valor !== 'comentario_foto');
  const cambiar = (n, campo, valor) =>
    onCambiar(lista.map((o, i) => (i === n ? { ...o, [campo]: valor } : o)));

  return (
    <div className="campo">
      <label className="etiqueta-campo">Opciones</label>

      {lista.length === 0 && (
        <div className="opciones-tipicas">
          <span className="micro apagado">Cargar:</span>
          {OPCIONES_TIPICAS.map(([nombre, tipicas]) => (
            <button key={nombre} type="button" className="boton boton-secundario"
                    onClick={() => onCambiar(tipicas.map(o => ({
                      ...o, evidencia: nivelPosible(o.evidencia, conFoto)
                    })))}>
              {nombre}
            </button>
          ))}
        </div>
      )}

      {lista.map((op, n) => (
        <div key={n} className="opcion-plantilla">
          <input type="text" value={op.texto} placeholder="Ej: No cumple"
                 aria-label={`Opción ${n + 1}`}
                 onChange={e => cambiar(n, 'texto', e.target.value)} />
          <select value={nivelPosible(op.evidencia, conFoto)}
                  aria-label={`Evidencia de ${op.texto || `la opción ${n + 1}`}`}
                  onChange={e => cambiar(n, 'evidencia', e.target.value)}>
            {niveles.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          <button type="button" className="quitar-opcion"
                  aria-label={`Quitar ${op.texto || 'opción'}`}
                  onClick={() => onCambiar(lista.filter((_, i) => i !== n))}>×</button>
        </div>
      ))}

      <button type="button" className="boton boton-texto agregar-punto"
              onClick={() => onCambiar([...lista, { texto: '', evidencia: 'ninguna' }])}>
        + Agregar opción
      </button>
      <p className="micro apagado" style={{ margin: '2px 0 0' }}>
        {conFoto
          ? 'La evidencia se pide al elegir la opción: un comentario, o un comentario y al menos una foto.'
          : 'Este punto no lleva fotos: la evidencia solo puede ser un comentario.'}
      </p>
    </div>
  );
}
