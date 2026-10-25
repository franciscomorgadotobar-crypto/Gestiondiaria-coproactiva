import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import biblioteca from '../datos/ley21442.contenidos.json';
import './BaseConocimientos.css';

export const EVENTO_BASE_CONOCIMIENTOS = 'coproactiva:base-conocimientos-abrir';
const INTERVALO_SEGUNDOS = 5 * 60;
const contenidos = biblioteca.contenidos;
const automaticas = contenidos.map((item, i) => item.automatico ? i : -1).filter(i => i >= 0);

/** Se evita interrumpir formularios, tareas de terreno y diálogos existentes. */
function momentoSeguro(pathname) {
  if (/^\/(ingreso|clave|nuevo|control|plantillas\/importar)(\/|$)/.test(pathname)) return false;
  if (/^\/(propiedades\/nueva|contabilidad\/asientos|bitacora\/nueva)(\/|$)/.test(pathname)) return false;
  if (document.hidden) return false;
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false;
  const activo = document.activeElement;
  if (activo?.matches?.('input, textarea, select, [contenteditable="true"]')) return false;
  return true;
}

export function abrirBaseConocimientos() {
  window.dispatchEvent(new Event(EVENTO_BASE_CONOCIMIENTOS));
}

/**
 * Popup no bloqueante, en el lado derecho: NO crea una pantalla o una ruta.
 * Todos los contenidos están disponibles con las flechas; las apariciones
 * automáticas usan solo las cápsulas marcadas como aptas en la biblioteca.
 */
export default function BaseConocimientos() {
  const { sesion, perfil } = useSesion();
  const { pathname, state } = useLocation();
  const habilitado = Boolean(sesion && perfil?.activo !== false);
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [restantes, setRestantes] = useState(INTERVALO_SEGUNDOS);
  const proximaAparicion = useRef(Date.now() + INTERVALO_SEGUNDOS * 1000);
  const contenido = contenidos[indice] || contenidos[0];
  const cantidad = contenidos.length;

  const etiquetaTiempo = useMemo(() =>
    Math.floor(restantes / 60) + ':' + String(restantes % 60).padStart(2, '0'), [restantes]);

  useEffect(() => {
    if (!habilitado) {
      setAbierto(false);
      return undefined;
    }
    const abrir = () => { setAbierto(true); setDetalle(false); };
    window.addEventListener(EVENTO_BASE_CONOCIMIENTOS, abrir);
    return () => window.removeEventListener(EVENTO_BASE_CONOCIMIENTOS, abrir);
  }, [habilitado]);

  // Permite abrir el popup desde el selector inicial de módulos.
  useEffect(() => {
    if (habilitado && state?.abrirBaseConocimientos === true) {
      setAbierto(true);
      setDetalle(false);
    }
  }, [habilitado, state]);

  useEffect(() => {
    proximaAparicion.current = Date.now() + INTERVALO_SEGUNDOS * 1000;
    setRestantes(INTERVALO_SEGUNDOS);
  }, [sesion?.user?.id, pausado]);

  useEffect(() => {
    if (!habilitado || pausado || !automaticas.length) return undefined;
    const timer = window.setInterval(() => {
      const segundos = Math.max(0, Math.ceil((proximaAparicion.current - Date.now()) / 1000));
      setRestantes(segundos);
      if (segundos !== 0) return;
      if (momentoSeguro(pathname) && !detalle) {
        setIndice(actual => {
          const pos = automaticas.indexOf(actual);
          return automaticas[(pos + 1) % automaticas.length];
        });
        setAbierto(true);
      }
      // Nunca acumular popups pendientes; reintentar en el siguiente intervalo.
      proximaAparicion.current = Date.now() + INTERVALO_SEGUNDOS * 1000;
      setRestantes(INTERVALO_SEGUNDOS);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [habilitado, pausado, pathname, detalle]);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarEscape = evento => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        setDetalle(false);
      }
    };
    window.addEventListener('keydown', cerrarEscape);
    return () => window.removeEventListener('keydown', cerrarEscape);
  }, [abierto]);

  function desplazar(paso) {
    setIndice(actual => (actual + paso + cantidad) % cantidad);
    setDetalle(false);
  }

  if (!habilitado || !abierto || !contenido) return null;

  return (
    <aside className="base-conocimientos-popup" role="dialog" aria-modal="false"
           aria-label="Base de conocimientos · Cápsula educativa">
      <div className="base-conocimientos-popup__encabezado">
        <div className="base-conocimientos-popup__identidad">
          <span className="base-conocimientos-popup__simbolo" aria-hidden="true">✦</span>
          <div>
            <strong>Base de conocimientos</strong>
            <span>Cápsulas educativas · Ley 21.442</span>
          </div>
        </div>
        <button type="button" className="base-conocimientos-popup__cerrar"
                aria-label="Cerrar cápsula" onClick={() => { setAbierto(false); setDetalle(false); }}>×</button>
      </div>

      <div className="base-conocimientos-popup__contenido" aria-live="polite">
        <div className="base-conocimientos-popup__superior">
          <span>¿Sabías que…?</span>
          <small>{indice + 1} de {cantidad}</small>
        </div>
        <h2>{contenido.texto}</h2>
        <div className="base-conocimientos-popup__fuente">{contenido.referencia} · Ley 21.442</div>

        {detalle && (
          <section className="base-conocimientos-popup__detalle" aria-label="Explicación de la cápsula">
            <h3>{contenido.titulo}</h3>
            <p>{contenido.explicacion}</p>
            {contenido.precaucion && <p className="base-conocimientos-popup__nota">{contenido.precaucion}</p>}
            <a href={biblioteca.url_oficial} target="_blank" rel="noopener noreferrer">
              Consultar texto de la ley ↗
            </a>
            <small>{biblioteca.aviso}</small>
          </section>
        )}
        <button type="button" className="base-conocimientos-popup__mas"
                onClick={() => setDetalle(valor => !valor)}
                aria-expanded={detalle}>
          {detalle ? 'Ver menos' : 'Conoce más'} <span aria-hidden="true">{detalle ? '↑' : '↗'}</span>
        </button>
      </div>

      <div className="base-conocimientos-popup__navegacion">
        <button type="button" onClick={() => desplazar(-1)} aria-label="Cápsula anterior">‹</button>
        <span>{indice + 1} / {cantidad}</span>
        <button type="button" className="base-conocimientos-popup__siguiente"
                onClick={() => desplazar(1)} aria-label="Siguiente cápsula">›</button>
      </div>
      <div className="base-conocimientos-popup__pie">
        <span>{pausado ? 'Apariciones automáticas pausadas' : 'Próxima cápsula en ' + etiquetaTiempo}</span>
        <button type="button" onClick={() => setPausado(valor => !valor)}>
          {pausado ? 'Reanudar' : 'Pausar'}
        </button>
      </div>
    </aside>
  );
}
