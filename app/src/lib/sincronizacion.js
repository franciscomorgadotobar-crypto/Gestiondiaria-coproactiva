import { supabase } from './supabase';
import {
  ALMACENES, leerCola, sacarDeCola, marcarIntento,
  guardarFoto, leerFotosDeControl, confirmarItem, pendientes, leerFotosPendientes
} from './local';

/* Subida de lo que se registró sin señal.
 *
 * Corre cuando el navegador avisa que volvió la conexión, al abrir la app y
 * cada vez que se guarda algo teniendo red. Procesa la cola en orden: si el
 * ítem 3 se evaluó antes que el 7, así se suben, porque el orden es parte del
 * registro de cómo ocurrió el recorrido.
 *
 * Nada se borra de la cola hasta que el servidor confirma. Un fallo deja la
 * entrada donde está, con su contador de intentos, y se reintenta en la ronda
 * siguiente. Eso hace que cerrar la app a media subida no pierda nada.
 */

// Tope de reintentos. Después de esto la entrada queda marcada y la interfaz la
// muestra: un error que se repite 8 veces no se arregla insistiendo, hay algo
// que una persona tiene que mirar.
const MAX_INTENTOS = 8;

let corriendo = false;
const oyentes = new Set();

export function alCambiarPendientes(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

async function avisar() {
  const estado = await pendientes();
  for (const fn of oyentes) fn(estado);
}

export function hayConexion() {
  return navigator.onLine;
}

/* Una foto sin comprimir de un teléfono moderno pesa entre 3 y 8 MB. Subir
 * treinta de esas por una red móvil de subterráneo no termina nunca, y para
 * leer la rotulación de un tablero no hace falta esa resolución. 1600 px en el
 * lado largo y calidad 0.72 deja legible un número de serie y baja el peso a
 * unos 300 KB. */
export async function comprimir(archivo, ladoMaximo = 1600, calidad = 0.72) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', calidad));
  return { blob, ancho, alto };
}

async function subirFoto(foto) {
  // La firma se dibuja en un canvas y sale PNG; las fotos van comprimidas a
  // JPEG. Subir una firma declarándola JPEG la deja ilegible en el informe.
  const esFirma = foto.clase === 'firma';
  const mime = esFirma ? 'image/png' : 'image/jpeg';
  /* La ruta cuelga del levantamiento, no de la comunidad: un levantamiento de
   * diagnóstico pertenece a un prospecto y no tiene comunidad todavía. */
  const ruta = `${foto.control_id}/${foto.id}.${esFirma ? 'png' : 'jpg'}`;

  const { error: errorSubida } = await supabase.storage
    .from('evidencia')
    .upload(ruta, foto.blob, { contentType: mime, upsert: true });

  // El bucket ya la tiene de un intento anterior que no alcanzó a registrar la
  // fila: no es un error, hay que seguir y crear el registro.
  if (errorSubida && !/already exists|duplicate/i.test(errorSubida.message)) {
    throw errorSubida;
  }

  const { error: errorFila } = await supabase.from('adjuntos').upsert({
    id: foto.id,
    comunidad_id: foto.comunidad_id ?? null,
    control_id: foto.control_id,
    control_item_id: foto.control_item_id,
    criterio_id: foto.criterio_id ?? null,
    storage_path: ruta,
    clase: foto.clase ?? 'foto',
    firmante_nombre: foto.firmante_nombre ?? null,
    firmante_rut: foto.firmante_rut ?? null,
    nombre_original: foto.nombre_original ?? null,
    mime,
    bytes: foto.blob.size,
    lat: foto.lat ?? null,
    lng: foto.lng ?? null,
    tomada_en: foto.tomada_en,
    descripcion: foto.descripcion ?? null,
    orden: foto.orden ?? 0,
    subida_por: foto.subida_por
  });
  if (errorFila) throw errorFila;

  // Se conserva el blob local: el informe se arma en el teléfono y necesita las
  // imágenes aunque no haya red. Solo se marca que ya está arriba.
  await guardarFoto({ ...foto, pendiente: 0, subida_en: new Date().toISOString() });
}

async function aplicar(entrada) {
  switch (entrada.tipo) {
    case 'item': {
      const { error } = await supabase
        .from('control_items')
        .update(entrada.cambios)
        .eq('id', entrada.id);
      if (error) throw error;
      // Confirmado en el servidor: la copia local deja de tener precedencia.
      await confirmarItem(entrada.id);
      return;
    }
    case 'control': {
      const { error } = await supabase
        .from('controles')
        .update(entrada.cambios)
        .eq('id', entrada.id);
      if (error) throw error;
      return;
    }
    case 'pausa': {
      // upsert y no insert: la pausa nace en el teléfono con su id, y al
      // reanudar se actualiza esa misma fila. Si la creación no había subido
      // todavía, el upsert la crea ya reanudada, que es el estado correcto.
      const { error } = await supabase.from('control_pausas').upsert(entrada.fila);
      if (error) throw error;
      return;
    }
    case 'foto': {
      const fotos = await leerFotosDeControl(entrada.control_id);
      const foto = fotos.find(f => f.id === entrada.id);
      // Si la foto ya no está localmente es porque se borró antes de subirla.
      // No es un error: la entrada de cola simplemente ya no aplica.
      if (foto) await subirFoto(foto);
      return;
    }
    default:
      throw new Error(`Operación desconocida: ${entrada.tipo}`);
  }
}

/* Corrige el caso de una foto que el teléfono cree pendiente y el servidor ya
 * tiene. Puede pasar si la subida terminó pero la app se cerró —el sistema
 * operativo puede cortar una pestaña en segundo plano en cualquier punto—
 * justo antes de guardar localmente que ya estaba arriba: la foto queda
 * subida de verdad, pero marcada como pendiente para siempre. Sin esto, ese
 * aviso no se resuelve nunca por más veces que se apriete "Subir ahora",
 * porque no hay nada en la cola que reintentar.
 *
 * Se compara contra el servidor solo lo que el teléfono cree pendiente —no
 * todo el levantamiento—, así que el costo es proporcional a lo que hay que
 * revisar, no al tamaño del historial. */
async function reconciliarFotos() {
  const locales = await leerFotosPendientes();
  if (!locales.length) return;

  const { data: enServidor } = await supabase
    .from('adjuntos')
    .select('id')
    .in('id', locales.map(f => f.id));

  const idsArriba = new Set((enServidor ?? []).map(a => a.id));
  for (const foto of locales) {
    if (idsArriba.has(foto.id)) {
      await guardarFoto({ ...foto, pendiente: 0 });
    }
  }
}

/* Devuelve qué pasó, para que la interfaz pueda decir algo concreto en vez de
 * un "error al sincronizar" que no ayuda a nadie en terreno. */
export async function sincronizar() {
  if (corriendo || !hayConexion()) return { subidas: 0, fallidas: 0, omitida: true };
  corriendo = true;

  let subidas = 0;
  let fallidas = 0;

  try {
    const cola = (await leerCola()).sort((a, b) => a.secuencia - b.secuencia);

    for (const entrada of cola) {
      if (entrada.intentos >= MAX_INTENTOS) { fallidas++; continue; }
      try {
        await aplicar(entrada);
        await sacarDeCola(entrada.secuencia);
        subidas++;
      } catch (e) {
        await marcarIntento(entrada, e.message ?? e);
        fallidas++;
        // Se corta la ronda ante el primer fallo de red: seguir intentando las
        // demás con la conexión caída solo gasta batería y llena el contador
        // de intentos sin motivo.
        if (!hayConexion()) break;
      }
    }

    if (hayConexion()) await reconciliarFotos();
  } finally {
    corriendo = false;
    await avisar();
  }

  return { subidas, fallidas, omitida: false };
}

/* Se engancha una vez, al arrancar la app. */
export function iniciarSincronizacion() {
  const alVolver = () => sincronizar();
  window.addEventListener('online', alVolver);
  // Volver a la app después de tenerla en segundo plano es el momento típico en
  // que se recuperó señal sin que se disparara el evento 'online'.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar();
  });
  sincronizar();
  return () => window.removeEventListener('online', alVolver);
}

export { ALMACENES };
