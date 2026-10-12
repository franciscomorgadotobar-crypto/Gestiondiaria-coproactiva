import { useEffect, useId, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Las ventanas comunes se abren sobre una entrada de historial de la misma
 * página. El gesto Atrás de Android / PWA cancela la ventana ANTES de salir.
 *
 * Sólo usa React Router (no window.onpopstate, no history.pushState directo):
 * deja al router controlar los enlaces y evita bucles en StrictMode.
 */
export function useAtrasCierraDialogo(onCancelar) {
  const location = useLocation();
  const navegar = useNavigate();
  const token = useId();
  const referenciaCerrar = useRef(onCancelar);
  referenciaCerrar.current = onCancelar;
  const iniciado = useRef(false);
  const armado = useRef(false);
  const montado = useRef(true);
  const rutaInicial = useRef(location.pathname);
  const marcado = location.state?.__copro_dialogo === token;

  useEffect(() => {
    if (marcado) {
      armado.current = true;
      return;
    }
    if (armado.current) {
      // Se presionó Atrás. El router ya retrocedió a la entrada anterior.
      armado.current = false;
      referenciaCerrar.current?.();
      return;
    }
    if (!iniciado.current) {
      iniciado.current = true; // Evitar doble push con StrictMode.
      navegar(location.pathname + location.search + location.hash, {
        state: { ...location.state, __copro_dialogo: token },
        preventScrollReset: true
      });
    }
  }, [marcado, location.key, location.pathname, location.search, location.hash, navegar, token]);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      // Si el usuario canceló o completó el formulario mediante los botones,
      // retirar la entrada del diálogo. No volver atrás si salió a otra ruta.
      queueMicrotask(() => {
        if (!montado.current && armado.current &&
            window.location.pathname === rutaInicial.current &&
            window.history.state?.usr?.__copro_dialogo === token) {
          window.history.back();
        }
      });
    };
  }, [token]);
}
