/**
 * Dos modos de acceso al MISMO sistema: áreas o módulos independientes.
 * Preferencia local por usuario (no afecta permisos, tablas ni rutas).
 */
const PREFIJO = 'coproactiva_organizacion:';

export function leerOrganizacion(usuarioId) {
  if (!usuarioId) return 'modulos';
  try {
    return localStorage.getItem(PREFIJO + usuarioId) === 'areas' ? 'areas' : 'modulos';
  } catch {
    return 'modulos';
  }
}

export function guardarOrganizacion(usuarioId, modo) {
  if (!usuarioId || !['areas', 'modulos'].includes(modo)) return;
  try { localStorage.setItem(PREFIJO + usuarioId, modo); }
  catch { /* Disponible durante la sesión aunque el navegador bloquee la persistencia. */ }
}

/**
 * Este catálogo se usa tanto para la pantalla de selección como para la
 * navegación plana. Todo destino existe en App.jsx; no crea permisos nuevos.
 */
export function modulosDisponibles(perfil) {
  if (!perfil || perfil.rol === 'cliente' || !perfil.activo) return [];
  const rol = perfil.rol;
  const comercial = ['superadmin', 'admin', 'jefatura'].includes(rol);
  const administracion = ['superadmin', 'admin'].includes(rol);
  const superadmin = rol === 'superadmin';
  const destinos = [
    { id: 'pipeline', titulo: 'Pipeline comercial', etiqueta: 'COMERCIAL', descripcion: 'Prospectos y oportunidades comerciales.', ruta: '/pipeline', area: 'comercial', visible: comercial },
    { id: 'propiedades', titulo: 'Arriendos y ventas', etiqueta: 'COMERCIAL', descripcion: 'Gestión de propiedades y publicaciones.', ruta: '/propiedades', area: 'comercial', visible: comercial },
    { id: 'seo', titulo: 'SEO y Analítica', etiqueta: 'COMERCIAL', descripcion: 'Posicionamiento, resultados y métricas web.', ruta: '/seo', area: 'comercial', visible: administracion },
    { id: 'inicio', titulo: 'Inicio operativo', etiqueta: 'OPERACIONES', descripcion: 'Resumen de tareas y trabajo del día.', ruta: '/inicio', area: 'operacion', visible: true },
    { id: 'comunidades', titulo: 'Comunidades', etiqueta: 'OPERACIONES', descripcion: 'Comunidades, activos y fichas de gestión.', ruta: '/comunidades', area: 'operacion', visible: true },
    { id: 'levantamientos', titulo: 'Levantamientos', etiqueta: 'OPERACIONES', descripcion: 'Controles y levantamientos pendientes.', ruta: '/inicio#por-hacer', area: 'operacion', visible: true },
    { id: 'mantenciones', titulo: 'Mantenciones', etiqueta: 'OPERACIONES', descripcion: 'Planificación, ejecución y seguimiento.', ruta: '/mantenciones', area: 'operacion', visible: true },
    { id: 'bitacora', titulo: 'Bitácora', etiqueta: 'OPERACIONES', descripcion: 'Observaciones, incidencias y registros.', ruta: '/bitacora', area: 'operacion', visible: true },
    { id: 'plantillas', titulo: 'Plantillas', etiqueta: 'OPERACIONES', descripcion: 'Tipos de levantamiento y formularios.', ruta: '/plantillas', area: 'operacion', visible: comercial },
    { id: 'mapa', titulo: 'Mapa', etiqueta: 'OPERACIONES', descripcion: 'Ubicación de comunidades y visitas.', ruta: '/mapa', area: 'operacion', visible: true },
    { id: 'proveedores', titulo: 'Proveedores', etiqueta: 'OPERACIONES', descripcion: 'Directorio, postulantes y comunicaciones.', ruta: '/proveedores', area: 'operacion', visible: administracion },
    { id: 'whatsapp', titulo: 'WhatsApp', etiqueta: 'OPERACIONES', descripcion: 'Recepción y atención por mensajería.', ruta: '/whatsapp', area: 'operacion', visible: administracion },
    { id: 'notificaciones', titulo: 'Notificaciones', etiqueta: 'GENERAL', descripcion: 'Avisos y tareas que requieren atención.', ruta: '/notificaciones', area: 'operacion', visible: true },
    { id: 'contabilidad', titulo: 'Contabilidad', etiqueta: 'FINANZAS', descripcion: 'Asientos, libros y estados financieros.', ruta: '/contabilidad', area: 'finanzas', visible: administracion },
    { id: 'configuracion', titulo: 'Administración y ajustes', etiqueta: 'ADMINISTRACIÓN', descripcion: 'Equipo, usuarios, permisos, accesos de clientes y configuración general.', ruta: '/configuracion', area: null, visible: administracion },
    { id: 'equipo', titulo: 'Equipo y permisos', etiqueta: 'ADMINISTRACIÓN', descripcion: 'Miembros, roles y accesos internos.', ruta: '/equipo', area: null, visible: administracion },
    { id: 'clientes', titulo: 'Clientes y accesos', etiqueta: 'ADMINISTRACIÓN', descripcion: 'Clientes del portal y comunidades autorizadas.', ruta: '/clientes', area: null, visible: superadmin }
  ];
  return destinos.filter(d => d.visible).map(({visible, ...d}) => d);
}
