/*
 * Distingue la apertura NUEVA de una recarga o restauración de la misma
 * sesión de trabajo. En una PWA no existe una señal web infalible de "app
 * completamente cerrada": usamos el tipo de navegación del documento.
 *
 * - navigate: acceso nuevo (icono PWA/enlace) => Home según perfil.
 * - reload: actualizar manualmente, Workbox o refresco => misma URL y filtros.
 * - back_forward: documento restaurado por historial => vista conservada.
 * - wasDiscarded: Android descartó la pestaña sin que el usuario la cerrara
 *   => tratar como continuación aunque el navegador reinicie el documento.
 *
 * Esto no elimina las validaciones del perfil ni permisos de cada ruta.
 */
import { esRutaInterna } from './historialSelector.js';

export function esContinuacionDocumento(rendimiento, documentoDescartado = false) {
  if (documentoDescartado) return true;
  try {
    const tipo = rendimiento?.getEntriesByType?.('navigation')?.[0]?.type;
    if (tipo === 'reload' || tipo === 'back_forward') return true;
    if (tipo === 'navigate') return false;
    // Compatibilidad con navegadores que no implementan Navigation Timing 2.
    return rendimiento?.navigation?.type === 1 || rendimiento?.navigation?.type === 2;
  } catch {
    return false;
  }
}

/**
 * Se ejecuta antes de BrowserRouter. En una nueva apertura desde una ruta
 * interna sustituye la URL por Home. En una recarga/retorno conserva
 * pathname, search, hash e historial existentes sin alterar nada.
 */
export function prepararArranqueConHome(historial, ubicacion, base = '/', opciones = {}) {
  if (opciones.continuar === true) return false;
  const prefijo = base === '/' ? '' : String(base).replace(/\/+$/, '');
  const pathname = ubicacion.pathname || '/';
  if (prefijo && !pathname.startsWith(prefijo + '/')) return false;
  const ruta = (prefijo ? pathname.slice(prefijo.length) : pathname) || '/';
  const esPortal = ruta === '/portal' || ruta.startsWith('/portal/');
  if (!(esPortal || esRutaInterna(ruta))) return false;

  const home = prefijo + '/';
  const anterior = historial.state || {};
  try {
    historial.replaceState({
      ...anterior,
      idx: 0,
      key: 'copro-home-arranque',
      usr: { selectorCoproactiva: true }
    }, '', home);
    return true;
  } catch {
    return false;
  }
}
