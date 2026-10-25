import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import biblioteca from '../datos/ley21442.contenidos.json';
import {
  CLAVE_INICIO, CLAVE_RECIENTES, EVENTO_PREFERENCIA,
  elegirCapsula, leerAutomaticas
} from '../lib/conocimientos';
import './BaseConocimientos.css';

const INTERVALO = 5 * 60 * 1000;
const DURACION = 7000;
const INICIO = 3500;

function puedePresentarse(pathname) {
  if (document.hidden || pathname === '/conocimientos') return false;
  if (/^\/(ingreso|clave|portal|nuevo|control|plantillas\/importar)(\/|$)/.test(pathname)) return false;
  if (/^\/(propiedades\/nueva|contabilidad\/asientos|bitacora\/nueva)(\/|$)/.test(pathname)) return false;
  if (document.querySelector('[aria-modal="true"], dialog[open]')) return false;
  if (document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return false;
  return true;
}

/**
 * Misma mecánica que la mascota del CRM (bonvallet.js):
 * mensaje pequeño, no modal, entrada por la derecha, cierre tras 7 s,
 * bienvenida una vez por sesión, rotación sin repeticiones y preferencia
 * individual de activación. Cada 5 minutos hay una nueva oportunidad.
 */
export default function BaseConocimientos() {
  const { sesion, perfil, cargando } = useSesion();
  const usuarioId = sesion?.user?.id;
  const activo = Boolean(usuarioId && !cargando && perfil?.activo && perfil?.rol !== 'cliente');
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const rutaActual = useRef(pathname);
  const [habilitado, setHabilitado] = useState(() => leerAutomaticas(usuarioId));
  const [capsula, setCapsula] = useState(null);
  const [visible, setVisible] = useState(false);
  const salida = useRef(null);
  const ocultar = useRef(null);
  const recientes = useRef([]);

  useEffect(() => { rutaActual.current = pathname; }, [pathname]);

  useEffect(() => {
    setHabilitado(leerAutomaticas(usuarioId));
    setCapsula(null);
    setVisible(false);
    try {
      const guardadas = JSON.parse(sessionStorage.getItem(CLAVE_RECIENTES + usuarioId) || '[]');
      recientes.current = Array.isArray(guardadas) ? guardadas : [];
    } catch { recientes.current = []; }
    const recibir = e => {
      if (e.detail?.usuarioId === usuarioId) setHabilitado(Boolean(e.detail.activas));
    };
    window.addEventListener(EVENTO_PREFERENCIA, recibir);
    return () => window.removeEventListener(EVENTO_PREFERENCIA, recibir);
  }, [usuarioId]);

  const cerrar = useCallback(() => {
    clearTimeout(ocultar.current);
    setVisible(false);
    ocultar.current = window.setTimeout(() => setCapsula(null), 370);
  }, []);

  const mostrar = useCallback((forzar = false) => {
    if (!activo || !habilitado || (!forzar && !puedePresentarse(rutaActual.current))) return false;
    const elegida = elegirCapsula(biblioteca.contenidos, recientes.current);
    if (!elegida) return false;
    recientes.current = [elegida.id, ...recientes.current.filter(id => id !== elegida.id)].slice(0, 5);
    try { sessionStorage.setItem(CLAVE_RECIENTES + usuarioId, JSON.stringify(recientes.current)); } catch {}
    clearTimeout(ocultar.current);
    clearTimeout(salida.current);
    setCapsula(elegida);
    // Doble frame para permitir el deslizamiento CSS aun cuando el aviso se crea ahora.
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    salida.current = window.setTimeout(cerrar, DURACION);
    return true;
  }, [activo, habilitado, usuarioId, cerrar]);

  useEffect(() => {
    if (!activo || !habilitado) {
      clearTimeout(salida.current);
      setVisible(false);
      return undefined;
    }
    const bienvenida = window.setTimeout(() => {
      const clave = CLAVE_INICIO + usuarioId;
      let vista = false;
      try { vista = sessionStorage.getItem(clave) === '1'; } catch {}
      if (!vista && mostrar()) {
        try { sessionStorage.setItem(clave, '1'); } catch {}
      }
    }, INICIO);
    const intervalo = window.setInterval(() => mostrar(), INTERVALO);
    return () => {
      window.clearTimeout(bienvenida);
      window.clearInterval(intervalo);
      clearTimeout(salida.current);
      clearTimeout(ocultar.current);
    };
  }, [activo, habilitado, usuarioId, mostrar]);

  if (!activo || !habilitado || !capsula) return null;

  return (
    <aside className={'conocimiento-mascota' + (visible ? ' is-visible' : '')}
      role="status" aria-live="polite" aria-atomic="true">
      <div className="conocimiento-mascota__icono" aria-hidden="true">?</div>
      <div className="conocimiento-mascota__cuerpo">
        <div className="conocimiento-mascota__cabecera">
          <strong>¿Sabías que…?</strong>
          <button type="button" onClick={cerrar} aria-label="Cerrar dato educativo">×</button>
        </div>
        <p className="conocimiento-mascota__texto">{capsula.texto}</p>
        <small className="conocimiento-mascota__articulo">{capsula.referencia} · Ley 21.442</small>
        <div className="conocimiento-mascota__acciones">
          <button type="button" className="conocimiento-mascota__enlace" onClick={() => {
            cerrar();
            navegar('/conocimientos?capsula=' + encodeURIComponent(capsula.id));
          }}>Conoce más ↗</button>
          <button type="button" className="conocimiento-mascota__siguiente"
            onClick={() => mostrar(true)} aria-label="Siguiente dato educativo">Siguiente ›</button>
        </div>
      </div>
    </aside>
  );
}
