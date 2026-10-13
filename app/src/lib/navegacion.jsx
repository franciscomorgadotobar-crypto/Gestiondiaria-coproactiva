import { useEffect, useRef } from 'react';
import { limpiarArea, inicioSegunArea } from './area';
import { destinoVolverPorJerarquia } from './jerarquia';
import { pasosHastaSelector } from './historialSelector';

/*
 * Las pantallas con lógica especial al salir (cambios sin guardar, origen
 * específico, etc.) pueden interceptar el botón Volver de la barra móvil.
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

/*
 * Volver de la barra de la app: detalle → módulo → inicio de área → selector.
 * Los roles de una sola área se quedan en su inicio y nunca ven el selector.
 * No modifica el historial físico Android ni confirma diálogos por su cuenta.
 */
export function volverPorJerarquia(navegar, pathname, puedeCambiarArea = true) {
  const destino = destinoVolverPorJerarquia(pathname, inicioSegunArea());
  if (!destino) return;
  if (destino === '/') {
    if (!puedeCambiarArea) return;
    limpiarArea();
    // Volver al selector real ya guardado evita dos copias consecutivas.
    // Si la app se abrió directamente en SEO, el selector fue preparado
    // antes de esa pantalla por PanelEscritorio.
    const pasos = pasosHastaSelector(window.history.state);
    if (pasos !== null) return navegar(pasos);
    // Sin entrada previa verificable, mostrar selector sin crear bucles.
    return navegar('/', { replace: true, state: { selectorCoproactiva: true } });
  }
  return navegar(destino);
}
