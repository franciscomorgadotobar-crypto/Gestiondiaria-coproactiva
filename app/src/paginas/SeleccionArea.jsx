import { useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { guardarArea } from '../lib/area';

/* Capa previa a entrar a la app, para roles que tienen acceso tanto al CRM
 * como a la operación (admin, jefatura, superadmin). Sin esto el Pipeline
 * era un enlace más entre varios en el menú lateral y no se notaba que ahí
 * vivía "el CRM". Terreno y demás roles sin acceso al CRM nunca ven esta
 * pantalla: van directo a Inicio.
 *
 * La elección se guarda en el navegador; "Cambiar de área" en el panel la
 * borra y vuelve a mostrar esta pantalla. */
export default function SeleccionArea() {
  const { perfil, salir } = useSesion();
  const navegar = useNavigate();

  function elegir(area) {
    guardarArea(area);
    // Nunca "/": esta pantalla ya está montada ahí, y navegar a la misma
    // ruta en la que se está no vuelve a renderizar nada en React Router.
    navegar(area === 'crm' ? '/pipeline' : '/inicio', { replace: true });
  }

  return (
    <div className="pantalla" style={{ justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
        <img src={import.meta.env.BASE_URL + 'logo-coproactiva.svg'}
             alt="CoproActiva" style={{ height: 26, marginBottom: 28 }} />

        <h1 className="h2" style={{ marginBottom: 6 }}>
          Hola{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''}
        </h1>
        <p className="chico apagado" style={{ margin: '0 0 26px' }}>
          ¿En qué área vas a trabajar?
        </p>

        <div className="seleccion-area-grid">
          <button type="button" className="tarjeta seleccion-area-opcion" onClick={() => elegir('crm')}>
            <span className="seleccion-area-etiqueta">CRM</span>
            <h2 className="h4" style={{ margin: '6px 0 4px' }}>Gestión comercial</h2>
            <p className="chico apagado" style={{ margin: 0 }}>
              Leads, pipeline y diagnóstico comercial de prospectos.
            </p>
          </button>

          <button type="button" className="tarjeta seleccion-area-opcion" onClick={() => elegir('operacion')}>
            <span className="seleccion-area-etiqueta">Levantamientos</span>
            <h2 className="h4" style={{ margin: '6px 0 4px' }}>Operación</h2>
            <p className="chico apagado" style={{ margin: 0 }}>
              Comunidades administradas, levantamientos y mantención.
            </p>
          </button>
        </div>

        <p className="micro" style={{ marginTop: 22 }}>
          Puedes cambiar de área cuando quieras desde el panel.
        </p>
        <p className="micro" style={{ marginTop: 10 }}>
          <button type="button" className="boton boton-texto" style={{ padding: 0 }} onClick={salir}>
            Salir
          </button>
        </p>
      </div>
    </div>
  );
}
