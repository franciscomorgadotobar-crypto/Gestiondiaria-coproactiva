import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { limpiarArea, inicioSegunArea } from '../lib/area';

function activa(pathname, ruta) {
  return pathname === ruta || pathname.startsWith(ruta + '/');
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

  const accesos = esCliente
    ? [
        {
          ruta: '/portal',
          etiqueta: alertasMantencion > 0 ? `Mi portal (${alertasMantencion})` : 'Mi portal',
          mostrar: true
        }
      ]
    // El Pipeline no va acá: es exclusivo del CRM, y ya se llega a él
    // como "Inicio" al elegir esa área. Listarlo también del lado de
    // Operación mezclaría las dos áreas que la capa de selección separa.
    : [
        { ruta: inicioSegunArea(), etiqueta: 'Inicio', mostrar: true },
        { ruta: '/nuevo', etiqueta: 'Nuevo levantamiento', mostrar: puedeConfigurar },
        { ruta: '/comunidades', etiqueta: alertasMantencion > 0 ? `Comunidades (${alertasMantencion})` : 'Comunidades', mostrar: true },
        { ruta: '/mapa', etiqueta: 'Mapa', mostrar: true }
      ];

  // Se tocan poco y no son trabajo del día: agrupados bajo "Configuración",
  // igual que en el acordeón del celular.
  const configuracion = esCliente ? [] : [
    { ruta: '/plantillas', etiqueta: 'Plantillas', mostrar: puedeConfigurar },
    { ruta: '/equipo', etiqueta: 'Equipo y permisos', mostrar: esAdministracion },
    { ruta: '/clientes', etiqueta: 'Clientes y accesos', mostrar: esSuperadmin }
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
          {accesos.filter(a => a.mostrar).map(a => (
            <Link key={a.ruta} to={a.ruta}
                  className={'enlace-lateral' + (activa(pathname, a.ruta) ? ' activo' : '')}>
              {a.etiqueta}
            </Link>
          ))}
          {configuracion.some(a => a.mostrar) && (
            <>
              <span className="micro apagado etiqueta-lateral">Configuración</span>
              {configuracion.filter(a => a.mostrar).map(a => (
                <Link key={a.ruta} to={a.ruta}
                      className={'enlace-lateral' + (activa(pathname, a.ruta) ? ' activo' : '')}>
                  {a.etiqueta}
                </Link>
              ))}
            </>
          )}
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
          <button type="button" className="boton boton-texto" style={{ padding: 0 }} onClick={salir}>
            Salir
          </button>
        </div>
      </nav>

      <div className={'area-escritorio' + (anchoCompleto ? ' ancho-completo' : '')}>
        {/* En el teléfono la barra lateral no existe (se oculta con CSS), así
            que sin esto "Cambiar de área" no tenía dónde vivir y quedaba
            fijo en la que se eligió la primera vez, sin salida. */}
        {puedeConfigurar && (
          <div className="barra-area-movil">
            <button type="button" onClick={cambiarArea}>Cambiar de área</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
