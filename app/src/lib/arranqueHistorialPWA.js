/*
 * Preparación del historial ANTES de montar BrowserRouter.
 *
 * Una PWA instalada puede restaurarse en /seo, /pipeline o una ficha como
 * documento nuevo. history.state.idx puede conservar un índice anterior,
 * aunque Android NO tenga ninguna pantalla de regreso en el proceso actual.
 * Por ello no basta comprobar idx === 0 dentro de React.
 *
 * Aquí, cuando el documento inicial es una ruta interna, se crea realmente:
 * Home autorizado → ruta solicitada. El router se monta después, por lo que
 * BrowserRouter adopta estos índices sin desincronizarse. No se captura
 * popstate ni se bloquea Atrás físico.
 */
import { esRutaInterna } from './historialSelector';

export function prepararArranqueConHome(historial, ubicacion, base = '/') {
  const prefijo = base === '/' ? '' : String(base).replace(/\/+$/, '');
  const pathname = ubicacion.pathname || '/';
  if (prefijo && !pathname.startsWith(prefijo + '/')) return false;
  const ruta = (prefijo ? pathname.slice(prefijo.length) : pathname) || '/';
  const esPortal = ruta.startsWith('/portal/');
  if (!(esPortal || esRutaInterna(ruta))) return false;

  const home = prefijo + (esPortal ? '/portal' : '/');
  const original = pathname + (ubicacion.search || '') + (ubicacion.hash || '');
  const anterior = historial.state || {};
  const estadoHome = {
    idx: 0, key: 'copro-home-inicial',
    usr: esPortal
      ? { homePortalCoproactiva: true }
      : { selectorCoproactiva: true }
  };
  const estadoDestino = {
    ...anterior,
    idx: 1, key: 'copro-vista-inicial',
    usr: {
      ...(anterior.usr || {}),
      ...(esPortal
        ? { desdePortalCoproactiva: true }
        : { desdeSelectorCoproactiva: true })
    }
  };
  try {
    historial.replaceState(estadoHome, '', home);
    historial.pushState(estadoDestino, '', original);
    return true;
  } catch (error) {
    // No dejar un enlace profundo apuntando al Home si la API falla.
    try { historial.replaceState(anterior, '', original); } catch { /* No disponible */ }
    return false;
  }
}
