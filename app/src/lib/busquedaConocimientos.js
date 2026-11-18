/* Búsqueda común en los 202 contenidos de la Ley 21.442.
 * Los campos de los artículos y las lecciones ampliadas pertenecen al índice.
 */
export function normalizarConsulta(texto) {
  return String(texto ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es').trim();
}

export function crearIndiceConocimientos(contenidos, obtenerLeccion) {
  return contenidos.map(item => {
    const leccion = obtenerLeccion(item);
    return {
      item,
      texto: normalizarConsulta([
        item.titulo, item.texto, item.explicacion, item.precaucion,
        item.categoria, item.referencia, item.articulo,
        leccion?.resumen, leccion?.desarrollo, leccion?.aplicacion,
        leccion?.fundamento, ...(leccion?.detalles || []).flat(),
        ...(leccion?.consideraciones || [])
      ].filter(Boolean).join(' '))
    };
  });
}

export function filtrarConocimientos(indice, busqueda = '', materia = 'Todas') {
  const palabras = normalizarConsulta(busqueda).split(/\s+/).filter(Boolean);
  return indice
    .filter(({item, texto}) => (materia === 'Todas' || item.categoria === materia)
      && palabras.every(palabra => texto.includes(palabra)))
    .map(({item}) => item);
}
