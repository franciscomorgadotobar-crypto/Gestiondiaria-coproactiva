/* Qué área eligió el usuario al entrar: 'crm' o 'operacion'. Se guarda en
 * este navegador para no preguntar cada vez que inicia sesión; "Cambiar de
 * área" en el panel la borra y vuelve a mostrar la capa de selección. */
const CLAVE = 'coproactiva_area';

export function areaGuardada() {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'crm' || v === 'operacion' ? v : null;
  } catch {
    return null;
  }
}

export function guardarArea(area) {
  try { localStorage.setItem(CLAVE, area); } catch { /* modo privado, etc. */ }
}

export function limpiarArea() {
  try { localStorage.removeItem(CLAVE); } catch { /* modo privado, etc. */ }
}
