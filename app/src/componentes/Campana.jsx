import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import './Campana.css';

/* Campana global: mismas notificaciones que /notificaciones, con una vista
 * rápida accesible desde cualquier pantalla. Los mensajes de correo están enlazados a
 * CRM o Proveedores, no a una bandeja central. */
function destino(n) {
  if(n.tipo==='correo_apertura'){
    if(n.correo_origen==='proveedores') return '/proveedores/comunicaciones'+
      (n.correo_registro_id?'?destinatario='+encodeURIComponent(n.correo_registro_id):'');
    return n.prospecto_id
      ? '/pipeline?prospecto='+encodeURIComponent(n.prospecto_id)+
        (n.correo_registro_id?'&correo='+encodeURIComponent(n.correo_registro_id):'')
      : '/pipeline';
  }
  if(n.tipo==='lead_web')return n.prospecto_id
    ? '/pipeline?prospecto='+encodeURIComponent(n.prospecto_id)
    : '/pipeline?etapa=nuevo';
  if(n.tabla==='notificaciones_mantenimiento')return '/mantenciones';
  if(n.bitacora_id)return '/bitacora/'+encodeURIComponent(n.bitacora_id);
  return '/notificaciones';
}
function fecha(valor) {
  if(!valor)return '';
  return new Date(valor).toLocaleString('es-CL',{
    day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'
  });
}
export default function Campana({ miId }) {
  const navegar=useNavigate();
  const { pathname, search }=useLocation();
  const [abierta,setAbierta]=useState(false);
  const [total,setTotal]=useState(0);
  const [urgentes,setUrgentes]=useState(0);
  const [ultimas,setUltimas]=useState([]);
  const contenedor=useRef(null);
  const panelRef=useRef(null);
  const [posicion,setPosicion]=useState({top:56,left:12,maxHeight:500});

  // El panel se monta en document.body: evita recortes y desplazamientos
  // debidos a overflow, transformaciones o el ancho del encabezado.
  function ajustarPanel(){
    const ancla=contenedor.current?.getBoundingClientRect();
    if(!ancla)return;
    const margen=12;
    const ancho=Math.min(390,Math.max(0,window.innerWidth-margen*2));
    const izquierda=Math.max(margen,Math.min(ancla.right-ancho,window.innerWidth-margen-ancho));
    const arriba=Math.max(margen,ancla.bottom+8);
    setPosicion({top:arriba,left:izquierda,maxHeight:Math.max(120,window.innerHeight-arriba-margen)});
  }

  useEffect(()=>{
    if(!miId)return;
    let vigente=true;
    async function cargar(){
      const [g,m,u,gn,mn]=await Promise.all([
        supabase.from('notificaciones').select('id',{count:'exact',head:true})
          .eq('destinatario_id',miId).eq('leida',false),
        supabase.from('notificaciones_mantenimiento').select('id',{count:'exact',head:true})
          .eq('destinatario_id',miId).eq('leida',false),
        supabase.from('notificaciones').select('id',{count:'exact',head:true})
          .eq('destinatario_id',miId).eq('leida',false).eq('tipo','bitacora_urgente'),
        supabase.from('notificaciones')
          .select('id,tipo,titulo,mensaje,prospecto_id,proveedor_id,correo_origen,correo_registro_id,bitacora_id,creado_en,leida')
          .eq('destinatario_id',miId).order('creado_en',{ascending:false}).limit(5),
        supabase.from('notificaciones_mantenimiento')
          .select('id,tipo,titulo,mensaje,actividad_id,creado_en,leida')
          .eq('destinatario_id',miId).order('creado_en',{ascending:false}).limit(5)
      ]);
      if(!vigente)return;
      setTotal((g.count||0)+(m.count||0));
      setUrgentes(u.count||0);
      const comunes=(gn.data||[]).map(n=>({...n,tabla:'notificaciones'}));
      const mantenimiento=(mn.data||[]).map(n=>({...n,tabla:'notificaciones_mantenimiento'}));
      setUltimas([...comunes,...mantenimiento]
        .sort((a,b)=>String(b.creado_en).localeCompare(String(a.creado_en))).slice(0,5));
    }
    cargar();
    const intervalo=window.setInterval(cargar,60000);
    const escuchar=()=>cargar();
    window.addEventListener('coproactiva:notificaciones-cambio',escuchar);
    return ()=>{
      vigente=false;window.clearInterval(intervalo);
      window.removeEventListener('coproactiva:notificaciones-cambio',escuchar);
    };
  },[miId]);

  useEffect(()=>{
    if(!abierta)return;
    ajustarPanel();
    const ajustar=()=>ajustarPanel();
    const cerrar=(e)=>{
      if(e.type==='keydown'&&e.key!=='Escape')return;
      if(e.type==='pointerdown'&&(
        contenedor.current?.contains(e.target)||panelRef.current?.contains(e.target)
      ))return;
      setAbierta(false);
    };
    document.addEventListener('pointerdown',cerrar);
    document.addEventListener('keydown',cerrar);
    window.addEventListener('resize',ajustar);
    window.addEventListener('scroll',ajustar,true);
    return ()=>{
      document.removeEventListener('pointerdown',cerrar);
      document.removeEventListener('keydown',cerrar);
      window.removeEventListener('resize',ajustar);
      window.removeEventListener('scroll',ajustar,true);
    };
  },[abierta]);

  // El componente no cambia al navegar entre módulos; el desplegable sí.
  useEffect(()=>setAbierta(false),[pathname,search]);

  async function abrirNotificacion(n){
    if(!n.leida){
      await supabase.from(n.tabla).update({
        leida:true,leida_en:new Date().toISOString()
      }).eq('id',n.id);
      window.dispatchEvent(new CustomEvent('coproactiva:notificaciones-cambio'));
    }
    setAbierta(false);
    navegar(destino(n));
  }

  return <div className="campana-contenedor" ref={contenedor}>
    <button type="button"
      className={'campana'+(total===0?' sin-pendientes':'')}
      onClick={()=>{if(!abierta)ajustarPanel();setAbierta(a=>!a);}}
      aria-expanded={abierta}
      aria-haspopup="dialog"
      aria-controls={abierta?'campana-panel-global':undefined}
      aria-label={total===0?'Ver notificaciones':total+' notificaciones sin leer'}
      title="Notificaciones">🔔
      {total>0&&<span className={'globo'+(urgentes>0?' critico':'')}>
        {total>99?'99+':total}
      </span>}
    </button>
    {abierta&&createPortal(<section id="campana-panel-global" ref={panelRef}
      className="campana-panel" role="dialog" aria-label="Notificaciones recientes"
      style={{top:posicion.top,left:posicion.left,maxHeight:posicion.maxHeight}}>
      <div className="campana-panel-encabezado">
        <strong>Notificaciones</strong>
        <button type="button" onClick={()=>{setAbierta(false);navegar('/notificaciones');}}>
          Ver todas
        </button>
      </div>
      <div className="campana-panel-lista">
        {!ultimas.length&&<p className="campana-vacio">Sin notificaciones recientes.</p>}
        {ultimas.map(n=><button key={n.tabla+n.id} type="button"
            className={'campana-entrada'+(!n.leida?' nueva':'')}
            onClick={()=>abrirNotificacion(n)}>
          <span className={'campana-simbolo'+(n.tipo==='correo_apertura'?' correo':'')}>
            {n.tipo==='correo_apertura'?'◉':n.tabla==='notificaciones_mantenimiento'?'⌛':'●'}
          </span>
          <span className="campana-entrada-texto">
            <strong>{n.titulo||'Notificación'}</strong>
            <span>{n.mensaje||''}</span>
            <small>{fecha(n.creado_en)}</small>
          </span>
          {!n.leida&&<span className="campana-punto" aria-label="No leída"/>}
        </button>)}
      </div>
    </section>,document.body)}
  </div>;
}
