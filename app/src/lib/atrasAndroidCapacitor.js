/**
 * Retroceso físico de Android empaquetado con Capacitor.
 * No altera el historial de Chrome/PWA; el plugin se registra solo en nativo.
 *
 * En cada perfil, el último nivel interno es su Home autorizado. Se consultan
 * los permisos vigentes del perfil, nunca el último módulo guardado.
 */
export function homeAutorizado(rol) {
  if (rol === 'cliente') return '/portal';
  return '/';
}

export function decidirAtrasAndroid({ pathname, rol, indice }) {
  const ruta = String(pathname || '/');
  const home = homeAutorizado(rol);

  // Salir solo al llegar al Home REAL del perfil, no desde SEO, fichas ni
  // desde páginas profundas abiertas sin historial.
  if (ruta === home || ruta === '/ingreso' || ruta === '/clave') {
    return { tipo: 'salir' };
  }
  if (Number.isInteger(indice) && indice > 0) {
    return { tipo: 'historial', pasos: -1 };
  }
  return { tipo: 'home', destino: home };
}
