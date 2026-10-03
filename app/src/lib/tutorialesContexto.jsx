import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { useSesion } from './sesion';
import { TUTORIALES, tutorialesParaRol } from './tutoriales';

const ContextoTutoriales = createContext(null);

function clave(id, version) {
  return `${id}:${version}`;
}

export function ProveedorTutoriales({ children }) {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [asignaciones, setAsignaciones] = useState({});
  const [progreso, setProgreso] = useState({});
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(null);
  const [oferta, setOferta] = useState(null);
  const [elemento, setElemento] = useState(null);
  const perfilAnterior = useRef(null);

  async function recargar() {
    if (!perfil?.id) {
      setAsignaciones({});
      setProgreso({});
      return;
    }
    setCargando(true);
    const [a, p] = await Promise.all([
      supabase.from('tutorial_asignaciones')
        .select('perfil_id,tutorial_id,version,iniciar_automaticamente,asignado_en')
        .eq('perfil_id', perfil.id),
      supabase.from('tutorial_progreso')
        .select('perfil_id,tutorial_id,version,estado,paso_actual,iniciado_en,completado_en,actualizado_en')
        .eq('perfil_id', perfil.id)
    ]);
    if (!a.error) {
      setAsignaciones(Object.fromEntries((a.data ?? []).map(x => [clave(x.tutorial_id, x.version), x])));
    }
    if (!p.error) {
      setProgreso(Object.fromEntries((p.data ?? []).map(x => [clave(x.tutorial_id, x.version), x])));
    }
    setCargando(false);
  }

  useEffect(() => {
    if (perfilAnterior.current !== perfil?.id) {
      setActivo(null);
      setOferta(null);
      perfilAnterior.current = perfil?.id ?? null;
    }
    recargar();
  }, [perfil?.id]);

  const disponibles = useMemo(
    () => tutorialesParaRol(perfil?.rol),
    [perfil?.rol]
  );

  // Una asignación automática se ofrece una vez por sesión. "Más tarde" no
  // borra ni completa nada: simplemente evita insistir durante esta sesión.
  useEffect(() => {
    if (!perfil?.id || cargando || activo || oferta) return;
    for (const t of disponibles) {
      const k = clave(t.id, t.version);
      const a = asignaciones[k];
      const p = progreso[k];
      const pospuesta = sessionStorage.getItem(`tutorial-pospuesto:${perfil.id}:${k}`);
      if (a?.iniciar_automaticamente && p?.estado !== 'completado' && !pospuesta) {
        setOferta(t.id);
        break;
      }
    }
  }, [perfil?.id, cargando, activo, oferta, disponibles, asignaciones, progreso]);

  async function guardarProgreso(tutorial, estado, pasoActual, extra = {}) {
    if (!perfil?.id) return;
    const ahora = new Date().toISOString();
    const previo = progreso[clave(tutorial.id, tutorial.version)];
    const fila = {
      perfil_id: perfil.id,
      tutorial_id: tutorial.id,
      version: tutorial.version,
      estado,
      paso_actual: pasoActual,
      iniciado_en: previo?.iniciado_en ?? (estado === 'pendiente' ? null : ahora),
      completado_en: estado === 'completado' ? ahora : null,
      actualizado_en: ahora,
      ...extra
    };
    setProgreso(p => ({ ...p, [clave(tutorial.id, tutorial.version)]: fila }));
    const { error } = await supabase.from('tutorial_progreso').upsert(fila, {
      onConflict: 'perfil_id,tutorial_id,version'
    });
    if (error) console.error('No se pudo guardar progreso del tutorial:', error.message);
  }

  async function iniciar(id, { continuar = true } = {}) {
    const tutorial = TUTORIALES[id];
    if (!tutorial || !perfil?.id) return;
    const p = progreso[clave(id, tutorial.version)];
    const pasoGuardado = continuar && p?.estado === 'en_curso' ? p.paso_actual : 0;
    const paso = Math.min(Math.max(0, pasoGuardado ?? 0), tutorial.pasos.length - 1);
    setOferta(null);
    setActivo({ id, paso });
    if (ubicacion.pathname !== tutorial.ruta) navegar(tutorial.ruta);
    await guardarProgreso(tutorial, 'en_curso', paso);
  }

  function posponerOferta() {
    if (!oferta || !perfil?.id) return;
    const t = TUTORIALES[oferta];
    sessionStorage.setItem(
      `tutorial-pospuesto:${perfil.id}:${clave(t.id, t.version)}`,
      '1'
    );
    setOferta(null);
  }

  async function salirTutorial() {
    if (!activo) return;
    const t = TUTORIALES[activo.id];
    await guardarProgreso(t, 'en_curso', activo.paso);
    setActivo(null);
    setElemento(null);
  }

  async function completar() {
    if (!activo) return;
    const t = TUTORIALES[activo.id];
    await guardarProgreso(t, 'completado', t.pasos.length - 1);
    setActivo(null);
    setElemento(null);
  }

  async function avanzar() {
    if (!activo) return;
    const t = TUTORIALES[activo.id];
    const siguiente = activo.paso + 1;
    if (siguiente >= t.pasos.length) return completar();
    setActivo(a => ({ ...a, paso: siguiente }));
    await guardarProgreso(t, 'en_curso', siguiente);
  }

  async function retroceder() {
    if (!activo || activo.paso === 0) return;
    const t = TUTORIALES[activo.id];
    const anterior = activo.paso - 1;
    setActivo(a => ({ ...a, paso: anterior }));
    await guardarProgreso(t, 'en_curso', anterior);
  }

  // Encuentra el elemento del paso incluso cuando aparece después de una
  // acción (abrir categoría, elegir pregunta, etc.).
  useEffect(() => {
    if (!activo) {
      setElemento(null);
      return;
    }
    const tutorial = TUTORIALES[activo.id];
    const paso = tutorial?.pasos[activo.paso];
    if (!paso) return;

    let vivo = true;
    let observado = null;
    let temporizador = null;

    const buscar = () => {
      if (!vivo) return false;
      const candidatos = [...document.querySelectorAll(paso.selector)];
      const encontrado = candidatos.find(el => {
        const r = el.getBoundingClientRect();
        const estilo = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && estilo.display !== 'none' && estilo.visibility !== 'hidden';
      }) ?? candidatos[0];
      if (!encontrado) return false;
      setElemento(encontrado);
      const r = encontrado.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 120) {
        encontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    };

    if (!buscar()) {
      observado = new MutationObserver(() => {
        if (buscar()) observado?.disconnect();
      });
      observado.observe(document.body, { subtree: true, childList: true, attributes: true });
      temporizador = setInterval(() => {
        if (buscar()) clearInterval(temporizador);
      }, 250);
    }

    return () => {
      vivo = false;
      observado?.disconnect();
      if (temporizador) clearInterval(temporizador);
      setElemento(null);
    };
  }, [activo?.id, activo?.paso, ubicacion.pathname]);

  // Los pasos interactivos avanzan cuando la persona realiza la acción
  // solicitada sobre el elemento resaltado.
  useEffect(() => {
    if (!activo || !elemento) return;
    const paso = TUTORIALES[activo.id]?.pasos[activo.paso];
    if (paso?.accion !== 'click') return;
    const alClick = () => setTimeout(() => avanzar(), 40);
    elemento.addEventListener('click', alClick, { once: true });
    return () => elemento.removeEventListener('click', alClick);
  }, [activo?.id, activo?.paso, elemento]);

  const valor = {
    disponibles,
    asignaciones,
    progreso,
    cargando,
    activo,
    oferta,
    iniciar,
    posponerOferta,
    salirTutorial,
    avanzar,
    retroceder,
    recargar,
    estadoDe(t) {
      const k = clave(t.id, t.version);
      return {
        asignado: Boolean(asignaciones[k]),
        progreso: progreso[k] ?? null
      };
    }
  };

  return (
    <ContextoTutoriales.Provider value={valor}>
      {children}
      <CapaTutorial
        activo={activo}
        oferta={oferta}
        elemento={elemento}
        onIniciar={() => oferta && iniciar(oferta)}
        onPosponer={posponerOferta}
        onSalir={salirTutorial}
        onReiniciar={() => activo && iniciar(activo.id, { continuar: false })}
        onAvanzar={avanzar}
        onRetroceder={retroceder}
      />
    </ContextoTutoriales.Provider>
  );
}

function CapaTutorial({ activo, oferta, elemento, onIniciar, onPosponer, onSalir, onReiniciar, onAvanzar, onRetroceder }) {
  const [, refrescar] = useState(0);

  useEffect(() => {
    if (!activo || !elemento) return;
    const actualizar = () => refrescar(x => x + 1);
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    const ro = new ResizeObserver(actualizar);
    ro.observe(elemento);
    return () => {
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('scroll', actualizar, true);
      ro.disconnect();
    };
  }, [activo, elemento]);

  if (oferta && !activo) {
    const t = TUTORIALES[oferta];
    return (
      <div className="tutorial-oferta-fondo" role="dialog" aria-modal="true">
        <div className="tutorial-oferta tarjeta">
          <span className="etiqueta-grupo">Capacitación asignada</span>
          <h2 className="h3">{t.nombre}</h2>
          <p className="chico apagado">{t.descripcion}</p>
          <p className="micro apagado">Duración aproximada: {t.duracion} min</p>
          <div className="fila-botones">
            <button type="button" className="boton boton-secundario" onClick={onPosponer}>Más tarde</button>
            <button type="button" className="boton" onClick={onIniciar}>Comenzar</button>
          </div>
        </div>
      </div>
    );
  }

  if (!activo) return null;
  const t = TUTORIALES[activo.id];
  const paso = t.pasos[activo.paso];

  if (!elemento) {
    return (
      <div className="tutorial-espera">
        <div className="tutorial-tarjeta tarjeta">
          <span className="etiqueta-grupo">{t.nombre}</span>
          <p className="chico" style={{ margin: '8px 0 14px' }}>
            Preparando el siguiente paso…
          </p>
          <div className="fila-botones">
            <button type="button" className="boton boton-secundario" onClick={onSalir}>Salir</button>
            <button type="button" className="boton" onClick={onReiniciar}>Reiniciar tutorial</button>
          </div>
        </div>
      </div>
    );
  }

  const r = elemento.getBoundingClientRect();
  const margen = 6;
  const hueco = {
    top: Math.max(0, r.top - margen),
    left: Math.max(0, r.left - margen),
    right: Math.min(window.innerWidth, r.right + margen),
    bottom: Math.min(window.innerHeight, r.bottom + margen)
  };
  const esAccion = paso.accion === 'click';

  return (
    <div className="tutorial-capa" aria-live="polite">
      <div className="tutorial-bloque" style={{ left: 0, top: 0, right: 0, height: hueco.top }} />
      <div className="tutorial-bloque" style={{ left: 0, top: hueco.top, width: hueco.left, height: hueco.bottom - hueco.top }} />
      <div className="tutorial-bloque" style={{ left: hueco.right, top: hueco.top, right: 0, height: hueco.bottom - hueco.top }} />
      <div className="tutorial-bloque" style={{ left: 0, top: hueco.bottom, right: 0, bottom: 0 }} />
      <div
        className="tutorial-marco"
        style={{
          left: hueco.left,
          top: hueco.top,
          width: hueco.right - hueco.left,
          height: hueco.bottom - hueco.top
        }}
      />

      <div className="tutorial-tarjeta tarjeta">
        <div className="fila" style={{ marginBottom: 8 }}>
          <span className="etiqueta-grupo crece">{t.nombre}</span>
          <span className="micro">{activo.paso + 1} / {t.pasos.length}</span>
        </div>
        <h2 className="h3">{paso.titulo}</h2>
        <p className="chico apagado" style={{ margin: '6px 0 14px' }}>{paso.texto}</p>
        {esAccion && <p className="micro tutorial-instruccion">Toca el elemento resaltado para continuar.</p>}
        <div className="fila" style={{ gap: 8 }}>
          <button type="button" className="boton boton-texto" onClick={onSalir}>Salir</button>
          <span className="crece" />
          {activo.paso > 0 && (
            <button type="button" className="boton boton-secundario" onClick={onRetroceder}>Anterior</button>
          )}
          {!esAccion && (
            <button type="button" className="boton" onClick={onAvanzar}>
              {activo.paso === t.pasos.length - 1 ? 'Finalizar tutorial' : 'Siguiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useTutoriales() {
  const v = useContext(ContextoTutoriales);
  if (!v) throw new Error('useTutoriales debe usarse dentro de ProveedorTutoriales');
  return v;
}
