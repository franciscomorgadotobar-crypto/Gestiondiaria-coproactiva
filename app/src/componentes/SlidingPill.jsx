import {useCallback,useEffect,useLayoutEffect,useRef} from 'react';

/**
 * Cápsula elástica compartida por las barras inferiores de Coproactiva.
 * Se mide contra el botón real, de modo que funciona también con «Más»,
 * etiquetas de distinto largo, giros de pantalla y accesibilidad.
 * El botón activo conserva aria-current; el indicador es decorativo.
 */
export default function SlidingPill({activo=null,distribucion=''}) {
  const elemento=useRef(null);
  const destinoAnterior=useRef(null);
  const animacion=useRef(null);

  const ubicar=useCallback((animar=false)=>{
    const pill=elemento.current;
    const barra=pill?.parentElement;
    if(!pill||!barra)return;
    const boton=Array.from(barra.querySelectorAll('[data-pill-tab]'))
      .find(n=>n.dataset.pillTab===activo);
    if(!boton){
      animacion.current?.cancel();
      destinoAnterior.current=null;
      pill.style.opacity='0';
      return;
    }
    const contenedor=barra.getBoundingClientRect();
    const rect=boton.getBoundingClientRect();
    const alto=Math.min(49,Math.max(38,rect.height-5));
    const target={
      x:rect.left-contenedor.left+4,
      y:rect.top-contenedor.top+(rect.height-alto)/2,
      w:Math.max(30,rect.width-8),
      h:alto
    };
    const anterior=destinoAnterior.current;
    // ResizeObserver emite una primera medida justo después del cambio de ruta.
    // Si la geometría no cambió, no interrumpir el resorte en curso.
    if(!animar&&anterior
      &&Math.abs(anterior.x-target.x)<.6
      &&Math.abs(anterior.y-target.y)<.6
      &&Math.abs(anterior.w-target.w)<.6
      &&Math.abs(anterior.h-target.h)<.6)return;
    const reducido=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const animarMovimiento=animar&&!reducido&&anterior
      &&Math.abs(target.x-anterior.x)>2&&typeof pill.animate==='function';
    const ahora=pill.getBoundingClientRect();
    const inicio=animacion.current&&anterior?{
      x:ahora.left-contenedor.left,
      w:ahora.width
    }:anterior;

    animacion.current?.cancel();
    animacion.current=null;
    pill.style.top=target.y+'px';
    pill.style.height=target.h+'px';
    pill.style.width=target.w+'px';
    pill.style.transform='translate3d('+target.x+'px,0,0)';
    pill.style.opacity='1';
    destinoAnterior.current=target;

    if(!animarMovimiento||!inicio)return;
    const desplazamiento=target.x-inicio.x;
    const direccion=Math.sign(desplazamiento)||1;
    const extra=Math.min(33,Math.abs(desplazamiento)*.32);
    const rebote=direccion*Math.min(10,Math.abs(desplazamiento)*.09);
    const medio=inicio.x+desplazamiento*.57-(direccion<0?extra:0);
    const mover=x=>'translate3d('+x+'px,0,0)';
    animacion.current=pill.animate([
      {offset:0,transform:mover(inicio.x),width:inicio.w+'px',
        easing:'cubic-bezier(.19,.8,.28,1)'},
      {offset:.49,transform:mover(medio),
        width:(Math.max(inicio.w,target.w)+extra)+'px',
        easing:'cubic-bezier(.16,.75,.28,1)'},
      {offset:.81,transform:mover(target.x+rebote),
        width:(target.w*.94)+'px',
        easing:'cubic-bezier(.2,1,.35,1)'},
      {offset:1,transform:mover(target.x),width:target.w+'px'}
    ],{duration:520,fill:'none',easing:'linear'});
    animacion.current.onfinish=()=>{animacion.current=null;};
  },[activo]);

  useLayoutEffect(()=>{ubicar(true);},[ubicar,distribucion]);
  useEffect(()=>{
    const pill=elemento.current;
    const barra=pill?.parentElement;
    if(!barra)return undefined;
    const reajustar=()=>ubicar(false);
    const observer=typeof ResizeObserver==='function'?
      new ResizeObserver(reajustar):null;
    if(observer){
      observer.observe(barra);
      barra.querySelectorAll('[data-pill-tab]').forEach(b=>observer.observe(b));
    }
    window.addEventListener('resize',reajustar,{passive:true});
    return ()=>{
      observer?.disconnect();
      window.removeEventListener('resize',reajustar);
    };
  },[ubicar,distribucion]);
  useEffect(()=>()=>{animacion.current?.cancel();},[]);

  return <span ref={elemento} className="nav-sliding-pill" aria-hidden="true"/>;
}
