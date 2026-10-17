import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { AvisoConexion } from '../../lib/estado';
import { hayConexion } from '../../lib/sincronizacion';
import { leerControles, guardarControl } from '../../lib/local';

const CHIP = {
  pendiente: ['chip-pendiente', 'Pendiente'],
  en_curso: ['chip-alerta', 'En curso'],
  enviado: ['chip-cumple', 'Enviado'],
  anulado: ['chip-pendiente', 'Anulado']
};

export default function InicioTerreno() {
  const { perfil, salir } = useSesion();
  const [controles, setControles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;

    // Sin señal se muestra lo que el teléfono ya tiene descargado: llegar a un
    // edificio y ver una lista vacía porque no hay red haría la app inútil
    // justo cuando se necesita.
    if (!hayConexion()) {
      leerControles().then(locales => vigente && setControles(locales));
      return () => { vigente = false; };
    }

    // La vista trae el avance calculado (12 de 28) en vez de contar en el
    // cliente. RLS ya limita a las comunidades del usuario, así que no hace
    // falta filtrar por comunidad acá.
    supabase
      .from('controles_con_avance')
      .select('id, estado, periodo, programado_para, checkin_en, items_evaluados, items_totales, comunidades(nombre, direccion, comuna)')
      .order('programado_para', { ascending: true })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          setError(error.message);
          leerControles().then(locales => vigente && setControles(locales));
        } else {
          setControles(data ?? []);
          // Se guardan para poder abrirlos después sin señal.
          for (const c of data ?? []) guardarControl(c);
        }
      });

    return () => { vigente = false; };
  }, []);

  const hoy = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="pantalla modulo-unificado">
      <AvisoConexion />

      <header className="encabezado modulo-cabecera">
        <div className="fila">
          <div className="crece">
            <h1 className="h3">Hola, {perfil?.nombre?.split(' ')[0] ?? ''}</h1>
            <p className="chico apagado" style={{ margin: '2px 0 0' }}>
              {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
            </p>
          </div>
          <button className="boton boton-texto" onClick={salir}>Salir</button>
        </div>
      </header>

      <div className="cuerpo">
        <div className="grupo-titulo">
          <span className="etiqueta-grupo">Mis levantamientos</span>
        </div>

        {error && <div className="aviso aviso-critico">{error}</div>}

        {controles === null && !error && <p className="cargando">Cargando…</p>}

        {controles?.length === 0 && (
          <p className="vacio">No tienes levantamientos asignados por ahora.</p>
        )}

        {controles?.map(c => {
          const [clase, texto] = CHIP[c.estado] ?? CHIP.pendiente;
          const pct = c.items_totales ? Math.round((c.items_evaluados / c.items_totales) * 100) : 0;
          return (
            <Link
              key={c.id}
              to={`/control/${c.id}`}
              className="tarjeta"
              style={{ display: 'block', padding: 16, marginBottom: 12, color: 'inherit' }}
            >
              <div className="fila" style={{ marginBottom: 8 }}>
                <span className="etiqueta-campo crece" style={{ margin: 0 }}>
                  {c.programado_para
                    ? new Date(c.programado_para).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    : c.periodo ?? ''}
                </span>
                <span className={'chip ' + clase}>{texto}</span>
              </div>

              <p className="dato-chico" style={{ margin: 0 }}>{c.comunidades?.nombre}</p>
              <p className="micro" style={{ margin: '3px 0 0' }}>
                {[c.comunidades?.direccion, c.comunidades?.comuna].filter(Boolean).join(', ')}
              </p>

              {c.items_totales > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="fila" style={{ marginBottom: 5 }}>
                    <span className="micro crece">
                      {c.checkin_en
                        ? `Check-in ${new Date(c.checkin_en).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Sin check-in'}
                    </span>
                    <span className="micro">{c.items_evaluados} de {c.items_totales}</span>
                  </div>
                  <div className="barra"><div style={{ width: pct + '%' }} /></div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
