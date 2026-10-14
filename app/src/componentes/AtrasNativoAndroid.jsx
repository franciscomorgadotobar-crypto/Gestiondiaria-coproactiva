import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useSesion } from '../lib/sesion';
import { decidirAtrasAndroid } from '../lib/atrasAndroidCapacitor';

/**
 * En la APK, registra la tecla/gesto Atrás físico de Android.
 * El navegador PWA conserva su comportamiento normal.
 */
export default function AtrasNativoAndroid() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { perfil } = useSesion();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let vigente = true;
    let control;

    CapacitorApp.addListener('backButton', async () => {
      if (!vigente) return;

      // Misma vía de intercepción que «‹ Volver»: evita perder cambios no
      // guardados en controles, levantamientos o formularios especializados.
      const evento = new Event('coproactiva:volver', { cancelable: true });
      window.dispatchEvent(evento);
      if (evento.defaultPrevented) return;

      const decision = decidirAtrasAndroid({
        pathname,
        rol: perfil?.rol,
        indice: window.history.state?.idx
      });
      if (decision.tipo === 'historial') navegar(decision.pasos);
      else if (decision.tipo === 'home') navegar(decision.destino, {
        replace: true, preventScrollReset: true
      });
      else await CapacitorApp.exitApp();
    }).then(listener => {
      if (vigente) control = listener;
      else listener.remove();
    }).catch(error => console.error('No se pudo activar Atrás nativo:', error));

    return () => {
      vigente = false;
      control?.remove();
    };
  }, [pathname, perfil?.rol, navegar]);
  return null;
}
