import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconoNavegacion, { iconoRutaCoproactiva } from './IconoNavegacion';
import {
  SEO_ACCESOS_DIRECTOS, SEO_MENU_PARAMETRO,
  abrirMenuSEO, cerrarMenuSEO, seleccionarSeccionSEO
} from '../lib/seoNavegacion';

function IconoSEO({ tipo }) {
  const comun = {
    width: 22, height: 22, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
  };
  if (tipo === 'resumen') return <svg {...comun}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>;
  if (tipo === 'consultas') return <svg {...comun}><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5M8.5 11h4.5"/></svg>;
  if (tipo === 'oportunidades') return <svg {...comun}><path d="M9 18h6M10 21h4M8 15.8C6.3 14.6 5.5 12.8 5.5 10.3a6.5 6.5 0 1 1 13 0c0 2.5-.8 4.3-2.5 5.5-.7.5-1 1.1-1 2.2h-6c0-1.1-.3-1.7-1-2.2Z"/><path d="m10 11 1.4 1.4L14 9.8"/></svg>;
  if (tipo === 'seguimiento') return <svg {...comun}><path d="M4 19V5M4 19h17M7 15l4-4 3 2 6-7"/><path d="m17 6 3 0 0 3"/></svg>;
  if (tipo === 'analytics') return <svg {...comun}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>;
  if (tipo === 'business') return <svg {...comun}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>;
  if (tipo === 'tecnico') return <svg {...comun}><path d="m9 7-5 5 5 5M15 7l5 5-5 5M13.7 4l-3.4 16"/></svg>;
  if (tipo === 'velocidad') return <svg {...comun}><path d="M4.8 18a9 9 0 1 1 14.4 0H4.8Z"/><path d="m12 14 4.7-5.7"/><circle cx="12" cy="14" r="1.2"/><path d="M12 5v2M5.7 10.5l1.7.7M18.3 10.5l-1.7.7"/></svg>;
  if (tipo === 'tagmanager') return <svg {...comun}><path d="M5 3h14v18H5zM8 7h8M8 11h5M8 15h8"/><circle cx="17" cy="16" r="1.7"/></svg>;
  if (tipo === 'conexiones') return <svg {...comun}><path d="M4 7h16M4 17h16M9 5v4M15 15v4"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>;
  if (tipo === 'diagnostico') return <svg {...comun}><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3"/><circle cx="17.5" cy="17.5" r="3"/><path d="m20 20 2 2"/></svg>;
  return <svg {...comun}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

/* `enlacesArea`: otras secciones del grupo Comercial (Pipeline, Arriendos y
 * ventas). Van al final de «Más» porque SEO usa su propia barra inferior. */
export default function BarraNavegacionSEO({ vista, secciones, vistasValidas, onSeleccionar, enlacesArea = [] }) {
  const [parametros, setParametros] = useSearchParams();
  const navegar = useNavigate();
  const abiertoDesdeAqui = useRef(false);
  const botonMas = useRef(null);
  const botonCerrar = useRef(null);
  const menuAbierto = parametros.get(SEO_MENU_PARAMETRO) === 'mas';

  const opciones = [
    ...secciones.map(([id, etiqueta]) => ({ id, etiqueta })),
    { id: 'diagnostico', etiqueta: 'Diagnóstico' }
  ];
  const principales = SEO_ACCESOS_DIRECTOS.map(id => opciones.find(item => item.id === id)).filter(Boolean);
  const adicionales = opciones.filter(item => !SEO_ACCESOS_DIRECTOS.includes(item.id));
  const masActivo = menuAbierto || adicionales.some(item => item.id === vista);

  function abrirMas() {
    if (menuAbierto) return cerrarMas();
    abiertoDesdeAqui.current = true;
    setParametros(actual => abrirMenuSEO(actual), { preventScrollReset: true });
  }

  function cerrarMas() {
    if (!menuAbierto) return;
    if (abiertoDesdeAqui.current) {
      abiertoDesdeAqui.current = false;
      navegar(-1); // Atrás cierra únicamente la hoja «Más».
    } else {
      setParametros(actual => cerrarMenuSEO(actual),
        { replace: true, preventScrollReset: true });
    }
  }

  function irArea(ruta) {
    // Reemplaza la entrada temporal de «Más»: Atrás vuelve a SEO.
    abiertoDesdeAqui.current = false;
    navegar(ruta, { replace: true });
  }

  function seleccionar(id) {
    if (!vistasValidas.includes(id)) return;
    if (id === vista && !menuAbierto) return;
    setParametros(actual => seleccionarSeccionSEO(actual, id, vistasValidas),
      { replace: menuAbierto, preventScrollReset: true });
    abiertoDesdeAqui.current = false;
    onSeleccionar?.(id);
    requestAnimationFrame(() => {
      document.querySelector('.seo-cuerpo')?.scrollIntoView({
        behavior: 'smooth', block: 'start'
      });
    });
  }

  useEffect(() => {
    if (!menuAbierto) return undefined;
    botonCerrar.current?.focus({ preventScroll: true });
    const tecla = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarMas();
      }
      if (e.key !== 'Tab') return;
      const botones = Array.from(document.querySelectorAll('.seo-menu-mas button:not([disabled])'));
      const primero = botones[0];
      const ultimo = botones[botones.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero?.focus();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      botonMas.current?.focus({ preventScroll: true });
    };
  }, [menuAbierto]);

  return (
    <>
      <nav className="barra-inferior-movil seo-barra-inferior" aria-label="Navegación inferior SEO">
        {principales.map(item => (
          <button key={item.id} type="button"
            className={'nav-movil-item' + (vista === item.id ? ' activo' : '')}
            aria-current={vista === item.id ? 'page' : undefined}
            aria-label={'Ir a ' + item.etiqueta}
            onClick={() => seleccionar(item.id)}>
            <span className="nav-movil-icono-wrap"><IconoSEO tipo={item.id}/></span>
            <span>{item.etiqueta}</span>
          </button>
        ))}
        <button type="button" ref={botonMas}
          className={'nav-movil-item' + (masActivo ? ' activo' : '')}
          aria-expanded={menuAbierto}
          aria-haspopup="dialog"
          aria-label="Más secciones SEO"
          onClick={abrirMas}>
          <span className="nav-movil-icono-wrap"><IconoSEO tipo="mas"/></span>
          <span>Más</span>
        </button>
      </nav>
      {menuAbierto && (
        <div className="menu-mas-fondo seo-menu-mas-fondo" role="presentation" onClick={cerrarMas}>
          <div className="menu-mas seo-menu-mas" role="dialog" aria-modal="true" aria-label="Más secciones SEO"
            onClick={e => e.stopPropagation()}>
            <div className="menu-mas-cabecera">
              <strong>Más secciones SEO</strong>
              <button ref={botonCerrar} type="button" aria-label="Cerrar menú SEO" onClick={cerrarMas}>×</button>
            </div>
            <div className="menu-mas-enlaces seo-menu-mas-enlaces">
              {adicionales.map(item => (
                <button key={item.id} type="button"
                  className={vista === item.id ? 'activo' : ''}
                  aria-current={vista === item.id ? 'page' : undefined}
                  onClick={() => seleccionar(item.id)}>
                  <span className="seo-menu-item-label"><IconoSEO tipo={item.id}/>{item.etiqueta}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
              {enlacesArea.length > 0 && <p className="seo-menu-grupo">Comercial</p>}
              {enlacesArea.map(enlace => (
                <button key={enlace.ruta} type="button" onClick={() => irArea(enlace.ruta)}>
                  <span className="seo-menu-item-label"><IconoNavegacion tipo={iconoRutaCoproactiva(enlace.ruta)} size={22}/>{enlace.etiqueta}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
