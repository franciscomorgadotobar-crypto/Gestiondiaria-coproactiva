import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import Confirmar from '../../componentes/Confirmar';
import DialogoCampos from '../../componentes/DialogoCampos';
import { useVolverGlobal } from '../../lib/navegacion';
import { descargarGuiaPlantilla } from '../../lib/plantillasPDF';
import './Plantillas.css';

/* Las plantillas del catálogo estándar (comunidad_id nulo) sirven para todas
 * las comunidades. Una plantilla con comunidad asignada existe porque ese
 * edificio tiene algo que las demás no: una piscina, un helipuerto, una caldera
 * a leña. */
export default function Plantillas() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  useVolverGlobal(() => navegar('/inicio'));
  const [plantillas, setPlantillas] = useState(null);
  const [error, setError] = useState(null);
  const [porBorrar, setPorBorrar] = useState(null);
  const [dialogoNombre, setDialogoNombre] = useState(null);
  const [descargandoId, setDescargandoId] = useState(null);

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

  async function crear(nombre) {
    if (!nombre?.trim()) return;
    setDialogoNombre(null);
    const { data, error } = await supabase
      .from('plantillas_control')
      .insert({ nombre: nombre.trim(), creado_por: perfil.id })
      .select().single();
    if (error) return setError(error.message);
    navegar(`/plantillas/${data.id}`);
  }

  /* Duplicar es la forma práctica de partir: se toma la plantilla estándar y se
   * ajusta para una comunidad, en vez de escribir treinta puntos de cero. */
  async function duplicar(p, nombre) {
    if (!nombre?.trim()) return;
    setDialogoNombre(null);

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

  async function descargarGuia(p) {
    setDescargandoId(p.id);
    setError(null);
    const { data, error } = await supabase.from('plantilla_items')
      .select('*')
      .eq('plantilla_id', p.id)
      .eq('activo', true)
      .order('orden_grupo')
      .order('orden');
    setDescargandoId(null);
    if (error) return setError(error.message);
    descargarGuiaPlantilla(p, data ?? []);
  }

  async function borrar() {
    const p = porBorrar;
    setPorBorrar(null);
    setPlantillas(xs => xs.filter(x => x.id !== p.id));
    const { error } = await supabase.from('plantillas_control').delete().eq('id', p.id);
    if (error) { setError(error.message); cargar(); }
  }

  return (
    <div className="pantalla plantillas-pantalla">
      {dialogoNombre && (
        <DialogoCampos
          titulo={dialogoNombre.tipo === 'crear' ? 'Nueva plantilla' : 'Duplicar plantilla'}
          mensaje={dialogoNombre.tipo === 'crear'
            ? 'Escribe un nombre para la nueva plantilla.'
            : 'La copia tendrá los mismos puntos y podrás editarla después.'}
          campos={[{
            id: 'nombre',
            label: 'Nombre',
            valor: dialogoNombre.tipo === 'crear' ? '' : `${dialogoNombre.plantilla.nombre} (copia)`,
            obligatorio: true
          }]}
          textoConfirmar={dialogoNombre.tipo === 'crear' ? 'Crear plantilla' : 'Duplicar'}
          onCancelar={() => setDialogoNombre(null)}
          onConfirmar={({ nombre }) => dialogoNombre.tipo === 'crear'
            ? crear(nombre)
            : duplicar(dialogoNombre.plantilla, nombre)}
        />
      )}

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

      <header className="encabezado plantillas-encabezado">
        <div className="fila navegacion-interna plantillas-volver">
          <button className="boton boton-texto"
                  onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
        </div>

        <div className="plantillas-cabecera-principal">
          <div>
            <h1 className="h3">Plantillas</h1>
            <p className="chico apagado">
              Define qué se revisa en cada tipo de levantamiento.
            </p>
          </div>

          {puedeEditar && (
            <div className="plantillas-acciones-cabecera">
              <button className="boton boton-movil"
                      onClick={() => setDialogoNombre({ tipo: 'crear' })}>
                + Nueva plantilla
              </button>
              <Link to="/plantillas/importar" className="boton boton-secundario boton-movil">
                Importar Excel
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="cuerpo plantillas-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {plantillas === null && !error && <p className="cargando">Cargando…</p>}

        {plantillas && (
          <section className="plantillas-catalogo">
            <div className="plantillas-catalogo-cabecera">
              <div>
                <h2 className="h3">Plantillas disponibles</h2>
                <p className="micro apagado">
                  {plantillas.length} {plantillas.length === 1 ? 'plantilla' : 'plantillas'} configuradas.
                </p>
              </div>
            </div>

            {plantillas.length === 0 ? (
              <div className="tarjeta plantillas-vacio">
                <h3 className="h3">Todavía no hay plantillas</h3>
                <p className="chico apagado">
                  Crea una desde cero o importa una estructura desde Excel.
                </p>
                {puedeEditar && (
                  <button className="boton"
                          onClick={() => setDialogoNombre({ tipo: 'crear' })}>
                    + Nueva plantilla
                  </button>
                )}
              </div>
            ) : (
              <div className="plantillas-grid">
                {plantillas.map(p => {
                  const puntos = p.plantilla_items?.[0]?.count ?? 0;
                  return (
                    <article key={p.id} className={'tarjeta plantilla-card ' + (!p.activa ? 'inactiva' : '')}>
                      <div className="plantilla-card-meta">
                        <span className="plantilla-card-origen">
                          {p.comunidades?.nombre ?? 'Catálogo estándar'}
                        </span>
                        <span className="chip plantilla-card-puntos">
                          {puntos} {puntos === 1 ? 'punto' : 'puntos'}
                        </span>
                      </div>

                      <div className="plantilla-card-contenido">
                        <Link to={`/plantillas/${p.id}`} className="plantilla-card-titulo">
                          {p.nombre}
                        </Link>

                        <p className={'plantilla-card-descripcion ' + (!p.descripcion ? 'sin-descripcion' : '')}>
                          {p.descripcion || 'Sin descripción. Abre la plantilla para completar su propósito o alcance.'}
                        </p>

                        {!p.activa && (
                          <span className="chip chip-pendiente plantilla-card-estado">Inactiva</span>
                        )}
                      </div>

                      <div className="plantilla-card-footer">
                        <div className="plantilla-card-acciones">
                          {puedeEditar && (
                            <Link to={`/plantillas/${p.id}`} className="boton boton-secundario">
                              Editar
                            </Link>
                          )}
                          <button
                            type="button"
                            className="boton boton-secundario"
                            disabled={descargandoId === p.id}
                            onClick={() => descargarGuia(p)}
                          >
                            {descargandoId === p.id ? 'Preparando…' : 'Descargar guía'}
                          </button>
                          {puedeEditar && (
                            <button className="boton boton-secundario"
                                    onClick={() => setDialogoNombre({ tipo: 'duplicar', plantilla: p })}>
                              Duplicar
                            </button>
                          )}
                        </div>

                        {puedeBorrar && (
                          <button type="button" className="boton boton-texto peligro plantilla-card-eliminar"
                                  onClick={() => setPorBorrar(p)}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
