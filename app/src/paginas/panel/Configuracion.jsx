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
        <div className="rejilla">
          {esAdministracion && (
            <Link to="/equipo" className="tarjeta tarjeta-enlace">
              <span className="seleccion-area-etiqueta">Equipo</span>
              <h2 className="h4">Equipo y permisos</h2>
              <p className="chico apagado">Quién entra, con qué rol y qué comunidades ve.</p>
            </Link>
          )}
          {esSuperadmin && (
            <Link to="/clientes" className="tarjeta tarjeta-enlace">
              <span className="seleccion-area-etiqueta">Portal</span>
              <h2 className="h4">Clientes y accesos</h2>
              <p className="chico apagado">Cuentas de clientes y lo que puede consultar cada uno.</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
