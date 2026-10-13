/* Historial de entrada de áreas para Android y PWA.
 *
 * Si React Router entró directamente en el inicio de un área (idx === 0),
 * no existe un selector detrás: Atrás abandonaría la aplicación.
 * Insertar UN selector real antes de la vista existente permite que Atrás
 * avance a /, y que un siguiente Atrás salga naturalmente de la PWA.
 *
 * No se ejecuta con roles sin selector, portales clientes, formularios ni
 * navegaciones ya iniciadas (idx > 0), para evitar pantallas fantasma.
 */
export const RAICES_CON_SELECTOR = [
  '/seo', '/pipeline', '/inicio', '/propiedades',
  '/proveedores', '/contabilidad', '/whatsapp', '/configuracion'
];

const MARCADOR_ORIGEN = '__coproAreaConSelectorAnterior';
let ultimoIndiceSelector = null;

export function registrarIndiceSelector(indice) {
  if (Number.isInteger(indice) && indice >= 0) ultimoIndiceSelector = indice;
}

export function pasosHastaSelector(estado) {
  const actual = estado?.idx;
  if (Number.isInteger(actual) && Number.isInteger(ultimoIndiceSelector)
    && actual > ultimoIndiceSelector) return ultimoIndiceSelector - actual;
  if (actual === 1 && (vieneDeSelectorPreparado(estado)
    || estado?.usr?.desdeSelectorCoproactiva === true)) return -1;
  return null;
}


export function debePrepararHistorialSelector(ruta, indice, puedeCambiarArea) {
  return Boolean(puedeCambiarArea)
    && indice === 0
    && RAICES_CON_SELECTOR.includes(String(ruta || '').replace(/\/+$/, '') || '/');
}

/*
 * Usa únicamente la History API y se ejecuta desde el panel autenticado;
 * no interfiere con el estado de React Router en otra navegación.
 * Conserva search/hash, para no perder la pestaña SEO actual.
 */
export function prepararHistorialSelector(historial, ubicacion, raiz = '/', puedeCambiarArea = false) {
  const anterior = historial.state || {};
  const indice = anterior.idx;
  const prefijo = raiz === '/' ? '' : raiz.replace(/\/$/, '');
  const ruta = ubicacion.pathname.startsWith(prefijo + '/')
    ? ubicacion.pathname.slice(prefijo.length) || '/'
    : ubicacion.pathname;
  if (!debePrepararHistorialSelector(ruta, indice, puedeCambiarArea)) return false;
  if (anterior[MARCADOR_ORIGEN]) return false;

  const origen = ubicacion.pathname + ubicacion.search + ubicacion.hash;
  const base = raiz.endsWith('/') ? raiz : raiz + '/';

  // React Router interpreta usr como location.state y idx como índice.
  historial.replaceState({
    ...anterior, idx: 0, key: 'selector-coproactiva',
    usr: { selectorCoproactiva: true }
  }, '', base);
  try {
    historial.pushState({
      ...anterior, idx: 1, [MARCADOR_ORIGEN]: true
    }, '', origen);
  } catch (error) {
    historial.replaceState(anterior, '', origen);
    throw error;
  }
  registrarIndiceSelector(0);
  return true;
}

export function vieneDeSelectorPreparado(estadoHistorial) {
  return estadoHistorial?.[MARCADOR_ORIGEN] === true;
}
