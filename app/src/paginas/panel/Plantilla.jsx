import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Confirmar from '../../componentes/Confirmar';

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
 * Estructura (categorías, puntos nuevos, borrar, mover) se guarda al toque:
 * son acciones de una sola vez, ya visibles apenas se hacen, y no hay nada que
 * "perder" si se sale después. Lo que sí queda en un borrador es el contenido
 * de un punto abierto —texto, tipo, configuración—: varios campos a la vez,
 * y de ahí sale el pedido de un botón Guardar con aviso si se sale sin usarlo.
 */

const TIPOS = [
  ['estado',    'Conforme / Observa / Crítico'],
  ['texto',     'Texto libre'],
  ['numero',    'Número o lectura'],
  ['escala',    'Escala del 1 al 10'],
  ['seleccion', 'Una opción de varias'],
  ['checklist', 'Varias opciones'],
  ['foto',      'Solo fotografía'],
  ['firma',     'Firma de quien recibe']
];

/* Los campos que vive el borrador. El resto del ítem (orden, grupo, id) no se
 * edita desde este panel. */
function campoBase(item) {
  return {
    texto: item.texto,
    tipo_ingreso: item.tipo_ingreso,
    config: item.config ?? {},
    requiere_foto: item.requiere_foto,
    obligatorio: item.obligatorio !== false,
    es_critico: item.es_critico
  };
}

export default function EditorPlantilla() {
  const { id } = useParams();
  const navegar = useNavigate();

  const [plantilla, setPlantilla] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState(null);         // id del punto abierto
  const [borrador, setBorrador] = useState(null);          // sus campos, en edición
  const [guardadoComo, setGuardadoComo] = useState(null);  // la última versión ya guardada
  const [porConfirmar, setPorConfirmar] = useState(null);  // qué hacer si se confirma perder el borrador

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([
        supabase.from('plantillas_control').select('*').eq('id', id).maybeSingle(),
        supabase.from('plantilla_items').select('*').eq('plantilla_id', id)
          .order('orden_grupo').order('orden')
      ]);
      if (p.error) return setError(p.error.message);
      if (!p.data) return setError('Esta plantilla no existe o no tienes acceso.');
      setPlantilla(p.data);
      setItems(i.data ?? []);
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
    return [...m.values()].sort((a, b) => a.orden - b.orden);
  }, [items]);

  const sucio = editando !== null && JSON.stringify(borrador) !== JSON.stringify(guardadoComo);

  /* Toda acción que pueda hacer perder el borrador pasa por acá: abrir otro
   * punto, cerrar el actual, salir de la pantalla. Si no hay nada sin
   * guardar, sigue directo; si lo hay, primero pregunta. */
  function conAviso(luego) {
    if (sucio) setPorConfirmar(() => luego);
    else luego();
  }

  function abrirDirecto(itemId) {
    if (itemId === editando) {
      setEditando(null); setBorrador(null); setGuardadoComo(null);
      return;
    }
    const base = campoBase(items.find(x => x.id === itemId));
    setEditando(itemId);
    setBorrador(base);
    setGuardadoComo(base);
  }

  const abrir = itemId => conAviso(() => abrirDirecto(itemId));
  const volver = () => conAviso(() => navegar('/plantillas'));

  function confirmarPerdida() {
    const luego = porConfirmar;
    setPorConfirmar(null);
    setEditando(null); setBorrador(null); setGuardadoComo(null);
    luego?.();
  }

  async function agregarCategoria() {
    const nombre = prompt('Nombre de la categoría');
    if (!nombre?.trim()) return;
    const orden = categorias.length ? Math.max(...categorias.map(c => c.orden)) + 1 : 0;
    await crearItem({ grupo: nombre.trim(), orden_grupo: orden, texto: 'Punto nuevo', orden: 0 });
  }

  async function renombrarCategoria(cat) {
    const nombre = prompt('Nuevo nombre de la categoría', cat.nombre);
    if (!nombre?.trim() || nombre === cat.nombre) return;
    setGuardando(true);
    const { error } = await supabase
      .from('plantilla_items')
      .update({ grupo: nombre.trim() })
      .eq('plantilla_id', id).eq('grupo', cat.nombre);
    setGuardando(false);
    if (error) return setError(error.message);
    setItems(xs => xs.map(x => (x.grupo === cat.nombre ? { ...x, grupo: nombre.trim() } : x)));
  }

  /* Mover una categoría intercambia su orden con la vecina y actualiza todos
   * sus ítems: el orden vive en cada fila porque es la plantilla la que se
   * consulta al armar el levantamiento. */
  async function moverCategoria(cat, direccion) {
    const i = categorias.findIndex(c => c.nombre === cat.nombre);
    const vecina = categorias[i + direccion];
    if (!vecina) return;

    setGuardando(true);
    const [a, b] = [cat.orden, vecina.orden];
    await Promise.all([
      supabase.from('plantilla_items').update({ orden_grupo: b })
        .eq('plantilla_id', id).eq('grupo', cat.nombre),
      supabase.from('plantilla_items').update({ orden_grupo: a })
        .eq('plantilla_id', id).eq('grupo', vecina.nombre)
    ]);
    setGuardando(false);
    setItems(xs => xs.map(x =>
      x.grupo === cat.nombre ? { ...x, orden_grupo: b }
      : x.grupo === vecina.nombre ? { ...x, orden_grupo: a }
      : x));
  }

  async function crearItem(datos) {
    setGuardando(true);
    const { data, error } = await supabase
      .from('plantilla_items')
      .insert({ plantilla_id: id, tipo_ingreso: 'estado', config: {}, ...datos })
      .select().single();
    setGuardando(false);
    if (error) return setError(error.message);
    setItems(xs => [...xs, data]);
    abrirDirecto(data.id);
  }

  /* Guarda el punto abierto entero, no campo por campo: es lo que hace que
   * "Guardar" tenga sentido como botón y no como algo que ya pasó solo. */
  async function guardarBorrador() {
    const item = items.find(x => x.id === editando);
    setGuardando(true);
    const { error } = await supabase.from('plantilla_items').update(borrador).eq('id', item.id);
    setGuardando(false);
    if (error) return setError(error.message);
    setItems(xs => xs.map(x => (x.id === item.id ? { ...x, ...borrador } : x)));
    setGuardadoComo(borrador);
  }

  /* El orden obligatorio es de la plantilla entera, no de un punto: si un
   * levantamiento tiene que hacerse en el orden en que se recorre el edificio,
   * eso no depende de qué pregunta sea, depende de qué plantilla es. Esto se
   * guarda al toque —es un solo interruptor, no un formulario—. */
  async function guardarPlantilla(cambios) {
    setPlantilla(p => ({ ...p, ...cambios }));
    const { error } = await supabase.from('plantillas_control').update(cambios).eq('id', id);
    if (error) setError(error.message);
  }

  async function borrarItem(item) {
    if (!confirm(`¿Eliminar "${item.texto}"?`)) return;
    if (editando === item.id) { setEditando(null); setBorrador(null); setGuardadoComo(null); }
    setItems(xs => xs.filter(x => x.id !== item.id));
    const { error } = await supabase.from('plantilla_items').delete().eq('id', item.id);
    if (error) setError(error.message);
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
          mensaje="Lo que escribiste en este punto se va a perder si sales ahora."
          textoConfirmar="Salir sin guardar"
          textoCancelar="Volver a editar"
          onConfirmar={confirmarPerdida}
          onCancelar={() => setPorConfirmar(null)}
        />
      )}

      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={volver}>
            ‹ Plantillas
          </button>
          <span className="crece" />
          {guardando && <span className="micro apagado">Guardando…</span>}
        </div>
        <h1 className="h3">{plantilla.nombre}</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0 0' }}>
          {items.length} puntos en {categorias.length} categorías
        </p>

        {/* Se pide el orden completo, no solo "no dejar en blanco": exigir
            respuesta sin exigir orden ya lo hace cada punto por su cuenta con
            "Responder es obligatorio". Esto es lo que impide adelantarse. */}
        <label className="marca" style={{ marginTop: 10 }}>
          <input type="checkbox" defaultChecked={plantilla.secuencial}
                 onChange={e => guardarPlantilla({ secuencial: e.target.checked })} />
          <span>Obliga a responder en orden, sin saltarse preguntas</span>
        </label>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

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
                abierto={editando === item.id}
                borrador={editando === item.id ? borrador : null}
                sucio={editando === item.id && sucio}
                guardando={guardando}
                onCambiar={(campo, valor) => setBorrador(b => ({ ...b, [campo]: valor }))}
                onCambiarConfig={(clave, valor) =>
                  setBorrador(b => ({ ...b, config: { ...b.config, [clave]: valor } }))}
                onAbrir={() => abrir(item.id)}
                onGuardar={guardarBorrador}
                onBorrar={() => borrarItem(item)}
              />
            ))}

            <button type="button" className="boton boton-texto agregar-punto"
                    onClick={() => crearItem({
                      grupo: cat.nombre,
                      orden_grupo: cat.orden,
                      texto: 'Punto nuevo',
                      orden: cat.items.length
                    })}>
              + Agregar punto a {cat.nombre}
            </button>
          </section>
        ))}

        <button className="boton boton-secundario boton-movil boton-ancho"
                style={{ marginTop: 12 }} onClick={agregarCategoria}>
          Nueva categoría
        </button>
      </div>
    </div>
  );
}

/* Un punto de la plantilla: qué se pregunta y cómo se responde.
 *
 * Mientras está abierto, sus campos se leen y se escriben en `borrador` —que
 * vive en el componente de arriba, no acá—, y no en `item` directamente:
 * `item` es lo último guardado, `borrador` es lo que se está por guardar. El
 * botón Guardar es lo único que los hace coincidir. */
function ItemPlantilla({
  item, abierto, borrador, sucio, guardando,
  onCambiar, onCambiarConfig, onAbrir, onGuardar, onBorrar
}) {
  const etiquetaTipo = TIPOS.find(([v]) => v === item.tipo_ingreso)?.[1] ?? item.tipo_ingreso;

  if (!abierto) {
    return (
      <article className="tarjeta item-plantilla">
        <button type="button" className="cabecera" onClick={onAbrir} aria-expanded={false}>
          <span className="crece">
            {item.texto}
            <span className="tipo">{etiquetaTipo}</span>
          </span>
          <span className="flecha" aria-hidden="true">+</span>
        </button>
      </article>
    );
  }

  const cfg = borrador.config ?? {};

  function cambiarOpciones(texto) {
    onCambiarConfig('opciones', texto.split('\n').map(s => s.trim()).filter(Boolean));
  }

  return (
    <article className="tarjeta item-plantilla abierto">
      <button type="button" className="cabecera" onClick={onAbrir} aria-expanded={true}>
        <span className="crece">
          {item.texto}
          <span className="tipo">{etiquetaTipo}</span>
        </span>
        <span className="flecha" aria-hidden="true">−</span>
      </button>

      <div className="detalle">
        <div className="campo">
          <label className="etiqueta-campo">Qué se pregunta</label>
          <input type="text" value={borrador.texto}
                 onChange={e => onCambiar('texto', e.target.value)} />
        </div>

        <div className="campo">
          <label className="etiqueta-campo">Cómo se responde</label>
          <select value={borrador.tipo_ingreso}
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
        {(borrador.tipo_ingreso === 'seleccion' || borrador.tipo_ingreso === 'checklist') && (
          <div className="campo">
            <label className="etiqueta-campo">Opciones, una por línea</label>
            <textarea rows={4} value={(cfg.opciones ?? []).join('\n')}
                      placeholder={'Bueno\nRegular\nMalo'}
                      onChange={e => cambiarOpciones(e.target.value)} />
          </div>
        )}

        {borrador.tipo_ingreso === 'escala' && (
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

        {borrador.tipo_ingreso === 'numero' && (
          <div className="campo">
            <label className="etiqueta-campo">Unidad</label>
            <input type="text" value={cfg.unidad ?? ''} placeholder="m³, bar, °C"
                   onChange={e => onCambiarConfig('unidad', e.target.value)} />
          </div>
        )}

        {borrador.tipo_ingreso === 'texto' && (
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
                    if (origen === 'ninguna' && borrador.requiere_foto) onCambiar('requiere_foto', false);
                  }}>
            <option value="ambas">Cámara o galería</option>
            <option value="camara">Solo cámara, en el momento</option>
            <option value="galeria">Solo galería</option>
            {borrador.tipo_ingreso !== 'foto' && <option value="ninguna">Sin foto</option>}
          </select>
        </div>

        {cfg.origen !== 'ninguna' && (
          <label className="marca">
            <input type="checkbox" checked={!!borrador.requiere_foto}
                   onChange={e => onCambiar('requiere_foto', e.target.checked)} />
            <span>Exigir al menos una foto</span>
          </label>
        )}

        <label className="marca">
          <input type="checkbox" checked={borrador.obligatorio}
                 onChange={e => onCambiar('obligatorio', e.target.checked)} />
          <span>Responder es obligatorio</span>
        </label>

        <label className="marca">
          <input type="checkbox" checked={!!borrador.es_critico}
                 onChange={e => onCambiar('es_critico', e.target.checked)} />
          <span>Es un punto crítico</span>
        </label>

        <div className="fila-botones" style={{ marginTop: 14 }}>
          <button type="button" className="boton boton-movil crece"
                  disabled={!sucio || guardando} onClick={onGuardar}>
            {guardando ? 'Guardando…' : sucio ? 'Guardar' : 'Guardado'}
          </button>
        </div>

        <button type="button" className="boton boton-texto peligro"
                style={{ marginTop: 10 }} onClick={onBorrar}>
          Eliminar este punto
        </button>
      </div>
    </article>
  );
}
