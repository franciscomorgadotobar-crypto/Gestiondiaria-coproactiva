import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import Confirmar from '../../componentes/Confirmar';

/* Las plantillas del catálogo estándar (comunidad_id nulo) sirven para todas
 * las comunidades. Una plantilla con comunidad asignada existe porque ese
 * edificio tiene algo que las demás no: una piscina, un helipuerto, una caldera
 * a leña. */
export default function Plantillas() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  const [plantillas, setPlantillas] = useState(null);
  const [error, setError] = useState(null);
  const [porBorrar, setPorBorrar] = useState(null);

  const puedeEditar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  // Borrar una plantilla se lleva su estructura completa —y la de cualquier
  // levantamiento que ya la citaba pasa a quedar sin plantilla asociada—: un
  // alcance mayor que editarla, reservado al superadmin.
  const puedeBorrar = perfil?.rol === 'superadmin';

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data, error } = await supabase
      .from('plantillas_control')
      .select('id, nombre, descripcion, comunidad_id, activa, comunidades(nombre), plantilla_items(count)')
      .order('nombre');
    if (error) setError(error.message);
    else setPlantillas(data ?? []);
  }

  async function crear() {
    const nombre = prompt('Nombre de la plantilla');
    if (!nombre?.trim()) return;
    const { data, error } = await supabase
      .from('plantillas_control')
      .insert({ nombre: nombre.trim(), creado_por: perfil.id })
      .select().single();
    if (error) return setError(error.message);
    navegar(`/plantillas/${data.id}`);
  }

  /* Duplicar es la forma práctica de partir: se toma la plantilla estándar y se
   * ajusta para una comunidad, en vez de escribir treinta puntos de cero. */
  async function duplicar(p) {
    const nombre = prompt('Nombre de la copia', `${p.nombre} (copia)`);
    if (!nombre?.trim()) return;

    const { data: nueva, error: e1 } = await supabase
      .from('plantillas_control')
      .insert({ nombre: nombre.trim(), descripcion: p.descripcion, creado_por: perfil.id })
      .select().single();
    if (e1) return setError(e1.message);

    const { data: items, error: e2 } = await supabase
      .from('plantilla_items').select('*').eq('plantilla_id', p.id);
    if (e2) return setError(e2.message);

    if (items?.length) {
      const copias = items.map(({ id, plantilla_id, ...resto }) => ({
        ...resto, plantilla_id: nueva.id
      }));
      const { error: e3 } = await supabase.from('plantilla_items').insert(copias);
      if (e3) return setError(e3.message);
    }
    navegar(`/plantillas/${nueva.id}`);
  }

  async function borrar() {
    const p = porBorrar;
    setPorBorrar(null);
    setPlantillas(xs => xs.filter(x => x.id !== p.id));
    const { error } = await supabase.from('plantillas_control').delete().eq('id', p.id);
    if (error) { setError(error.message); cargar(); }
  }

  return (
    <div className="pantalla">
      {porBorrar && (
        <Confirmar
          titulo="Eliminar plantilla"
          mensaje={`"${porBorrar.nombre}" se va a borrar junto con todos sus puntos. Los levantamientos que ya la usaron quedan igual, solo pierden la referencia. Esto no se puede deshacer.`}
          textoConfirmar="Eliminar"
          textoCancelar="Cancelar"
          onConfirmar={borrar}
          onCancelar={() => setPorBorrar(null)}
        />
      )}

      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/configuracion')}>
            ‹ Configuración
          </button>
        </div>
        <h1 className="h3">Plantillas</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Qué se pregunta en cada levantamiento
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {plantillas === null && !error && <p className="cargando">Cargando…</p>}
        {plantillas?.length === 0 && (
          <p className="vacio">Todavía no hay plantillas.</p>
        )}

        {plantillas?.map(p => (
          <article key={p.id} className="tarjeta" style={{ padding: 16, marginBottom: 12 }}>
            <div className="fila" style={{ marginBottom: 6 }}>
              <span className="etiqueta-campo crece" style={{ margin: 0 }}>
                {p.comunidades?.nombre ?? 'Catálogo estándar'}
              </span>
              {!p.activa && <span className="chip chip-pendiente">Inactiva</span>}
            </div>

            <Link to={`/plantillas/${p.id}`} className="dato-chico" style={{ color: 'inherit' }}>
              {p.nombre}
            </Link>
            {p.descripcion && (
              <p className="micro" style={{ margin: '3px 0 0' }}>{p.descripcion}</p>
            )}
            <p className="micro apagado" style={{ margin: '6px 0 10px' }}>
              {p.plantilla_items?.[0]?.count ?? 0} puntos
            </p>

            {puedeEditar && (
              <div className="fila" style={{ gap: 8 }}>
                <Link to={`/plantillas/${p.id}`} className="boton boton-secundario crece"
                      style={{ textAlign: 'center' }}>
                  Editar
                </Link>
                <button className="boton boton-secundario crece" onClick={() => duplicar(p)}>
                  Duplicar
                </button>
              </div>
            )}
            {puedeBorrar && (
              <button type="button" className="boton boton-texto peligro"
                      style={{ marginTop: 8 }} onClick={() => setPorBorrar(p)}>
                Eliminar plantilla
              </button>
            )}
          </article>
        ))}

        {puedeEditar && (
          <button className="boton boton-movil boton-ancho" style={{ marginTop: 8 }}
                  onClick={crear}>
            Nueva plantilla
          </button>
        )}
      </div>
    </div>
  );
}
