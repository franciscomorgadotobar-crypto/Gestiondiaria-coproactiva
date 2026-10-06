import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* La campana y la barra inferior comparten las mismas fuentes:
 * notificaciones generales + notificaciones de mantención. Las tareas
 * "Por hacer" no cuentan como notificaciones; se gestionan en el Home. */
export default function Campana({ miId }) {
  const navegar = useNavigate();
  const [total, setTotal] = useState(0);
  const [urgentes, setUrgentes] = useState(0);

  useEffect(() => {
    if (!miId) return;
    let vigente = true;

    async function cargar() {
      const [g, m, u] = await Promise.all([
        supabase.from('notificaciones')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', miId)
          .eq('leida', false),
        supabase.from('notificaciones_mantenimiento')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', miId)
          .eq('leida', false),
        supabase.from('notificaciones')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', miId)
          .eq('leida', false)
          .eq('tipo', 'bitacora_urgente')
      ]);

      if (!vigente) return;
      setTotal((g.count ?? 0) + (m.count ?? 0));
      setUrgentes(u.count ?? 0);
    }

    cargar();
    const escuchar = () => cargar();
    window.addEventListener('coproactiva:notificaciones-cambio', escuchar);
    return () => {
      vigente = false;
      window.removeEventListener('coproactiva:notificaciones-cambio', escuchar);
    };
  }, [miId]);

  return (
    <button
      type="button"
      className={'campana' + (total === 0 ? ' sin-pendientes' : '')}
      onClick={() => navegar('/notificaciones')}
      aria-label={total === 0 ? 'Sin notificaciones' : total + ' notificaciones sin leer'}
      title="Notificaciones"
    >
      🔔
      {total > 0 && (
        <span className={'globo' + (urgentes > 0 ? ' critico' : '')}>
          {total > 99 ? '99+' : total}
        </span>
      )}
    </button>
  );
}
