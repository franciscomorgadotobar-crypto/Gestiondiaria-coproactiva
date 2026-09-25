import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { diagnosticoHtml } from '../../lib/diagnosticoInforme';
import { imprimirInforme } from '../../lib/informe';
import './DiagnosticoComercial.css';

/* Diagnóstico comercial: el mismo cuestionario y la misma lógica de puntaje
 * del CRM anterior, portados tal cual — mismas preguntas, mismos pesos,
 * misma escala, misma fórmula de línea sugerida. Lo único nuevo es dónde
 * vive: ahora es un levantamiento más (control_items) contra un prospecto,
 * no una herramienta aparte con su propio backend.
 *
 * Las preguntas y sus pesos viven en plantilla_items (grupo, texto, config),
 * copiadas a control_items al crear el diagnóstico igual que cualquier otro
 * levantamiento. Este componente solo agrega la interpretación específica de
 * ese `config` (escala de 4, condiciones, pesos) y el cálculo del resultado.
 */

const AREAS = [
  { id: 'legal', label: 'Legal' },
  { id: 'financiero', label: 'Financiero' },
  { id: 'laboral', label: 'Laboral', condArea: 'trabajadores' },
  { id: 'tecnico', label: 'Técnico' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'documental', label: 'Documental' }
];

const WP = { c: 3, i: 2, b: 1 };
// El peso viaja en config.peso (3/2/1); esto solo traduce a la etiqueta que se
// muestra junto a cada ítem.
const ETIQUETA_PESO = { 3: 'Crítico', 2: 'Importante', 1: 'Básico' };

const ESCALA_4 = [
  { valor: 0, etiqueta: 'No cumple' },
  { valor: 0.25, etiqueta: 'No sabe' },
  { valor: 0.5, etiqueta: 'Parcial' },
  { valor: 1, etiqueta: 'Cumple' }
];

const LINEAS = {
  L1: { label: 'Administración integral', desc: 'La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes.' },
  L2: { label: 'Nueva administración', desc: 'La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión.' },
  L3: { label: 'Asesoría externa', desc: 'Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente.' }
};

function lineaSugerida(score, areasRed, hasCritFail) {
  if (score < 40) return 'L3';
  if (score >= 75 && areasRed.length === 0 && !hasCritFail) return 'L1';
  return 'L2';
}

export default function DiagnosticoComercial({ id }) {
  const navegar = useNavigate();
  const [control, setControl] = useState(null);
  const [prospecto, setProspecto] = useState(null);
  const [items, setItems] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [notas, setNotas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [paso, setPaso] = useState('contexto');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    const { data: c, error: e1 } = await supabase.from('controles').select('*').eq('id', id).maybeSingle();
    if (e1) return setError(e1.message);
    if (!c) return setError('Este diagnóstico no existe o no tienes acceso.');
    setControl(c);

    const [rp, ri, rr] = await Promise.all([
      c.prospecto_id
        ? supabase.from('prospectos').select('*').eq('id', c.prospecto_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('control_items').select('*').eq('control_id', id).order('orden'),
      supabase.from('diagnosticos_resultado').select('*').eq('control_id', id).maybeSingle()
    ]);
    if (ri.error) return setError(ri.error.message);
    setProspecto(rp.data ?? null);
    setItems(ri.data ?? []);
    setResultado(rr.data ?? null);

    const r = {};
    for (const it of ri.data ?? []) {
      if (it.respuesta && typeof it.respuesta === 'object' && 'valor' in it.respuesta) r[it.id] = it.respuesta.valor;
    }
    setRespuestas(r);
    // Las observaciones son por área (la caja de texto al pie de cada área),
    // no por ítem: viven en diagnosticos_resultado.notas_areas, no en el
    // control_item.
    setNotas(rr.data?.notas_areas ?? {});
  }

  useEffect(() => { cargar(); }, [id]);

  const porGrupo = useMemo(() => {
    const m = new Map();
    for (const it of items ?? []) {
      if (!m.has(it.grupo)) m.set(it.grupo, []);
      m.get(it.grupo).push(it);
    }
    return m;
  }, [items]);

  const itemsPorClave = useMemo(() => {
    const m = new Map();
    for (const it of items ?? []) {
      const clave = it.config?.clave;
      if (clave) m.set(clave, it);
    }
    return m;
  }, [items]);

  const itemTrabajadores = useMemo(
    () => (items ?? []).find(i => i.grupo === 'contexto' && i.texto === 'Trabajadores contratados'),
    [items]
  );
  const numTrabajadores = itemTrabajadores ? Number(respuestas[itemTrabajadores.id] || 0) : 0;

  function claveActiva(clave) {
    if (clave === 'trabajadores') return numTrabajadores > 0;
    if (clave === 'menosDiez') return numTrabajadores > 0 && numTrabajadores < 10;
    if (clave === 'diezOMas') return numTrabajadores >= 10;
    const it = itemsPorClave.get(clave);
    return it ? Boolean(respuestas[it.id]) : false;
  }

  function itemAplica(it) {
    const cond = it.config?.condicion;
    if (cond && !claveActiva(cond)) return false;
    return true;
  }

  function areaAplica(area) {
    if (area.condArea) return claveActiva(area.condArea);
    return true;
  }

  function scoreArea(area) {
    if (!areaAplica(area)) return null;
    const itemsArea = (porGrupo.get(area.id) ?? []).filter(itemAplica);
    if (itemsArea.length === 0) return null;
    let earned = 0, possible = 0, criticosFallidos = 0;
    for (const it of itemsArea) {
      const peso = it.config?.peso ?? 1;
      possible += peso;
      const v = respuestas[it.id];
      if (v !== undefined && v !== null) earned += peso * Number(v);
      if (peso === 3 && (v === 0 || v === 0.25)) criticosFallidos += 1;
    }
    if (possible === 0) return null;
    return { pct: Math.round((earned / possible) * 100), criticosFallidos, evaluados: itemsArea.filter(it => respuestas[it.id] !== undefined).length, total: itemsArea.length };
  }

  const diagnostico = useMemo(() => {
    const puntajes = AREAS.map(a => ({ area: a, score: scoreArea(a) })).filter(x => x.score);
    const globalScore = puntajes.length ? Math.round(puntajes.reduce((s, x) => s + x.score.pct, 0) / puntajes.length) : 0;
    const hallazgosCriticos = [];
    for (const a of AREAS) {
      if (!areaAplica(a)) continue;
      for (const it of (porGrupo.get(a.id) ?? []).filter(itemAplica)) {
        if ((it.config?.peso ?? 1) !== 3) continue;
        const v = respuestas[it.id];
        if (v === 0 || v === 0.25) hallazgosCriticos.push({ area: a.label, texto: it.texto, tipo: v === 0 ? 'no_cumple' : 'no_sabe' });
      }
    }
    const hasCritFail = hallazgosCriticos.length > 0;
    const areasBajo60 = puntajes.filter(x => x.score.pct < 60);
    const areasRed = puntajes.filter(x => x.score.pct < 40);
    let nivel;
    if (globalScore >= 80 && areasBajo60.length === 0 && !hasCritFail) nivel = 'Estable';
    else if (globalScore >= 80) nivel = 'Estable con observaciones';
    else if (globalScore >= 50) nivel = 'En riesgo';
    else nivel = 'Crítico';
    return { globalScore, hallazgosCriticos, hasCritFail, areasBajo60, areasRed, nivel, linea: lineaSugerida(globalScore, areasRed, hasCritFail) };
  }, [items, respuestas]);

  function responder(itemId, valor) {
    setRespuestas(r => ({ ...r, [itemId]: r[itemId] === valor ? undefined : valor }));
  }

  async function guardarTodo(marcarEnviado) {
    setGuardando(true);
    setError(null);

    const actualizaciones = (items ?? []).map(it => ({
      id: it.id,
      respuesta: { valor: respuestas[it.id] ?? null },
      evaluado_en: respuestas[it.id] !== undefined ? new Date().toISOString() : it.evaluado_en
    }));

    for (const u of actualizaciones) {
      const { error: eItem } = await supabase.from('control_items')
        .update({ respuesta: u.respuesta, evaluado_en: u.evaluado_en }).eq('id', u.id);
      if (eItem) { setGuardando(false); return setError(eItem.message); }
    }

    const filaResultado = {
      control_id: id,
      score: diagnostico.globalScore,
      nivel: diagnostico.nivel,
      linea_sugerida: diagnostico.linea,
      linea_elegida: resultado?.linea_elegida ?? diagnostico.linea,
      hallazgos_criticos: diagnostico.hallazgosCriticos,
      notas_areas: notas
    };
    const { data: guardado, error: eRes } = resultado
      ? await supabase.from('diagnosticos_resultado').update(filaResultado).eq('control_id', id).select().single()
      : await supabase.from('diagnosticos_resultado').insert(filaResultado).select().single();
    if (eRes || !guardado) { setGuardando(false); return setError(eRes?.message || 'No se pudo guardar el resultado.'); }
    setResultado(guardado);

    if (marcarEnviado && control?.estado !== 'enviado') {
      const { error: eControl } = await supabase.from('controles')
        .update({ estado: 'enviado', enviado_en: new Date().toISOString() }).eq('id', id);
      if (eControl) { setGuardando(false); return setError(eControl.message); }
      setControl(c => ({ ...c, estado: 'enviado', enviado_en: new Date().toISOString() }));
    }

    setGuardando(false);
  }

  async function cambiarLineaElegida(linea) {
    if (!resultado) return;
    setGuardando(true);
    const { data, error: e } = await supabase.from('diagnosticos_resultado')
      .update({ linea_elegida: linea }).eq('control_id', id).select().single();
    setGuardando(false);
    if (e || !data) return setError(e?.message || 'No se pudo guardar la línea elegida.');
    setResultado(data);
  }

  function generarPdf() {
    const lineaElegida = resultado?.linea_elegida ?? diagnostico.linea;
    const areasInforme = AREAS.map(a => ({ id: a.id, label: a.label, pct: scoreArea(a)?.pct ?? null }));
    const html = diagnosticoHtml({
      prospecto,
      diagnostico,
      areas: areasInforme,
      notasAreas: notas,
      lineaElegida,
      logo: import.meta.env.BASE_URL + 'logo-coproactiva.svg'
    });
    if (!imprimirInforme(html)) {
      setError('El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para este sitio.');
    }
  }

  if (error) {
    return (
      <div className="pantalla">
        <div className="cuerpo"><div className="aviso aviso-critico">{error}</div></div>
      </div>
    );
  }
  if (!control || !prospecto || items === null) return <p className="cargando">Cargando…</p>;

  const contexto = porGrupo.get('contexto') ?? [];
  const instalaciones = porGrupo.get('instalaciones') ?? [];
  const pasos = ['contexto', 'instalaciones', ...AREAS.map(a => a.id), 'revision'];
  const indicePaso = pasos.indexOf(paso);

  return (
    <div className="pantalla pantalla-angosta">
      <header className="encabezado">
        <button className="boton boton-texto" style={{ padding: '4px 8px 8px 0' }} onClick={() => navegar('/pipeline')}>
          ‹ Pipeline
        </button>
        <h1 className="h3">Diagnóstico comercial</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          {prospecto.nombre_condominio}{prospecto.comuna ? ` · ${prospecto.comuna}` : ''}
        </p>
      </header>

      <div className="cuerpo">
        {control.estado === 'enviado' && (
          <div className="aviso" style={{ marginBottom: 14 }}>Este diagnóstico ya fue enviado. Los cambios se siguen guardando si lo editas.</div>
        )}

        <nav className="diag-pasos" aria-label="Pasos del diagnóstico">
          {pasos.map((p, i) => (
            <button key={p} type="button" className={'diag-paso' + (p === paso ? ' activo' : '') + (i < indicePaso ? ' hecho' : '')}
                    onClick={() => setPaso(p)}>
              {etiquetaPaso(p)}
            </button>
          ))}
        </nav>

        {paso === 'contexto' && (
          <PasoContexto prospecto={prospecto} items={contexto} respuestas={respuestas} onResponder={responder} />
        )}

        {paso === 'instalaciones' && (
          <PasoInstalaciones items={instalaciones} respuestas={respuestas} onResponder={responder} />
        )}

        {AREAS.map(a => paso === a.id && (
          <PasoArea key={a.id} area={a} items={porGrupo.get(a.id) ?? []} respuestas={respuestas} notas={notas}
                    setNotas={setNotas} itemAplica={itemAplica} areaAplica={areaAplica} scoreArea={scoreArea}
                    onResponder={responder} />
        ))}

        {paso === 'revision' && (
          <PasoRevision diagnostico={diagnostico} resultado={resultado} guardando={guardando}
                        onGuardar={() => guardarTodo(false)} onEnviar={() => guardarTodo(true)}
                        onElegirLinea={cambiarLineaElegida} onGenerarPdf={generarPdf} />
        )}

        <div className="fila-botones" style={{ marginTop: 20 }}>
          <button type="button" className="boton boton-secundario" disabled={indicePaso === 0}
                  onClick={() => setPaso(pasos[indicePaso - 1])}>← Anterior</button>
          {indicePaso < pasos.length - 1 && (
            <button type="button" className="boton" onClick={() => setPaso(pasos[indicePaso + 1])}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function etiquetaPaso(p) {
  const mapa = { contexto: 'Datos', instalaciones: 'Instal.', revision: 'Revisión' };
  return mapa[p] ?? AREAS.find(a => a.id === p)?.label ?? p;
}

function PasoContexto({ prospecto, items, respuestas, onResponder }) {
  return (
    <section className="diag-seccion">
      <h2 className="h4" style={{ marginTop: 0 }}>Datos de la comunidad</h2>
      <div className="tarjeta" style={{ padding: 14, marginBottom: 16 }}>
        <p className="micro apagado" style={{ margin: 0 }}>Estos datos vienen del prospecto y se editan desde el Pipeline.</p>
        <div className="diag-datos-prospecto">
          <ResumenDato etiqueta="Condominio" valor={prospecto.nombre_condominio} />
          <ResumenDato etiqueta="Dirección" valor={[prospecto.direccion, prospecto.comuna].filter(Boolean).join(', ') || '—'} />
          <ResumenDato etiqueta="Unidades" valor={prospecto.unidades ?? '—'} />
          <ResumenDato etiqueta="Contacto" valor={prospecto.nombre_contacto ? `${prospecto.nombre_contacto}${prospecto.cargo_contacto ? ' · ' + prospecto.cargo_contacto : ''}` : '—'} />
        </div>
      </div>
      <div className="diag-lista diag-lista-doble">
        {items.map(it => <ItemFormulario key={it.id} item={it} valor={respuestas[it.id]} onResponder={onResponder} />)}
      </div>
    </section>
  );
}

function ItemFormulario({ item, valor, onResponder }) {
  if (item.tipo_ingreso === 'seleccion') {
    const opciones = item.config?.opciones ?? [];
    return (
      <div className="campo">
        <label className="etiqueta-campo">{item.texto}</label>
        <select value={valor ?? ''} onChange={e => onResponder(item.id, e.target.value || undefined)}>
          <option value="">Sin definir</option>
          {opciones.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      </div>
    );
  }
  if (item.tipo_ingreso === 'numero') {
    return (
      <div className="campo">
        <label className="etiqueta-campo">{item.texto}</label>
        <input type="number" min={item.config?.min ?? 0} value={valor ?? ''}
               onChange={e => onResponder(item.id, e.target.value === '' ? undefined : Number(e.target.value))} />
        {item.config?.hint && <span className="micro apagado">{item.config.hint}</span>}
      </div>
    );
  }
  // 'estado' con escala si_no: usado para segPrivada en contexto.
  return (
    <label className={'diag-toggle' + (valor ? ' on' : '')}>
      <input type="checkbox" checked={Boolean(valor)} onChange={e => onResponder(item.id, e.target.checked)} />
      <span>{item.texto}</span>
    </label>
  );
}

function PasoInstalaciones({ items, respuestas, onResponder }) {
  return (
    <section className="diag-seccion">
      <h2 className="h4" style={{ marginTop: 0 }}>Instalaciones y equipamiento</h2>
      <p className="chico apagado">Marca todo lo que tiene el edificio — determina qué ítems aplican en el diagnóstico.</p>
      <div className="diag-lista diag-lista-doble">
        {items.map(it => (
          <label key={it.id} className={'diag-toggle' + (respuestas[it.id] ? ' on' : '')}>
            <input type="checkbox" checked={Boolean(respuestas[it.id])} onChange={e => onResponder(it.id, e.target.checked)} />
            <span>{it.texto}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function PasoArea({ area, items, respuestas, notas, setNotas, itemAplica, areaAplica, scoreArea, onResponder }) {
  const aplica = areaAplica(area);
  const score = scoreArea(area);

  if (!aplica) {
    return (
      <section className="diag-seccion">
        <h2 className="h4" style={{ marginTop: 0 }}>{area.label}</h2>
        <div className="vacio">Esta comunidad no tiene personal contratado, por lo que el área {area.label} no se evalúa.</div>
      </section>
    );
  }

  return (
    <section className="diag-seccion">
      <div className="fila" style={{ marginBottom: 4 }}>
        <h2 className="h4 crece" style={{ margin: 0 }}>{area.label}</h2>
        {score && <span className="chip chip-tipo">{score.pct}% · {score.evaluados}/{score.total} evaluados</span>}
      </div>
      <div className="diag-lista">
        {items.filter(itemAplica).map(it => (
          <div key={it.id} className="tarjeta diag-item">
            <div className="fila" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
              <p className="diag-item-texto crece" style={{ margin: 0 }}>{it.texto}</p>
              <span className="micro apagado">{ETIQUETA_PESO[it.config?.peso] ?? ''}</span>
            </div>
            <div className="diag-escala">
              {ESCALA_4.map(o => (
                <button key={o.valor} type="button"
                        className={'diag-escala-boton' + (respuestas[it.id] === o.valor ? ' activo' : '')}
                        onClick={() => onResponder(it.id, o.valor)}>
                  {o.etiqueta}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="campo" style={{ marginTop: 14 }}>
        <label className="etiqueta-campo">Observaciones del área</label>
        <textarea value={notas[area.id] ?? ''} onChange={e => setNotas(n => ({ ...n, [area.id]: e.target.value }))} />
      </div>
    </section>
  );
}

function ResumenDato({ etiqueta, valor }) {
  return (
    <div className="diag-resumen-dato">
      <span className="micro apagado">{etiqueta}</span>
      <strong className="micro">{valor}</strong>
    </div>
  );
}

function PasoRevision({ diagnostico, resultado, guardando, onGuardar, onEnviar, onElegirLinea, onGenerarPdf }) {
  const linea = resultado?.linea_elegida ?? diagnostico.linea;
  return (
    <section className="diag-seccion">
      <h2 className="h4" style={{ marginTop: 0 }}>Revisión</h2>

      <div className="tablero">
        <div className={diagnostico.globalScore >= 80 ? 'ok' : diagnostico.globalScore >= 50 ? 'alerta' : 'critico'}>
          <p className="n">{diagnostico.globalScore}%</p><p className="r">Puntaje global</p>
        </div>
        <div><p className="n">{diagnostico.nivel}</p><p className="r">Nivel</p></div>
        <div className={diagnostico.hasCritFail ? 'critico' : ''}>
          <p className="n">{diagnostico.hallazgosCriticos.length}</p><p className="r">Hallazgos críticos</p>
        </div>
        <div><p className="n">{diagnostico.areasBajo60.length}</p><p className="r">Áreas bajo 60%</p></div>
      </div>

      {diagnostico.hallazgosCriticos.length > 0 && (
        <div className="diag-seccion" style={{ marginTop: 0 }}>
          <h3 className="h4">Hallazgos críticos</h3>
          <div className="diag-lista">
            {diagnostico.hallazgosCriticos.map((h, i) => (
              <div key={i} className="tarjeta diag-item" style={{ padding: 12 }}>
                <span className="micro apagado">{h.area}</span>
                <p className="micro" style={{ margin: '2px 0 0' }}>{h.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="diag-seccion" style={{ marginTop: 0 }}>
        <h3 className="h4">Línea sugerida</h3>
        <div className="diag-lineas">
          {Object.entries(LINEAS).map(([clave, l]) => (
            <button key={clave} type="button"
                    className={'tarjeta diag-linea' + (linea === clave ? ' seleccionada' : '') + (diagnostico.linea === clave ? ' sugerida' : '')}
                    onClick={() => onElegirLinea(clave)} disabled={!resultado}>
              <strong className="micro">{l.label}{diagnostico.linea === clave ? ' — sugerida' : ''}</strong>
              <span className="micro apagado">{l.desc}</span>
            </button>
          ))}
        </div>
        {!resultado && <p className="micro apagado" style={{ marginTop: 8 }}>Guarda el diagnóstico para poder elegir la línea.</p>}
      </div>

      <div className="fila-botones">
        <button type="button" className="boton boton-secundario" onClick={onGuardar} disabled={guardando}>Guardar avance</button>
        <button type="button" className="boton" onClick={onEnviar} disabled={guardando}>Guardar y enviar</button>
      </div>
      {resultado && (
        <button type="button" className="boton boton-texto" style={{ marginTop: 10 }} onClick={onGenerarPdf}>
          Generar PDF del informe
        </button>
      )}
    </section>
  );
}
