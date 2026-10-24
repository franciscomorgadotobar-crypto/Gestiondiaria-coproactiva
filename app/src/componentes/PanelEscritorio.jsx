import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { limpiarArea, inicioSegunArea, areaGuardada, grupoDeRuta } from '../lib/area';
import { useTutoriales } from '../lib/tutorialesContexto';
import { volverPorJerarquia } from '../lib/navegacion';
import { pasosHastaSelector } from '../lib/historialSelector';

import { usePestanaHistorial } from '../lib/pestanasHistorial';
import IconoNavegacion, { iconoRutaCoproactiva } from './IconoNavegacion';

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
  // Cambiar de área no debe reiniciar React ni interrumpir la PWA.
  // Entrada interpreta este estado incluso al navegar desde la misma ruta '/'.
  function cambiarArea() {
    limpiarArea();
    // La selección ya es el último destino: no debe quedar una copia nueva
    // encima de una pantalla de trabajo al pulsar «Cambiar de área».
    const pasos = pasosHastaSelector(window.history.state);
    if (pasos !== null) return navegar(pasos);
    navegar('/', { replace: true, state: { selectorCoproactiva: true } });
  }
  const { iniciar } = useTutoriales();
  const [alertasMantencion, setAlertasMantencion] = useState(0);
  const [alertasGenerales, setAlertasGenerales] = useState(0);
  const [menu, cambiarMenu] = usePestanaHistorial('menu', 'cerrado', ESTADOS_MENU);
  const masAbierto = menu === 'mas';
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
    const escuchar = () => actualizarAlertas();
    window.addEventListener('coproactiva:notificaciones-cambio', escuchar);
    return () => {
      vigente = false;
      window.removeEventListener('coproactiva:notificaciones-cambio', escuchar);
    };
  }, [perfil?.id, pathname]);

  const esCliente = perfil?.rol === 'cliente';
  const puedeConfigurar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  const puedeCambiarArea = Boolean(puedeConfigurar);
  const esAdministracion = perfil && ['superadmin', 'admin'].includes(perfil.rol);
  const esSuperadmin = perfil?.rol === 'superadmin';



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
  let grupo = esCliente ? null : (grupoDeRuta(pathname) ?? areaGuardada() ?? 'operacion');
  if (grupo === 'comercial' && !puedeConfigurar) grupo = 'operacion';
  if ((grupo === 'finanzas' || grupo === 'configuracion') && !esAdministracion) grupo = 'operacion';
  const enConfiguracion = grupo === 'configuracion';
  const enComercial = grupo === 'comercial';
  const enFinanzas = grupo === 'finanzas';
  const enOperacion = grupo === 'operacion';
  const alertasTotales = alertasMantencion + alertasGenerales;
  const levantamientosActivo = pathname === '/nuevo'
    || pathname.startsWith('/control/')
    || (pathname === '/inicio' && hash === '#por-hacer');

  const nombreArea = esCliente ? null
    : enConfiguracion ? 'Configuración'
    : enComercial ? 'Comercial'
    : enFinanzas ? 'Finanzas'
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
        { ruta: '/seo', etiqueta: 'SEO y analítica', mostrar: esAdministracion }
      ]
    : [
        { ruta: '/inicio', etiqueta: 'Inicio', mostrar: true },
        { ruta: '/nuevo', etiqueta: 'Nuevo levantamiento', mostrar: puedeConfigurar },
        { ruta: '/plantillas', etiqueta: 'Plantillas', mostrar: puedeConfigurar },
        { ruta: '/bitacora', etiqueta: 'Bitácora', mostrar: true },
        { ruta: '/comunidades', etiqueta: 'Comunidades', mostrar: true },
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

  const inicio = esCliente ? '/portal' : inicioSegunArea();

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
    { id: 'levantamientos', etiqueta: 'Levantamientos', accion: irLevantamientos },
    { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', badge: alertasTotales },
    { id: 'plantillas', etiqueta: 'Plantillas', ruta: '/plantillas', mostrar: puedeConfigurar },
    { id: 'bitacora', etiqueta: 'Bitácora', ruta: '/bitacora' },
    { id: 'mantenciones', etiqueta: 'Mantenciones', ruta: '/mantenciones' },
    { id: 'mapa', etiqueta: 'Mapa', ruta: '/mapa' },
    { id: 'proveedores', etiqueta: 'Proveedores', ruta: '/proveedores', mostrar: esAdministracion },
    { id: 'whatsapp', etiqueta: 'WhatsApp', ruta: '/whatsapp', mostrar: esAdministracion }
  ].filter(x => x.mostrar !== false);

  // Comercial en el teléfono: misma barra inferior que Operaciones. SEO
  // tiene su propia barra de secciones, así que en /seo no se dibuja esta.
  const opcionesComercial = [
    { id: 'pipeline', etiqueta: 'Pipeline', ruta: '/pipeline' },
    { id: 'propiedades', etiqueta: 'Arriendos', ruta: '/propiedades', activo: activaPropiedades },
    { id: 'seo', etiqueta: 'SEO', ruta: '/seo', mostrar: esAdministracion },
    { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', badge: alertasTotales },
    { id: 'nueva-propiedad', etiqueta: 'Nueva propiedad', ruta: '/propiedades/nueva' }
  ].filter(x => x.mostrar !== false);

  const idsPermitidos = new Set(opcionesOperacion.map(x => x.id));
  const preferidos = Array.isArray(perfil?.bottom_nav) && perfil.bottom_nav.length
    ? perfil.bottom_nav.filter(id => idsPermitidos.has(id))
    : ['inicio', 'comunidades', 'levantamientos', 'notificaciones'];

  const opcionesBarra = enComercial ? opcionesComercial : opcionesOperacion;
  const barraIds = enComercial ? [] : [...preferidos];
  for (const item of opcionesBarra) {
    if (barraIds.length >= 4) break;
    if (!barraIds.includes(item.id)) barraIds.push(item.id);
  }
  const barraMovil = barraIds.slice(0, 4)
    .map(id => opcionesBarra.find(x => x.id === id))
    .filter(Boolean);
  const menuMasOperacion = opcionesBarra.filter(x => !barraIds.slice(0, 4).includes(x.id));
  const alertasEnMas = menuMasOperacion.reduce((total, item) => total + Number(item.badge || 0), 0);
  const mostrarBarraMovil = enOperacion || (enComercial && !activa(pathname, '/seo'));

  function itemMovilActivo(item) {
    if (item.id === 'inicio') return pathname === '/inicio' && hash !== '#por-hacer';
    if (item.id === 'levantamientos') return levantamientosActivo;
    if (item.activo) return item.activo(pathname);
    return item.ruta ? activa(pathname, item.ruta) : false;
  }

  function ejecutarItemMovil(item) {
    // Se reemplaza la entrada del menú al navegar; Atrás lleva al módulo
    // anterior sin regresar a un menú abierto.
    setMasAbierto(false, { alNavegar: true });
    if (item.accion) return item.accion();
    if (item.ruta) navegar(item.ruta, { replace: true });
  }

  return (
    <div className="layout-escritorio">
      <nav className="barra-lateral" aria-label="Navegación">
        <Link to={inicio} className="marca-lateral" aria-label="CoproActiva">
          <img src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'} alt="CoproActiva" />
        </Link>
        <div className="enlaces-lateral">
          {nombreArea && <span className="micro apagado etiqueta-lateral">{nombreArea}</span>}
          {accesos.filter(a => a.mostrar).map(a => (
            <Link key={a.ruta} to={a.ruta}
                  className={'enlace-lateral' + (a.hijo ? ' enlace-lateral-hijo' : '') + ((a.activo ? a.activo(pathname) : activa(pathname, a.ruta)) ? ' activo' : '')}>
              <span className="enlace-lateral-icono"><IconoNavegacion tipo={iconoRutaCoproactiva(a.ruta)} /></span>
              <span>{a.etiqueta}</span>
            </Link>
          ))}
        </div>

        <div className="crece" />
        <div className="usuario-lateral">
          <div className="usuario-lateral-identidad">
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
          </div>
          <div className="usuario-lateral-acciones">
            {!esCliente && <Link to="/mi-cuenta">Mi cuenta</Link>}
            {puedeConfigurar && (
              <button type="button" onClick={cambiarArea}>Cambiar de área</button>
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
      </nav>

      <div className={'area-escritorio' + (anchoCompleto ? ' ancho-completo' : '')}>
        {/* En el teléfono la barra lateral no existe (se oculta con CSS), así
            que sin esto "Cambiar de área" no tenía dónde vivir y quedaba
            fijo en la que se eligió la primera vez, sin salida. */}
        {!esCliente && (
          <div className="barra-area-movil">
            {(puedeCambiarArea || !['/', '/inicio'].includes(pathname)) && (
              <button type="button" className="barra-area-volver" onClick={volverGlobal}>
                ‹ Volver
              </button>
            )}
            <div className="barra-area-derecha">
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
              {puedeCambiarArea && (
                <button type="button" className="barra-area-cambiar" onClick={cambiarArea}>
                  Cambiar de área
                </button>
              )}
            </div>
          </div>
        )}
        {children}
      </div>

      {mostrarBarraMovil && (
        <>
          <nav className="barra-inferior-movil" aria-label="Navegación principal">
            {barraMovil.map(item => (
              <button
                key={item.id}
                type="button"
                className={'nav-movil-item' + (itemMovilActivo(item) ? ' activo' : '')}
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

            <button type="button"
                    className={'nav-movil-item' + (masAbierto ? ' activo' : '')}
                    onClick={() => setMasAbierto(v => !v)}
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
                  <button type="button" onClick={() => setMasAbierto(false)} aria-label="Cerrar">×</button>
                </div>
                <div className="menu-mas-enlaces">
                  {menuMasOperacion.map(item => (
                    <button key={item.id} type="button" onClick={() => ejecutarItemMovil(item)}>
                      <span>
                        {item.etiqueta}
                        {item.badge > 0 ? ` (${item.badge})` : ''}
                      </span>
                      <span>›</span>
                    </button>
                  ))}
                  <Link to="/mi-cuenta" onClick={() => setMasAbierto(false, { alNavegar: true })}>
                    Mi cuenta <span>›</span>
                  </Link>
                  {puedeCambiarArea && (
                    <button type="button" onClick={() => { setMasAbierto(false, { alNavegar: true }); cambiarArea(); }}>
                      Cambiar de área <span>›</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

