import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import './Levantamientos.css';

export default function Levantamientos() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  useVolverGlobal(() => navegar('/inicio'));

  const puedeEditarPlantillas = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);

  return (
    <div className="pantalla levantamientos-pantalla">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto levantamientos-volver" onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
        </div>
        <h1 className="h3">Levantamientos</h1>
        <p className="chico apagado levantamientos-bajada">
          Realiza revisiones con pauta o registra novedades de una comunidad.
        </p>
      </header>

      <div className="cuerpo levantamientos-cuerpo">
        <div className="levantamientos-opciones">
          <Link to="/nuevo" className="tarjeta levantamientos-opcion">
            <span className="levantamientos-icono" aria-hidden="true">☑</span>
            <span className="levantamientos-opcion-texto">
              <strong>Nuevo levantamiento</strong>
              <small>Usa una plantilla para realizar una inspección estructurada.</small>
            </span>
            <span className="levantamientos-flecha" aria-hidden="true">›</span>
          </Link>

          <Link to="/bitacora" className="tarjeta levantamientos-opcion">
            <span className="levantamientos-icono" aria-hidden="true">▤</span>
            <span className="levantamientos-opcion-texto">
              <strong>Bitácora</strong>
              <small>Registro de novedades en la comunidad.</small>
            </span>
            <span className="levantamientos-flecha" aria-hidden="true">›</span>
          </Link>

          <Link to="/plantillas" className="tarjeta levantamientos-opcion">
            <span className="levantamientos-icono" aria-hidden="true">☷</span>
            <span className="levantamientos-opcion-texto">
              <strong>Plantillas</strong>
              <small>
                {puedeEditarPlantillas
                  ? 'Administra las pautas de levantamiento y descarga sus guías.'
                  : 'Consulta y descarga las guías de levantamiento.'}
              </small>
            </span>
            <span className="levantamientos-flecha" aria-hidden="true">›</span>
          </Link>
        </div>

        <aside className="levantamientos-guia">
          <span className="levantamientos-guia-icono" aria-hidden="true">💡</span>
          <div>
            <strong>¿Cuál usar?</strong>
            <p>
              Usa <b>Levantamiento</b> para inspecciones estructuradas con plantilla.
              Usa <b>Bitácora</b> para registrar novedades u observaciones rápidas de una comunidad.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
