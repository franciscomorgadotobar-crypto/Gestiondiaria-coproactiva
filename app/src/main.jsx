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
