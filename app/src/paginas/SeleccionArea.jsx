import {useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useSesion} from '../lib/sesion';
import {guardarArea} from '../lib/area';
import {registrarIndiceSelector} from '../lib/historialSelector';
import {areasDisponibles,enlacesAdministracion} from '../lib/selectorModulos';
import Campana from '../componentes/Campana';
import './SeleccionArea.css';

const PRESENTACION={
  jarvis:{icono:'jarvis',texto:'Lo que viene y lo que hay que hacer en toda la gestión.'},
  comercial:{icono:'comercial',texto:'Leads, oportunidades y herramientas comerciales.'},
  operacion:{icono:'operacion',texto:'Gestión diaria, comunidades y mantenciones.'},
  finanzas:{icono:'finanzas',texto:'Contabilidad, reportes y control financiero.'},
  documental:{icono:'documental',texto:'Documentos, plantillas y archivos de trabajo.'},
  aprendizaje:{icono:'aprendizaje',texto:'Manuales, procedimientos y material de apoyo.'}
};
function IconoArea({tipo}){
  const comun={fill:'none',stroke:'currentColor',strokeWidth:1.85,strokeLinecap:'round',strokeLinejoin:'round'};
  const dibujos={
    jarvis:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></>,
    comercial:<><path d="m3 9 5-5 5 3 3-2 5 5-5 6-4 4-4-3-5-5Z"/><path d="m8 10 4 4 3-2 4 2M6 14l4 4m4-9-3 3"/></>,
    operacion:<><path d="M4 21V5l9-3v19M13 9h7v12M2 21h20"/><path d="M8 7h1m-1 4h1m-1 4h1m8-2h1m-1 4h1"/></>,
    finanzas:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    documental:<><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h5"/></>,
    aprendizaje:<><path d="M12 6c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Zm0 0v15"/></>
  };
  return <svg viewBox="0 0 24 24" width="29" height="29" aria-hidden="true" {...comun}>{dibujos[tipo]||dibujos.aprendizaje}</svg>;
}
function Flecha({abierta=false}){
  return <svg className={abierta?'girada':''} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>;
}

/** Home principal: reutiliza el mismo catálogo de rutas y permisos que el lateral. */
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
  const administracion=enlacesAdministracion(perfil);
  const [areaAbierta,setAreaAbierta]=useState(null);
  const [administracionAbierta,setAdministracionAbierta]=useState(false);
  const nombre=perfil?.nombre?.trim()?.split(' ')[0]||'';
  const iniciales=(perfil?.nombre||'Usuario').trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase();
  function entrar(area,ruta){
    guardarArea(area.area);
    navegar(ruta,{state:{desdeSelectorCoproactiva:true}});
  }
  return <main className="pantalla seleccion-home seleccion-home-areas">
    <header className="seleccion-home__barra">
      <div className="seleccion-home__barra-marca">
        <img className="seleccion-home__marca" src={import.meta.env.BASE_URL+'brand/imagologo-horizontal-naranja.svg'} alt="Coproactiva"/>
        <span className="seleccion-home__barra-separador" aria-hidden="true"/>
        <span className="seleccion-home__barra-titulo">Home principal</span>
      </div>
      <div className="seleccion-home__barra-acciones">
        <div className="seleccion-home__administracion">
          <button type="button" className="seleccion-home__ajustes-enlace"
            aria-label="Administración y ajustes" aria-expanded={administracionAbierta} aria-controls="home-administracion"
            onClick={()=>setAdministracionAbierta(v=>!v)}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 14 5l2.4-.4 1.1 2.2 2.3 1-.3 2.5 1.5 1.7-1.5 1.8.3 2.5-2.3 1-1.1 2.2-2.4-.4-2 1.4-2-1.4-2.4.4-1.1-2.2-2.3-1 .3-2.5L3 12l1.5-1.7-.3-2.5 2.3-1 1.1-2.2L10 5Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Administración y ajustes</span>
          </button>
          {administracionAbierta&&<div id="home-administracion" className="seleccion-home__ajustes-opciones">
            {administracion.map(enlace=><button key={enlace.ruta} type="button" onClick={()=>navegar(enlace.ruta)}>
              <span>{enlace.etiqueta}</span><Flecha/>
            </button>)}
          </div>}
        </div>
        <Campana miId={perfil?.id}/>
        <span className="seleccion-home__avatar" title={perfil?.nombre||'Usuario'} aria-label={'Usuario '+(perfil?.nombre||'')}>{iniciales}</span>
      </div>
    </header>
    <div className="seleccion-home__contenido">
      <section className="seleccion-home__introduccion" aria-label="Home principal">
        <span className="seleccion-home__acento" aria-hidden="true"/>
        <h1>Hola{nombre?', '+nombre:''} <span aria-hidden="true">👋</span></h1>
        <p>Selecciona el área en la que vas a trabajar.</p>
      </section>
      <nav className="seleccion-home__tarjetas" aria-label="Áreas de trabajo">
        {areas.map(area=>{
          const vista=PRESENTACION[area.id]||{icono:'aprendizaje',texto:area.descripcion};
          const abierta=areaAbierta===area.id;
          return <div key={area.id} className={'seleccion-home__grupo seleccion-home__grupo--'+vista.icono+(abierta?' abierto':'')}>
            <button type="button" className="seleccion-home__tarjeta"
              onClick={()=>area.directo?entrar(area,area.ruta):setAreaAbierta(v=>v===area.id?null:area.id)}
              aria-expanded={area.directo?undefined:abierta} aria-controls={area.directo?undefined:'home-area-'+area.id}
              aria-label={(area.directo?'Abrir ':'Mostrar opciones de ')+area.titulo}>
              <span className="seleccion-home__icono"><IconoArea tipo={vista.icono}/></span>
              <span className="seleccion-home__detalle"><strong className="seleccion-home__titulo">{area.titulo}</strong>
                <span className="seleccion-home__descripcion">{vista.texto}</span></span>

            </button>
            {!area.directo&&<div id={'home-area-'+area.id} className="seleccion-home__submodulos" hidden={!abierta}>
              {area.enlaces.map(enlace=><button key={enlace.ruta} className="seleccion-home__submodulo" type="button" onClick={()=>entrar(area,enlace.ruta)}>
                <span>{enlace.etiqueta}</span><Flecha/>
              </button>)}
            </div>}
          </div>;
        })}
      </nav>
      <footer className="seleccion-home__pie">
        <button className="seleccion-home__salir" type="button" onClick={salir}>Cerrar sesión</button>
      </footer>
    </div>
  </main>;
}
