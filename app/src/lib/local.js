import { openDB } from 'idb';

/* Almacenamiento local del levantamiento.
 *
 * El problema que resuelve: en una sala de bombas o en un subterráneo no hay
 * señal, y ahí es justo donde está lo que hay que fotografiar. La app tiene que
 * poder recorrer el edificio completo sin conexión y subir todo después.
 *
 * La regla: el teléfono es la fuente de verdad mientras el levantamiento está
 * abierto. Se escribe primero acá y siempre; la subida es un proceso aparte que
 * ocurre cuando hay red. Nada de lo que la persona registró en terreno puede
 * depender de que el servidor conteste.
 *
 * Los ids los genera el teléfono (uuid v4). Como el esquema usa uuid en todas
 * las claves, un registro creado sin señal ya nace con su id definitivo y no
 * hay que reconciliar nada al subirlo.
 */

const NOMBRE = 'coproactiva-terreno';
const VERSION = 1;

export const ALMACENES = {
  controles: 'controles',
  items: 'items',
  fotos: 'fotos',
  cola: 'cola'
};

let promesaBase;

function base() {
  if (!promesaBase) {
    promesaBase = openDB(NOMBRE, VERSION, {
      upgrade(db) {
        db.createObjectStore(ALMACENES.controles, { keyPath: 'id' });

        const items = db.createObjectStore(ALMACENES.items, { keyPath: 'id' });
        items.createIndex('control_id', 'control_id');

        const fotos = db.createObjectStore(ALMACENES.fotos, { keyPath: 'id' });
        fotos.createIndex('control_id', 'control_id');
        fotos.createIndex('control_item_id', 'control_item_id');
        // Índice sobre "pendiente" para encontrar rápido lo que falta subir sin
        // recorrer todas las fotos del levantamiento.
        fotos.createIndex('pendiente', 'pendiente');

        const cola = db.createObjectStore(ALMACENES.cola, {
          keyPath: 'secuencia',
          autoIncrement: true
        });
        cola.createIndex('creada_en', 'creada_en');
      }
    });
  }
  return promesaBase;
}

export function nuevoId() {
  // crypto.randomUUID existe en todo navegador que soporte service workers.
  return crypto.randomUUID();
}

// ------------------------------------------------------------------ Lectura

export async function leerControl(id) {
  return (await base()).get(ALMACENES.controles, id);
}

export async function leerControles() {
  return (await base()).getAll(ALMACENES.controles);
}

export async function leerItems(controlId) {
  return (await base()).getAllFromIndex(ALMACENES.items, 'control_id', controlId);
}

export async function leerFotosDeItem(itemId) {
  const fotos = await (await base()).getAllFromIndex(
    ALMACENES.fotos, 'control_item_id', itemId
  );
  return fotos.sort((a, b) => a.orden - b.orden);
}

export async function leerFotosDeControl(controlId) {
  return (await base()).getAllFromIndex(ALMACENES.fotos, 'control_id', controlId);
}

// ----------------------------------------------------------------- Escritura

export async function guardarControl(control) {
  return (await base()).put(ALMACENES.controles, control);
}

/* Al borrar un levantamiento en el servidor, la copia local no se limpia
 * sola: sin esto, un teléfono que lo tenía descargado seguiría mostrándolo
 * si se abre sin señal después. */
export async function borrarControlLocal(controlId) {
  const db = await base();
  const [items, fotos] = await Promise.all([
    db.getAllFromIndex(ALMACENES.items, 'control_id', controlId),
    db.getAllFromIndex(ALMACENES.fotos, 'control_id', controlId)
  ]);
  await Promise.all([
    db.delete(ALMACENES.controles, controlId),
    ...items.map(i => db.delete(ALMACENES.items, i.id)),
    ...fotos.map(f => db.delete(ALMACENES.fotos, f.id))
  ]);
}

/* Reemplaza los ítems de un control con lo que vino del servidor.
 *
 * Se conserva lo que el teléfono tenga sin subir: si alguien evaluó un ítem en
 * el subterráneo y todavía no sube, la copia del servidor no puede pisarlo.
 * Esa es la única regla de precedencia que hay, y va en esta dirección: lo
 * local gana mientras esté pendiente. */
export async function fusionarItems(controlId, delServidor) {
  const db = await base();
  const locales = await db.getAllFromIndex(ALMACENES.items, 'control_id', controlId);
  const pendientes = new Map(
    locales.filter(i => i.pendiente).map(i => [i.id, i])
  );

  const tx = db.transaction(ALMACENES.items, 'readwrite');
  for (const item of delServidor) {
    const local = pendientes.get(item.id);

    /* La estructura de la pauta (texto, ayuda/descripcion, tipo, config,
     * obligatoriedad, etc.) siempre viene del servidor. Solo conservamos del
     * teléfono los campos que el usuario puede haber cambiado sin subir.
     *
     * Antes se guardaba el objeto local completo cuando estaba pendiente. Un
     * levantamiento creado con una versión antigua de la app podía conservar
     * respuestas y fotos correctamente, pero perder campos incorporados luego,
     * como `ayuda`. El informe entonces no tenía de dónde sacar la descripción
     * aun cuando Supabase sí la tenía. */
    const combinado = local
      ? {
          ...item,
          control_id: controlId,
          estado: local.estado,
          nota: local.nota,
          respuesta: local.respuesta,
          evaluado_en: local.evaluado_en,
          pendiente: true
        }
      : { ...item, control_id: controlId, pendiente: false };

    await tx.store.put(combinado);
  }
  await tx.done;
}

export async function guardarItem(item) {
  return (await base()).put(ALMACENES.items, item);
}

/* Un ítem queda marcado `pendiente` mientras su cambio no haya subido, y esa
 * marca hace que `fusionarItems` prefiera la copia del teléfono. Si no se
 * limpia al confirmarse la subida, la marca queda para siempre: el teléfono
 * ignoraría cualquier corrección que jefatura hiciera después sobre ese ítem. */
export async function confirmarItem(id) {
  const db = await base();
  const item = await db.get(ALMACENES.items, id);
  if (item?.pendiente) await db.put(ALMACENES.items, { ...item, pendiente: false });
}

export async function guardarFoto(foto) {
  return (await base()).put(ALMACENES.fotos, foto);
}

export async function borrarFoto(id) {
  return (await base()).delete(ALMACENES.fotos, id);
}

// --------------------------------------------------------------------- Cola

/* Cada cambio que hay que llevar al servidor entra acá en orden. La cola es la
 * memoria de lo que falta: mientras tenga entradas, hay trabajo sin subir, y la
 * interfaz lo dice. Se vacía sola cuando vuelve la señal. */
export async function encolar(operacion) {
  return (await base()).add(ALMACENES.cola, {
    ...operacion,
    intentos: 0,
    creada_en: new Date().toISOString()
  });
}

export async function leerCola() {
  return (await base()).getAll(ALMACENES.cola);
}

export async function sacarDeCola(secuencia) {
  return (await base()).delete(ALMACENES.cola, secuencia);
}

export async function marcarIntento(entrada, error) {
  const db = await base();
  return db.put(ALMACENES.cola, {
    ...entrada,
    intentos: entrada.intentos + 1,
    ultimo_error: error ? String(error).slice(0, 300) : null,
    ultimo_intento: new Date().toISOString()
  });
}

/* Cuánto queda por subir. Alimenta el indicador de la interfaz: en terreno hay
 * que poder mirar el teléfono y saber si ya es seguro cerrar la app.
 *
 * Las fotos se cuentan una sola vez, desde el almacén de fotos. Contarlas
 * también desde la cola —donde tienen su propia entrada tipo 'foto' para
 * llevarlas al servidor— las duplicaba: una foto pendiente aparecía a la vez
 * como "1 cambio" y como "1 foto", cuando era la misma foto. */
export async function pendientes() {
  const db = await base();
  const [cola, fotos] = await Promise.all([
    db.getAll(ALMACENES.cola),
    db.getAllFromIndex(ALMACENES.fotos, 'pendiente', 1)
  ]);
  const cambios = cola.filter(e => e.tipo !== 'foto').length;
  return { cambios, fotos: fotos.length, total: cambios + fotos.length };
}

/* Lo mismo, pero por levantamiento: para poder decir "en el Edificio Mirador
 * del Parque" en vez de un número suelto que no dice dónde ir a mirar.
 *
 * Los ítems no guardan su control_id en la entrada de cola —solo el id del
 * ítem—, así que hay que resolverlo contra el almacén de ítems. Es la única
 * vuelta extra; control, pausa y foto ya lo traen directo. */
export async function pendientesPorControl() {
  const db = await base();
  const [cola, fotos] = await Promise.all([
    db.getAll(ALMACENES.cola),
    db.getAllFromIndex(ALMACENES.fotos, 'pendiente', 1)
  ]);

  const porControl = new Map();
  function sumar(controlId, campo) {
    if (!controlId) return;
    if (!porControl.has(controlId)) porControl.set(controlId, { cambios: 0, fotos: 0 });
    porControl.get(controlId)[campo]++;
  }

  for (const entrada of cola) {
    if (entrada.tipo === 'foto') continue;
    if (entrada.tipo === 'control') sumar(entrada.id, 'cambios');
    else if (entrada.tipo === 'pausa') sumar(entrada.fila?.control_id, 'cambios');
    else if (entrada.tipo === 'item') {
      const item = await db.get(ALMACENES.items, entrada.id);
      sumar(item?.control_id, 'cambios');
    }
  }
  for (const foto of fotos) sumar(foto.control_id, 'fotos');

  return [...porControl.entries()].map(([control_id, c]) => (
    { control_id, ...c, total: c.cambios + c.fotos }
  ));
}

/* Fotos que el teléfono cree que no ha subido. Sirve para comprobar contra el
 * servidor si eso sigue siendo cierto: ver `reconciliarFotos` en
 * sincronizacion.js. */
export async function leerFotosPendientes() {
  return (await base()).getAllFromIndex(ALMACENES.fotos, 'pendiente', 1);
}
