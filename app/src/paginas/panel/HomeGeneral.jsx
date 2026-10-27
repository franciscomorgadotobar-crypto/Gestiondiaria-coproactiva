import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { guardarArea } from '../../lib/area';
import { leerOrganizacion, guardarOrganizacion, modulosDisponibles } from '../../lib/selectorModulos';
import Campana from '../../componentes/Campana';
import IconoNavegacion, { iconoRutaCoproactiva } from '../../componentes/IconoNavegacion';
import './HomeGeneral.css';

const CLAVE_VISTA = 'coproactiva_selector_vista:';
function leerVista(usuarioId) {
  try {
    const propia = usuarioId && localStorage.getItem(CLAVE_VISTA + usuarioId);
    const anterior = localStorage.getItem('coproactiva_selector_vista');
    if (propia === 'lista' || propia === 'cuadricula') return propia;
    if (anterior === 'lista' || anterior === 'cuadricula') return anterior;
  } catch { /* La vista no depende del almacenamiento local. */ }
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches
    ? 'cuadricula' : 'lista';
}

/* Un solo Home, sin selección intermedia. Recupera las dos preferencias
 * independientes del selector antiguo y comparte catálogo con la barra lateral.
 * La preferencia no modifica permisos ni rutas. */
export default function HomeGeneral() {
  const { perfil, salir } = useSesion();
  const [resumen, setResumen] = useState({ prospectos:null, compromisos:null, pendientes:null });
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set(['operaciones']));
  const [organizacion, setOrganizacion] = useState(() => leerOrganizacion(perfil?.id));
  const [vista, setVista] = useState(() => leerVista(perfil?.id));
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);
  const selectorRef = useRef(null);
  const rol = perfil?.rol;
  const comercial = ['superadmin','admin','jefatura'].includes(rol);
  const administracion = ['superadmin','admin'].includes(rol);
  const superadmin = rol === 'superadmin';

  useEffect(() => {
    setOrganizacion(leerOrganizacion(perfil?.id));
    setVista(leerVista(perfil?.id));
  }, [perfil?.id]);

  useEffect(() => {
    if (!opcionesAbiertas) return;
    const alPulsar = evento => {
      if (evento.key === 'Escape') setOpcionesAbiertas(false);
    };
    const alExterior = evento => {
      if (!selectorRef.current?.contains(evento.target)) setOpcionesAbiertas(false);
    };
    document.addEventListener('keydown', alPulsar);
    document.addEventListener('pointerdown', alExterior);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.removeEventListener('pointerdown', alExterior);
    };
  }, [opcionesAbiertas]);

  useEffect(() => {
    let activo = true;
    const consultas = [
      comercial ? supabase.from('prospectos').select('id',{head:true,count:'exact'}) : Promise.resolve({count:null}),
      comercial ? supabase.from('compromisos_administracion').select('id',{head:true,count:'exact'}).neq('estado','completado') : Promise.resolve({count:null}),
      supabase.from('controles_con_avance').select('id',{head:true,count:'exact'}).in('estado',['pendiente','en_curso','pausado'])
    ];
    Promise.all(consultas).then(([p,c,l]) => {
      if (!activo) return;
      setResumen({prospectos:p.count,compromisos:c.count,pendientes:l.count});
      setAviso([p,c,l].some(x=>x.error)
        ? 'Algunos contadores no se pudieron consultar; los módulos siguen disponibles.' : '');
    }).catch(() => {
      if (activo) setAviso('No se pudo actualizar el resumen; los módulos siguen disponibles.');
    });
    return () => { activo = false; };
  }, [perfil?.id, comercial]);

  const secciones = useMemo(() => [
    {id:'comercial', nombre:'Comercial', descripcion:'Contactos web, prospectos y seguimiento comercial.',
      area:'comercial', mostrar:comercial, enlaces:[
        ['Pipeline comercial','/pipeline','Contactos de formularios y etapas de oportunidad'],
        ['Arriendos y ventas','/propiedades','Propiedades y publicaciones'],
        ...(administracion ? [['SEO y Analítica','/seo','Resultados de la web y posicionamiento']] : []),
        ['Plantillas de correo','/plantillas-correo','Mensajes reutilizables para prospectos']
      ]},
    {id:'operaciones', nombre:'Operaciones', descripcion:'Comunidades y trabajo en terreno.',
      area:'operacion', mostrar:true, enlaces:[
        ['Levantamientos','/inicio','Pendientes y realizados por persona'],
        ['Comunidades','/comunidades','Fichas, compromisos y documentos'],
        ['Compromisos y avances','/compromisos','Etapas, fechas y responsables por comunidad'],
        ['Mantenciones','/mantenciones','Planificación y seguimiento'],
        ['Bitácora','/bitacora','Incidencias y observaciones'],
        ['Mapa','/mapa','Ubicaciones y visitas'],
        ...(administracion ? [
          ['Red de proveedores','/proveedores','Directorio y comunicaciones'],
          ['Recepción y atención','/whatsapp','Conversaciones y solicitudes']
        ] : []),
        ...(comercial ? [['Plantillas de levantamientos','/plantillas','Formularios operativos']] : [])
      ]},
    {id:'finanzas', nombre:'Finanzas', descripcion:'Gestión contable y financiera.',
      area:'finanzas', mostrar:administracion,
      enlaces:[['Gestión contable','/contabilidad','Asientos, libro mayor y estados financieros']]},
    {id:'general', nombre:'Mi espacio', descripcion:'Avisos, información y cuenta personal.',
      area:null, mostrar:true, enlaces:[
        ['Notificaciones','/notificaciones','Avisos pendientes'],
        ['Mi cuenta','/mi-cuenta','Perfil y preferencias'],
        ['Aprendizaje','/conocimientos','Guías y normativas']
      ]},
    // Configuración debe quedar siempre al final, también en vista cuadrícula.
    {id:'administracion', nombre:'Administración y ajustes',
      descripcion:'Equipo, usuarios, permisos, accesos de clientes y configuración general.',
      area:null, mostrar:administracion, enlaces:[
        ['Equipo y permisos','/equipo','Usuarios y accesos internos'],
        ...(superadmin ? [['Clientes y accesos','/clientes','Permisos del portal cliente']] : []),
        ['Configuración general','/configuracion','Ajustes de la aplicación']
      ]}
  ].filter(grupo => grupo.mostrar), [comercial,administracion,superadmin]);

  const modulos = useMemo(() => modulosDisponibles(perfil), [perfil]);
  const q = filtro.trim().toLocaleLowerCase('es-CL');
  const grupos = secciones.map(grupo => {
    const coincideGrupo = (grupo.nombre + ' ' + grupo.descripcion).toLocaleLowerCase('es-CL').includes(q);
    return { ...grupo, enlaces: grupo.enlaces.filter(
      x => !q || coincideGrupo || (x[0] + ' ' + x[2]).toLocaleLowerCase('es-CL').includes(q)
    ) };
  }).filter(grupo => grupo.enlaces.length);
  const modulosFiltrados = modulos.filter(m => !q ||
    (m.titulo + ' ' + m.descripcion + ' ' + m.etiqueta).toLocaleLowerCase('es-CL').includes(q));

  function cambiarOrganizacion(modo) {
    if (!['areas','modulos'].includes(modo)) return;
    setOrganizacion(modo);
    guardarOrganizacion(perfil?.id, modo);
    window.dispatchEvent(new Event('coproactiva:organizacion-cambio'));
  }
  function cambiarVista(modo) {
    if (!['lista','cuadricula'].includes(modo)) return;
    setVista(modo);
    try { if (perfil?.id) localStorage.setItem(CLAVE_VISTA + perfil.id, modo); }
    catch { /* Preferencia válida durante la sesión. */ }
  }
  function alternar(id) {
    setAbiertos(xs => {
      const y = new Set(xs);
      y.has(id) ? y.delete(id) : y.add(id);
      return y;
    });
  }

  return <div className="pantalla modulo-unificado home-general">
    <header className="encabezado modulo-cabecera">
      <div className="home-general-saludo">
        <div><h1 className="h3">Hola, {perfil?.nombre?.split(' ')[0] || 'equipo'}</h1>
          <p className="chico apagado">Tu espacio de trabajo · Coproactiva</p></div>
        <div className="home-general-perfil">
          <Campana miId={perfil?.id}/>
          <button type="button" className="boton boton-texto" onClick={salir}>Salir</button>
        </div>
      </div>
    </header>
    <div className="cuerpo modulo-contenido home-general-cuerpo">
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <div className="home-general-metricas" aria-label="Resumen del sistema">
        {comercial && <Link to="/pipeline" onClick={() => guardarArea('comercial')}>
          <strong>{resumen.prospectos ?? '—'}</strong><span>Prospectos</span>
          <small>Ir al Pipeline ›</small>
        </Link>}
        {comercial && <Link to="/compromisos" onClick={() => guardarArea('operacion')}>
          <strong>{resumen.compromisos ?? '—'}</strong><span>Compromisos abiertos</span>
          <small>Ver seguimiento ›</small>
        </Link>}
        <Link to="/inicio" onClick={() => guardarArea('operacion')}>
          <strong>{resumen.pendientes ?? '—'}</strong><span>Levantamientos pendientes</span>
          <small>Ver levantamientos ›</small>
        </Link>
      </div>
      <div className="home-general-cabecera">
        <div><h2 className="h4">Módulos de trabajo</h2>
          <p className="chico apagado">Accede a tus herramientas desde un solo lugar.</p></div>
        <div className="home-general-herramientas">
          <label className="home-general-buscar">
            <span className="micro">Buscar módulo</span>
            <input type="search" value={filtro} onChange={e=>setFiltro(e.target.value)}
              placeholder="Buscar…" />
          </label>
          <div className="home-general-selector" ref={selectorRef}>
            <button type="button" className="home-general-cambiar boton boton-secundario"
              aria-expanded={opcionesAbiertas} aria-haspopup="dialog"
              aria-controls="home-general-opciones-vista"
              onClick={() => setOpcionesAbiertas(a=>!a)}>
              <span><strong>Cambiar vista</strong>
                <small>{organizacion === 'areas' ? 'Por áreas' : 'Por módulos'} · {vista === 'lista' ? 'Lista' : 'Cuadrícula'}</small>
              </span>
              <span aria-hidden="true">{opcionesAbiertas ? '⌃' : '⌄'}</span>
            </button>
            {opcionesAbiertas && <div id="home-general-opciones-vista"
              className="home-general-menu-vistas" role="dialog" aria-modal="false"
              aria-label="Opciones de visualización">
              <div className="home-general-menu-vistas-cabecera">
                <strong>Personalizar vista</strong>
                <button type="button" aria-label="Cerrar opciones de vista"
                  onClick={() => setOpcionesAbiertas(false)}>×</button>
              </div>
              <div className="home-general-grupo-vistas" role="group" aria-label="Organización">
                <span>Organizar por</span>
                <div className="home-general-botones-vistas">
                  <button type="button" aria-pressed={organizacion === 'areas'}
                    className={organizacion === 'areas' ? 'activo' : ''}
                    onClick={() => cambiarOrganizacion('areas')}>Por áreas</button>
                  <button type="button" aria-pressed={organizacion === 'modulos'}
                    className={organizacion === 'modulos' ? 'activo' : ''}
                    onClick={() => cambiarOrganizacion('modulos')}>Por módulos</button>
                </div>
              </div>
              <div className="home-general-grupo-vistas" role="group" aria-label="Presentación">
                <span>Mostrar como</span>
                <div className="home-general-botones-vistas">
                  <button type="button" aria-pressed={vista === 'lista'}
                    className={vista === 'lista' ? 'activo' : ''}
                    onClick={() => cambiarVista('lista')}>Lista</button>
                  <button type="button" aria-pressed={vista === 'cuadricula'}
                    className={vista === 'cuadricula' ? 'activo' : ''}
                    onClick={() => cambiarVista('cuadricula')}>Cuadrícula</button>
                </div>
              </div>
            </div>}
          </div>
        </div>
      </div>
      {organizacion === 'areas'
        ? <div className={'home-general-secciones vista-' + vista}>
          {grupos.map(g => {
            const abierto = Boolean(q) || abiertos.has(g.id);
            return <section key={g.id} className="tarjeta home-general-seccion">
              <button type="button" className="home-general-encabezado" aria-expanded={abierto}
                aria-controls={'seccion-' + g.id} onClick={() => alternar(g.id)}>
                <span><strong>{g.nombre}</strong><small>{g.descripcion}</small></span>
                <span className="home-general-contador">{g.enlaces.length}</span>
                <span aria-hidden="true">{abierto ? '⌃' : '⌄'}</span>
              </button>
              {abierto && <div id={'seccion-' + g.id} className="home-general-enlaces">
                {g.enlaces.map(([nombre,ruta,desc]) =>
                  <Link key={ruta} to={ruta} className="home-general-enlace"
                    onClick={() => { if (g.area) guardarArea(g.area); }}>
                    <span className="home-general-enlace-icono"><IconoNavegacion tipo={iconoRutaCoproactiva(ruta)} /></span>
                    <span className="home-general-enlace-texto"><strong>{nombre}</strong><small>{desc}</small></span>
                    <span aria-hidden="true">›</span>
                  </Link>
                )}
              </div>}
            </section>;
          })}
          {!grupos.length && <div className="tarjeta home-general-vacio">No hay módulos que coincidan con la búsqueda.</div>}
        </div>
        : <div className={'home-general-modulos vista-' + vista}>
          {modulosFiltrados.map(modulo =>
            <Link key={modulo.id} to={modulo.ruta} className="tarjeta home-general-modulo"
              onClick={() => { if (modulo.area) guardarArea(modulo.area); }}>
              <span className="home-general-enlace-icono"><IconoNavegacion tipo={iconoRutaCoproactiva(modulo.ruta)} /></span>
              <span className="home-general-enlace-texto">
                <small className="home-general-modulo-etiqueta">{modulo.etiqueta}</small>
                <strong>{modulo.titulo}</strong><small>{modulo.descripcion}</small>
              </span>
              <span className="home-general-modulo-flecha" aria-hidden="true">›</span>
            </Link>
          )}
          {!modulosFiltrados.length && <div className="tarjeta home-general-vacio">No hay módulos que coincidan con la búsqueda.</div>}
        </div>
      }
    </div>
  </div>;
}
