import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { limpiarArea, inicioSegunArea, areaGuardada } from '../lib/area';
import { useTutoriales } from '../lib/tutorialesContexto';
import { volverPorJerarquia } from '../lib/navegacion';

function activa(pathname, ruta) {
  return pathname === ruta || pathname.startsWith(ruta + '/');
}

/* El listado de propiedades y la ficha de una cuelgan de /propiedades, igual
 * que "Nueva propiedad": sin esto las dos entradas se marcaban a la vez. */
function activaPropiedades(pathname) {
  return activa(pathname, '/propiedades') && !activa(pathname, '/propiedades/nueva');
}

/* Recarga completa en vez de navegar: "Cambiar de área" puede apretarse
 * estando ya en "/" (cuando el área es 'operacion', Entrada muestra Inicio
 * ahí mismo), y navegar a la misma ruta en la que ya se está no vuelve a
 * renderizar nada en React Router. Una recarga completa no tiene ese
 * problema: Entrada vuelve a evaluar el área desde cero, siempre. */
function cambiarArea() {
  limpiarArea();
  window.location.href = import.meta.env.BASE_URL;
}

export default function PanelEscritorio({ children, anchoCompleto = false }) {
  const { perfil, salir } = useSesion();
  const { pathname, hash } = useLocation();
  const navegar = useNavigate();
  const { iniciar } = useTutoriales();
  const [alertasMantencion, setAlertasMantencion] = useState(0);
  const [alertasGenerales, setAlertasGenerales] = useState(0);
  const [masAbierto, setMasAbierto] = useState(false);

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;
    supabase.from('notificaciones_mantenimiento')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', perfil.id)
      .eq('leida', false)
      .then(({ count }) => { if (vigente) setAlertasMantencion(count ?? 0); });
    return () => { vigente = false; };
  }, [perfil?.id, pathname]);

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;
    supabase.from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', perfil.id)
      .eq('leida', false)
      .then(({ count }) => { if (vigente) setAlertasGenerales(count ?? 0); });
    return () => { vigente = false; };
  }, [perfil?.id, pathname]);

  const esCliente = perfil?.rol === 'cliente';
  const puedeConfigurar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  const puedeCambiarArea = Boolean(puedeConfigurar);
  const esAdministracion = perfil && ['superadmin', 'admin'].includes(perfil.rol);
  const esSuperadmin = perfil?.rol === 'superadmin';

  // La barra muestra solo el área en la que se está, igual que en el
  // teléfono: en CRM, el Pipeline; en Operación, levantamientos, plantillas,
  // comunidades y mapa; en Propiedades, el listado y el alta; en
  // Configuración, Equipo y Clientes. Para ir a otra área está "Cambiar de
  // área".
  // El Pipeline es del CRM aunque se llegue a él sin haber elegido área
  // (un enlace directo, por ejemplo). Lo mismo con Propiedades: la ruta
  // manda sobre el área guardada.
  // Configuración no se guarda como área (se entra desde su tarjeta en la
  // capa de entrada, de visita), así que se reconoce solo por la ruta. Sus
  // enlaces no se repiten en las otras áreas: no son trabajo del día.
  const enConfiguracion = !esCliente && esAdministracion
    && ['/configuracion', '/equipo', '/clientes'].some(r => activa(pathname, r));
  const enContabilidad = !esCliente && esAdministracion && !enConfiguracion
    && (activa(pathname, '/contabilidad') || areaGuardada() === 'contabilidad');
  const enProveedores = !esCliente && esAdministracion && !enConfiguracion && !enContabilidad
    && (activa(pathname, '/proveedores') || areaGuardada() === 'proveedores');
  const enPropiedades = !esCliente && puedeConfigurar && !enConfiguracion && !enContabilidad && !enProveedores
    && (activa(pathname, '/propiedades')
      || (areaGuardada() === 'propiedades' && !activa(pathname, '/pipeline')));
  const enCRM = !esCliente && puedeConfigurar && !enConfiguracion && !enContabilidad && !enProveedores && !enPropiedades
    && (areaGuardada() === 'crm' || activa(pathname, '/pipeline'));
  const enOperacion = !esCliente && !enConfiguracion && !enContabilidad && !enProveedores && !enPropiedades && !enCRM;
  const alertasTotales = alertasMantencion + alertasGenerales;
  const levantamientosActivo = pathname === '/nuevo'
    || pathname.startsWith('/control/')
    || (pathname === '/inicio' && hash === '#por-hacer');

  const nombreArea = esCliente ? null
    : enConfiguracion ? 'Configuración'
    : enContabilidad ? 'Contabilidad'
    : enProveedores ? 'Proveedores'
    : enPropiedades ? 'Propiedades'
    : enCRM ? 'CRM'
    : puedeConfigurar ? 'Operación' : null;

  const accesos = esCliente
    ? [
        {
          ruta: '/portal',
          etiqueta: alertasMantencion > 0 ? `Mi portal (${alertasMantencion})` : 'Mi portal',
          mostrar: true
        }
      ]
    : enConfiguracion
    ? [
        { ruta: '/equipo', etiqueta: 'Equipo y permisos', mostrar: true },
        { ruta: '/clientes', etiqueta: 'Clientes y accesos', mostrar: esSuperadmin }
      ]
    : enContabilidad
    ? [
        { ruta: '/contabilidad', etiqueta: 'Resumen', mostrar: true },
        { ruta: '/contabilidad/asientos', etiqueta: 'Asientos', mostrar: true },
        { ruta: '/contabilidad/plan', etiqueta: 'Plan de cuentas', mostrar: true },
        { ruta: '/contabilidad/reportes', etiqueta: 'Reportes', mostrar: true },
        { ruta: '/contabilidad/entidades', etiqueta: 'Entidades', mostrar: true }
      ]
    : enProveedores
    ? [
        { ruta: '/proveedores', etiqueta: 'Directorio', mostrar: true }
      ]
    : enPropiedades
    ? [
        { ruta: '/propiedades', etiqueta: 'Inicio', mostrar: true, activo: activaPropiedades },
        { ruta: '/propiedades/nueva', etiqueta: 'Nueva propiedad', mostrar: true }
      ]
    : enCRM
    ? [
        // "Inicio" es el home del área: en CRM, el Pipeline.
        { ruta: '/pipeline', etiqueta: 'Inicio', mostrar: true }
      ]
    : [
        { ruta: '/inicio', etiqueta: 'Inicio', mostrar: true },
        { ruta: '/nuevo', etiqueta: 'Nuevo levantamiento', mostrar: puedeConfigurar },
        { ruta: '/plantillas', etiqueta: 'Plantillas', mostrar: puedeConfigurar },
        { ruta: '/bitacora', etiqueta: 'Bitácora', mostrar: true },
        { ruta: '/comunidades', etiqueta: 'Comunidades', mostrar: true },
        { ruta: '/mantenciones', etiqueta: alertasMantencion > 0 ? `Mantenciones (${alertasMantencion})` : 'Mantenciones', mostrar: true },
        { ruta: '/mapa', etiqueta: 'Mapa', mostrar: true }
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
    return <svg {...comun}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
  }

  function irLevantamientos() {
    setMasAbierto(false);
    if (pathname === '/inicio') {
      document.getElementById('por-hacer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.history?.replaceState) window.history.replaceState(null, '', '#por-hacer');
      return;
    }
    navegar('/inicio#por-hacer');
  }

  return (
    <div className="layout-escritorio">
      <nav className="barra-lateral" aria-label="Navegación">
        <Link to={inicio} className="marca-lateral">
          <img src={import.meta.env.BASE_URL + 'logo-coproactiva.svg'} alt="" />
          <span>CoproActiva</span>
        </Link>
        <div className="enlaces-lateral">
          {nombreArea && <span className="micro apagado etiqueta-lateral">{nombreArea}</span>}
          {accesos.filter(a => a.mostrar).map(a => (
            <Link key={a.ruta} to={a.ruta}
                  className={'enlace-lateral' + ((a.activo ? a.activo(pathname) : activa(pathname, a.ruta)) ? ' activo' : '')}>
              {a.etiqueta}
            </Link>
          ))}
        </div>

        <div className="crece" />
        <div className="usuario-lateral">
          <span className="micro apagado" style={{ display: 'block', marginBottom: 3 }}>
            {perfil?.nombre}
          </span>
          {esCliente && (
            <span className="micro apagado" style={{ display: 'block', marginBottom: 6 }}>
              Cliente
            </span>
          )}
          {puedeConfigurar && (
            <button type="button" className="boton boton-texto" style={{ padding: 0, display: 'block', marginBottom: 6 }}
                    onClick={cambiarArea}>
              Cambiar de área
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
              ? Tutorial
            </button>
          )}
          <button type="button" className="boton boton-texto" style={{ padding: 0 }} onClick={salir}>
            Salir
          </button>
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

      {enOperacion && (
        <>
          <nav className="barra-inferior-movil" aria-label="Navegación principal">
            <Link to="/inicio"
                  className={'nav-movil-item' + (pathname === '/inicio' && hash !== '#por-hacer' ? ' activo' : '')}
                  onClick={() => setMasAbierto(false)}>
              <IconoMovil tipo="inicio" />
              <span>Inicio</span>
            </Link>

            <Link to="/comunidades"
                  className={'nav-movil-item' + (activa(pathname, '/comunidades') ? ' activo' : '')}
                  onClick={() => setMasAbierto(false)}>
              <IconoMovil tipo="comunidades" />
              <span>Comunidades</span>
            </Link>

            <button type="button"
                    className={'nav-movil-item' + (levantamientosActivo ? ' activo' : '')}
                    onClick={irLevantamientos}>
              <IconoMovil tipo="levantamientos" />
              <span>Levantamientos</span>
            </button>

            <Link to="/notificaciones"
                  className={'nav-movil-item nav-movil-notificaciones' + (activa(pathname, '/notificaciones') ? ' activo' : '')}
                  onClick={() => setMasAbierto(false)}>
              <span className="nav-movil-icono-wrap">
                <IconoMovil tipo="notificaciones" />
                {alertasTotales > 0 && <span className="nav-movil-badge">{alertasTotales > 99 ? '99+' : alertasTotales}</span>}
              </span>
              <span>Notificaciones</span>
            </Link>

            <button type="button"
                    className={'nav-movil-item' + (masAbierto ? ' activo' : '')}
                    onClick={() => setMasAbierto(v => !v)}
                    aria-expanded={masAbierto}>
              <IconoMovil tipo="mas" />
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
                  {puedeConfigurar && <Link to="/plantillas" onClick={() => setMasAbierto(false)}>Plantillas <span>›</span></Link>}
                  <Link to="/bitacora" onClick={() => setMasAbierto(false)}>Bitácora <span>›</span></Link>
                  <Link to="/mantenciones" onClick={() => setMasAbierto(false)}>Mantenciones <span>›</span></Link>
                  <Link to="/mapa" onClick={() => setMasAbierto(false)}>Mapa <span>›</span></Link>
                  {puedeCambiarArea && (
                    <button type="button" onClick={() => { setMasAbierto(false); cambiarArea(); }}>
                      Cambiar de área <span>›</span>
                    </button>
                  )}
                  <button type="button" className="menu-mas-salir" onClick={salir}>Salir</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
