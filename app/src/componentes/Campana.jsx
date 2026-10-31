import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import './Campana.css';

/* Campana transversal: un acceso por pantalla en Home y encabezados de módulos.
 * El panel se monta sobre document.body para no sufrir recortes por contenedores
 * ni desbordarse cuando el disparador está junto al borde de la pantalla. */
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
  const { pathname }=useLocation();
  const [abierta,setAbierta]=useState(false);
  const [total,setTotal]=useState(0);
  const [urgentes,setUrgentes]=useState(0);
  const [ultimas,setUltimas]=useState([]);
  const contenedor=useRef(null);
  const panelRef=useRef(null);
  const [posicion,setPosicion]=useState(null);
  // Calcular con coordenadas del viewport: nunca usar right:0 relativo
  // a la campana, pues en teléfonos el panel se sale por la izquierda.
  function ubicarPanel(){
    if(!contenedor.current)return;
    const rect=contenedor.current.getBoundingClientRect();
    const anchoViewport=document.documentElement.clientWidth || window.innerWidth;
    const altoViewport=window.visualViewport?.height || window.innerHeight;
    const margen=12;
    const ancho=Math.min(390,Math.max(0,anchoViewport-2*margen));
    const left=Math.max(margen,Math.min(rect.right-ancho,anchoViewport-ancho-margen));
    const top=Math.max(margen,Math.min(rect.bottom+8,altoViewport-140));
    setPosicion({left,top,width:ancho,maxHeight:Math.max(100,altoViewport-top-margen)});
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
    ubicarPanel();
    const actualizar=()=>ubicarPanel();
    const cerrar=e=>{
      if(e.type==='keydown'){
        if(e.key!=='Escape')return;
        e.preventDefault();
        setAbierta(false);
        contenedor.current?.querySelector('button')?.focus();
        return;
      }
      if(contenedor.current?.contains(e.target)||panelRef.current?.contains(e.target))return;
      setAbierta(false);
    };
    window.addEventListener('resize',actualizar);
    window.addEventListener('scroll',actualizar,true);
    window.visualViewport?.addEventListener('resize',actualizar);
    document.addEventListener('pointerdown',cerrar);
    document.addEventListener('keydown',cerrar);
    return ()=>{
      window.removeEventListener('resize',actualizar);
      window.removeEventListener('scroll',actualizar,true);
      window.visualViewport?.removeEventListener('resize',actualizar);
      document.removeEventListener('pointerdown',cerrar);
      document.removeEventListener('keydown',cerrar);
    };
  },[abierta]);
  // La campana no permanece abierta al saltar de un módulo a otro.
  useEffect(()=>{setAbierta(false);},[pathname]);

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
      onClick={()=>{if(!abierta)ubicarPanel();setAbierta(a=>!a);}}
      aria-expanded={abierta}
      aria-haspopup="true"
      aria-label={total===0?'Ver notificaciones':total+' notificaciones sin leer'}
      title="Notificaciones">🔔
      {total>0&&<span className={'globo'+(urgentes>0?' critico':'')}>
        {total>99?'99+':total}
      </span>}
    </button>
    {abierta&&createPortal(<section ref={panelRef} className="campana-panel"
      role="dialog" aria-modal="false" aria-label="Notificaciones recientes"
      style={posicion || {left:12,top:75,width:'calc(100vw - 24px)'}}>
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
