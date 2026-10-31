import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { guardarArea } from '../lib/area';
import { registrarIndiceSelector } from '../lib/historialSelector';
import { leerOrganizacion, guardarOrganizacion, modulosDisponibles } from '../lib/selectorModulos';
import Campana from '../componentes/Campana';
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
  const opcionesVistaRef = useRef(null);
  const [mostrarOpcionesVista, setMostrarOpcionesVista] = useState(false);

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
    const destino = { comercial: '/pipeline', finanzas: '/contabilidad' }[area] ?? '/inicio';
    navegar(destino, { state: { desdeSelectorCoproactiva: true } });
  }

  function elegirModulo(modulo) {
    // Se conserva el área de la ruta para Volver, enlaces compartidos y
    // barra móvil. No se añade ningún permiso ni ruta.
    if (modulo.area) guardarArea(modulo.area);
    navegar(modulo.ruta, { state: { desdeSelectorCoproactiva: true } });
  }

  // Mismo catálogo autorizado para pantalla inicial y navegación de escritorio.
  // No confundir organización por módulos/áreas con formato lista/cuadrícula.
  const [organizacion, setOrganizacion] = useState(() => leerOrganizacion(perfil?.id));
  const cambiarOrganizacion = modo => {
    setOrganizacion(modo);
    guardarOrganizacion(perfil?.id, modo);
  };


  // Dos presentaciones del mismo selector. No afecta rutas ni roles autorizados.
  const [vista, setVista] = useState(() => {
    try {
      const guardada = window.localStorage.getItem('coproactiva_selector_vista');
      if (guardada === 'lista' || guardada === 'cuadricula') return guardada;
    } catch { /* Navegación privada o almacenamiento deshabilitado. */ }
    return window.matchMedia('(min-width: 720px)').matches ? 'cuadricula' : 'lista';
  });

  const cambiarVista = siguiente => {
    if (!['lista', 'cuadricula'].includes(siguiente)) return;
    setVista(siguiente);
    try { window.localStorage.setItem('coproactiva_selector_vista', siguiente); }
    catch { /* La vista funciona aunque no se pueda guardar. */ }
  };

  useEffect(() => {
    if (!mostrarOpcionesVista) return undefined;
    const cerrarExterior = evento => {
      if (!opcionesVistaRef.current?.contains(evento.target)) {
        setMostrarOpcionesVista(false);
      }
    };
    const cerrarEscape = evento => {
      if (evento.key === 'Escape') setMostrarOpcionesVista(false);
    };
    document.addEventListener('pointerdown', cerrarExterior);
    document.addEventListener('keydown', cerrarEscape);
    return () => {
      document.removeEventListener('pointerdown', cerrarExterior);
      document.removeEventListener('keydown', cerrarEscape);
    };
  }, [mostrarOpcionesVista]);

  // Tres áreas de trabajo; Administración y ajustes aparece debajo como
  // acceso secundario, sin cambiar el área que el usuario tenía seleccionada.
  // Los permisos de SEO, proveedores, WhatsApp y contabilidad no cambian.
  const areas = [
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
  const opciones = organizacion === 'modulos' ? modulosDisponibles(perfil) : areas;

  return (
    <main className="pantalla seleccion-home">
      <div className="seleccion-home__contenido">
        <header className="seleccion-home__cabecera">
          <img
            className="seleccion-home__marca"
            src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'}
            alt="Coproactiva"
          />
          <div className="seleccion-home__selector-vistas" ref={opcionesVistaRef}>
            <button
              className="seleccion-home__cambiar"
              type="button"
              aria-label="Cambiar vista"
              aria-expanded={mostrarOpcionesVista}
              aria-haspopup="dialog"
              aria-controls="seleccion-home-opciones-vista"
              onClick={() => setMostrarOpcionesVista(actual => !actual)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.4" />
                <rect x="14" y="3" width="7" height="7" rx="1.4" />
                <rect x="3" y="14" width="7" height="7" rx="1.4" />
                <rect x="14" y="14" width="7" height="7" rx="1.4" />
              </svg>
              <span className="seleccion-home__cambiar-etiqueta">
                <strong>Cambiar vista</strong>
                <small>{organizacion === 'areas' ? 'Por áreas' : 'Por módulos'} · {vista === 'lista' ? 'Lista' : 'Cuadrícula'}</small>
              </span>
              <svg className={mostrarOpcionesVista ? 'seleccion-home__desplegable-abierto' : ''}
                viewBox="0 0 24 24" width="15" height="15" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </button>
            {mostrarOpcionesVista && (
              <div id="seleccion-home-opciones-vista"
                className="seleccion-home__menu-vistas"
                role="dialog" aria-modal="false" aria-label="Opciones de visualización">
                <div className="seleccion-home__menu-vistas-cabecera">
                  <strong>Personalizar vista</strong>
                  <button type="button" aria-label="Cerrar opciones de vista"
                    onClick={() => setMostrarOpcionesVista(false)}>×</button>
                </div>
                <div className="seleccion-home__grupo-vistas"
                  role="group" aria-label="Organización">
                  <span>Organizar por</span>
                  <div className="seleccion-home__botones-vistas">
                    <button type="button" aria-pressed={organizacion === 'areas'}
                      className={organizacion === 'areas' ? 'activo' : ''}
                      onClick={() => cambiarOrganizacion('areas')}>Por áreas</button>
                    <button type="button" aria-pressed={organizacion === 'modulos'}
                      className={organizacion === 'modulos' ? 'activo' : ''}
                      onClick={() => cambiarOrganizacion('modulos')}>Por módulos</button>
                  </div>
                </div>
                <div className="seleccion-home__grupo-vistas"
                  role="group" aria-label="Presentación">
                  <span>Mostrar como</span>
                  <div className="seleccion-home__botones-vistas">
                    <button type="button" aria-pressed={vista === 'lista'}
                      className={vista === 'lista' ? 'activo' : ''}
                      onClick={() => cambiarVista('lista')}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                      </svg>
                      Lista
                    </button>
                    <button type="button" aria-pressed={vista === 'cuadricula'}
                      className={vista === 'cuadricula' ? 'activo' : ''}
                      onClick={() => cambiarVista('cuadricula')}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                        stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1.2"/>
                        <rect x="14" y="3" width="7" height="7" rx="1.2"/>
                        <rect x="3" y="14" width="7" height="7" rx="1.2"/>
                        <rect x="14" y="14" width="7" height="7" rx="1.2"/>
                      </svg>
                      Cuadrícula
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Campana miId={perfil?.id} />
        </header>

        <section className="seleccion-home__introduccion" aria-label="Selección de destino">
          <h1>Hola{perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}</h1>
          <p>{organizacion === 'modulos' ? '¿Qué módulo quieres abrir?' : '¿En qué área vas a trabajar?'}</p>
        </section>

        <div className={'seleccion-area-grid seleccion-home__tarjetas ' +
          (puedeConfigurar ? 'dos ' : '') +
          (vista === 'cuadricula' ? 'vista-cuadricula' : 'vista-lista')}>
          {opciones.map(modulo => (
            <button
              key={modulo.id || modulo.area}
              type="button"
              className="tarjeta seleccion-area-opcion seleccion-home__tarjeta"
              onClick={() => organizacion === 'modulos' ? elegirModulo(modulo) : elegir(modulo.area)}
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

        {puedeConfigurar && organizacion === 'areas' && (
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
          <p>Puedes volver al selector y cambiar la organización cuando quieras, sin perder tus módulos.</p>
          <button className="seleccion-home__salir" type="button" onClick={salir}>Salir</button>
        </footer>
      </div>
    </main>
  );
}
