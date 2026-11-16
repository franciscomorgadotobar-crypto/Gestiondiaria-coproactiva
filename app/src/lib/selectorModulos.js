/**
 * Dos modos de acceso al MISMO sistema: áreas o módulos independientes.
 * Preferencia local por usuario (no afecta permisos, tablas ni rutas).
 */
const PREFIJO = 'coproactiva_organizacion_modular_v2:'; // El Home restaurado inicia Por módulos, ignorando preferencias de los rediseños descartados.

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
  // Restauración fiel del Home modular previo a la agrupación por áreas
  // (commit histórico c99a7bd). Los submódulos se navegan DENTRO de cada
  // módulo principal y no se presentan como tarjetas independientes.
  const destinos = [
    { id:'crm', titulo:'Gestión comercial', etiqueta:'CRM',
      descripcion:'Leads, pipeline y diagnóstico comercial de prospectos.',
      ruta:'/pipeline', area:'comercial', visible:comercial },
    { id:'documentos', titulo:'Gestor documental', etiqueta:'DOCUMENTOS',
      descripcion:'Plantillas, propuestas comerciales e informes reutilizables desde toda la app.',
      ruta:'/documentos', area:'comercial', visible:comercial },
    { id:'levantamientos', titulo:'Operaciones', etiqueta:'OPERACIONES',
      descripcion:'Comunidades, compromisos, levantamientos y mantenciones.',
      ruta:'/inicio', area:'operacion', visible:true },
    { id:'propiedades', titulo:'Arriendos y ventas', etiqueta:'PROPIEDADES',
      descripcion:'Lo que se publica en coproactiva.cl/propiedades.',
      ruta:'/propiedades', area:'comercial', visible:comercial },
    { id:'proveedores', titulo:'Red de proveedores', etiqueta:'PROVEEDORES',
      descripcion:'Buscar, contactar y administrar proveedores para las comunidades.',
      ruta:'/proveedores', area:'operacion', visible:administracion },
    { id:'contabilidad', titulo:'Gestión contable', etiqueta:'CONTABILIDAD',
      descripcion:'Asientos, libros, estados financieros e informes por entidad.',
      ruta:'/contabilidad', area:'finanzas', visible:administracion },
    { id:'seo', titulo:'SEO y Analítica', etiqueta:'MARKETING',
      descripcion:'Search Console, Analytics, indexación, velocidad y oportunidades web.',
      ruta:'/seo', area:'comercial', visible:administracion },
    { id:'conocimientos', titulo:'Base de conocimientos', etiqueta:'APRENDIZAJE',
      descripcion:'Cápsulas breves para aprender la Ley 21.442.',
      ruta:'/conocimientos', area:null, visible:true },
    { id:'vista-cliente', titulo:'Vista de cliente', etiqueta:'PORTAL CLIENTE',
      descripcion:'Previsualiza el portal según la comunidad y cuenta cliente, sin editar datos.',
      ruta:'/vista-cliente', area:'operacion', visible:administracion },
    // Ajustes y configuración siempre al final del catálogo y navegación plana.
    { id:'configuracion', titulo:'Configuración', etiqueta:'AJUSTES',
      descripcion:administracion ? 'Mi cuenta, equipo y permisos.' : 'Mi cuenta y preferencias personales.',
      ruta:'/configuracion', area:null, visible:true }

  ];
  return destinos.filter(d => d.visible).map(({visible, ...d}) => d);
}


/**
 * Catálogo único de navegación. Home principal y menú lateral leen de aquí
 * Jarvis, los cinco grupos de trabajo y las mismas reglas de acceso.
 *
 * Las rutas no se reemplazan: todas siguen usando las pantallas existentes.
 * "Gestiones y avances" está dentro de la ficha de cada comunidad.
 */
export function areasDisponibles(perfil) {
  if(!perfil || perfil.rol==='cliente' || !perfil.activo)return [];
  const rol=perfil.rol;
  const comercial=['superadmin','admin','jefatura'].includes(rol);
  const administracion=['superadmin','admin'].includes(rol);
  const configurar=['superadmin','admin','jefatura'].includes(rol);
  const grupos=[
    // Jarvis cruza todas las áreas: va primero y entra directo, sin submenú.
    {
      id:'jarvis',area:null,etiqueta:'ANTICIPACIÓN',titulo:'Jarvis',
      descripcion:'Lo que viene y lo que hay que hacer en toda la gestión.',
      ruta:'/jarvis',icono:'jarvis',directo:true,visible:comercial,
      enlaces:[
        {ruta:'/jarvis',etiqueta:'Lo que viene',visible:true}
      ]
    },
    {
      id:'comercial',area:'comercial',etiqueta:'COMERCIAL',titulo:'Comercial',
      descripcion:'Leads, propiedades y herramientas comerciales.',
      ruta:'/pipeline',icono:'comercial',visible:comercial,
      enlaces:[
        {ruta:'/pipeline',etiqueta:'Leads y prospectos',visible:true},
        {ruta:'/propiedades',etiqueta:'Arriendos y ventas',visible:true},
        {ruta:'/seo',etiqueta:'SEO y analítica',visible:administracion},
        {ruta:'/plantillas-correo',etiqueta:'Plantillas de correo',visible:configurar}
      ]
    },
    {
      id:'operacion',area:'operacion',etiqueta:'OPERACIONES',titulo:'Operaciones de comunidades',
      descripcion:'Comunidades, seguimiento, levantamientos y mantenciones.',
      ruta:'/inicio',icono:'comunidades',visible:true,
      enlaces:[
        {ruta:'/inicio',etiqueta:'Panel de operaciones',visible:true},
        {ruta:'/comunidades',etiqueta:'Comunidades',visible:true},
        {ruta:'/bitacora',etiqueta:'Bitácora',visible:true},
        {ruta:'/mantenciones',etiqueta:'Mantenciones',visible:true},
        {ruta:'/nuevo',etiqueta:'Nuevo levantamiento',visible:configurar},
        {ruta:'/plantillas',etiqueta:'Plantillas de levantamiento',visible:configurar},
        {ruta:'/mapa',etiqueta:'Mapa de visitas',visible:true},
        {ruta:'/proveedores',etiqueta:'Red de proveedores',visible:administracion}
      ]
    },
    {
      id:'finanzas',area:'finanzas',etiqueta:'FINANZAS',titulo:'Gestión contable / Finanzas',
      descripcion:'Asientos, libros, reportes, entidades y control contable.',
      ruta:'/contabilidad',icono:'contabilidad',visible:administracion,
      enlaces:[
        {ruta:'/contabilidad',etiqueta:'Resumen financiero',visible:true},
        {ruta:'/contabilidad/asientos',etiqueta:'Asientos',visible:true},
        {ruta:'/contabilidad/plan',etiqueta:'Plan de cuentas',visible:true},
        {ruta:'/contabilidad/reportes',etiqueta:'Reportes',visible:true},
        {ruta:'/contabilidad/entidades',etiqueta:'Entidades',visible:true},
        {ruta:'/contabilidad/configuracion',etiqueta:'Configuración contable',visible:true}
      ]
    },
    {
      id:'documental',area:'documental',etiqueta:'DOCUMENTOS',titulo:'Gestión documental',
      descripcion:'Documentos, plantillas y archivos de trabajo.',
      ruta:'/documentos',icono:'documentos',visible:comercial,
      enlaces:[
        {ruta:'/documentos',etiqueta:'Gestor documental',visible:true},
        {ruta:'/documentos/nuevo',etiqueta:'Nuevo documento',visible:true}
      ]
    },
    {
      id:'aprendizaje',area:'aprendizaje',etiqueta:'CONOCIMIENTOS',titulo:'Base de conocimientos',
      descripcion:'Biblioteca y material de consulta para la administración.',
      ruta:'/conocimientos',icono:'conocimientos',visible:true,
      enlaces:[
        {ruta:'/conocimientos',etiqueta:'Biblioteca de conocimientos',visible:true}
      ]
    }
  ];
  return grupos.filter(g=>g.visible).map(({visible,...g})=>({
    ...g,
    enlaces:g.enlaces.filter(enlace=>enlace.visible)
      .map(({visible:_,...enlace})=>enlace)
  }));
}

/** Accesos administrativos compartidos por Home principal y lateral.
 * La vista de cliente es una herramienta de previsualización, no Operaciones. */
export function enlacesAdministracion(perfil){
  if(!perfil || perfil.rol==='cliente' || !perfil.activo)return [];
  const admin=['admin','superadmin'].includes(perfil.rol);
  return [
    {ruta:'/configuracion',etiqueta:'Configuración'},
    {ruta:'/mi-cuenta',etiqueta:'Mi cuenta'},
    ...(admin?[{ruta:'/vista-cliente',etiqueta:'Vista de cliente'},
      {ruta:'/equipo',etiqueta:'Equipo y permisos'}]:[]),
    ...(perfil.rol==='superadmin'?[{ruta:'/clientes',etiqueta:'Clientes y accesos'}]:[])
  ];
}
