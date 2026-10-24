import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { guardarArea } from '../lib/area';
import { registrarIndiceSelector } from '../lib/historialSelector';
import './SeleccionArea.css';

/* Capa previa a entrar a la app, para roles que tienen acceso tanto al CRM
 * como a la operación (admin, jefatura, superadmin). Sin esto el Pipeline
 * era un enlace más entre varios en el menú lateral y no se notaba que ahí
 * vivía "el CRM". Terreno y demás roles sin acceso al CRM nunca ven esta
 * pantalla: van directo a Inicio.
 *
 * La elección de Comercial, Operaciones o Finanzas se guarda en el navegador;
 * "Cambiar de área" en el panel la borra y vuelve a mostrar esta pantalla.
 * Arriendos y ventas va en Comercial y es de los mismos roles: las
 * publicaciones del sitio no son trabajo de terreno. Configuración
 * no se guarda como área: no es un modo de trabajo del día a día, es una
 * visita ocasional, así que entrar ahí no cambia a qué área se vuelve
 * después. */
export default function SeleccionArea() {
  const { perfil, salir } = useSesion();
  const navegar = useNavigate();
  const location = useLocation();

  useEffect(() => {
    registrarIndiceSelector(window.history.state?.idx);
    if (location.state?.selectorCoproactiva === true) return;
    // Esta entrada representa el selector en el historial, para que
    // Android Atrás vuelva aquí desde el módulo que se elija después.
    navegar('/', { replace: true, state: { selectorCoproactiva: true },
      preventScrollReset: true });
  }, [location.state?.selectorCoproactiva, navegar]);

  // Equipo y Clientes son de administración: jefatura trabaja CRM y
  // Operación, pero no tiene nada que configurar ahí.
  const puedeConfigurar = ['superadmin', 'admin'].includes(perfil?.rol);

  function elegir(area) {
    guardarArea(area);
    // Nunca "/": esta pantalla ya está montada ahí, y navegar a la misma
    // ruta en la que se está no vuelve a renderizar nada en React Router.
    const destino = { comercial: '/pipeline', finanzas: '/contabilidad' }[area] ?? '/inicio';
    navegar(destino, { state: { desdeSelectorCoproactiva: true } }); // Push: Atrás regresa a la selección.
  }


  // Dos presentaciones del mismo selector. No afecta rutas ni roles autorizados.
  const [vista, setVista] = useState(() => {
    try {
      const guardada = window.localStorage.getItem('coproactiva_selector_vista');
      if (guardada === 'lista' || guardada === 'cuadricula') return guardada;
    } catch { /* Navegación privada o almacenamiento deshabilitado. */ }
    return window.matchMedia('(min-width: 720px)').matches ? 'cuadricula' : 'lista';
  });

  const alternarVista = () => {
    const siguiente = vista === 'lista' ? 'cuadricula' : 'lista';
    setVista(siguiente);
    try { window.localStorage.setItem('coproactiva_selector_vista', siguiente); }
    catch { /* La vista funciona aunque no se pueda guardar. */ }
  };

  // Tres áreas de trabajo; Administración y ajustes aparece debajo como
  // acceso secundario, sin cambiar el área que el usuario tenía seleccionada.
  // Los permisos de SEO, proveedores, WhatsApp y contabilidad no cambian.
  const modulos = [
    {
      area: 'comercial', etiqueta: 'COMERCIAL', titulo: 'Gestión comercial',
      descripcion: puedeConfigurar
        ? 'Pipeline y diagnóstico de prospectos, arriendos y ventas, SEO y analítica.'
        : 'Pipeline y diagnóstico de prospectos, arriendos y ventas.',
      visible: true
    },
    {
      area: 'operacion', etiqueta: 'OPERACIONES', titulo: 'Operación de comunidades',
      descripcion: puedeConfigurar
        ? 'Comunidades, levantamientos, mantenciones, bitácora, proveedores y recepción WhatsApp.'
        : 'Comunidades, levantamientos, mantenciones y bitácora.',
      visible: true
    },
    {
      area: 'finanzas', etiqueta: 'FINANZAS', titulo: 'Gestión contable',
      descripcion: 'Asientos, libros, estados financieros e informes por entidad.', visible: puedeConfigurar
    }
  ].filter(modulo => modulo.visible);

  return (
    <main className="pantalla seleccion-home">
      <div className="seleccion-home__contenido">
        <header className="seleccion-home__cabecera">
          <img
            className="seleccion-home__marca"
            src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'}
            alt="Coproactiva"
          />
          <button
            className="seleccion-home__cambiar"
            type="button"
            onClick={alternarVista}
            aria-label={'Cambiar a vista en ' + (vista === 'lista' ? 'cuadrícula' : 'lista')}
            title={'Cambiar a vista en ' + (vista === 'lista' ? 'cuadrícula' : 'lista')}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.4" />
              <rect x="14" y="3" width="7" height="7" rx="1.4" />
              <rect x="3" y="14" width="7" height="7" rx="1.4" />
              <rect x="14" y="14" width="7" height="7" rx="1.4" />
            </svg>
            <span>Cambiar vista</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>
        </header>

        <section className="seleccion-home__introduccion" aria-label="Selección de área">
          <h1>Hola{perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}</h1>
          <p>¿En qué área vas a trabajar?</p>
        </section>

        <div className={'seleccion-area-grid seleccion-home__tarjetas ' +
          (puedeConfigurar ? 'dos ' : '') +
          (vista === 'cuadricula' ? 'vista-cuadricula' : 'vista-lista')}>
          {modulos.map(modulo => (
            <button
              key={modulo.area}
              type="button"
              className="tarjeta seleccion-area-opcion seleccion-home__tarjeta"
              onClick={() => elegir(modulo.area)}
            >
              <span className="seleccion-home__detalle">
                <span className="seleccion-area-etiqueta">{modulo.etiqueta}</span>
                <span className="seleccion-home__titulo">{modulo.titulo}</span>
                <span className="seleccion-home__descripcion">{modulo.descripcion}</span>
              </span>
              <span className="seleccion-home__flecha" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {puedeConfigurar && (
          <div className="seleccion-home__administracion">
            <button type="button" className="seleccion-home__ajustes-enlace"
                    onClick={() => navegar('/configuracion')}>
              <span className="seleccion-home__ajustes-icono" aria-hidden="true">⚙</span>
              <span className="seleccion-home__detalle">
                <span className="seleccion-home__ajustes-titulo">Administración y ajustes</span>
                <span className="seleccion-home__descripcion">
                  Equipo, usuarios, permisos, accesos de clientes y configuración general.
                </span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        )}

        <footer className="seleccion-home__pie">
          <p>Puedes cambiar de área cuando quieras desde el panel.</p>
          <button className="seleccion-home__salir" type="button" onClick={salir}>Salir</button>
        </footer>
      </div>
    </main>
  );
}
