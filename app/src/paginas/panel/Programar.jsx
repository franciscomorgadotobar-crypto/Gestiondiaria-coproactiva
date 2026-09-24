import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';

/* Programar o editar un levantamiento.
 *
 * El destino puede ser una comunidad administrada o un prospecto del embudo. El
 * segundo caso es el diagnóstico comercial: se visita el edificio antes de
 * ganarlo, y de esa visita sale la propuesta. Por eso el levantamiento no exige
 * una comunidad: obligaría a inventar una por cada visita y ensuciaría el
 * padrón con edificios que quizá nunca se administren.
 *
 * Los puntos se copian de la plantilla al crear. A partir de ahí el
 * levantamiento es independiente: cambiar la plantilla después no altera los ya
 * programados, porque un levantamiento en curso no puede cambiar de preguntas a
 * mitad del recorrido.
 *
 * Si se entra desde /comunidades/:id se usa ?comunidad=<id>. No existe un segundo
 * formulario: este mismo flujo abre con la comunidad preseleccionada.
 */
export default function Programar() {
  const { id } = useParams();          // sin id = uno nuevo
  const [searchParams] = useSearchParams();
  const comunidadInicial = searchParams.get('comunidad');
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const editando = Boolean(id);
  const [comunidades, setComunidades] = useState([]);
  const [prospectos, setProspectos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [control, setControl] = useState(null);

  const [datos, setDatos] = useState({
    destino: '',                       // "comunidad:<id>" o "prospecto:<id>"
    plantilla_id: '',
    responsable_id: '',
    periodo: '',
    programado_para: ''
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      const [com, pro, pla, eq] = await Promise.all([
        supabase.from('comunidades').select('id, nombre, comuna').order('nombre'),
        // Solo los prospectos vivos: programar una visita a uno perdido no tiene
        // sentido, y llenan la lista.
        supabase.from('prospectos')
          .select('id, nombre_condominio, comuna, etapa')
          .not('etapa', 'in', '("ganado","perdido")')
          .order('nombre_condominio'),
        supabase.from('plantillas_control')
          .select('id, nombre, codigo, secuencial, plantilla_items(count)')
          .eq('activa', true).order('nombre'),
        supabase.from('perfiles').select('id, nombre, rol, activo').order('nombre')
      ]);
      setComunidades(com.data ?? []);
      setProspectos(pro.data ?? []);
      setPlantillas(pla.data ?? []);
      setEquipo(eq.data ?? []);

      if (!editando) {
        const comunidadValida = comunidadInicial && (com.data ?? []).some(c => c.id === comunidadInicial);
        setDatos(d => ({
          ...d,
          destino: comunidadValida ? `comunidad:${comunidadInicial}` : d.destino,
          responsable_id: perfil?.id ?? '',
          periodo: mesEnCurso()
        }));
        return;
      }

      const { data, error } = await supabase
        .from('controles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return setError(error.message);
      if (!data) return setError('Este levantamiento no existe o no tienes acceso.');
      setControl(data);
      setDatos({
        destino: data.comunidad_id
          ? `comunidad:${data.comunidad_id}`
          : `prospecto:${data.prospecto_id}`,
        plantilla_id: data.plantilla_id ?? '',
        responsable_id: data.responsable_id ?? '',
        periodo: data.periodo ?? '',
        programado_para: data.programado_para
          ? data.programado_para.slice(0, 16)   // formato de datetime-local
          : ''
      });
    })();
  }, [id, comunidadInicial, perfil?.id]);

  function mesEnCurso() {
    const d = new Date();
    const mes = d.toLocaleDateString('es-CL', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + d.getFullYear();
  }

  function volver() {
    if (comunidadInicial) return navegar(`/comunidades/${comunidadInicial}?seccion=levantamientos`);
    navegar('/');
  }

  async function guardar() {
    if (!datos.destino) return setError('Elige a qué comunidad o prospecto corresponde.');
    if (!editando && !datos.plantilla_id) return setError('Elige una plantilla.');

    setGuardando(true);
    setError(null);
    const [tipo, destinoId] = datos.destino.split(':');
    const plantillaElegida = plantillas.find(p => p.id === datos.plantilla_id);
    const fila = {
      comunidad_id: tipo === 'comunidad' ? destinoId : null,
      prospecto_id: tipo === 'prospecto' ? destinoId : null,
      plantilla_id: datos.plantilla_id || null,
      responsable_id: datos.responsable_id || null,
      periodo: datos.periodo || null,
      programado_para: datos.programado_para
        ? new Date(datos.programado_para).toISOString()
        : null,
      // Se copia al crear, igual que los puntos: si la plantilla cambia
      // después, este levantamiento no tiene por qué cambiar de reglas a
      // mitad del recorrido.
      secuencial: plantillaElegida?.secuencial ?? false,
      // El diagnóstico comercial usa una pantalla propia (puntaje ponderado,
      // ítems condicionales), no el renderer genérico de levantamientos.
      es_diagnostico: plantillaElegida?.codigo === 'diagnostico_comercial'
    };

    if (editando) {
      // La plantilla no viaja en el update: no es editable, y enviarla arriesga
      // borrarla si el desplegable no alcanzó a cargar su valor. `secuencial`
      // y `es_diagnostico` tampoco: se fijaron al crear y no cambian después.
      const { plantilla_id, secuencial, es_diagnostico, ...cambios } = fila;
      const { error } = await supabase.from('controles').update(cambios).eq('id', id);
      setGuardando(false);
      if (error) return setError(error.message);
      return volver();
    }

    const { data: nuevo, error: e1 } = await supabase
      .from('controles').insert(fila).select().single();
    if (e1) { setGuardando(false); return setError(e1.message); }

    /* Los puntos se copian con su texto, su categoría y su tipo de ingreso. Se
     * copian y no se referencian: si la plantilla cambia el mes que viene, este
     * levantamiento debe seguir diciendo lo que preguntaba hoy. */
    const { data: items, error: e2 } = await supabase
      .from('plantilla_items')
      .select('id, grupo, texto, orden, orden_grupo, tipo_ingreso, config, requiere_foto, es_critico, obligatorio')
      .eq('plantilla_id', datos.plantilla_id)
      .eq('activo', true)
      .order('orden_grupo').order('orden');
    if (e2) { setGuardando(false); return setError(e2.message); }

    if (items?.length) {
      const { error: e3 } = await supabase.from('control_items').insert(
        items.map((it, n) => ({
          control_id: nuevo.id,
          plantilla_item_id: it.id,
          grupo: it.grupo,
          texto: it.texto,
          orden: n,
          tipo_ingreso: it.tipo_ingreso,
          config: it.config,
          requiere_foto: it.requiere_foto,
          es_critico: it.es_critico,
          obligatorio: it.obligatorio
        }))
      );
      if (e3) { setGuardando(false); return setError(e3.message); }
    }

    setGuardando(false);
    navegar(`/control/${nuevo.id}`);
  }

  /* Reabrir un levantamiento enviado es legítimo —se anotó mal un punto, faltó
   * una foto—, pero queda registrado: el informe pudo haberse entregado ya. */
  async function reabrir() {
    const motivo = prompt('¿Por qué se reabre este levantamiento?');
    if (motivo === null) return;
    setGuardando(true);
    const { error } = await supabase.from('controles').update({
      estado: 'en_curso',
      reabierto_en: new Date().toISOString(),
      reabierto_por: perfil?.id ?? null,
      motivo_reapertura: motivo.trim() || null
    }).eq('id', id);
    setGuardando(false);
    if (error) return setError(error.message);
    navegar(`/control/${id}`);
  }

  const enviado = control?.estado === 'enviado';
  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={volver}>
            {comunidadInicial ? '‹ Comunidad' : '‹ Inicio'}
          </button>
        </div>
        <h1 className="h3">{editando ? 'Editar levantamiento' : 'Nuevo levantamiento'}</h1>
      </header>
      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

        {enviado && (
          <div className="aviso" style={{ marginBottom: 14 }}>
            <p style={{ margin: 0 }}>
              Este levantamiento ya fue enviado. Para corregirlo hay que reabrirlo,
              y queda registrado quién lo hizo y por qué.
            </p>
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={reabrir} disabled={guardando}>
              Reabrir
            </button>
          </div>
        )}

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="destino">A quién corresponde</label>
          <select id="destino" value={datos.destino}
                  onChange={e => setDatos({ ...datos, destino: e.target.value })}>
            <option value="">Elegir…</option>
            {comunidades.length > 0 && (
              <optgroup label="Comunidades administradas">
                {comunidades.map(c => (
                  <option key={c.id} value={`comunidad:${c.id}`}>
                    {c.nombre}{c.comuna ? ` — ${c.comuna}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {prospectos.length > 0 && (
              <optgroup label="Prospectos del CRM">
                {prospectos.map(p => (
                  <option key={p.id} value={`prospecto:${p.id}`}>
                    {p.nombre_condominio}{p.comuna ? ` — ${p.comuna}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="micro apagado" style={{ margin: '5px 0 0' }}>
            Los prospectos vienen del embudo comercial. Un levantamiento sobre un
            prospecto es el diagnóstico previo a la propuesta.
          </p>
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="plantilla">Plantilla</label>
          <select id="plantilla" value={datos.plantilla_id} disabled={editando}
                  onChange={e => setDatos({ ...datos, plantilla_id: e.target.value })}>
            <option value="">Elegir…</option>
            {plantillas.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.plantilla_items?.[0]?.count ?? 0} puntos)
              </option>
            ))}
          </select>
          {editando && (
            <p className="micro apagado" style={{ margin: '5px 0 0' }}>
              La plantilla no se cambia después de crear: los puntos ya están
              copiados y cambiarlos a mitad del recorrido perdería lo evaluado.
            </p>
          )}
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="responsable">Responsable</label>
          <select id="responsable" value={datos.responsable_id}
                  onChange={e => setDatos({ ...datos, responsable_id: e.target.value })}>
            <option value="">Sin asignar</option>
            {equipo
              // Los dados de baja no se ofrecen, pero si uno es el responsable
              // actual sigue en la lista: sacarlo dejaría el campo vacío y al
              // guardar se perdería la asignación sin que nadie lo pidiera.
              .filter(p => p.activo || p.id === datos.responsable_id)
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {p.rol}{p.activo ? '' : ' (inactivo)'}
                </option>
              ))}
          </select>
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="cuando">Fecha y hora</label>
          <input id="cuando" type="datetime-local" value={datos.programado_para}
                 onChange={e => setDatos({ ...datos, programado_para: e.target.value })} />
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="periodo">Periodo</label>
          <input id="periodo" type="text" value={datos.periodo} placeholder="Septiembre 2026"
                 onChange={e => setDatos({ ...datos, periodo: e.target.value })} />
        </div>

        <button className="boton boton-movil boton-ancho" style={{ marginTop: 8 }}
                onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear levantamiento'}
        </button>
      </div>
    </div>
  );
}
