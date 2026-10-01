/* Opciones de un punto "Opciones con evidencia".
 *
 * Se guardan en `config.opciones` como { texto, evidencia }, y `evidencia` es
 * uno de NIVELES_EVIDENCIA. Se leen también dos formas anteriores, para que
 * nada guardado así quede mudo: `evidencia` como sí/no (sí equivalía a
 * comentario y foto) y `etiqueta` en lugar de `texto`. */

export const NIVELES_EVIDENCIA = [
  ['ninguna', 'Sin evidencia'],
  ['comentario', 'Comentario'],
  ['comentario_foto', 'Comentario y foto']
];

const NIVELES = new Set(NIVELES_EVIDENCIA.map(([valor]) => valor));

export function normalizarOpcion(o) {
  if (typeof o === 'string') return { texto: o, evidencia: 'ninguna' };
  const texto = o?.texto ?? o?.etiqueta ?? '';
  const evidencia = o?.evidencia === true ? 'comentario_foto'
    : NIVELES.has(o?.evidencia) ? o.evidencia
    : 'ninguna';
  return { texto, evidencia };
}

/* Las opciones listas para mostrar: normalizadas y sin filas vacías. */
export function opcionesDe(config) {
  return (config?.opciones ?? []).map(normalizarOpcion).filter(o => o.texto.trim());
}

/* Un punto sin fotos no puede pedir foto como evidencia: queda en comentario. */
export function nivelPosible(evidencia, admiteFotos) {
  return !admiteFotos && evidencia === 'comentario_foto' ? 'comentario' : evidencia;
}
