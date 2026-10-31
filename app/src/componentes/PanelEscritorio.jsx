import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { guardarArea, limpiarArea, inicioSegunArea, areaGuardada, grupoDeRuta } from '../lib/area';
import { useTutoriales } from '../lib/tutorialesContexto';
import { volverPorJerarquia } from '../lib/navegacion';
import { pasosHastaSelector } from '../lib/historialSelector';
import { leerOrganizacion, modulosDisponibles } from '../lib/selectorModulos';
import { leerAutomaticas, guardarAutomaticas } from '../lib/conocimientos';

import { usePestanaHistorial } from '../lib/pestanasHistorial';
import IconoNavegacion, { iconoRutaCoproactiva } from './IconoNavegacion';
import Campana from './Campana';

const ESTADOS_MENU = ['cerrado', 'mas'];

function activa(pathname, ruta) {
  return pathname === ruta || pathname.startsWith(ruta + '/');
}

/* El listado de propiedades y la ficha de una cuelgan de /propiedades, igual
 * que "Nueva propiedad": sin esto las dos entradas se marcaban a la vez. */
function activaPropiedades(pathname) {
  return activa(pathname, '/propiedades') && !activa(pathname, '/propiedades/nueva');
}

export default function PanelEscritorio({ children, anchoCompleto = false }) {
  const { perfil, salir } = useSesion();
  const { pathname, hash, search } = useLocation();
  const navegar = useNavigate();
  // El Home único es el nivel superior; las pantallas funcionales no apilan
  // selectores en el historial al volver.
  function cambiarArea() {
    limpiarArea();
    navegar('/', { replace:true });
  }
  const { iniciar } = useTutoriales();
  const [alertasMantencion, setAlertasMantencion] = useState(0);
  const [alertasGenerales, setAlertasGenerales] = useState(0);
  const [menu, cambiarMenu] = usePestanaHistorial('menu', 'cerrado', ESTADOS_MENU);
  const [buscarAprendizaje, setBuscarAprendizaje] = useState(false);
  const [avisosActivos, setAvisosActivos] = useState(() => leerAutomaticas(perfil?.id));
  useEffect(() => {
    setAvisosActivos(leerAutomaticas(perfil?.id));
  }, [perfil?.id]);
  useEffect(() => {
    const estadoBusqueda = e => setBuscarAprendizaje(Boolean(e.detail?.visible));
    window.addEventListener('coproactiva:conocimientos:estado-busqueda', estadoBusqueda);
    return () => window.removeEventListener('coproactiva:conocimientos:estado-busqueda', estadoBusqueda);
  }, []);
  const masAbierto = menu === 'mas';
  const botonMasRef = useRef(null);
  const cerrarMasRef = useRef(null);

  // El diálogo «Más» se comporta igual en Comercial, Operaciones, Finanzas
  // y Configuración: foco inicial, Escape y tabulación confinada al diálogo.
  useEffect(() => {
    if (!masAbierto) return undefined;
    cerrarMasRef.current?.focus({ preventScroll: true });
    const alPulsarTecla = evento => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        navegar(-1);
        return;
      }
      if (evento.key !== 'Tab') return;
      const elementos = Array.from(document.querySelectorAll(
        '.menu-mas [href]:not([tabindex="-1"]), .menu-mas button:not([disabled])'
      ));
      if (!elementos.length) return;
      const primero = elementos[0], ultimo = elementos[elementos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener('keydown', alPulsarTecla);
    return () => {
      window.removeEventListener('keydown', alPulsarTecla);
      botonMasRef.current?.focus({ preventScroll: true });
    };
  }, [masAbierto, navegar]);
  function setMasAbierto(proximo, { alNavegar = false } = {}) {
    const abrir = typeof proximo === 'function' ? proximo(masAbierto) : proximo;
    if (abrir === masAbierto) return;
    if (abrir) cambiarMenu('mas');
    else if (alNavegar) cambiarMenu('cerrado', { replace: true });
    else navegar(-1); // Volver quita la entrada que abrió el menú.
  }

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;

    async function actualizarAlertas() {
      const [m, g] = await Promise.all([
        supabase.from('notificaciones_mantenimiento')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', perfil.id)
          .eq('leida', false),
        supabase.from('notificaciones')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', perfil.id)
          .eq('leida', false)
      ]);
      if (!vigente) return;
      setAlertasMantencion(m.count ?? 0);
      setAlertasGenerales(g.count ?? 0);
    }

    actualizarAlertas();
    // Nuevas aperturas se registran en el servidor; la campana las consulta
    // periódicamente, incluso sin que se abra la página de notificaciones.
    const intervalo=window.setInterval(actualizarAlertas,60000);
    const escuchar = () => actualizarAlertas();
    window.addEventListener('coproactiva:notificaciones-cambio', escuchar);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
      window.removeEventListener('coproactiva:notificaciones-cambio', escuchar);
    };
  }, [perfil?.id, pathname]);

  const esCliente = perfil?.rol === 'cliente';
  const puedeConfigurar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  const puedeCambiarArea = Boolean(puedeConfigurar);
  const esAdministracion = perfil && ['superadmin', 'admin'].includes(perfil.rol);
  const esSuperadmin = perfil?.rol === 'superadmin';
  // El menú lateral utiliza en vivo la misma organización del Home.
  const [organizacion, setOrganizacion] = useState(() => leerOrganizacion(perfil?.id));
  useEffect(() => {
    const sincronizar = () => setOrganizacion(leerOrganizacion(perfil?.id));
    sincronizar();
    window.addEventListener('coproactiva:organizacion-cambio', sincronizar);
    return () => window.removeEventListener('coproactiva:organizacion-cambio', sincronizar);
  }, [perfil?.id]);
  const modulosPlanos = esCliente ? [] : modulosDisponibles(perfil);



  // La barra muestra solo el grupo en el que se está: Comercial (Pipeline,
  // Arriendos y ventas, SEO), Operaciones (levantamientos, comunidades,
  // mantenciones, bitácora, mapa, proveedores y WhatsApp), Finanzas
  // (contabilidad) o Configuración (equipo y clientes). Para ir a otro grupo
  // está "Cambiar de área".
  // La ruta manda sobre el grupo guardado: el Pipeline es Comercial aunque se
  // llegue por un enlace directo. Las rutas compartidas (/nuevo,
  // /notificaciones, /mi-cuenta) usan el grupo elegido.
  // Configuración no se guarda como grupo (es una visita), así que se
  // reconoce solo por la ruta.
  let grupo = esCliente ? null : (pathname.startsWith('/conocimientos') ? 'aprendizaje' : (grupoDeRuta(pathname) ?? areaGuardada() ?? 'operacion'));
  if (grupo === 'comercial' && !puedeConfigurar) grupo = 'operacion';
  if ((grupo === 'finanzas' || grupo === 'configuracion') && !esAdministracion) grupo = 'operacion';
  const enConfiguracion = grupo === 'configuracion';
  const enComercial = grupo === 'comercial';
  const enFinanzas = grupo === 'finanzas';
  const enOperacion = grupo === 'operacion';
  // Restaurar la navegación lateral de escritorio en Operaciones sin
  // cambiar el portal cliente ni las pantallas de Comercial/Finanzas.
  const mostrarPanelIzquierdo = esCliente || enOperacion;
  const enAprendizaje = grupo === 'aprendizaje';
  const alertasTotales = alertasMantencion + alertasGenerales;
  const levantamientosActivo = pathname === '/nuevo'
    || pathname.startsWith('/control/')
    || (pathname === '/inicio' && hash === '#por-hacer');

  const nombreArea = esCliente ? null
    : enConfiguracion ? 'Administración y ajustes'
    : enComercial ? 'Comercial'
    : enFinanzas ? 'Finanzas'
    : enAprendizaje ? 'Aprendizaje'
    : puedeConfigurar ? 'Operaciones' : null;

  // La comunidad seleccionada es el contexto del menú cliente.
  // Los enlaces usan la misma URL de pestañas, sin crear pantallas duplicadas.
  const comunidadPortalId = pathname.startsWith('/portal/comunidades/') ? pathname.split('/')[3] : null;
  const tabPortal = new URLSearchParams(search).get('seccion') || 'resumen';
  const enlacePortal = (seccion, etiqueta) => ({
    ruta: `/portal/comunidades/${comunidadPortalId}${seccion === 'resumen' ? '' : '?seccion=' + seccion}`,
    etiqueta,
    mostrar: true,
    activo: () => tabPortal === seccion
  });
  const accesos = esCliente
    ? (comunidadPortalId ? [
        enlacePortal('resumen', 'Resumen'),
        enlacePortal('compromisos', 'Compromisos y avances'),
        enlacePortal('incidencias', 'Incidencias'),
        enlacePortal('levantamientos', 'Levantamientos'),
        enlacePortal('mantencion', 'Mantenciones'),
        enlacePortal('documentos', 'Documentos')
      ] : [{ ruta: '/portal', etiqueta: 'Mis comunidades', mostrar: true }])
    : enConfiguracion
    ? [
        { ruta: '/equipo', etiqueta: 'Equipo y permisos', mostrar: true },
        { ruta: '/clientes', etiqueta: 'Clientes y accesos', mostrar: esSuperadmin }
      ]
    : enFinanzas
    ? [
        { ruta: '/contabilidad', etiqueta: 'Resumen', mostrar: true },
        { ruta: '/contabilidad/asientos', etiqueta: 'Asientos', mostrar: true },
        { ruta: '/contabilidad/plan', etiqueta: 'Plan de cuentas', mostrar: true },
        { ruta: '/contabilidad/reportes', etiqueta: 'Reportes', mostrar: true },
        { ruta: '/contabilidad/configuracion', etiqueta: 'Configuración', mostrar: true },
        { ruta: '/contabilidad/entidades', etiqueta: 'Entidades', mostrar: true }
      ]
    : enComercial
    ? [
        // "Inicio" del grupo Comercial es el Pipeline.
        { ruta: '/pipeline', etiqueta: 'Pipeline', mostrar: true },
        { ruta: '/propiedades', etiqueta: 'Arriendos y ventas', mostrar: true, activo: activaPropiedades },
        { ruta: '/propiedades/nueva', etiqueta: 'Nueva propiedad', mostrar: true, hijo: true },
        { ruta: '/seo', etiqueta: 'SEO y analítica', mostrar: esAdministracion },
        { ruta: '/plantillas-correo', etiqueta: 'Plantillas de correo', mostrar: puedeConfigurar }
      ]
    : [
        { ruta: '/inicio', etiqueta: 'Inicio', mostrar: true },
        { ruta: '/nuevo', etiqueta: 'Nuevo levantamiento', mostrar: puedeConfigurar },
        { ruta: '/plantillas', etiqueta: 'Plantillas', mostrar: puedeConfigurar },
        { ruta: '/bitacora', etiqueta: 'Bitácora', mostrar: true },
        { ruta: '/comunidades', etiqueta: 'Comunidades', mostrar: true },
        { ruta: '/compromisos', etiqueta: 'Compromisos y avances', mostrar: true },
        { ruta: '/vista-cliente', etiqueta: 'Vista de cliente', mostrar: esAdministracion },
        { ruta: '/mantenciones', etiqueta: alertasMantencion > 0 ? `Mantenciones (${alertasMantencion})` : 'Mantenciones', mostrar: true },
        { ruta: '/mapa', etiqueta: 'Mapa', mostrar: true },
        // Proveedores y WhatsApp son de administración. Sus subsecciones
        // aparecen debajo solo mientras se está en ellas.
        { ruta: '/proveedores', etiqueta: 'Proveedores', mostrar: esAdministracion, activo: p => p === '/proveedores' || (/^\/proveedores\/[0-9a-f-]{20,}$/i.test(p)) },
        { ruta: '/proveedores/postulantes', etiqueta: 'Postulantes', mostrar: esAdministracion && activa(pathname, '/proveedores'), hijo: true },
        { ruta: '/proveedores/correos', etiqueta: 'Correos', mostrar: esAdministracion && activa(pathname, '/proveedores'), hijo: true },
        { ruta: '/proveedores/comunicaciones', etiqueta: 'Comunicaciones', mostrar: esAdministracion && activa(pathname, '/proveedores'), hijo: true },
        { ruta: '/whatsapp', etiqueta: 'WhatsApp', mostrar: esAdministracion, activo: p => p === '/whatsapp' },
        { ruta: '/whatsapp/automatizaciones', etiqueta: 'Automatizaciones', mostrar: esSuperadmin && activa(pathname, '/whatsapp'), hijo: true },
        { ruta: '/whatsapp/configuracion', etiqueta: 'Configuración', mostrar: esSuperadmin && activa(pathname, '/whatsapp'), hijo: true }
      ];

  const inicio = esCliente ? '/portal' : '/';

  function volverGlobal() {
    const evento = new CustomEvent('coproactiva:volver', { cancelable: true });
    window.dispatchEvent(evento);
    if (!evento.defaultPrevented) volverPorJerarquia(navegar, pathname, puedeCambiarArea);
  }

  const tutorialContextual =
    pathname === '/inicio' ? 'primeros_pasos'
    : pathname === '/ayuda/practica-levantamiento' ? 'ejecutar_levantamiento'
    : null;

  function IconoMovil({ tipo }) {
    const comun = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
    if (tipo === 'conocimientos') return <IconoNavegacion tipo="conocimientos" size={21} />;
    if (tipo === 'buscar-conocimientos') return <svg {...comun}><circle cx="10.7" cy="10.7" r="7.2"/><path d="m16 16 5 5"/></svg>;
    if (tipo === 'inicio') return <svg {...comun}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
    if (tipo === 'comunidades') return <svg {...comun}><path d="M4 20h16"/><path d="M6 20V7h12v13"/><path d="M9 10h2M13 10h2M9 14h2M13 14h2"/></svg>;
    if (tipo === 'levantamientos') return <svg {...comun}><path d="M8 4h8"/><path d="M9 3h6v3H9z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="m8 11 1.5 1.5L12 10M14 11h2M8 16l1.5 1.5L12 15M14 16h2"/></svg>;
    if (tipo === 'notificaciones') return <svg {...comun}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    if (tipo === 'plantillas') return <svg {...comun}><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>;
    if (tipo === 'bitacora') return <svg {...comun}><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
    if (tipo === 'mantenciones') return <svg {...comun}><path d="m14 6 4-4 4 4-4 4"/><path d="M18 2v6a6 6 0 0 1-6 6H6"/><path d="m10 18-4 4-4-4 4-4"/><path d="M6 22v-6"/></svg>;
    if (tipo === 'mapa') return <svg {...comun}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>;
    if (tipo === 'proveedores' || tipo === 'whatsapp' || tipo === 'propiedades' || tipo === 'seo') return <IconoNavegacion tipo={tipo} size={21} />;
    if (tipo === 'pipeline') return <IconoNavegacion tipo="comercial" size={21} />;
    if (tipo === 'conta-resumen') return <svg {...comun}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>;
    if (tipo === 'conta-asientos') return <svg {...comun}><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M12 4v16"/></svg>;
    if (tipo === 'conta-reportes') return <svg {...comun}><path d="M4 19V5M4 19h17M7 15l4-4 3 2 6-7"/></svg>;
    if (tipo === 'conta-plan') return <svg {...comun}><path d="M6 4v16M6 8h6M6 14h6"/><rect x="12" y="5.5" width="8" height="5" rx="1"/><rect x="12" y="11.5" width="8" height="5" rx="1"/></svg>;
    if (tipo === 'conta-entidades') return <svg {...comun}><path d="M4 20h16"/><path d="M6 20V7h12v13"/><path d="M9 10h2M13 10h2M9 14h2M13 14h2"/></svg>;
    if (tipo === 'conta-configuracion' || tipo === 'ajustes') return <svg {...comun}><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>;
    if (tipo === 'equipo') return <svg {...comun}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>;
    if (tipo === 'clientes') return <svg {...comun}><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/></svg>;
    if (tipo === 'nueva-propiedad') return <svg {...comun}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M12 11v6M9 14h6"/></svg>;
    return <svg {...comun}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
  }

  function irLevantamientos() {
    if (pathname === '/inicio') {
      document.getElementById('por-hacer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // React Router conserva el state/índice del historial usado por Atrás Android.
      navegar('/inicio#por-hacer', { replace: true, preventScrollReset: true });
      return;
    }
    navegar('/inicio#por-hacer');
  }

  const opcionesOperacion = [
    { id: 'inicio', etiqueta: 'Inicio', ruta: '/inicio' },
    { id: 'comunidades', etiqueta: 'Comunidades', ruta: '/comunidades' },
    { id: 'compromisos', etiqueta: 'Compromisos', ruta: '/compromisos' },
    { id: 'levantamientos', etiqueta: 'Levantamientos', accion: irLevantamientos },
    { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', badge: alertasTotales },
    { id: 'plantillas', etiqueta: 'Plantillas', ruta: '/plantillas', mostrar: puedeConfigurar },
    { id: 'bitacora', etiqueta: 'Bitácora', ruta: '/bitacora' },
    { id: 'mantenciones', etiqueta: 'Mantenciones', ruta: '/mantenciones' },
    { id: 'mapa', etiqueta: 'Mapa', ruta: '/mapa' },
    { id: 'proveedores', etiqueta: 'Proveedores', ruta: '/proveedores', mostrar: esAdministracion },
    { id: 'whatsapp', etiqueta: 'WhatsApp', ruta: '/whatsapp', mostrar: esAdministracion }
  ].filter(x => x.mostrar !== false);

  // Comercial conserva el mismo menú principal también al entrar en SEO.
  // Las secciones de SEO son navegación interna, no reemplazan esta barra.
  const opcionesComercial = [
    { id: 'pipeline', etiqueta: 'Pipeline', ruta: '/pipeline' },
    { id: 'propiedades', etiqueta: 'Arriendos', ruta: '/propiedades', activo: activaPropiedades },
    { id: 'seo', etiqueta: 'SEO', ruta: '/seo', mostrar: esAdministracion },
    { id: 'plantillas-correo', etiqueta: 'Plantillas de correo', ruta: '/plantillas-correo', mostrar: puedeConfigurar },
    { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', badge: alertasTotales },
    // Mantener el acceso comercial existente (incluida Jefatura), salvo
    // dentro de SEO donde las acciones de propiedades no corresponden.
    { id: 'nueva-propiedad', etiqueta: 'Nueva propiedad', ruta: '/propiedades/nueva',
      mostrar: !activa(pathname, '/seo') }
  ].filter(x => x.mostrar !== false);

  const idsPermitidos = new Set(opcionesOperacion.map(x => x.id));
  const preferidos = Array.isArray(perfil?.bottom_nav) && perfil.bottom_nav.length
    ? perfil.bottom_nav.filter(id => idsPermitidos.has(id))
    : ['inicio', 'comunidades', 'levantamientos', 'notificaciones'];

  // Finanzas y Configuración: también barra inferior en el teléfono (en
  // escritorio, la barra lateral). Contabilidad oculta sus pestañas
  // superiores en el teléfono para no repetir el menú.
  const opcionesFinanzas = [
    { id: 'conta-resumen', etiqueta: 'Resumen', ruta: '/contabilidad', activo: p => p === '/contabilidad' },
    { id: 'conta-asientos', etiqueta: 'Asientos', ruta: '/contabilidad/asientos' },
    { id: 'conta-reportes', etiqueta: 'Reportes', ruta: '/contabilidad/reportes' },
    { id: 'conta-plan', etiqueta: 'Plan de cuentas', ruta: '/contabilidad/plan' },
    { id: 'conta-entidades', etiqueta: 'Entidades', ruta: '/contabilidad/entidades' },
    { id: 'conta-configuracion', etiqueta: 'Configuración', ruta: '/contabilidad/configuracion' }
  ];
  const opcionesConfiguracion = [
    { id: 'ajustes', etiqueta: 'Ajustes', ruta: '/configuracion' },
    { id: 'equipo', etiqueta: 'Equipo', ruta: '/equipo' },
    { id: 'clientes', etiqueta: 'Clientes', ruta: '/clientes', mostrar: esSuperadmin }
  ].filter(x => x.mostrar !== false);

  const opcionesBarra = enAprendizaje ? [
    { id: 'conocimientos', etiqueta: 'Aprendizaje', ruta: '/conocimientos' },
    { id: 'buscar-conocimientos', etiqueta: 'Buscar', accion: () =>
      window.dispatchEvent(new CustomEvent('coproactiva:conocimientos:buscar', { detail: { accion: 'alternar' } })) }
  ]
    : enComercial ? opcionesComercial
    : enFinanzas ? opcionesFinanzas
    : enConfiguracion ? opcionesConfiguracion
    : opcionesOperacion;
  const barraIds = enOperacion ? [...preferidos] : [];
  for (const item of opcionesBarra) {
    if (barraIds.length >= 4) break;
    if (!barraIds.includes(item.id)) barraIds.push(item.id);
  }
  const barraMovil = barraIds.slice(0, 4)
    .map(id => opcionesBarra.find(x => x.id === id))
    .filter(Boolean);
  const menuMasOperacion = opcionesBarra.filter(x => !barraIds.slice(0, 4).includes(x.id));
  const alertasEnMas = menuMasOperacion.reduce((total, item) => total + Number(item.badge || 0), 0);
  const mostrarBarraMovil = enOperacion || enFinanzas || enConfiguracion || enComercial || enAprendizaje;

  function itemMovilActivo(item) {
    if (item.id === 'buscar-conocimientos') return buscarAprendizaje;
    if (item.id === 'conocimientos') return !buscarAprendizaje && activa(pathname, '/conocimientos');
    if (item.id === 'inicio') return pathname === '/inicio' && hash !== '#por-hacer';
    if (item.id === 'levantamientos') return levantamientosActivo;
    if (item.activo) return item.activo(pathname);
    return item.ruta ? activa(pathname, item.ruta) : false;
  }

  function ejecutarItemMovil(item) {
    // En la barra principal, navegar crea historial (Atrás recupera el módulo
    // anterior). Desde «Más» se sustituye solo la entrada temporal del diálogo.
    const desdeMas = masAbierto;
    setMasAbierto(false, { alNavegar: true });
    if (item.id === 'conocimientos' && pathname === '/conocimientos') {
      window.dispatchEvent(new CustomEvent('coproactiva:conocimientos:buscar', { detail: { accion: 'inicio' } }));
      return;
    }
    if (item.accion) return item.accion();
    if (item.ruta && pathname !== item.ruta) navegar(item.ruta, { replace: desdeMas });
  }

  // Navegación de escritorio: las tres áreas de trabajo permanecen a la
  // vista. Solo se despliegan los destinos de la sección activa, sin obligar
  // a volver al selector inicial. Administración es un acceso transversal.
  const gruposLaterales = [
    { id: 'comercial', etiqueta: 'Comercial', ruta: '/pipeline', icono: 'comercial', mostrar: puedeConfigurar },
    { id: 'operacion', etiqueta: 'Operaciones', ruta: '/inicio', icono: 'comunidades', mostrar: true },
    { id: 'finanzas', etiqueta: 'Finanzas', ruta: '/contabilidad', icono: 'contabilidad', mostrar: esAdministracion }
  ].filter(item => item.mostrar);

  function abrirGrupoLateral(item) {
    guardarArea(item.id);
    if (pathname !== item.ruta) navegar(item.ruta, { replace:true });
  }

  function esModuloActivo(item) {
    if (item.id === 'conocimientos') return activa(pathname, '/conocimientos');
    if (item.id === 'levantamientos') {
      // Módulo original «Levantamientos»: contiene Inicio, Comunidades,
      // Levantamientos, Mantenciones, Bitácora, Plantillas y Mapa.
      // Proveedores y WhatsApp son módulos principales independientes.
      return ['/inicio','/comunidades','/nuevo','/control','/mantenciones','/bitacora','/plantillas','/mapa']
        .some(r => activa(pathname,r));
    }
    if (item.id === 'inicio') return pathname === '/inicio' && hash !== '#por-hacer';
    if (item.id === 'notificaciones') return pathname === '/notificaciones';
    if (item.id === 'configuracion') return ['/configuracion','/equipo','/clientes'].some(r => activa(pathname,r));
    return item.ruta ? activa(pathname, item.ruta.split('#')[0]) : false;
  }

  function irModuloPlano(item, { desdeMas = false } = {}) {
    if (desdeMas) setMasAbierto(false, { alNavegar: true });
    if (item.area) guardarArea(item.area);
    navegar(item.ruta, desdeMas ? { replace: true } : undefined);
  }

  function enlacesDelGrupo() {
    return accesos.filter(item => item.mostrar).map(item => (
      <Link key={item.ruta} to={item.ruta} replace
            aria-current={(item.activo ? item.activo(pathname) : activa(pathname, item.ruta)) ? 'page' : undefined}
            className={'enlace-lateral' + (item.hijo ? ' enlace-lateral-hijo' : '') +
              ((item.activo ? item.activo(pathname) : activa(pathname, item.ruta)) ? ' activo' : '')}>
        <span className="enlace-lateral-icono"><IconoNavegacion tipo={iconoRutaCoproactiva(item.ruta)} /></span>
        <span>{item.etiqueta}</span>
      </Link>
    ));
  }

  return (
    <div className={"layout-escritorio" + (!mostrarPanelIzquierdo ? " layout-sin-panel-lateral" : "")}>
      {mostrarPanelIzquierdo && <nav className={'barra-lateral' + (organizacion === 'modulos' && !esCliente ? ' barra-lateral-modulos' : '')} aria-label="Navegación">
        <Link to={inicio} className="marca-lateral" aria-label="CoproActiva">
          <img src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'} alt="CoproActiva" />
        </Link>
        <div className="enlaces-lateral">
          {esCliente ? enlacesDelGrupo() : organizacion === 'modulos' ? (
            <>
              <span className="micro apagado etiqueta-lateral">Módulos</span>
              {modulosPlanos.map(item => (
                <Link key={item.id} to={item.ruta} replace
                      onClick={() => { if (item.area) guardarArea(item.area); }}
                      aria-current={esModuloActivo(item) ? 'page' : undefined}
                      className={'enlace-lateral' + (esModuloActivo(item) ? ' activo' : '')}>
                  <span className="enlace-lateral-icono">
                    <IconoNavegacion tipo={iconoRutaCoproactiva(item.ruta)} />
                  </span>
                  <span>{item.titulo}</span>
                </Link>
              ))}
            </>
          ) : (
            <>
              <span className="micro apagado etiqueta-lateral">Áreas de trabajo</span>
              {gruposLaterales.map(item => (
                <div key={item.id} className="grupo-navegacion-lateral">
                  <button type="button" onClick={() => abrirGrupoLateral(item)}
                          className={'grupo-navegacion-boton' + (grupo === item.id ? ' activo' : '')}
                          aria-expanded={grupo === item.id}
                          aria-label={'Ir al área ' + item.etiqueta}>
                    <span className="enlace-lateral-icono"><IconoNavegacion tipo={item.icono}/></span>
                    <span>{item.etiqueta}</span>
                    <span className="grupo-navegacion-flecha" aria-hidden="true">{grupo === item.id ? '⌄' : '›'}</span>
                  </button>
                  {grupo === item.id && (
                    <div className="grupo-navegacion-enlaces" aria-label={'Módulos de ' + item.etiqueta}>
                      {enlacesDelGrupo()}
                    </div>
                  )}
                </div>
              ))}
              {esAdministracion && (
                <div className="grupo-navegacion-lateral grupo-navegacion-administracion">
                  <button type="button" onClick={() => navegar('/configuracion')}
                          className={'grupo-navegacion-boton' + (enConfiguracion ? ' activo' : '')}
                          aria-expanded={enConfiguracion}
                          title="Equipo, usuarios, permisos, accesos de clientes y configuración general.">
                    <span className="enlace-lateral-icono"><IconoNavegacion tipo="configuracion"/></span>
                    <span>Administración y ajustes</span>
                    <span className="grupo-navegacion-flecha" aria-hidden="true">{enConfiguracion ? '⌄' : '›'}</span>
                  </button>
                  {enConfiguracion && (
                    <div className="grupo-navegacion-enlaces" aria-label="Opciones de administración y ajustes">
                      {enlacesDelGrupo()}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {!esCliente && organizacion !== 'modulos' && (
          <div className="coproactiva-aprendizaje-lateral">
            <span className="micro apagado etiqueta-lateral">Aprendizaje</span>
            <Link to="/conocimientos"
                  className={'coproactiva-aprendizaje-boton' + (activa(pathname, '/conocimientos') ? ' activo' : '')}
                  aria-current={activa(pathname, '/conocimientos') ? 'page' : undefined}>
              <span className="enlace-lateral-icono"><IconoNavegacion tipo="conocimientos" /></span>
              <span>Base de conocimientos</span>
            </Link>
          </div>
        )}

        <div className="crece" />
        <div className="usuario-lateral">
          <div className="usuario-lateral-identidad con-campana">
            <span className="usuario-lateral-avatar" aria-hidden="true">
              {(perfil?.nombre || 'U').trim().charAt(0).toUpperCase()}
            </span>
            <span className="usuario-lateral-datos">
              <strong>{perfil?.nombre || 'Usuario'}</strong>
              <small>
                {esCliente ? 'Cliente'
                  : perfil?.rol === 'superadmin' ? 'Superadministrador'
                  : perfil?.rol === 'admin' ? 'Administrador'
                  : perfil?.rol === 'jefatura' ? 'Jefatura'
                  : perfil?.rol === 'terreno' ? 'Terreno'
                  : perfil?.rol || ''}
              </small>
            </span>
            <Campana miId={perfil?.id} />
          </div>
          <div className="usuario-lateral-acciones">
            {!esCliente && <Link to="/mi-cuenta">Mi cuenta</Link>}
            {puedeConfigurar && (
              <button type="button" onClick={cambiarArea}>
                Ir al inicio
              </button>
            )}
            {!esCliente && tutorialContextual && (
              <button
                type="button"
                className="ayuda-contextual-escritorio"
                data-tutorial="ayuda-menu"
                aria-label="Abrir tutorial de esta pantalla"
                title="Tutorial de esta pantalla"
                onClick={() => iniciar(tutorialContextual, { continuar: false })}
              >
                Tutorial
              </button>
            )}
            <button type="button" className="usuario-lateral-salir" onClick={salir}>Salir</button>
          </div>
        </div>
      </nav>}

      <div className={'area-escritorio' + (anchoCompleto ? ' ancho-completo' : '')}>
        {!mostrarPanelIzquierdo && (
          <header className="barra-contextual-escritorio" aria-label="Navegación contextual">
            <button type="button" className="barra-contextual-marca"
              aria-label="Ir al Home de módulos" onClick={cambiarArea}>
              <img src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'} alt="Coproactiva" />
            </button>
            <div className="barra-contextual-ubicacion">
              <button type="button" className="barra-contextual-home" onClick={cambiarArea}>
                ‹ Home de módulos
              </button>
              {nombreArea && <span className="barra-contextual-seccion" aria-label={'Área actual: ' + nombreArea}>
                {nombreArea}
              </span>}
            </div>
            <div className="barra-contextual-cuenta">
              <Campana miId={perfil?.id} />
              <Link to="/mi-cuenta">Mi cuenta</Link>
              <button type="button" onClick={salir}>Salir</button>
            </div>
          </header>
        )}
        {/* En el teléfono la barra lateral no existe (se oculta con CSS), así
            que sin esto "Cambiar de área" no tenía dónde vivir y quedaba
            fijo en la que se eligió la primera vez, sin salida. */}
        {pathname !== '/' && (
          <div className="barra-area-movil">
            {(puedeCambiarArea || !['/', '/inicio'].includes(pathname)) && (
              <button type="button" className="barra-area-volver" onClick={volverGlobal}>
                ‹ Volver
              </button>
            )}
            <div className="barra-area-derecha">
              <Campana miId={perfil?.id} />
              {tutorialContextual && (
                <button
                  type="button"
                  className="barra-area-tutorial"
                  data-tutorial="ayuda-menu"
                  aria-label="Abrir tutorial de esta pantalla"
                  title="Tutorial"
                  onClick={() => iniciar(tutorialContextual, { continuar: false })}
                >
                  ?
                </button>
              )}
              {nombreArea && (
                <span className="barra-area-nombre" aria-label={'Área actual: ' + nombreArea}>
                  {nombreArea}
                </span>
              )}
            </div>
          </div>
        )}
        {children}
      </div>

      {mostrarBarraMovil && (
        <>
          <nav className={'barra-inferior-movil' + (enAprendizaje ? ' barra-inferior-aprendizaje' : '')} aria-label="Navegación principal">
            {barraMovil.map(item => (
              <button
                key={item.id}
                type="button"
                className={'nav-movil-item' + (itemMovilActivo(item) ? ' activo' : '')}
                aria-current={itemMovilActivo(item) ? 'page' : undefined}
                onClick={() => ejecutarItemMovil(item)}
              >
                <span className="nav-movil-icono-wrap">
                  <IconoMovil tipo={item.id} />
                  {item.badge > 0 && (
                    <span className="nav-movil-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                  )}
                </span>
                <span>{item.etiqueta}</span>
              </button>
            ))}

            <button type="button" ref={botonMasRef}
                    className={'nav-movil-item' + (masAbierto ? ' activo' : '')}
                    onClick={() => setMasAbierto(v => !v)}
                    aria-haspopup="dialog"
                    aria-expanded={masAbierto}>
              <span className="nav-movil-icono-wrap">
                <IconoMovil tipo="mas" />
                {alertasEnMas > 0 && (
                  <span className="nav-movil-badge">{alertasEnMas > 99 ? '99+' : alertasEnMas}</span>
                )}
              </span>
              <span>Más</span>
            </button>
          </nav>

          {masAbierto && (
            <div className="menu-mas-fondo" role="presentation" onClick={() => setMasAbierto(false)}>
              <div className="menu-mas" role="dialog" aria-modal="true" aria-label="Más opciones"
                   onClick={e => e.stopPropagation()}>
                <div className="menu-mas-cabecera">
                  <strong>Más</strong>
                  <button ref={cerrarMasRef} type="button" onClick={() => setMasAbierto(false)} aria-label="Cerrar menú">×</button>
                </div>
                <div className="menu-mas-secciones">
                  {organizacion === 'modulos' && !esCliente ? (
                    <div className="menu-mas-grupo" role="group" aria-label="Todos los módulos">
                      <p className="menu-mas-grupo-titulo">Todos los módulos</p>
                      <div className="menu-mas-enlaces">
                        {modulosPlanos.map(item => (
                          <button key={item.id} type="button" onClick={() => irModuloPlano(item, { desdeMas: true })}
                                  aria-current={esModuloActivo(item) ? 'page' : undefined}>
                            <span>{item.titulo}</span>
                            <span aria-hidden="true">›</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : menuMasOperacion.length > 0 && (
                    <div className="menu-mas-grupo" role="group" aria-label={'Módulos y acciones de ' + nombreArea}>
                      <p className="menu-mas-grupo-titulo">Módulos y acciones · {nombreArea}</p>
                      <div className="menu-mas-enlaces">
                        {menuMasOperacion.map(item => (
                          <button key={item.id} type="button" onClick={() => ejecutarItemMovil(item)}>
                            <span>
                              {item.etiqueta}
                              {item.badge > 0 ? ` (${item.badge})` : ''}
                            </span>
                            <span aria-hidden="true">›</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {organizacion !== 'modulos' && !esCliente && (
                    <div className="menu-mas-grupo" role="group" aria-label="Aprendizaje">
                      <p className="menu-mas-grupo-titulo">Aprendizaje</p>
                      <div className="menu-mas-enlaces">
                        <Link to="/conocimientos" onClick={() => setMasAbierto(false, { alNavegar: true })}>
                          Base de conocimientos <span aria-hidden="true">›</span>
                        </Link>
                      </div>
                    </div>
                  )}
                  {enAprendizaje && (
                    <div className="menu-mas-grupo" role="group" aria-label="Preferencias de aprendizaje">
                      <p className="menu-mas-grupo-titulo">Preferencias de aprendizaje</p>
                      <div className="menu-mas-enlaces">
                        <button type="button" role="switch" aria-label="Mostrar avisos educativos automáticos" aria-checked={avisosActivos}
                          onClick={() => {
                            const proximo = !avisosActivos;
                            setAvisosActivos(proximo);
                            guardarAutomaticas(perfil?.id, proximo);
                          }}>
                          <span>Avisos «¿Sabías que…?»</span>
                          <span>{avisosActivos ? 'Activados' : 'Desactivados'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="menu-mas-grupo menu-mas-grupo-cuenta" role="group" aria-label="Cuenta y navegación">
                    <p className="menu-mas-grupo-titulo">Cuenta y navegación</p>
                    <div className="menu-mas-enlaces">
                      <Link to="/mi-cuenta" onClick={() => setMasAbierto(false, { alNavegar: true })}>
                        Mi cuenta <span aria-hidden="true">›</span>
                      </Link>
                      {puedeCambiarArea && (
                        <button type="button" onClick={() => { setMasAbierto(false, { alNavegar: true }); cambiarArea(); }}>
                          Ir al inicio
                          <span aria-hidden="true">›</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

