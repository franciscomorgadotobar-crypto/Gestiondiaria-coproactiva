import {useEffect,useRef} from 'react';

/**
 * Mantiene el teclado dentro del diálogo, ofrece Esc para cancelarlo y
 * devuelve el foco al control que lo abrió. No altera la gestión de Android
 * ni las entradas de historial de useAtrasCierraDialogo.
 */
export function useFocoDialogo(referencia, alCerrar) {
  const callback=useRef(alCerrar);
  callback.current=alCerrar;
  useEffect(() => {
    const anterior=document.activeElement;
    const elemento=referencia.current;
    if (!elemento) return;

    const disponibles=()=>[...elemento.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(x => x.getClientRects().length > 0 && !x.closest('[aria-hidden="true"]'));
    const enfocarInicial=()=>{
      if (!elemento.contains(document.activeElement)) {
        const primero=disponibles().find(x=>x.hasAttribute('autofocus'))||disponibles()[0];
        (primero||elemento).focus();
      }
    };
    enfocarInicial();
    const tecla=e=>{
      if(e.key==='Escape') {
        e.preventDefault();
        e.stopPropagation();
        callback.current?.();
        return;
      }
      if(e.key!=='Tab')return;
      const elementos=disponibles();
      if(!elementos.length) {
        e.preventDefault();
        elemento.focus();
        return;
      }
      const primero=elementos[0], ultimo=elementos.at(-1);
      if(e.shiftKey && (document.activeElement===primero || document.activeElement===elemento || !elemento.contains(document.activeElement))){
        e.preventDefault();ultimo.focus();
      }else if(!e.shiftKey && (document.activeElement===ultimo || !elemento.contains(document.activeElement))){
        e.preventDefault();primero.focus();
      }
    };
    elemento.addEventListener('keydown',tecla);
    return ()=>{
      elemento.removeEventListener('keydown',tecla);
      if(anterior?.isConnected && typeof anterior.focus==='function') anterior.focus();
    };
  },[referencia]);
}
