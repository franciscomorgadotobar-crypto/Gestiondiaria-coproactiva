import { useEffect, useRef } from 'react';
import { limpiarArea } from './area';

/*
 * Las pantallas con lógica especial al salir (cambios sin guardar, origen
 * específico, etc.) pueden interceptar el botón Volver de la barra móvil.
 * Si nadie lo intercepta, PanelEscritorio usa el historial normal.
 */
export function useVolverGlobal(handler, activo = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!activo) return;
    const escuchar = e => {
      e.preventDefault();
      ref.current?.();
    };
    window.addEventListener('coproactiva:volver', escuchar);
    return () => window.removeEventListener('coproactiva:volver', escuchar);
  }, [activo]);
}


/*
 * Navegación jerárquica del botón Volver de la barra móvil.
 * No depende del historial del navegador: retrocede por niveles funcionales
 * y el último nivel para usuarios con selector es siempre Selección de área.
 */
export function volverPorJerarquia(navegar, pathname, puedeCambiarArea = true) {
  const ruta = String(pathname || '/').replace(/\/+$/, '') || '/';

  // Tercer nivel → listado/módulo.
  if (/^\/comunidades\/[^/]+$/.test(ruta)) return navegar('/comunidades');
  if (/^\/plantillas\/[^/]+$/.test(ruta)) return navegar('/plantillas');
  if (/^\/bitacora\/[^/]+$/.test(ruta)) return navegar('/bitacora');
  if (/^\/propiedades\/[^/]+$/.test(ruta)) return navegar('/propiedades');
  if (/^\/proveedores\/[^/]+$/.test(ruta)) return navegar('/proveedores');
  if (/^\/whatsapp\/[^/]+$/.test(ruta)) return navegar('/whatsapp');
  if (/^\/contabilidad\/[^/]+$/.test(ruta)) return navegar('/contabilidad');
  if (/^\/ayuda\/[^/]+$/.test(ruta)) return navegar('/ayuda');

  // Configuración tiene un nivel propio antes del selector.
  if (ruta === '/equipo' || ruta === '/clientes') return navegar('/configuracion');

  // Operación: módulos → inicio del área.
  if ([
    '/bitacora',
    '/notificaciones',
    '/mi-cuenta',
    '/plantillas',
    '/comunidades',
    '/mantenciones',
    '/mapa',
    '/ayuda',
    '/nuevo'
  ].includes(ruta)) return navegar('/inicio');

  // Edición de un control vuelve a su control.
  const editarControl = ruta.match(/^\/control\/([^/]+)\/editar$/);
  if (editarControl) return navegar('/control/' + editarControl[1]);

  // Homes de área/configuración → selector de área.
  if ([
    '/inicio',
    '/pipeline',
    '/propiedades',
    '/proveedores',
    '/contabilidad',
    '/configuracion',
    '/whatsapp'
  ].includes(ruta)) {
    if (!puedeCambiarArea) return;
    limpiarArea();
    return navegar('/', { replace: true });
  }

  // Rutas no catalogadas: conserva un fallback razonable.
  navegar(-1);
}

