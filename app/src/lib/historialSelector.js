/*
 * El último nivel de navegación interna es el Home autorizado del perfil:
 * selector de módulos (roles multiarea) o inicio de Operación (rol de área
 * única). El gesto Atrás de Android debe usar el historial REAL de React
 * Router; no se intercepta popstate ni se inserta historial manual.
 *
 * Cuando una PWA abre una ruta profunda directamente con idx=0, el Home no
 * está detrás. Primero reemplazamos la entrada por ese Home y, en el SIGUIENTE
 * render, hacemos push de la ruta original. No hacemos dos navigate seguidos:
 * React Router puede descartar el primer paso cuando se ejecutan en un tick.
 */
export const RAICES_CON_SELECTOR = [
  '/inicio', '/pipeline', '/propiedades', '/proveedores', '/contabilidad',
  '/seo', '/configuracion', '/whatsapp', '/comunidades', '/mantenciones',
  '/bitacora', '/plantillas', '/mapa', '/ayuda', '/nuevo', '/equipo',
  '/clientes', '/mi-cuenta', '/notificaciones', '/control'
];

let ultimoIndiceSelector = null;
let regresoPendiente = null;

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

export function esRutaInterna(ruta) {
  const path = String(ruta || '').replace(/\/+$/, '') || '/';
  return RAICES_CON_SELECTOR.some(base => path === base || path.startsWith(base + '/'));
}

export function homePermitido(puedeCambiarArea) {
  return puedeCambiarArea ? '/' : '/inicio';
}

export function debePrepararHistorialSelector(ruta, indice, accesoInterno, puedeCambiarArea = true) {
  const path = String(ruta || '').replace(/\/+$/, '') || '/';
  return Boolean(accesoInterno)
    && indice === 0
    && path !== homePermitido(puedeCambiarArea)
    && esRutaInterna(path);
}

export function prepararHistorialSelector(navegar, ubicacion, indice, accesoInterno = false, puedeCambiarArea = true) {
  const ruta = ubicacion.pathname;
  if (!debePrepararHistorialSelector(ruta, indice, accesoInterno, puedeCambiarArea)) return false;
  if (regresoPendiente) return false;
  const home = homePermitido(puedeCambiarArea);
  regresoPendiente = {
    home,
    destino: ruta + (ubicacion.search || '') + (ubicacion.hash || ''),
    puedeCambiarArea
  };
  navegar(home, {
    replace: true,
    state: puedeCambiarArea
      ? { selectorCoproactiva: true }
      : { homeAreaCoproactiva: true },
    preventScrollReset: true
  });
  return true;
}

/* Se consume una única vez al montar el Home. Al volver desde un módulo, no
 * queda ninguna acción pendiente: se muestra el selector sin redirigir.
 */
export function consumirRegresoPendiente(pathname) {
  if (!regresoPendiente || pathname !== regresoPendiente.home) return null;
  const destino = regresoPendiente;
  regresoPendiente = null;
  return destino;
}

/* En la salida o cambio de usuario nunca conservar índices del anterior. */
export function reiniciarHistorialSelector() {
  ultimoIndiceSelector = null;
  regresoPendiente = null;
}
