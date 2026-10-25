/**
 * Dos modos de acceso al MISMO sistema: áreas o módulos independientes.
 * Preferencia local por usuario (no afecta permisos, tablas ni rutas).
 */
const PREFIJO = 'coproactiva_organizacion:';

export function leerOrganizacion(usuarioId) {
  if (!usuarioId) return 'areas';
  try {
    return localStorage.getItem(PREFIJO + usuarioId) === 'modulos' ? 'modulos' : 'areas';
  } catch {
    return 'areas';
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
  // Restauración fiel del Home modular previo a la agrupación por áreas
  // (commit histórico c99a7bd). Los submódulos se navegan DENTRO de cada
  // módulo principal y no se presentan como tarjetas independientes.
  const destinos = [
    { id:'crm', titulo:'Gestión comercial', etiqueta:'CRM',
      descripcion:'Leads, pipeline y diagnóstico comercial de prospectos.',
      ruta:'/pipeline', area:'comercial', visible:comercial },
    { id:'levantamientos', titulo:'Levantamientos', etiqueta:'OPERACIONES',
      descripcion:'Comunidades administradas, levantamientos y mantención.',
      ruta:'/inicio', area:'operacion', visible:true },
    { id:'propiedades', titulo:'Arriendos y ventas', etiqueta:'PROPIEDADES',
      descripcion:'Lo que se publica en coproactiva.cl/propiedades.',
      ruta:'/propiedades', area:'comercial', visible:comercial },
    { id:'proveedores', titulo:'Red de proveedores', etiqueta:'PROVEEDORES',
      descripcion:'Buscar, contactar y administrar proveedores para las comunidades.',
      ruta:'/proveedores', area:'operacion', visible:administracion },
    { id:'whatsapp', titulo:'Recepción y atención', etiqueta:'WHATSAPP',
      descripcion:'Solicitudes, cotizaciones y conversaciones con administración.',
      ruta:'/whatsapp', area:'operacion', visible:administracion },
    { id:'contabilidad', titulo:'Gestión contable', etiqueta:'CONTABILIDAD',
      descripcion:'Asientos, libros, estados financieros e informes por entidad.',
      ruta:'/contabilidad', area:'finanzas', visible:administracion },
    { id:'seo', titulo:'SEO y Analítica', etiqueta:'MARKETING',
      descripcion:'Search Console, Analytics, indexación, velocidad y oportunidades web.',
      ruta:'/seo', area:'comercial', visible:administracion },
    { id:'configuracion', titulo:'Configuración', etiqueta:'AJUSTES',
      descripcion:'Equipo y clientes.', ruta:'/configuracion', area:null, visible:administracion },
    { id:'conocimientos', titulo:'Base de conocimientos', etiqueta:'APRENDIZAJE',
      descripcion:'Cápsulas breves para aprender la Ley 21.442.',
      ruta:'/inicio', area:null, tipo:'popup', visible:true }

  ];
  return destinos.filter(d => d.visible).map(({visible, ...d}) => d);
}
