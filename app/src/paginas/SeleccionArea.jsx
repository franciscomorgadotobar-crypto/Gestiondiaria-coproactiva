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
 * La elección de CRM, Operación o Propiedades se guarda en el navegador;
 * "Cambiar de área" en el panel la borra y vuelve a mostrar esta pantalla.
 * Propiedades es de los mismos roles: las publicaciones de arriendo y venta
 * del sitio no son trabajo de terreno. Configuración
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
    const destino = { crm: '/pipeline', propiedades: '/propiedades', proveedores: '/proveedores', contabilidad: '/contabilidad', whatsapp: '/whatsapp', seo: '/seo' }[area] ?? '/inicio';
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

  const modulos = [
    {
      area: 'crm', etiqueta: 'CRM', titulo: 'Gestión comercial',
      descripcion: 'Leads, pipeline y diagnóstico comercial de prospectos.', visible: true
    },
    {
      area: 'operacion', etiqueta: 'OPERACIONES', titulo: 'Levantamientos',
      descripcion: 'Comunidades administradas, levantamientos y mantención.', visible: true
    },
    {
      area: 'propiedades', etiqueta: 'PROPIEDADES', titulo: 'Arriendos y ventas',
      descripcion: 'Lo que se publica en coproactiva.cl/propiedades.', visible: true
    },
    {
      area: 'proveedores', etiqueta: 'PROVEEDORES', titulo: 'Red de proveedores',
      descripcion: 'Buscar, contactar y administrar proveedores para las comunidades.', visible: puedeConfigurar
    },
    {
      area: 'whatsapp', etiqueta: 'WHATSAPP', titulo: 'Recepción y atención',
      descripcion: 'Solicitudes, cotizaciones y conversaciones con administración.', visible: puedeConfigurar
    },
    {
      area: 'contabilidad', etiqueta: 'CONTABILIDAD', titulo: 'Gestión contable',
      descripcion: 'Asientos, libros, estados financieros e informes por entidad.', visible: puedeConfigurar
    },
    {
      area: 'seo', etiqueta: 'MARKETING', titulo: 'SEO y Analítica',
      descripcion: 'Search Console, Analytics, indexación, velocidad y oportunidades web.', visible: puedeConfigurar
    },
    {
      area: 'configuracion', etiqueta: 'AJUSTES', titulo: 'Configuración',
      descripcion: 'Equipo y clientes.', visible: puedeConfigurar
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
              onClick={() => modulo.area === 'configuracion'
                ? navegar('/configuracion')
                : elegir(modulo.area)}
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

        <footer className="seleccion-home__pie">
          <p>Puedes cambiar de área cuando quieras desde el panel.</p>
          <button className="seleccion-home__salir" type="button" onClick={salir}>Salir</button>
        </footer>
      </div>
    </main>
  );
}
