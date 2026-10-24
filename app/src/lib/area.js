/* Qué grupo eligió el usuario al entrar: 'comercial', 'operacion' o 'finanzas'.
 * Configuración no se guarda: es una visita ocasional, no un modo de trabajo.
 *
 * Grupos (24-10-2026):
 * - Comercial: Pipeline y diagnóstico comercial, Arriendos y ventas, SEO y analítica.
 * - Operaciones: Comunidades, levantamientos, mantenciones, bitácora, mapa,
 *   red de proveedores y recepción WhatsApp.
 * - Finanzas: gestión contable.
 * - Configuración: equipo y clientes.
 *
 * Se guarda en este navegador y por usuario: si otra persona inicia sesión en
 * el mismo equipo, no hereda el grupo de la anterior. La sesión avisa quién
 * está conectado (fijarUsuarioArea) antes de dibujar cualquier pantalla que
 * lo consulte. Los valores de la versión anterior (crm, seo, propiedades,
 * proveedores, whatsapp, contabilidad) se leen como su grupo actual. */
const PREFIJO = 'coproactiva_area:';
const AREAS = ['comercial', 'operacion', 'finanzas'];
const EQUIVALENCIAS = {
  crm: 'comercial', seo: 'comercial', propiedades: 'comercial',
  proveedores: 'operacion', whatsapp: 'operacion', contabilidad: 'finanzas'
};
let usuario = null;

try { localStorage.removeItem('coproactiva_area'); } catch { /* clave antigua, sin dueño */ }

export function normalizarArea(valor) {
  if (AREAS.includes(valor)) return valor;
  return EQUIVALENCIAS[valor] ?? null;
}

/* Grupo al que pertenece una ruta. Las rutas compartidas (/nuevo,
 * /notificaciones, /mi-cuenta) no tienen grupo propio: devuelven null y
 * mandan el grupo elegido. */
const RUTAS_GRUPO = [
  ['comercial', ['/pipeline', '/propiedades', '/seo']],
  ['finanzas', ['/contabilidad']],
  ['configuracion', ['/configuracion', '/equipo', '/clientes']],
  ['operacion', ['/inicio', '/comunidades', '/mantenciones', '/bitacora', '/plantillas',
    '/mapa', '/control', '/ayuda', '/proveedores', '/whatsapp']]
];

export function grupoDeRuta(pathname) {
  const ruta = String(pathname || '/').replace(/\/+$/, '') || '/';
  for (const [grupo, raices] of RUTAS_GRUPO) {
    if (raices.some(r => ruta === r || ruta.startsWith(r + '/'))) return grupo;
  }
  return null;
}

export function fijarUsuarioArea(id) {
  usuario = id ?? null;
}

export function areaGuardada() {
  if (!usuario) return null;
  try {
    return normalizarArea(localStorage.getItem(PREFIJO + usuario));
  } catch {
    return null;
  }
}

export function guardarArea(area) {
  const grupo = normalizarArea(area);
  if (!usuario || !grupo) return;
  try { localStorage.setItem(PREFIJO + usuario, grupo); } catch { /* modo privado, etc. */ }
}

export function limpiarArea() {
  if (!usuario) return;
  try { localStorage.removeItem(PREFIJO + usuario); } catch { /* modo privado, etc. */ }
}

/* A dónde vuelve "Inicio" según el grupo elegido: Pipeline en Comercial,
 * Contabilidad en Finanzas y el inicio de Operación en Operaciones (o si el
 * usuario no tiene selector y nunca eligió nada). */
export function inicioSegunArea() {
  const area = areaGuardada();
  if (area === 'comercial') return '/pipeline';
  if (area === 'finanzas') return '/contabilidad';
  return '/inicio';
}
