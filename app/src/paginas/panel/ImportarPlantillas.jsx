import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { descargarFormato, leerArchivo } from '../../lib/excelPlantillas';
import { interpretarFilas, cargaParaImportar } from '../../lib/importarPlantillas';
import { TIPOS, ORIGENES_FOTO } from '../../lib/tiposDePunto';
import { NIVELES_EVIDENCIA } from '../../lib/opciones';
import { useVolverGlobal } from '../../lib/navegacion';

/* Importación masiva: se descarga el formato, se llena en Excel y se sube.
 *
 * El archivo se revisa completo antes de crear nada. Con un solo problema no
 * se crea ninguna plantilla y se indica la fila, para corregir el Excel y
 * volver a subirlo: arreglar a mano una importación a medias sería peor que
 * repetirla. Lo que se crea queda igual que una plantilla hecha en la app y
 * se sigue ajustando en el editor. */

const PROBLEMAS_A_LA_VISTA = 30;
const etiqueta = (lista, valor) => lista.find(([v]) => v === valor)?.[1] ?? valor;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export default function ImportarPlantillas() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  useVolverGlobal(() => navegar('/plantillas'));
  const entrada = useRef(null);
  const [descargando, setDescargando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [creando, setCreando] = useState(false);
  const [creadas, setCreadas] = useState(null);
  const [error, setError] = useState(null);

  const puedeEditar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);

  async function descargar() {
    setError(null);
    setDescargando(true);
    try {
      await descargarFormato();
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(false);
    }
  }

  /* Para avisar si una plantilla del archivo se llama igual que una que ya
   * existe. Si no se pueden leer, se importa igual, sin ese aviso. */
  async function nombresExistentes() {
    const { data } = await supabase.from('plantillas_control').select('nombre');
    return (data ?? []).map(p => p.nombre);
  }

  async function elegir(e) {
    const elegido = e.target.files?.[0];
    // Vaciar el campo deja volver a subir el mismo archivo después de corregirlo.
    e.target.value = '';
    if (!elegido) return;
    setError(null);
    setResultado(null);
    setCreadas(null);
    setArchivo(elegido.name);
    setLeyendo(true);
    try {
      const [filas, nombres] = await Promise.all([leerArchivo(elegido), nombresExistentes()]);
      setResultado(interpretarFilas(filas, { nombresExistentes: nombres }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLeyendo(false);
    }
  }

  async function crear() {
    setError(null);
    setCreando(true);
    const { data, error } = await supabase.rpc('importar_plantillas', {
      p_plantillas: cargaParaImportar(resultado.plantillas)
    });
    setCreando(false);
    if (error) {
      setError(`No se pudo importar: ${error.message} No se creó ninguna plantilla.`);
      return;
    }
    setCreadas(resultado.plantillas.map((p, i) => ({ id: data?.[i], nombre: p.nombre, puntos: p.items.length })));
    setResultado(null);
    setArchivo(null);
  }

  const listo = resultado && resultado.errores.length === 0;
  const cuantas = resultado?.plantillas.length ?? 0;
  const puntos = resultado?.plantillas.reduce((s, p) => s + p.items.length, 0) ?? 0;

  return (
    <div className="pantalla pantalla-angosta">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/plantillas')}>
            ‹ Plantillas
          </button>
        </div>
        <h1 className="h3">Importar desde Excel</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Crea una o varias plantillas de una vez
        </p>
      </header>

      <div className="cuerpo importar">
        {perfil && !puedeEditar ? (
          <div className="aviso aviso-critico">Solo administración y jefatura pueden crear plantillas.</div>
        ) : (
          <>
            <section className="tarjeta paso-importar">
              <h2 className="h4">1. Descarga el formato</h2>
              <p className="chico apagado">
                Una fila por punto, con listas para elegir cómo se responde y las fotografías.
                Trae una hoja con un ejemplo completo y otra con las instrucciones.
              </p>
              <button type="button" className="boton boton-secundario" onClick={descargar}
                      disabled={descargando}>
                {descargando ? 'Preparando…' : 'Descargar formato'}
              </button>
            </section>

            <section className="tarjeta paso-importar">
              <h2 className="h4">2. Sube el archivo lleno</h2>
              <p className="chico apagado">
                Se revisa completo antes de crear: si una fila tiene un problema, se indica cuál
                y no se crea nada.
              </p>
              <input ref={entrada} type="file" hidden onChange={elegir}
                     accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
              <button type="button" className="boton" onClick={() => entrada.current?.click()}
                      disabled={leyendo || creando}>
                {leyendo ? 'Leyendo el archivo…' : archivo || creadas ? 'Elegir otro archivo' : 'Elegir archivo'}
              </button>
              {archivo && !leyendo && <p className="micro apagado nombre-archivo">{archivo}</p>}
            </section>

            {error && <div className="aviso aviso-critico" role="alert">{error}</div>}

            {creadas && (
              <section className="aviso aviso-ok" role="status">
                <strong>
                  {creadas.length === 1 ? 'Se creó 1 plantilla.' : `Se crearon ${creadas.length} plantillas.`}
                </strong>{' '}
                Quedan en el catálogo estándar; ábrelas para ajustar lo que haga falta.
                <ul className="lista-problemas">
                  {creadas.map(p => (
                    <li key={p.id ?? p.nombre}>
                      {p.id ? <Link to={`/plantillas/${p.id}`}>{p.nombre}</Link> : p.nombre}
                      {' '}<span className="micro">({plural(p.puntos, 'punto', 'puntos')})</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {resultado && !listo && (
              <section>
                <div className="aviso aviso-critico" role="alert">
                  <strong>No se puede importar todavía.</strong>{' '}
                  {resultado.errores.length === 1 ? 'Hay 1 problema' : `Hay ${resultado.errores.length} problemas`} en
                  el archivo: corrígelos en el Excel y vuelve a subirlo.
                </div>
                <ul className="lista-problemas">
                  {resultado.errores.slice(0, PROBLEMAS_A_LA_VISTA).map((p, i) => (
                    <li key={i}>
                      {p.fila != null && <span className="fila-excel">Fila {p.fila}</span>}
                      {p.mensaje}
                    </li>
                  ))}
                </ul>
                {resultado.errores.length > PROBLEMAS_A_LA_VISTA && (
                  <p className="micro apagado">
                    … y {resultado.errores.length - PROBLEMAS_A_LA_VISTA} más.
                  </p>
                )}
              </section>
            )}

            {listo && (
              <section className="vista-previa">
                <h2 className="h4">3. Revisa y crea</h2>
                <p className="chico">
                  {cuantas === 1 ? 'Se va a crear 1 plantilla' : `Se van a crear ${cuantas} plantillas`} con{' '}
                  {plural(puntos, 'punto', 'puntos')} en total.
                </p>

                {resultado.avisos.length > 0 && (
                  <div className="aviso">
                    <strong>Revisa antes de crear:</strong>
                    <ul className="lista-problemas">
                      {resultado.avisos.map((a, i) => (
                        <li key={i}>
                          {a.fila != null && <span className="fila-excel">Fila {a.fila}</span>}
                          {a.mensaje}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resultado.plantillas.map(p => <PlantillaPrevia key={p.nombre} plantilla={p} />)}

                <div className="fila-botones">
                  <button type="button" className="boton boton-movil" onClick={crear} disabled={creando}>
                    {creando ? 'Creando…' : cuantas === 1 ? 'Crear plantilla' : `Crear ${cuantas} plantillas`}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlantillaPrevia({ plantilla }) {
  const { nombre, categorias, items } = plantilla;
  return (
    <article className="tarjeta plantilla-previa">
      <h3 className="dato-chico">{nombre}</h3>
      <p className="micro apagado">
        {plural(items.length, 'punto', 'puntos')} en {plural(categorias.length, 'categoría', 'categorías')}
      </p>
      <details>
        <summary className="chico">Ver los puntos</summary>
        {categorias.map(c => (
          <section key={c.nombre} className="categoria-previa">
            <h4 className="etiqueta-campo">{c.nombre}</h4>
            <ol>
              {items.filter(i => i.grupo === c.nombre).map(i => (
                <li key={i.fila}>
                  <span className="chico">{i.texto}</span>
                  <span className="micro apagado">{detalle(i)}</span>
                  {i.ayuda && <span className="micro ayuda-previa">{i.ayuda}</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </details>
    </article>
  );
}

/* Cómo se responde el punto y lo que tiene de distinto a lo habitual. */
function detalle(punto) {
  const { config } = punto;
  const partes = [etiqueta(TIPOS, punto.tipo_ingreso)];
  if (config.opciones?.length) {
    partes.push(config.opciones.map(o => (
      typeof o === 'string' || o.evidencia === 'ninguna'
        ? (o.texto ?? o)
        : `${o.texto} (${etiqueta(NIVELES_EVIDENCIA, o.evidencia).toLowerCase()})`
    )).join(' / '));
  }
  if (config.unidad) partes.push(config.unidad);
  if (config.origen) partes.push(etiqueta(ORIGENES_FOTO, config.origen));
  if (punto.requiere_foto) partes.push('Exige foto');
  if (!punto.obligatorio) partes.push('Opcional');
  if (punto.es_critico) partes.push('Crítico');
  return partes.join(' · ');
}
