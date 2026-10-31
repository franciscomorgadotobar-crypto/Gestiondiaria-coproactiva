import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Campana.css';

/* Campana global: mismas notificaciones que /notificaciones, con una vista
 * rápida accesible desde el Home. Los mensajes de correo están enlazados a
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
  const [abierta,setAbierta]=useState(false);
  const [total,setTotal]=useState(0);
  const [urgentes,setUrgentes]=useState(0);
  const [ultimas,setUltimas]=useState([]);
  const contenedor=useRef(null);

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
    const cerrar=(e)=>{
      if(e.type==='keydown'&&e.key!=='Escape')return;
      if(e.type==='pointerdown'&&contenedor.current?.contains(e.target))return;
      setAbierta(false);
    };
    document.addEventListener('pointerdown',cerrar);
    document.addEventListener('keydown',cerrar);
    return ()=>{
      document.removeEventListener('pointerdown',cerrar);
      document.removeEventListener('keydown',cerrar);
    };
  },[abierta]);

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
      onClick={()=>setAbierta(a=>!a)}
      aria-expanded={abierta}
      aria-haspopup="true"
      aria-label={total===0?'Ver notificaciones':total+' notificaciones sin leer'}
      title="Notificaciones">🔔
      {total>0&&<span className={'globo'+(urgentes>0?' critico':'')}>
        {total>99?'99+':total}
      </span>}
    </button>
    {abierta&&<section className="campana-panel" aria-label="Notificaciones recientes">
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
    </section>}
  </div>;
}
