import {useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useSesion} from '../lib/sesion';
import {guardarArea} from '../lib/area';
import {registrarIndiceSelector} from '../lib/historialSelector';
import {areasDisponibles,enlacesAdministracion} from '../lib/selectorModulos';
import Campana from '../componentes/Campana';
import './SeleccionArea.css';

/** Home principal: las mismas cinco áreas y permisos que el lateral.
 * No ofrece vistas alternativas ni una lista paralela de módulos. */
export default function SeleccionArea(){
  const {perfil,salir}=useSesion();
  const navegar=useNavigate();
  const location=useLocation();
  useEffect(()=>{
    registrarIndiceSelector(window.history.state?.idx);
    if(location.state?.selectorCoproactiva===true)return;
    navegar('/',{replace:true,state:{selectorCoproactiva:true},preventScrollReset:true});
  },[location.state?.selectorCoproactiva,navegar]);

  const areas=areasDisponibles(perfil);
  const [areaAbierta,setAreaAbierta]=useState(null);
  const [submenuAbierto,setSubmenuAbierto]=useState(null);
  const [administracionAbierta,setAdministracionAbierta]=useState(false);
  const administracion=enlacesAdministracion(perfil);
  const puedeAdministrar=['superadmin','admin'].includes(perfil?.rol);
  function entrar(area,ruta){
    guardarArea(area.area);
    navegar(ruta,{state:{desdeSelectorCoproactiva:true}});
  }
  function alternarArea(id){
    setAreaAbierta(actual=>actual===id?null:id);
    setSubmenuAbierto(null);
  }
  function alternarSubmenu(id){
    setSubmenuAbierto(actual=>actual===id?null:id);
  }
  return (
    <main className="pantalla seleccion-home seleccion-home-areas">
      <div className="seleccion-home__contenido">
        <header className="seleccion-home__cabecera">
          <img className="seleccion-home__marca"
            src={import.meta.env.BASE_URL+'brand/imagologo-horizontal-naranja.svg'}
            alt="Coproactiva"/>
          <Campana miId={perfil?.id}/>
        </header>
        <section className="seleccion-home__introduccion" aria-label="Home principal">
          <h1>Hola{perfil?.nombre?', '+perfil.nombre.split(' ')[0]:''}</h1>
          <p>Home principal · ¿En qué área vas a trabajar?</p>
        </section>
        <nav className="seleccion-area-grid seleccion-home__tarjetas vista-cuadricula"
             aria-label="Áreas de trabajo">
          {areas.map(area=>(
            <div key={area.id}
              className={'seleccion-home__grupo'+(areaAbierta===area.id?' abierto':'')}>
              <button type="button"
                className="tarjeta seleccion-area-opcion seleccion-home__tarjeta"
                onClick={()=>alternarArea(area.id)}
                aria-expanded={areaAbierta===area.id}
                aria-controls={'home-area-'+area.id}
                aria-label={'Mostrar opciones de '+area.titulo}>
                <span className="seleccion-home__titulo">{area.titulo}</span>
                <span className="seleccion-home__flecha" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 5 7 7-7 7"/>
                  </svg>
                </span>
              </button>
              <div id={'home-area-'+area.id} className="seleccion-home__submodulos"
                   hidden={areaAbierta!==area.id}>
                {area.secciones
                  ? area.secciones.map(seccion=>seccion.tipo==='submenu'
                    ? <div key={seccion.id} className="seleccion-home__subgrupo">
                        <button type="button" className="seleccion-home__submodulo seleccion-home__subgrupo-boton"
                          onClick={()=>alternarSubmenu(seccion.id)}
                          aria-expanded={submenuAbierto===seccion.id}
                          aria-controls={'home-subarea-'+seccion.id}>
                          <span>{seccion.titulo}</span>
                          <span className="seleccion-home__subgrupo-flecha" aria-hidden="true">
                            {submenuAbierto===seccion.id?'⌃':'⌄'}
                          </span>
                        </button>
                        <div id={'home-subarea-'+seccion.id}
                             className="seleccion-home__subgrupo-enlaces"
                             hidden={submenuAbierto!==seccion.id}>
                          {seccion.enlaces.map(enlace=>(
                            <button key={enlace.ruta} type="button"
                              className="seleccion-home__submodulo seleccion-home__submodulo-hijo"
                              onClick={()=>entrar(area,enlace.ruta)}>
                              <span>{enlace.etiqueta}</span><span aria-hidden="true">›</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    : <button key={seccion.ruta} type="button"
                        className="seleccion-home__submodulo"
                        onClick={()=>entrar(area,seccion.ruta)}>
                        <span>{seccion.etiqueta}</span><span aria-hidden="true">›</span>
                      </button>)
                  : area.enlaces.map(enlace=>(
                    <button key={enlace.ruta} type="button"
                      className="seleccion-home__submodulo"
                      onClick={()=>entrar(area,enlace.ruta)}>
                      <span>{enlace.etiqueta}</span><span aria-hidden="true">›</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="seleccion-home__administracion">
          <button type="button" className="seleccion-home__ajustes-enlace"
                  onClick={()=>setAdministracionAbierta(v=>!v)}
                  aria-expanded={administracionAbierta}
                  aria-controls="home-administracion">
            <span className="seleccion-home__ajustes-icono" aria-hidden="true">⚙</span>
            <span className="seleccion-home__detalle">
              <span className="seleccion-home__ajustes-titulo">Administración y ajustes</span>
              <span className="seleccion-home__descripcion">
                {puedeAdministrar
                  ? 'Mi cuenta, equipo, usuarios, permisos y configuración general.'
                  : 'Mi cuenta y preferencias personales.'}
              </span>
            </span>
            <span aria-hidden="true">{administracionAbierta?'⌄':'›'}</span>
          </button>
          <div id="home-administracion" className="seleccion-home__ajustes-opciones"
               hidden={!administracionAbierta}>
            {administracion.map(enlace=>(
              <button key={enlace.ruta} type="button" className="seleccion-home__submodulo"
                onClick={()=>navegar(enlace.ruta)}>
                <span>{enlace.etiqueta}</span><span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
        <footer className="seleccion-home__pie">
          <p>Las cinco áreas comparten la misma navegación del menú lateral.</p>
          <button className="seleccion-home__salir" type="button" onClick={salir}>Salir</button>
        </footer>
      </div>
    </main>
  );
}
