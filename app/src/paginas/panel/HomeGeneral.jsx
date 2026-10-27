import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import Campana from '../../componentes/Campana';
import './HomeGeneral.css';

/* Home principal único. Grupos expandibles como Levantamientos: un primer nivel
   con todo el sistema, sin una segunda pantalla de selección. */
export default function HomeGeneral() {
  const { perfil } = useSesion();
  const [resumen, setResumen] = useState({ prospectos:null, compromisos:null, pendientes:null });
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set(['operaciones']));
  const rol=perfil?.rol;
  const comercial=['superadmin','admin','jefatura'].includes(rol);
  const administracion=['superadmin','admin'].includes(rol);
  const superadmin=rol==='superadmin';
  useEffect(()=>{
    let activo=true;
    const consultas=[
      comercial ? supabase.from('prospectos').select('id',{head:true,count:'exact'}) : Promise.resolve({count:null}),
      comercial ? supabase.from('compromisos_administracion').select('id',{head:true,count:'exact'}).neq('estado','completado') : Promise.resolve({count:null}),
      supabase.from('controles_con_avance').select('id',{head:true,count:'exact'}).in('estado',['pendiente','en_curso','pausado'])
    ];
    Promise.all(consultas).then(([p,c,l])=>{
      if (!activo) return;
      setResumen({prospectos:p.count,compromisos:c.count,pendientes:l.count});
      const primerError=[p,c,l].find(x=>x.error)?.error;
      if(primerError) setAviso('Algunos contadores no se pudieron consultar; los módulos siguen disponibles.');
    });
    return()=>{activo=false};
  },[perfil?.id,comercial]);

  const secciones=useMemo(()=>[
    {id:'comercial',nombre:'Comercial',descripcion:'Contactos web, prospectos y seguimiento comercial.',
      mostrar:comercial, enlaces:[
        ['Pipeline comercial','/pipeline','Contactos de formularios y etapas de oportunidad'],
        ['Arriendos y ventas','/propiedades','Propiedades y publicaciones'],
        ...(administracion?[['SEO y Analítica','/seo','Resultados de la web y posicionamiento']]:[]),
        ['Plantillas de correo','/plantillas-correo','Mensajes reutilizables para prospectos']
      ]},
    {id:'operaciones',nombre:'Operaciones',descripcion:'Comunidades y trabajo en terreno.',mostrar:true,
      enlaces:[
        ['Levantamientos','/inicio','Pendientes y realizados por persona'],
        ['Comunidades','/comunidades','Fichas, compromisos y documentos'],
        ['Compromisos y avances','/compromisos','Etapas, fechas y responsables por comunidad'],
        ['Mantenciones','/mantenciones','Planificación y seguimiento'],
        ['Bitácora','/bitacora','Incidencias y observaciones'],
        ['Mapa','/mapa','Ubicaciones y visitas'],
        ...(administracion?[['Red de proveedores','/proveedores','Directorio y comunicaciones'],['Recepción y atención','/whatsapp','Conversaciones y solicitudes']]:[]),
        ...(comercial?[['Plantillas de levantamientos','/plantillas','Formularios operativos']]:[])
      ]},
    {id:'finanzas',nombre:'Finanzas',descripcion:'Gestión contable y financiera.',mostrar:administracion,
      enlaces:[['Gestión contable','/contabilidad','Asientos, libro mayor y estados financieros']]},
    {id:'administracion',nombre:'Administración y ajustes',descripcion:'Equipo, usuarios, permisos, accesos de clientes y configuración general.',
      mostrar:administracion,enlaces:[
        ['Configuración general','/configuracion','Ajustes de la aplicación'],
        ['Equipo y permisos','/equipo','Usuarios y accesos internos'],
        ...(superadmin?[['Clientes y accesos','/clientes','Permisos del portal cliente']]:[])
      ]},
    {id:'general',nombre:'Mi espacio',descripcion:'Avisos, información y cuenta personal.',mostrar:true,
      enlaces:[['Notificaciones','/notificaciones','Avisos pendientes'],['Mi cuenta','/mi-cuenta','Perfil y preferencias'],['Aprendizaje','/conocimientos','Guías y normativas']]}
  ].filter(g=>g.mostrar),[comercial,administracion,superadmin]);
  const q=filtro.trim().toLocaleLowerCase('es-CL');
  const grupos=secciones.map(g=>({...g,enlaces:g.enlaces.filter(x=>!q||(x[0]+' '+x[2]).toLocaleLowerCase('es-CL').includes(q))}))
    .filter(g=>g.enlaces.length);

  function alternar(id) {
    setAbiertos(xs=>{const y=new Set(xs); y.has(id)?y.delete(id):y.add(id);return y;});
  }

  return <div className="pantalla modulo-unificado home-general">
    <header className="encabezado modulo-cabecera">
      <div className="home-general-saludo">
        <div><h1 className="h3">Hola, {perfil?.nombre?.split(' ')[0]||'equipo'}</h1>
          <p className="chico apagado">Tu espacio de trabajo · Coproactiva</p></div>
        <Campana miId={perfil?.id}/>
      </div>
    </header>
    <div className="cuerpo modulo-contenido home-general-cuerpo">
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <div className="home-general-metricas" aria-label="Resumen del sistema">
        {comercial && <div><strong>{resumen.prospectos??'—'}</strong><span>Prospectos</span></div>}
        {comercial && <div><strong>{resumen.compromisos??'—'}</strong><span>Compromisos abiertos</span></div>}
        <div><strong>{resumen.pendientes??'—'}</strong><span>Levantamientos pendientes</span></div>
      </div>
      <div className="home-general-cabecera">
        <div><h2 className="h4">Módulos de trabajo</h2>
          <p className="chico apagado">Abre la sección que necesitas. Todos los módulos están aquí, sin una pantalla de selección previa.</p></div>
        <label className="home-general-buscar"><span className="micro">Buscar módulo</span>
          <input type="search" value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar…"/></label>
      </div>
      <div className="home-general-secciones">
        {grupos.map((g,i)=>{
          const abierto=q.length>0||abiertos.has(g.id);
          return <section key={g.id} className="tarjeta home-general-seccion">
            <button type="button" className="home-general-encabezado" aria-expanded={abierto}
              aria-controls={'seccion-'+g.id} onClick={()=>alternar(g.id)}>
              <span><strong>{g.nombre}</strong><small>{g.descripcion}</small></span>
              <span className="home-general-contador">{g.enlaces.length}</span>
              <span aria-hidden="true">{abierto?'⌃':'⌄'}</span>
            </button>
            {abierto&&<div id={'seccion-'+g.id} className="home-general-enlaces">
              {g.enlaces.map(([nombre,ruta,desc])=><Link key={ruta} to={ruta} className="home-general-enlace">
                <span><strong>{nombre}</strong><small>{desc}</small></span><span aria-hidden="true">›</span>
              </Link>)}
            </div>}
          </section>;
        })}
        {!grupos.length&&<div className="tarjeta home-general-vacio">No hay módulos que coincidan con la búsqueda.</div>}
      </div>
    </div>
  </div>;
}
