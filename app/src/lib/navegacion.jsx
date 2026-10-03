import { useEffect, useRef } from 'react';

/*
 * Las pantallas con lógica especial al salir (cambios sin guardar, origen
 * específico, etc.) pueden interceptar el botón Volver de la barra móvil.
 * Si nadie lo intercepta, PanelEscritorio usa el historial normal.
 */
export function useVolverGlobal(handler, activo = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!activo) return;
    const escuchar = e => {
      e.preventDefault();
      ref.current?.();
    };
    window.addEventListener('coproactiva:volver', escuchar);
    return () => window.removeEventListener('coproactiva:volver', escuchar);
  }, [activo]);
}
