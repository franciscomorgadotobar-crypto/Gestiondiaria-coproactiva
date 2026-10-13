/* Historial de entrada de áreas para Android y PWA.
 *
 * Si se abre directamente un inicio de área con idx = 0, la navegación
 * automática desde "/" lo ha reemplazado; no existe selector detrás.
 * React Router debe insertar el selector antes de esa vista, con DOS
 * navegaciones de su propio historial (replace + push).
 * Nunca usar history.pushState manual: desincroniza el índice del router.
 */
export const RAICES_CON_SELECTOR = [
  '/seo', '/pipeline', '/inicio', '/propiedades',
  '/proveedores', '/contabilidad', '/whatsapp', '/configuracion'
];

let ultimoIndiceSelector = null;

export function registrarIndiceSelector(indice) {
  if (Number.isInteger(indice) && indice >= 0) ultimoIndiceSelector = indice;
}

export function pasosHastaSelector(estado) {
  const actual = estado?.idx;
  if (Number.isInteger(actual) && Number.isInteger(ultimoIndiceSelector)
    && actual > ultimoIndiceSelector) return ultimoIndiceSelector - actual;
  if (actual === 1 && estado?.usr?.desdeSelectorCoproactiva === true) return -1;
  return null;
}

export function debePrepararHistorialSelector(ruta, indice, puedeCambiarArea) {
  return Boolean(puedeCambiarArea)
    && indice === 0
    && RAICES_CON_SELECTOR.includes(String(ruta || '').replace(/\/+$/, '') || '/');
}

/*
 * Ejecutar solamente después de comprobar que la sesión pertenece a un rol
 * que puede elegir distintas áreas. Las URLs son relativas al basename
 * administrado por BrowserRouter; se conserva search y hash sin resetear
 * filtros, pestañas ni información de formularios.
 */
export function prepararHistorialSelector(navegar, ubicacion, indice, puedeCambiarArea = false) {
  const ruta = ubicacion.pathname;
  if (!debePrepararHistorialSelector(ruta, indice, puedeCambiarArea)) return false;

  const destino = ruta + (ubicacion.search || '') + (ubicacion.hash || '');
  registrarIndiceSelector(indice);
  navegar('/', {
    replace: true,
    state: { selectorCoproactiva: true },
    preventScrollReset: true
  });
  navegar(destino, {
    state: { desdeSelectorCoproactiva: true },
    preventScrollReset: true
  });
  return true;
}
