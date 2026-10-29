import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import './VistaCliente.css';

const PortalCliente = lazy(() => import('../cliente/PortalCliente'));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vista administrativa, no cambia la sesión ni concede un perfil cliente.
 * Solo utiliza consultas que comprueban la vinculación de la cuenta
 * seleccionada y las publicaciones habilitadas en esa comunidad. */
export default function VistaCliente() {
  const { perfil } = useSesion();
  const permitido=['superadmin','admin','jefatura'].includes(perfil?.rol);
  const [params,setParams]=useSearchParams();
  const comunidadId=params.get('comunidad')||'';
  const clienteId=params.get('cliente')||'';
  const [comunidades,setComunidades]=useState(null);
  const [cuentas,setCuentas]=useState(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!permitido)return;
    let vigente=true;
    supabase.from('comunidades')
      .select('id,nombre,comuna,direccion,estado')
      .order('nombre')
      .then(({data,error:e})=>{
        if(!vigente)return;
        if(e){setError(e.message);setComunidades([]);}
        else {setComunidades(data||[]);setError('');}
      });
    return ()=>{vigente=false;};
  },[permitido]);

  // Si la administración tiene una sola comunidad, abrir su portal
  // directamente sin pedir otra selección redundante.
  useEffect(()=>{
    if(!permitido || comunidades?.length!==1 || comunidadId)return;
    setParams(p=>{
      const next=new URLSearchParams(p);
      next.set('comunidad',comunidades[0].id);
      next.delete('cliente');
      next.delete('seccion');
      return next;
    },{replace:true,preventScrollReset:true});
  },[permitido,comunidades,comunidadId,setParams]);

  useEffect(()=>{
    if(!permitido||!UUID.test(comunidadId)){setCuentas([]);return;}
    let vigente=true;
    setCuentas(null);
    supabase.rpc('vista_cliente_cuentas',{p_comunidad_id:comunidadId})
      .then(({data,error:e})=>{
        if(!vigente)return;
        if(e){setError(e.message);setCuentas([]);}
        else {setError('');setCuentas(data||[]);}
      });
    return ()=>{vigente=false;};
  },[permitido,comunidadId]);

  useEffect(()=>{
    if(cuentas===null||!comunidadId)return;
    if(!cuentas.length){
      if(clienteId) setParams(p=>{
        const next=new URLSearchParams(p);
        next.delete('cliente');next.delete('seccion');
        return next;
      },{replace:true,preventScrollReset:true});
      return;
    }
    if(!cuentas.some(x=>x.cliente_id===clienteId)){
      setParams(p=>{
        const next=new URLSearchParams(p);
        next.set('cliente',cuentas[0].cliente_id);
        next.delete('seccion');
        return next;
      },{replace:true,preventScrollReset:true});
    }
  },[cuentas,comunidadId,clienteId,setParams]);

  const comunidadSeleccionada=useMemo(
    ()=>(comunidades||[]).find(c=>c.id===comunidadId),
    [comunidades,comunidadId]);
  const clienteSeleccionado=(cuentas||[]).find(x=>x.cliente_id===clienteId);
  const listaConfigurada=Boolean(comunidadId&&clienteSeleccionado&&comunidadSeleccionada);
  const cambiarComunidad=(id)=>{
    setCuentas(null);
    const next=new URLSearchParams();
    if(id) next.set('comunidad',id);
    setParams(next,{replace:false});
  };
  const cambiarCliente=(id)=>{
    const next=new URLSearchParams(params);
    if(id)next.set('cliente',id);else next.delete('cliente');
    next.delete('seccion');
    setParams(next,{replace:false,preventScrollReset:true});
  };

  if(!permitido)return <main className="pantalla">
    <div className="cuerpo"><div className="aviso aviso-critico">
      Esta vista está disponible exclusivamente para administración.
    </div><Link className="boton boton-secundario" to="/">Volver al Home</Link></div>
  </main>;

  return <main className="vista-cliente-modulo">
    <header className="vista-cliente-encabezado">
      <div>
        <p className="vista-cliente-sobretitulo">OPERACIONES · PORTAL CLIENTE</p>
        <h1>Vista de cliente</h1>
        <p>Selecciona una comunidad y una cuenta cliente para revisar exactamente las secciones y los datos habilitados para esa cuenta.</p>
      </div>
      <Link to="/" className="boton boton-secundario">‹ Home de módulos</Link>
    </header>

    <section className="vista-cliente-barra" aria-label="Elegir comunidad y cliente">
      <div className="vista-cliente-campo">
        <label htmlFor="vista-cliente-comunidad">Comunidad</label>
        <select id="vista-cliente-comunidad" value={comunidadSeleccionada?.id||''}
          onChange={e=>cambiarComunidad(e.target.value)}
          disabled={comunidades===null}>
          <option value="">{comunidades===null?'Cargando comunidades…':'Selecciona una comunidad'}</option>
          {(comunidades||[]).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="vista-cliente-campo">
        <label htmlFor="vista-cliente-cuenta">Cuenta cliente</label>
        <select id="vista-cliente-cuenta" value={clienteSeleccionado?.cliente_id||''}
          disabled={!comunidadSeleccionada||cuentas===null||!cuentas.length}
          onChange={e=>cambiarCliente(e.target.value)}>
          <option value="">{cuentas===null?'Cargando cuentas…':cuentas?.length?'Selecciona una cuenta':'Sin clientes asociados'}</option>
          {(cuentas||[]).map(c=><option key={c.cliente_id} value={c.cliente_id}>
            {c.cliente_nombre||'Cliente'}{c.cliente_email?' · '+c.cliente_email:''}
          </option>)}
        </select>
      </div>
      <div className="vista-cliente-modo" aria-label="Modo lectura">
        <span aria-hidden="true">◉</span> Vista previa · Solo lectura
      </div>
    </section>

    {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
    {comunidades?.length===0&&!error&&<div className="vista-cliente-vacio">
      <h2>Aún no hay comunidades</h2>
      <p>Cuando registres comunidades, podrás seleccionar cuál previsualizar.</p>
      <Link to="/comunidades">Ir a Comunidades</Link>
    </div>}
    {comunidades?.length>0&&!comunidadSeleccionada&&<div className="vista-cliente-vacio">
      <h2>Elige una comunidad</h2>
      <p>La simulación utilizará el mismo portal del cliente y mostrará únicamente su información autorizada.</p>
    </div>}
    {comunidadSeleccionada&&cuentas!==null&&!cuentas.length&&!error&&<div className="vista-cliente-vacio">
      <h2>No hay cuentas cliente activas</h2>
      <p>Esta comunidad todavía no tiene una cuenta cliente asociada y activa. Configura su acceso para poder previsualizar exactamente qué verá.</p>
      <Link to="/configuracion">Configurar usuarios y accesos</Link>
    </div>}
    {comunidadSeleccionada&&cuentas===null&&<p className="cargando">Consultando clientes de la comunidad…</p>}
    {listaConfigurada&&<section className="vista-cliente-simulacion" aria-label="Simulación del portal">
      <div className="vista-cliente-simulacion-cabecera">
        <strong>Portal de {comunidadSeleccionada.nombre}</strong>
        <span>Simulando: {clienteSeleccionado.cliente_nombre||clienteSeleccionado.cliente_email}</span>
      </div>
      <Suspense fallback={<p className="cargando">Cargando portal de cliente…</p>}>
        <PortalCliente key={comunidadId+':'+clienteId}
          vistaPrevia={{comunidadId,clienteId}} />
      </Suspense>
    </section>}
    <p className="vista-cliente-nota">
      Esta vista no inicia sesión como cliente, no modifica registros y no envía notificaciones. Las secciones que una cuenta no tiene publicadas no se muestran.
    </p>
  </main>;
}
