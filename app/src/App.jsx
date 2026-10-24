import { Suspense, lazy, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import Ingreso from './paginas/Ingreso';
import Clave from './paginas/Clave';
import Inicio from './paginas/panel/Inicio';
import Plantillas from './paginas/panel/Plantillas';
import Bitacora from './paginas/panel/Bitacora';
import Notificaciones from './paginas/panel/Notificaciones';
import MiCuenta from './paginas/panel/MiCuenta';
import EditorPlantilla from './paginas/panel/Plantilla';
import Programar from './paginas/panel/Programar';
import Equipo from './paginas/panel/Equipo';
import Comunidades from './paginas/panel/Comunidades';
import Mantenciones from './paginas/panel/Mantenciones';
import Clientes from './paginas/panel/Clientes';
import Configuracion from './paginas/panel/Configuracion';
import Pipeline from './paginas/panel/Pipeline';
import Ayuda from './paginas/panel/Ayuda';
import PracticaLevantamiento from './paginas/panel/PracticaLevantamiento';
import Proveedores from './paginas/panel/Proveedores';
import SeleccionArea from './paginas/SeleccionArea';
import PanelEscritorio from './componentes/PanelEscritorio';
import AtrasNativoAndroid from './componentes/AtrasNativoAndroid';
import { guardarArea, limpiarArea } from './lib/area';
import { consumirAreaEnlaceDirecto, esContinuacionDocumento } from './lib/arranqueHistorialPWA';
import { prepararHistorialSelector, consumirRegresoPendiente, reiniciarHistorialSelector } from './lib/historialSelector';

const Mapa = lazy(() => import('./paginas/panel/Mapa'));
// El portal de cliente arrastra el mismo Leaflet que el mapa interno —de
// cargarlo aparte, quien va a terreno con el teléfono también lo bajaría,
// sin usarlo nunca.
const PortalCliente = lazy(() => import('./paginas/cliente/PortalCliente'));
// Propiedades es de administración: quien va a terreno con el teléfono no
// tiene por qué descargarla.
const Propiedades = lazy(() => import('./paginas/propiedades/Propiedades'));
const WhatsApp = lazy(() => import('./paginas/panel/WhatsApp'));
const ProveedoresRecepcion = lazy(() => import('./paginas/panel/ProveedoresRecepcion'));
const ProveedoresComunicaciones = lazy(() => import('./paginas/panel/ProveedoresComunicaciones'));
const Contabilidad = lazy(() => import('./paginas/panel/Contabilidad'));
const SEO = lazy(() => import('./paginas/panel/SEO'));
// Importar plantillas desde Excel es de oficina; el lector de Excel, además,
// se carga recién al usarlo (ver lib/excelPlantillas.js).
const ImportarPlantillas = lazy(() => import('./paginas/panel/ImportarPlantillas'));
import Despacho from './paginas/terreno/Despacho';

function Privada({ children }) {
  const { sesion, perfil, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!sesion) return <Navigate to="/ingreso" replace />;

  if (perfil && !perfil.activo) {
    return (
      <div className="cuerpo">
        <div className="aviso aviso-critico">
          Tu cuenta está desactivada. Habla con administración.
        </div>
      </div>
    );
  }
  return children;
}

function SoloInterno({ children }) {
  const { perfil, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  if (perfil?.rol === 'cliente') return <Navigate to="/portal" replace />;
  return children;
}

function SoloCliente({ children }) {
  const { perfil, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  if (perfil?.rol !== 'cliente') return <Navigate to="/" replace />;
  return children;
}

/* Solo admin, jefatura y superadmin tienen CRM además de la operación: son
 * quienes necesitan elegir. El resto (terreno, etc.) no tiene nada que
 * elegir y va directo a Inicio, sin una capa de por medio. */
function tieneCRM(perfil) {
  return Boolean(perfil) && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
}

/*
 * Pantalla inicial determinada exclusivamente por el perfil AUTORIZADO.
 * Nunca abrir el área que quedó guardada en una sesión anterior.
 * La elección de un módulo sigue guardándose durante la navegación activa,
 * pero no determina qué se muestra en la próxima apertura de la PWA.
 */
function Entrada() {
  const { perfil } = useSesion();
  if (perfil?.rol === 'cliente') return <Navigate to="/portal" replace />;
  if (!tieneCRM(perfil)) return <PanelEscritorio><Inicio /></PanelEscritorio>;
  return <SeleccionArea />;
}

function Interna({ children, anchoCompleto = false }) {
  return (
    <Privada>
      <SoloInterno>
        <PanelEscritorio anchoCompleto={anchoCompleto}>{children}</PanelEscritorio>
      </SoloInterno>
    </Privada>
  );
}

function Cliente({ children }) {
  return (
    <Privada>
      <SoloCliente>
        <PanelEscritorio>{children}</PanelEscritorio>
      </SoloCliente>
    </Privada>
  );
}

/*
 * Reglas de Atrás de toda la aplicación, antes de todas las Routes.
 * Se aplica también a rutas profundas sin PanelEscritorio (levantamientos,
 * diagnósticos), desde enlaces directos o una PWA restaurada.
 * El primer Atrás vuelve al Home permitido; el siguiente usa la salida
 * normal de Android. No fuerza cerrar sesión ni bloquea el navegador.
 */
function ProtegerHomeFinal() {
  const { sesion, perfil, cargando } = useSesion();
  const { pathname, search, hash } = useLocation();
  const navegar = useNavigate();
  const idUsuario = sesion?.user?.id;
  const idAnterior = useRef(undefined);

  useEffect(() => {
    if (idAnterior.current !== idUsuario) {
      reiniciarHistorialSelector();
      // Una recarga mantiene el área elegida: no debe devolver SEO al Home
      // ni alterar el destino del botón Volver. En un inicio nuevo sí se borra.
      if (idUsuario && !esContinuacionDocumento(window.performance, document.wasDiscarded)) {
        limpiarArea();
        // Un enlace directo de Coproactiva (correo) deja elegida el área de su
        // pantalla, igual que entrar desde el selector.
        const areaEnlace = consumirAreaEnlaceDirecto();
        if (areaEnlace) guardarArea(areaEnlace);
      }
      idAnterior.current = idUsuario;
    }
  }, [idUsuario]);

  useEffect(() => {
    if (cargando || !sesion || !perfil?.activo) return;
    const regreso = consumirRegresoPendiente(pathname);
    if (regreso) {
      navegar(regreso.destino, {
        state: regreso.esCliente
          ? { desdePortalCoproactiva: true }
          : regreso.puedeCambiarArea
            ? { desdeSelectorCoproactiva: true }
            : { desdeHomeAreaCoproactiva: true },
        preventScrollReset: true
      });
      return;
    }
    prepararHistorialSelector(
      navegar, { pathname, search, hash },
      window.history.state?.idx, true, tieneCRM(perfil), perfil.rol === 'cliente'
    );
  }, [cargando, sesion, perfil, pathname, search, hash, navegar]);
  return null;
}

export default function App() {
  const { sesion, cargando } = useSesion();

  useEffect(() => {
    if (cargando) return;
    // La apertura se muestra desde index.html ANTES de que React cargue.
    // Solo se retira al terminar la validación de la sesión y del perfil;
    // no se impone un retardo artificial al usuario.
    const splash = document.getElementById('splash-inicial');
    if (!splash) return;
    splash.classList.add('splash-finalizando');
    const quitar = window.setTimeout(() => splash.remove(), 260);
    return () => window.clearTimeout(quitar);
  }, [cargando]);

  return (
    <>
    <ProtegerHomeFinal />
    <AtrasNativoAndroid />
    <Routes>
      <Route path="/clave" element={<Clave />} />
      <Route path="/ingreso" element={sesion ? <Navigate to="/" replace /> : <Ingreso />} />

      <Route path="/" element={<Privada><Entrada /></Privada>} />

      {/* Portal cliente: consulta solamente. */}
      <Route path="/portal" element={
        <Cliente>
          <Suspense fallback={<p className="cargando">Cargando…</p>}><PortalCliente /></Suspense>
        </Cliente>
      } />
      <Route path="/portal/comunidades/:id" element={
        <Cliente>
          <Suspense fallback={<p className="cargando">Cargando…</p>}><PortalCliente /></Suspense>
        </Cliente>
      } />

      {/* Operación interna. El guard evita que un cliente entre pegando URLs.
          "/inicio" es fijo, sin el redirect de área de "/": todo botón "‹
          Inicio" del panel apunta acá, para no quedar en loop de vuelta al
          CRM cuando la área elegida es 'crm'. */}
      <Route path="/inicio" element={<Interna><Inicio /></Interna>} />
      <Route path="/ayuda" element={<Interna><Ayuda /></Interna>} />
      <Route path="/ayuda/practica-levantamiento" element={<Interna><PracticaLevantamiento /></Interna>} />
      <Route path="/configuracion" element={<Interna><Configuracion /></Interna>} />
      <Route path="/bitacora" element={<Interna><Bitacora /></Interna>} />
      <Route path="/bitacora/nueva" element={<Interna><Bitacora /></Interna>} />
      <Route path="/bitacora/:id" element={<Interna><Bitacora /></Interna>} />
      <Route path="/notificaciones" element={<Interna><Notificaciones /></Interna>} />
      <Route path="/mi-cuenta" element={<Interna><MiCuenta /></Interna>} />
      <Route path="/plantillas" element={<Interna><Plantillas /></Interna>} />
      <Route path="/plantillas/importar" element={
        <Interna>
          <Suspense fallback={<p className="cargando">Cargando…</p>}><ImportarPlantillas /></Suspense>
        </Interna>
      } />
      <Route path="/plantillas/:id" element={<Interna><EditorPlantilla /></Interna>} />
      <Route path="/equipo" element={<Interna><Equipo /></Interna>} />
      <Route path="/clientes" element={<Interna><Clientes /></Interna>} />
      <Route path="/pipeline" element={<Interna><Pipeline /></Interna>} />
      <Route path="/comunidades" element={<Interna><Comunidades /></Interna>} />
      <Route path="/comunidades/:id" element={<Interna><Comunidades /></Interna>} />
      <Route path="/mantenciones" element={<Interna><Mantenciones /></Interna>} />
      <Route path="/historico" element={<Navigate to="/comunidades" replace />} />
      <Route path="/mapa" element={
        <Interna anchoCompleto>
          <Suspense fallback={<p className="cargando">Cargando el mapa…</p>}>
            <Mapa />
          </Suspense>
        </Interna>
      } />
      <Route path="/propiedades" element={
        <Interna>
          <Suspense fallback={<p className="cargando">Cargando…</p>}><Propiedades /></Suspense>
        </Interna>
      } />
      <Route path="/propiedades/:id" element={
        <Interna>
          <Suspense fallback={<p className="cargando">Cargando…</p>}><Propiedades /></Suspense>
        </Interna>
      } />
      <Route path="/proveedores" element={<Interna><Proveedores /></Interna>} />
      <Route path="/proveedores/postulantes" element={<Interna><Suspense fallback={<p className="cargando">Cargando…</p>}><ProveedoresRecepcion vista="postulantes" /></Suspense></Interna>} />
      <Route path="/proveedores/correos" element={<Interna><Suspense fallback={<p className="cargando">Cargando…</p>}><ProveedoresRecepcion vista="correos" /></Suspense></Interna>} />
      <Route path="/proveedores/comunicaciones" element={<Interna><Suspense fallback={<p className="cargando">Cargando…</p>}><ProveedoresComunicaciones /></Suspense></Interna>} />
      <Route path="/whatsapp" element={<Interna><Suspense fallback={<p className="cargando">Cargando…</p>}><WhatsApp /></Suspense></Interna>} />
      <Route path="/whatsapp/:vista" element={<Interna><Suspense fallback={<p className="cargando">Cargando…</p>}><WhatsApp /></Suspense></Interna>} />
      <Route path="/proveedores/:id" element={<Interna><Proveedores /></Interna>} />

      <Route path="/seo" element={<Interna><Suspense fallback={<p className="cargando">Cargando SEO…</p>}><SEO /></Suspense></Interna>} />

      <Route path="/contabilidad" element={
        <Interna>
          <Suspense fallback={<p className="cargando">Cargando Contabilidad…</p>}><Contabilidad /></Suspense>
        </Interna>
      } />
      <Route path="/contabilidad/:vista" element={
        <Interna>
          <Suspense fallback={<p className="cargando">Cargando Contabilidad…</p>}><Contabilidad /></Suspense>
        </Interna>
      } />
      <Route path="/nuevo" element={<Interna><Programar /></Interna>} />
      <Route path="/control/:id/editar" element={<Interna><Programar /></Interna>} />
      <Route path="/control/:id" element={<Privada><SoloInterno><Despacho /></SoloInterno></Privada>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

