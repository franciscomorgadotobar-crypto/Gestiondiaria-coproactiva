/**
 * Iconografía lineal compartida para las barras de navegación.
 * Mantiene rutas y permisos existentes; solamente asigna un pictograma
 * por tipo de módulo/acción siguiendo el Home de Coproactiva.
 */
export const iconoRutaCoproactiva = ruta => {
  const r = String(ruta || '');
  if (r.startsWith('/pipeline')) return 'comercial';
  if (r.startsWith('/propiedades')) return 'propiedades';
  if (r.startsWith('/proveedores')) return 'proveedores';
  if (r.startsWith('/whatsapp')) return 'whatsapp';
  if (r.startsWith('/seo')) return 'seo';
  if (r.startsWith('/contabilidad')) return 'contabilidad';
  if (r.startsWith('/configuracion') || r.startsWith('/equipo') || r.startsWith('/clientes')) return 'configuracion';
  if (r.startsWith('/comunidades')) return 'comunidades';
  if (r.startsWith('/mantenciones')) return 'mantenciones';
  if (r.startsWith('/plantillas')) return 'plantillas';
  if (r.startsWith('/bitacora')) return 'bitacora';
  if (r.startsWith('/notificaciones')) return 'notificaciones';
  if (r.startsWith('/mapa')) return 'mapa';
  if (r.startsWith('/nuevo') || r.startsWith('/control')) return 'levantamientos';
  if (r.startsWith('/portal')) return 'comunidades';
  return 'inicio';
};

export default function IconoNavegacion({ tipo = 'inicio', size = 19 }) {
  const icon = { width:size, height:size, viewBox:'0 0 24 24',
    fill:'none', stroke:'currentColor', strokeWidth:1.8,
    strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true,
    focusable:'false' };
  switch(tipo) {
    case 'comercial': return <svg {...icon}><path d="M4 20V13M10 20V9M16 20V4M21 20H3"/><path d="M3 11 10 7l6-4"/></svg>;
    case 'propiedades': return <svg {...icon}><path d="m3 11 9-8 9 8v10H3z"/><path d="M9 21v-7h6v7M15 8h3M15 11h3"/></svg>;
    case 'proveedores': return <svg {...icon}><circle cx="12" cy="8" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/><path d="M19 6a2 2 0 0 1 0 4M20 15a4 4 0 0 1 2 4"/></svg>;
    case 'whatsapp': return <svg {...icon}><path d="M5.5 18.5 3 21l.8-4A9 9 0 1 1 7 20"/><path d="M8.5 9.5q3.3 5 7 5l1-2-2-1-1 1q-2-.6-3-3l1-1-1-2-2 1z"/></svg>;
    case 'seo': return <svg {...icon}><path d="M3 18V6M3 18h18M6 15l5-5 3 3 6-7"/><path d="M17 6h3v3"/></svg>;
    case 'contabilidad': return <svg {...icon}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3M15 15h1M8 18h3M15 18h1"/></svg>;
    case 'configuracion': return <svg {...icon}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>;
    case 'comunidades': return <svg {...icon}><path d="M4 21V5h16v16M2 21h20M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/></svg>;
    case 'mantenciones': return <svg {...icon}><path d="m14 4 6 6-4 4-6-6"/><path d="M13 11 4 20l-2-2 9-9M18 2l4 4"/></svg>;
    case 'plantillas': return <svg {...icon}><path d="M7 3h10l3 3v15H4V3zM14 3v5h6M8 12h8M8 16h8"/></svg>;
    case 'bitacora': return <svg {...icon}><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg>;
    case 'notificaciones': return <svg {...icon}><path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-3 9h18c-1-2-3-3-3-9M10 21h4"/></svg>;
    case 'mapa': return <svg {...icon}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/></svg>;
    case 'levantamientos': return <svg {...icon}><rect x="4" y="4" width="16" height="18" rx="2"/><path d="M9 3h6v3H9zM8 12l2 2 3-3M15 13h2M8 18h9"/></svg>;
    default: return <svg {...icon}><path d="m3 11 9-8 9 8v10H3zM9 21v-7h6v7"/></svg>;
  }
}
