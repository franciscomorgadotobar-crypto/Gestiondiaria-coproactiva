import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { limpiarArea, inicioSegunArea, areaGuardada } from '../lib/area';

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
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const [alertasMantencion, setAlertasMantencion] = useState(0);

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

  const esCliente = perfil?.rol === 'cliente';
  const puedeConfigurar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
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
  const enProveedores = !esCliente && esAdministracion && !enConfiguracion
    && (activa(pathname, '/proveedores') || areaGuardada() === 'proveedores');
  const enPropiedades = !esCliente && puedeConfigurar && !enConfiguracion && !enProveedores
    && (activa(pathname, '/propiedades')
      || (areaGuardada() === 'propiedades' && !activa(pathname, '/pipeline')));
  const enCRM = !esCliente && puedeConfigurar && !enConfiguracion && !enProveedores && !enPropiedades
    && (areaGuardada() === 'crm' || activa(pathname, '/pipeline'));
  const nombreArea = esCliente ? null
    : enConfiguracion ? 'Configuración'
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
        { ruta: '/comunidades', etiqueta: alertasMantencion > 0 ? `Comunidades (${alertasMantencion})` : 'Comunidades', mostrar: true },
        { ruta: '/mapa', etiqueta: 'Mapa', mostrar: true }
      ];

  const inicio = esCliente ? '/portal' : inicioSegunArea();

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
          {!esCliente && (
            <Link to="/ayuda" data-tutorial="ayuda-menu"
                  className="ayuda-lateral">
              Ayuda y tutoriales
            </Link>
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
            <button type="button" className="barra-area-volver" onClick={() => navegar(-1)}>
              ‹ Volver
            </button>
            {puedeConfigurar && (
              <button type="button" className="barra-area-cambiar" onClick={cambiarArea}>
                Cambiar de área
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
