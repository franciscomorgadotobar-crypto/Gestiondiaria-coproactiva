/* Evaluación por condición, compatible con levantamientos históricos.
 * Los controles antiguos mantienen respuesta.opcion; los nuevos usan
 * respuesta.criterios[id] = { opcion, comentario }.
 */
export const OPCIONES_CRITERIO = ['Cumple', 'No cumple', 'Cumple con observaciones', 'No aplica'];

export function criteriosDe(config) {
  return Array.isArray(config?.criterios)
    ? config.criterios.map((c, index) => typeof c === 'string'
      ? { id: String(index + 1), texto: c }
      : { id: String(c.id ?? index + 1), texto: String(c.texto ?? '') })
      .filter(c => c.texto.trim())
    : [];
}

export function evidenciaDeCriterio(config, opcion) {
  if (!opcion) return 'ninguna';
  const definida = (config?.opciones ?? []).find(x => (typeof x === 'string' ? x : x.texto) === opcion);
  return typeof definida === 'object' ? definida.evidencia ?? 'ninguna' : 'ninguna';
}

export function pendienteCriterio(item, fotos = []) {
  const criterios = criteriosDe(item.config);
  if (!criterios.length || item.respuesta?.opcion) return false; // formato histórico
  return criterios.some(c => {
    const valor = item.respuesta?.criterios?.[c.id];
    if (!valor?.opcion) return true;
    const evidencia = evidenciaDeCriterio(item.config, valor.opcion);
    if (evidencia !== 'ninguna' && !String(valor.comentario ?? '').trim()) return true;
    return evidencia === 'comentario_foto'
      && !fotos.some(f => String(f.criterio_id ?? '') === c.id);
  });
}
