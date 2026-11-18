import {lazy,Suspense,useEffect,useState} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import PanelEscritorio from '../../componentes/PanelEscritorio';
import './VistaCliente.css';

const PortalCliente=lazy(()=>import('../cliente/PortalCliente'));
const Conocimientos=lazy(()=>import('./Conocimientos'));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El administrador no suplanta la sesión ni altera permisos.
 * Reutiliza el shell y las pantallas del portal auténtico y comprueba la
 * vinculación efectiva por RPC antes de cargar sus datos publicados. */
export default function VistaClienteReal(){
  const {perfil}=useSesion();
  const {pathname}=useLocation();
  const [params]=useSearchParams();
  const comunidadId=params.get('comunidad')||'';
  const clienteId=params.get('cliente')||'';
  const [estado,setEstado]=useState({cargando:true,comunidad:null,cuenta:null,error:''});
  const autorizado=['superadmin','admin','jefatura'].includes(perfil?.rol);
  const esBiblioteca=pathname==='/vista-cliente/conocimientos';
  const regresar='/vista-cliente?comunidad='+encodeURIComponent(comunidadId)+'&cliente='+encodeURIComponent(clienteId);

  useEffect(()=>{
    if(!autorizado||!UUID.test(comunidadId)||!UUID.test(clienteId)){
      setEstado({cargando:false,comunidad:null,cuenta:null,error:'Selecciona una comunidad y cuenta cliente válidas.'});
      return undefined;
    }
    let vigente=true;
    setEstado({cargando:true,comunidad:null,cuenta:null,error:''});
    async function comprobar(){
      try{
        const [comunidad,cuentas]=await Promise.all([
          supabase.from('comunidades').select('id,nombre').eq('id',comunidadId).maybeSingle(),
          supabase.rpc('vista_cliente_cuentas',{p_comunidad_id:comunidadId})
        ]);
        if(comunidad.error)throw comunidad.error;
        if(cuentas.error)throw cuentas.error;
        const cuenta=(cuentas.data||[]).find(c=>c.cliente_id===clienteId);
        if(!comunidad.data||!cuenta)throw new Error('La cuenta no tiene acceso vigente a esta comunidad.');
        if(vigente)setEstado({cargando:false,comunidad:comunidad.data,cuenta,error:''});
      }catch(error){
        if(vigente)setEstado({cargando:false,comunidad:null,cuenta:null,error:error?.message||'No se pudo validar la vista del cliente.'});
      }
    }
    comprobar();
    return ()=>{vigente=false;};
  },[autorizado,comunidadId,clienteId]);

  if(!autorizado||estado.error)return <main className="pantalla vista-cliente-real-error">
    <div className="aviso aviso-critico" role="alert">{!autorizado?'Esta función requiere autorización administrativa.':estado.error}</div>
    <Link to="/vista-cliente" className="boton boton-secundario">Volver a Vista de cliente</Link>
  </main>;
  if(estado.cargando)return <p className="cargando">Verificando permisos de la cuenta cliente…</p>;

  return <PanelEscritorio vistaCliente={{comunidadId,clienteId,clienteNombre:estado.cuenta.cliente_nombre||estado.cuenta.cliente_email||'Cliente'}}>
    <div className="vista-cliente-real-herramientas" role="region" aria-label="Herramientas del administrador">
      <div className="vista-cliente-real-identidad">
        <strong>Vista real del portal · Solo lectura</strong>
        <small>{estado.comunidad.nombre} · {estado.cuenta.cliente_nombre||estado.cuenta.cliente_email||'Cliente'}</small>
        <span>Los datos publicados se consultan desde el origen autorizado y se actualizan automáticamente.</span>
      </div>
      <div className="vista-cliente-real-acciones">
        {!esBiblioteca&&<button type="button" className="boton boton-secundario"
          onClick={()=>window.dispatchEvent(new CustomEvent('coproactiva:portal:actualizar'))}>
          Actualizar
        </button>}
        <Link className="boton boton-secundario" to={regresar}>Cambiar cliente</Link>
      </div>
    </div>
    <Suspense fallback={<p className="cargando">Cargando vista del portal…</p>}>
      {esBiblioteca
        ? <Conocimientos/>
        : <PortalCliente vistaPrevia={{comunidadId,clienteId,real:true}}/>}
    </Suspense>
  </PanelEscritorio>;
}
