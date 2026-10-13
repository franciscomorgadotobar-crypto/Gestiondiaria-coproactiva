/*
 * Inicio de documento de Coproactiva (incluye reapertura desde icono PWA).
 *
 * Chrome/Android puede recuperar la URL visitada por última vez. Esa URL
 * NO representa la elección del usuario para el nuevo arranque: toda entrada
 * nueva debe empezar en el Home según el rol autenticado, nunca abrir SEO,
 * CRM u otra pantalla automáticamente.
 *
 * Antes de montar BrowserRouter se normaliza una ruta interna restaurada a
 * "/". La pantalla raíz resuelve los permisos reales una vez que se carga
 * el perfil: selector de módulos / Inicio de Operación / portal cliente.
 *
 * Se usa REPLACE, no push: la vista restaurada NO queda debajo de Home,
 * evitando que Atrás de Android abra nuevamente el módulo anterior.
 */
import { esRutaInterna } from './historialSelector.js';

export function prepararArranqueConHome(historial, ubicacion, base = '/') {
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
