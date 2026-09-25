import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../../lib/sesion';
import { inicioSegunArea } from '../../lib/area';

/* Ajustes que se tocan poco, no trabajo del día: equipo y accesos de
 * clientes. Alcanzable directo desde la capa de selección al entrar, junto
 * a CRM y Operación. */
export default function Configuracion() {
  const { perfil } = useSesion();
  const navegar = useNavigate();

  const esAdministracion = perfil && ['superadmin', 'admin'].includes(perfil.rol);
  const esSuperadmin = perfil?.rol === 'superadmin';

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar(inicioSegunArea())}>
            ‹ Inicio
          </button>
        </div>
        <h1 className="h3">Configuración</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          Equipo y accesos de clientes.
        </p>
      </header>

      <div className="cuerpo">
        {esAdministracion && (
          <Link to="/equipo" className="acceso">
            <span>Equipo y permisos</span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        {esSuperadmin && (
          <Link to="/clientes" className="acceso">
            <span>Clientes y accesos</span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>
    </div>
  );
}
