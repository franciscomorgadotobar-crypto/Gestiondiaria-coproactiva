import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { ProveedorTutoriales } from './lib/tutorialesContexto';
import { iniciarSincronizacion } from './lib/sincronizacion';
import App from './App';
import './estilos/tokens.css';
import './estilos/base.css';

/* Si la app se publica bajo una subcarpeta (github.io/<repositorio>/), el
 * router tiene que descontar ese prefijo o ninguna ruta calza. BASE_URL lo
 * entrega Vite a partir de `base`; en la raíz (app.coproactiva.cl) vale '/' y
 * el basename queda vacío. */
const raiz = import.meta.env.BASE_URL.replace(/\/$/, '');

/* La cola de subida arranca con la app: si el teléfono quedó con trabajo sin
 * subir de un levantamiento anterior, se sube apenas haya señal, sin que nadie
 * tenga que acordarse de abrir esa pantalla. */
iniciarSincronizacion();

/* La PWA precarga el bundle para trabajar sin señal. Cuando se publica una
 * versión nueva, Workbox puede activar el service worker nuevo mientras la
 * pestaña abierta sigue ejecutando el JavaScript anterior. Eso hacía que una
 * función recién publicada —por ejemplo el nuevo formato de informes— pareciera
 * no existir hasta hacer un hard refresh manual.
 *
 * Forzamos una comprobación al abrir la app y recargamos una sola vez cuando el
 * nuevo service worker toma control. Así el usuario no tiene que limpiar caché
 * ni adivinar si está viendo una versión antigua. */
if ('serviceWorker' in navigator) {
  let recargandoPorActualizacion = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargandoPorActualizacion) return;
    recargandoPorActualizacion = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registro = await navigator.serviceWorker.ready;
      await registro.update();
    } catch {
      // La app sigue operativa aunque no se pueda comprobar la actualización.
    }
  });
}

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter basename={raiz}>
      <ProveedorSesion>
        <ProveedorTutoriales>
          <App />
        </ProveedorTutoriales>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>
);
