import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import './Notificaciones.css';

function fechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function Notificaciones() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  useVolverGlobal(() => navegar('/'));

  const [generales, setGenerales] = useState(null);
  const [mantenciones, setMantenciones] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    if (!perfil?.id) return;
    const [g, m] = await Promise.all([
      supabase.from('notificaciones')
        .select('id,tipo,titulo,mensaje,bitacora_id,prospecto_id,proveedor_id,correo_origen,correo_registro_id,leida,creado_en')
        .eq('destinatario_id', perfil.id)
        .order('creado_en', { ascending: false })
        .limit(100),
      supabase.from('notificaciones_mantenimiento')
        .select('id,tipo,titulo,mensaje,actividad_id,leida,creado_en')
        .eq('destinatario_id', perfil.id)
        .order('creado_en', { ascending: false })
        .limit(100)
    ]);

    if (g.error) return setError(g.error.message);
    if (m.error) return setError(m.error.message);
    setGenerales(g.data ?? []);
    setMantenciones(m.data ?? []);
  }

  useEffect(() => {
    if (!perfil?.id) return;
    cargar();
    const intervalo=window.setInterval(cargar,60000);
    return ()=>window.clearInterval(intervalo);
  }, [perfil?.id]);

  async function marcarLeida(tabla, id) {
    await supabase.from(tabla)
      .update({ leida: true, leida_en: new Date().toISOString() })
      .eq('id', id);
    if (tabla === 'notificaciones') {
      setGenerales(xs => (xs ?? []).map(x => x.id === id ? { ...x, leida: true } : x));
    } else {
      setMantenciones(xs => (xs ?? []).map(x => x.id === id ? { ...x, leida: true } : x));
    }
    window.dispatchEvent(new CustomEvent('coproactiva:notificaciones-cambio'));
  }

  const todas = [
    ...(generales ?? []).map(x => ({ ...x, origen: 'bitacora', tabla: 'notificaciones' })),
    ...(mantenciones ?? []).map(x => ({ ...x, origen: 'mantencion', tabla: 'notificaciones_mantenimiento' }))
  ].sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));

  const sinLeer = todas.filter(x => !x.leida).length;
  const tituloEstado = sinLeer > 0 ? `${sinLeer} sin leer` : todas.length ? 'Todas revisadas' : 'Estás al día.';

  return (
    <div className="pantalla notificaciones-pantalla modulo-unificado">
      <header className="encabezado modulo-cabecera">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/')}>
            ‹ Home
          </button>
        </div>
        <h1 className="h3">Notificaciones</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          {tituloEstado}
        </p>
      </header>

      <div className="cuerpo notificaciones-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {(generales === null || mantenciones === null) && !error && <p className="cargando">Cargando…</p>}

        {generales !== null && mantenciones !== null && todas.length === 0 && (
          <div className="tarjeta notificaciones-vacio">
            <strong>Sin notificaciones</strong>
            <p className="chico apagado">Cuando haya algo que requiera tu atención aparecerá aquí.</p>
          </div>
        )}

        <div className="notificaciones-lista">
          {todas.map(n => {
            const urgente = n.tipo === 'bitacora_urgente';
            const esProspectoWeb = n.tipo === 'lead_web';
            const esAperturaCorreo = n.tipo === 'correo_apertura';
            const contenido = (
              <>
                <div className="notificacion-superior">
                  <span className={'notificacion-tipo ' + (urgente ? 'urgente' : n.origen)}>
                    {urgente ? 'Urgente' : esAperturaCorreo ? 'Apertura de correo' : esProspectoWeb ? 'Comercial' : n.origen === 'bitacora' ? 'Bitácora' : 'Mantención'}
                  </span>
                  {!n.leida && <span className="notificacion-nueva">Nueva</span>}
                </div>
                <strong>{n.titulo}</strong>
                {n.mensaje && <p>{n.mensaje}</p>}
                <time>{fechaHora(n.creado_en)}</time>
              </>
            );

            if (esAperturaCorreo) {
              const url=n.correo_origen==='proveedores'
                ? '/proveedores/comunicaciones'+(n.correo_registro_id?'?destinatario='+encodeURIComponent(n.correo_registro_id):'')
                : n.prospecto_id
                  ? '/pipeline?prospecto='+encodeURIComponent(n.prospecto_id)+
                    (n.correo_registro_id?'&correo='+encodeURIComponent(n.correo_registro_id):'')
                  : '/pipeline';
              return <Link key={n.tabla+n.id} to={url}
                className={'tarjeta notificacion-item'+(!n.leida?' no-leida':'')}
                onClick={()=>marcarLeida(n.tabla,n.id)}>
                  {contenido}
                  <span className="notificacion-destino">
                    {n.correo_origen==='proveedores'?'Ver comunicación en Proveedores ›':'Ver correo del prospecto ›'}
                  </span>
                </Link>;
            }
            if (esProspectoWeb) {
              return (
                <Link key={n.tabla + n.id}
                      to={n.prospecto_id
                        ? '/pipeline?prospecto=' + encodeURIComponent(n.prospecto_id)
                        : '/pipeline?etapa=nuevo'}
                      className={'tarjeta notificacion-item' + (!n.leida ? ' no-leida' : '')}
                      aria-label={'Gestionar prospecto: ' + n.titulo}
                      onClick={() => marcarLeida(n.tabla, n.id)}>
                  {contenido}
                  <span className="notificacion-destino">Abrir prospecto en Pipeline ›</span>
                </Link>
              );
            }
            if (n.origen === 'bitacora' && n.bitacora_id) {
              return (
                <Link key={n.tabla + n.id}
                      to={'/bitacora/' + n.bitacora_id}
                      className={'tarjeta notificacion-item' + (!n.leida ? ' no-leida' : '')}
                      onClick={() => marcarLeida(n.tabla, n.id)}>
                  {contenido}
                </Link>
              );
            }

            return (
              <button key={n.tabla + n.id}
                      type="button"
                      className={'tarjeta notificacion-item notificacion-boton' + (!n.leida ? ' no-leida' : '')}
                      onClick={() => {
                        marcarLeida(n.tabla, n.id);
                        if (n.origen === 'mantencion') navegar('/mantenciones');
                        else if (n.origen === 'bitacora') navegar('/bitacora');
                      }}>
                {contenido}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
