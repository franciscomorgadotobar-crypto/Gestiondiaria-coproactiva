/* Qué área eligió el usuario al entrar: 'crm' o 'operacion'. Se guarda en
 * este navegador para no preguntar cada vez que inicia sesión; "Cambiar de
 * área" en el panel la borra y vuelve a mostrar la capa de selección.
 *
 * Se guarda por usuario: si otra persona inicia sesión en el mismo equipo,
 * no hereda el área de la anterior. La sesión avisa quién está conectado
 * (fijarUsuarioArea) antes de dibujar cualquier pantalla que la consulte. */
const PREFIJO = 'coproactiva_area:';
let usuario = null;

try { localStorage.removeItem('coproactiva_area'); } catch { /* clave antigua, sin dueño */ }

export function fijarUsuarioArea(id) {
  usuario = id ?? null;
}

export function areaGuardada() {
  if (!usuario) return null;
  try {
    const v = localStorage.getItem(PREFIJO + usuario);
    return v === 'crm' || v === 'operacion' ? v : null;
  } catch {
    return null;
  }
}

export function guardarArea(area) {
  if (!usuario) return;
  try { localStorage.setItem(PREFIJO + usuario, area); } catch { /* modo privado, etc. */ }
}

export function limpiarArea() {
  if (!usuario) return;
  try { localStorage.removeItem(PREFIJO + usuario); } catch { /* modo privado, etc. */ }
}

/* A dónde vuelve "Inicio" según el área elegida: el Pipeline si se está en
 * CRM, el panel de levantamientos si se está en Operación (o si el usuario
 * no tiene CRM y nunca eligió nada). "Inicio" es el home del área en la que
 * se está, no siempre el mismo destino fijo. */
export function inicioSegunArea() {
  return areaGuardada() === 'crm' ? '/pipeline' : '/inicio';
}
