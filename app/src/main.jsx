import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ProveedorSesion } from './lib/sesion';
import { ProveedorTutoriales } from './lib/tutorialesContexto';
import { iniciarSincronizacion } from './lib/sincronizacion';
import { instalarGuionesGlobales } from './lib/guionesGlobales';
import { prepararArranqueConHome, esContinuacionDocumento } from './lib/arranqueHistorialPWA';
import App from './App';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/modulos.css';
import './estilos/identidad-app.css';
import './estilos/comercial-homologado.css';

/* Si la app se publica bajo una subcarpeta (github.io/<repositorio>/), el
 * router tiene que descontar ese prefijo o ninguna ruta calza. BASE_URL lo
 * entrega Vite a partir de `base`; en la raíz (app.coproactiva.cl) vale '/' y
 * el basename queda vacío. */
const raiz = import.meta.env.BASE_URL.replace(/\/$/, '');

// Apertura NUEVA => Home según permisos. Recarga o vuelta a una pestaña viva
// => conservar ruta, pestaña y filtros sin reescribir la URL de la PWA.
const continuarPantalla = esContinuacionDocumento(window.performance, document.wasDiscarded);
prepararArranqueConHome(window.history, window.location, import.meta.env.BASE_URL,
  { continuar: continuarPantalla });

/* La cola de subida arranca con la app: si el teléfono quedó con trabajo sin
 * subir de un levantamiento anterior, se sube apenas haya señal, sin que nadie
 * tenga que acordarse de abrir esa pantalla. */
iniciarSincronizacion();

/* La PWA precarga el bundle para trabajar sin señal. Cuando se publica una
 * versión nueva, Workbox puede activar el service worker nuevo mientras la
 * pestaña abierta sigue ejecutando el JavaScript anterior. Eso hacía que una
 * función recién publicada -por ejemplo el nuevo formato de informes- pareciera
 * no existir hasta hacer un hard refresh manual.
 *
 * Forzamos una comprobación al abrir la app y recargamos una sola vez cuando el
 * nuevo service worker toma control. Así el usuario no tiene que limpiar caché
 * ni adivinar si está viendo una versión antigua. */
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  let recargandoPorActualizacion = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargandoPorActualizacion) return;
    recargandoPorActualizacion = true;
    window.location.reload();
  });

  // Una pestaña Chrome que permanece abierta durante horas no dispara 'load'
  // al volver a primer plano. Revisar también la PWA al regresar a Home.
  // No consultar en formularios internos: una activación podría recargar
  // datos aún no guardados en campo.
  let ultimaRevision = 0;
  async function comprobarActualizacion(desdeInicio = false) {
    if (document.visibilityState === 'hidden') return;
    const rutaHome = (raiz || '') + '/';
    if (!desdeInicio && window.location.pathname !== rutaHome) return;
    const ahora = Date.now();
    if (!desdeInicio && ahora - ultimaRevision < 45000) return;
    ultimaRevision = ahora;
    try {
      const registro = await navigator.serviceWorker.ready;
      await registro.update();
    } catch {
      // Sin red, continuar trabajando con el contenido disponible.
    }
  }

  window.addEventListener('load', () => comprobarActualizacion(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') comprobarActualizacion();
  });
  window.addEventListener('pageshow', (evento) => {
    if (evento.persisted) comprobarActualizacion();
  });
}

// Incluye el árbol React y los portales que se montan directamente en body.
instalarGuionesGlobales(document.body);

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
