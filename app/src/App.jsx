import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import Ingreso from './paginas/Ingreso';
import Clave from './paginas/Clave';
import Inicio from './paginas/panel/Inicio';
import Plantillas from './paginas/panel/Plantillas';
import EditorPlantilla from './paginas/panel/Plantilla';
import Programar from './paginas/panel/Programar';
import Equipo from './paginas/panel/Equipo';
import Comunidades from './paginas/panel/Comunidades';
import Clientes from './paginas/panel/Clientes';
import Configuracion from './paginas/panel/Configuracion';
import Pipeline from './paginas/panel/Pipeline';
import SeleccionArea from './paginas/SeleccionArea';
import PanelEscritorio from './componentes/PanelEscritorio';
import { areaGuardada } from './lib/area';

const Mapa = lazy(() => import('./paginas/panel/Mapa'));
// El portal de cliente arrastra el mismo Leaflet que el mapa interno —de
// cargarlo aparte, quien va a terreno con el teléfono también lo bajaría,
// sin usarlo nunca.
const PortalCliente = lazy(() => import('./paginas/cliente/PortalCliente'));
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

function Entrada() {
  const { perfil } = useSesion();
  if (perfil?.rol === 'cliente') return <Navigate to="/portal" replace />;
  if (!tieneCRM(perfil)) return <PanelEscritorio><Inicio /></PanelEscritorio>;

  const area = areaGuardada();
  if (area === 'crm') return <Navigate to="/pipeline" replace />;
  if (area === 'operacion') return <PanelEscritorio><Inicio /></PanelEscritorio>;
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

export default function App() {
  const { sesion } = useSesion();
  return (
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
      <Route path="/configuracion" element={<Interna><Configuracion /></Interna>} />
      <Route path="/plantillas" element={<Interna><Plantillas /></Interna>} />
      <Route path="/plantillas/:id" element={<Interna><EditorPlantilla /></Interna>} />
      <Route path="/equipo" element={<Interna><Equipo /></Interna>} />
      <Route path="/clientes" element={<Interna><Clientes /></Interna>} />
      <Route path="/pipeline" element={<Interna><Pipeline /></Interna>} />
      <Route path="/comunidades" element={<Interna><Comunidades /></Interna>} />
      <Route path="/comunidades/:id" element={<Interna><Comunidades /></Interna>} />
      <Route path="/historico" element={<Navigate to="/comunidades" replace />} />
      <Route path="/mapa" element={
        <Interna anchoCompleto>
          <Suspense fallback={<p className="cargando">Cargando el mapa…</p>}>
            <Mapa />
          </Suspense>
        </Interna>
      } />
      <Route path="/nuevo" element={<Interna><Programar /></Interna>} />
      <Route path="/control/:id/editar" element={<Interna><Programar /></Interna>} />
      <Route path="/control/:id" element={<Privada><SoloInterno><Despacho /></SoloInterno></Privada>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
