import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { supabase } from '../lib/supabase';
import { limpiarArea } from '../lib/area';

function activa(pathname, ruta) {
  return pathname === ruta || pathname.startsWith(ruta + '/');
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

  const accesos = esCliente
    ? [
        {
          ruta: '/portal',
          etiqueta: alertasMantencion > 0 ? `Mi portal (${alertasMantencion})` : 'Mi portal',
          mostrar: true
        }
      ]
    : [
        { ruta: '/inicio', etiqueta: 'Inicio', mostrar: true },
        { ruta: '/pipeline', etiqueta: 'Pipeline comercial', mostrar: puedeConfigurar },
        { ruta: '/nuevo', etiqueta: 'Nuevo levantamiento', mostrar: puedeConfigurar },
        { ruta: '/comunidades', etiqueta: alertasMantencion > 0 ? `Comunidades (${alertasMantencion})` : 'Comunidades', mostrar: true },
        { ruta: '/plantillas', etiqueta: 'Plantillas', mostrar: puedeConfigurar },
        { ruta: '/equipo', etiqueta: 'Equipo y permisos', mostrar: esAdministracion },
        { ruta: '/clientes', etiqueta: 'Clientes y accesos', mostrar: esSuperadmin },
        { ruta: '/mapa', etiqueta: 'Mapa', mostrar: true }
      ];

  const inicio = esCliente ? '/portal' : '/inicio';

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
                    onClick={() => { limpiarArea(); navegar('/'); }}>
              Cambiar de área
            </button>
          )}
          <button type="button" className="boton boton-texto" style={{ padding: 0 }} onClick={salir}>
            Salir
          </button>
        </div>
      </nav>

      <div className={'area-escritorio' + (anchoCompleto ? ' ancho-completo' : '')}>
        {children}
      </div>
    </div>
  );
}
