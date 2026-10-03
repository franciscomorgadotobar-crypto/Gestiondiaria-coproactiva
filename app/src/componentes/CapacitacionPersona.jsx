import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CapacitacionPersona({ persona }) {
  const [tutoriales, setTutoriales] = useState([]);
  const [asignadas, setAsignadas] = useState({});
  const [progreso, setProgreso] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { cargar(); }, [persona.id, persona.rol]);

  async function cargar() {
    const [t, a, p] = await Promise.all([
      supabase.from('tutoriales').select('id,nombre,descripcion,version,duracion_min,roles,orden')
        .eq('activo', true).order('orden'),
      supabase.from('tutorial_asignaciones').select('*').eq('perfil_id', persona.id),
      supabase.from('tutorial_progreso').select('*').eq('perfil_id', persona.id)
    ]);
    if (t.error || a.error || p.error) {
      setError(t.error?.message ?? a.error?.message ?? p.error?.message);
      return;
    }
    setTutoriales((t.data ?? []).filter(x => (x.roles ?? []).includes(persona.rol)));
    setAsignadas(Object.fromEntries((a.data ?? []).map(x => [`${x.tutorial_id}:${x.version}`, x])));
    setProgreso(Object.fromEntries((p.data ?? []).map(x => [`${x.tutorial_id}:${x.version}`, x])));
  }

  async function asignar(t, si) {
    setGuardando(true);
    setError(null);
    const k = `${t.id}:${t.version}`;
    if (si) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tutorial_asignaciones').upsert({
        perfil_id: persona.id,
        tutorial_id: t.id,
        version: t.version,
        iniciar_automaticamente: true,
        asignado_por: user?.id ?? null
      }, { onConflict: 'perfil_id,tutorial_id,version' });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('tutorial_asignaciones').delete()
        .eq('perfil_id', persona.id).eq('tutorial_id', t.id).eq('version', t.version);
      if (error) setError(error.message);
    }
    setGuardando(false);
    await cargar();
  }

  async function cambiarAuto(t, valor) {
    setGuardando(true);
    const { error } = await supabase.from('tutorial_asignaciones')
      .update({ iniciar_automaticamente: valor })
      .eq('perfil_id', persona.id).eq('tutorial_id', t.id).eq('version', t.version);
    if (error) setError(error.message);
    setGuardando(false);
    await cargar();
  }

  async function reiniciar(t) {
    if (!confirm(`¿Volver a asignar “${t.nombre}” desde el primer paso?`)) return;
    setGuardando(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const ahora = new Date().toISOString();
    const [a, p] = await Promise.all([
      supabase.from('tutorial_asignaciones').upsert({
        perfil_id: persona.id,
        tutorial_id: t.id,
        version: t.version,
        iniciar_automaticamente: true,
        asignado_por: user?.id ?? null,
        asignado_en: ahora
      }, { onConflict: 'perfil_id,tutorial_id,version' }),
      supabase.from('tutorial_progreso').upsert({
        perfil_id: persona.id,
        tutorial_id: t.id,
        version: t.version,
        estado: 'pendiente',
        paso_actual: 0,
        iniciado_en: null,
        completado_en: null,
        actualizado_en: ahora
      }, { onConflict: 'perfil_id,tutorial_id,version' })
    ]);
    if (a.error || p.error) setError(a.error?.message ?? p.error?.message);
    setGuardando(false);
    await cargar();
  }

  return (
    <div className="capacitacion-persona">
      <div className="fila" style={{ marginBottom: 8 }}>
        <label className="etiqueta-campo crece" style={{ margin: 0 }}>Capacitación</label>
        {guardando && <span className="micro apagado">Guardando…</span>}
      </div>
      <p className="micro apagado" style={{ margin: '0 0 10px' }}>
        Asigna tutoriales y decide si deben aparecer al próximo ingreso.
      </p>
      {error && <div className="aviso aviso-critico" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="lista-tutoriales-admin">
        {tutoriales.map(t => {
          const k = `${t.id}:${t.version}`;
          const a = asignadas[k];
          const p = progreso[k];
          const estado = p?.estado === 'completado'
            ? 'Completado'
            : p?.estado === 'en_curso' ? 'En curso'
            : a ? 'Pendiente' : 'No asignado';
          return (
            <div key={k} className="tutorial-admin-fila">
              <label className={'marca' + (a ? ' activa' : '')}>
                <input type="checkbox" checked={Boolean(a)} disabled={guardando}
                       onChange={e => asignar(t, e.target.checked)} />
                <span>
                  <strong>{t.nombre}</strong>
                  <small>{t.duracion_min} min · {estado}</small>
                </span>
              </label>

              {a && (
                <div className="tutorial-admin-acciones">
                  <label className="marca compacta">
                    <input type="checkbox" checked={a.iniciar_automaticamente}
                           disabled={guardando}
                           onChange={e => cambiarAuto(t, e.target.checked)} />
                    <span>Mostrar al ingresar</span>
                  </label>
                  {p?.estado === 'completado' && (
                    <button type="button" className="boton boton-texto"
                            disabled={guardando} onClick={() => reiniciar(t)}>
                      Reasignar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
