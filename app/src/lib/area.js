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

/* A dónde vuelve "Inicio" según el área elegida: el Pipeline si se está en
 * CRM, el panel de levantamientos si se está en Operación (o si el usuario
 * no tiene CRM y nunca eligió nada). "Inicio" es el home del área en la que
 * se está, no siempre el mismo destino fijo. */
export function inicioSegunArea() {
  return areaGuardada() === 'crm' ? '/pipeline' : '/inicio';
}
