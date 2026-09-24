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
import Pipeline from './paginas/panel/Pipeline';
import PanelEscritorio from './componentes/PanelEscritorio';

const Mapa = lazy(() => import('./paginas/panel/Mapa'));
// El portal de cliente arrastra el mismo Leaflet que el mapa interno —de
// cargarlo aparte, quien va a terreno con el teléfono también lo bajaría,
// sin usarlo nunca.
const PortalCliente = lazy(() => import('./paginas/cliente/PortalCliente'));
import Levantamiento from './paginas/terreno/Control';

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

function Entrada() {
  const { perfil } = useSesion();
  if (perfil?.rol === 'cliente') return <Navigate to="/portal" replace />;
  return <PanelEscritorio><Inicio /></PanelEscritorio>;
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

      {/* Operación interna. El guard evita que un cliente entre pegando URLs. */}
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
      <Route path="/control/:id" element={<Privada><SoloInterno><Levantamiento /></SoloInterno></Privada>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
