/*
 * Destinos funcionales del botón «Volver» de Coproactiva.
 * Esta función no usa history(-1): una pantalla abierta sin historial interno
 * conserva un camino predecible hasta la raíz de su área y su selector.
 */
// Inicio de cada grupo del selector: Operaciones, Comercial, Finanzas y
// Configuración. Desde ahí, Volver llega al selector.
const RAICES_AREA = new Set(['/inicio', '/pipeline', '/contabilidad', '/configuracion']);

// Secciones de Comercial: vuelven al Pipeline, inicio del grupo.
const MODULOS_COMERCIAL = new Set(['/propiedades', '/seo']);

const MODULOS_OPERACION = new Set([
  '/bitacora', '/plantillas', '/comunidades', '/mantenciones',
  '/mapa', '/ayuda', '/nuevo', '/proveedores', '/whatsapp'
]);

const MODULOS_COMPARTIDOS = new Set(['/mi-cuenta', '/notificaciones']);

export function destinoVolverPorJerarquia(pathname, inicioDeArea = '/inicio') {
  const ruta = String(pathname || '/').replace(/\/+$/, '') || '/';

  // Ingreso y portal cliente no acceden al selector de áreas internas.
  if (ruta === '/' || ruta === '/ingreso' || ruta === '/clave' ||
      ruta === '/portal' || ruta.startsWith('/portal/')) return null;

  // Levantamiento: edición → detalle → Inicio de Operación → selector.
  const editarControl = ruta.match(/^\/control\/([^/]+)\/editar$/);
  if (editarControl) return '/control/' + editarControl[1];
  if (/^\/control\/[^/]+$/.test(ruta)) return '/inicio';

  // Pantalla hija → listado o sección principal de su módulo.
  for (const modulo of [
    'comunidades', 'plantillas', 'bitacora', 'propiedades',
    'proveedores', 'whatsapp', 'contabilidad', 'ayuda'
  ]) {
    if (ruta.startsWith('/' + modulo + '/') &&
        ruta.split('/').length === 3) return '/' + modulo;
  }

  if (ruta === '/equipo' || ruta === '/clientes') return '/configuracion';

  // Mi cuenta y Notificaciones no pertenecen exclusivamente a Operación.
  if (MODULOS_COMPARTIDOS.has(ruta)) return inicioDeArea;

  if (MODULOS_COMERCIAL.has(ruta)) return '/pipeline';
  if (MODULOS_OPERACION.has(ruta)) return '/inicio';

  // El último Volver en cualquier inicio de área llega al selector.
  if (RAICES_AREA.has(ruta)) return '/';

  // Rutas nuevas: no salir inesperadamente de la PWA.
  return ruta === inicioDeArea ? '/' : inicioDeArea;
}
