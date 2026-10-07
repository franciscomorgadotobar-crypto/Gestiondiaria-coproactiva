import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import './ContabilidadConfiguracion.css';

function origenTexto(entidad, plantilla) {
  if (!entidad) return 'Sin configurar';
  if (entidad.plan_origen === 'plantilla') return plantilla?.nombre || 'Plantilla predefinida';
  if (entidad.plan_origen === 'personalizada') return plantilla?.nombre || 'Plantilla personalizada';
  if (entidad.plan_origen === 'importado') return 'Plan importado / histórico';
  if (entidad.plan_origen === 'manual') return 'Creado desde cero';
  if (entidad.plan_origen === 'legado') return 'Plan histórico';
  return 'Pendiente de configurar';
}

function tipoDesdeCodigo(codigo) {
  const n = String(codigo || '').trim()[0];
  if (n === '1') return 'activo';
  if (n === '2') return 'pasivo';
  if (n === '3') return 'patrimonio';
  if (n === '4') return 'ingreso';
  if (n === '5') return 'gasto';
  return 'gasto';
}

function naturalezaDesdeCodigo(codigo) {
  return ['2','3','4'].includes(String(codigo || '').trim()[0]) ? 'acreedora' : 'deudora';
}

function clasificacionDesdeCodigo(codigo) {
  const n = String(codigo || '').trim()[0];
  if (n === '1') return 'activo';
  if (n === '2' || n === '3') return 'pasivo';
  if (n === '4') return 'ganancia';
  if (n === '5') return 'perdida';
  return null;
}

function boolImportado(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1','si','sí','s','true','verdadero','yes'].includes(s);
}

function normalizarFila(raw) {
  const r = Object.fromEntries(Object.entries(raw || {}).map(([k,v]) => [
    String(k).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_'),
    v
  ]));
  const codigo = String(r.codigo ?? r.code ?? '').trim();
  const cuenta = String(r.cuenta ?? r.nombre ?? r.account ?? '').trim();
  if (!codigo || !cuenta) return null;
  const nivel = Number(r.nivel || codigo.split('.').length);
  return {
    codigo,
    cuenta,
    parent_codigo: String(r.parent_codigo ?? r.padre ?? r.cuenta_padre ?? '').trim() || null,
    clase: String(r.clase ?? '').trim() || 'movimiento',
    tipo_contable: String(r.tipo_contable ?? r.tipo ?? '').trim() || tipoDesdeCodigo(codigo),
    grupo: String(r.grupo ?? '').trim() || null,
    naturaleza: String(r.naturaleza ?? '').trim() || naturalezaDesdeCodigo(codigo),
    clasificacion_balance: String(r.clasificacion_balance ?? r.clasificacion ?? '').trim() || clasificacionDesdeCodigo(codigo),
    eerr_seccion: String(r.eerr_seccion ?? r.estado_resultados ?? '').trim() || null,
    eerr_orden: r.eerr_orden === '' || r.eerr_orden == null ? null : Number(r.eerr_orden),
    nivel: Number.isFinite(nivel) ? nivel : codigo.split('.').length,
    imputable: r.imputable === '' || r.imputable == null ? true : boolImportado(r.imputable),
    requiere_centro_costo: boolImportado(r.requiere_centro_costo ?? r.centro_costo)
  };
}

async function leerArchivo(file) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.csv')) {
    const texto = await file.text();
    const lineas = texto.split(/\r?\n/).filter(x => x.trim());
    if (!lineas.length) return [];
    const separador = lineas[0].includes(';') ? ';' : ',';
    const cab = lineas[0].split(separador).map(x => x.trim().replace(/^"|"$/g,''));
    return lineas.slice(1).map(linea => {
      const vals = linea.split(separador).map(x => x.trim().replace(/^"|"$/g,''));
      return normalizarFila(Object.fromEntries(cab.map((k,i)=>[k,vals[i] ?? ''])));
    }).filter(Boolean);
  }

  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await file.arrayBuffer());
  const hoja = libro.worksheets[0];
  if (!hoja) return [];
  const encabezados = [];
  hoja.getRow(1).eachCell((cell, col) => { encabezados[col] = String(cell.value ?? '').trim(); });
  const filas = [];
  hoja.eachRow((row, numero) => {
    if (numero === 1) return;
    const obj = {};
    encabezados.forEach((h, col) => { if (h) obj[h] = row.getCell(col).value ?? ''; });
    const n = normalizarFila(obj);
    if (n) filas.push(n);
  });
  return filas;
}

export default function ContabilidadConfiguracion({
  entidad,
  cuentas,
  asientos,
  centros,
  onRecargar,
  onVerPlan,
  onError,
  onAviso
}) {
  const archivoRef = useRef(null);
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaPrevia, setPlantillaPrevia] = useState(null);
  const [cuentasPrevias, setCuentasPrevias] = useState([]);
  const [cargandoPrevia, setCargandoPrevia] = useState(false);
  const [errorPrevia, setErrorPrevia] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [centroEditando, setCentroEditando] = useState(null);
  const [centroForm, setCentroForm] = useState({ codigo:'', nombre:'', descripcion:'', activa:true });

  const tieneMovimientos = asientos.length > 0;
  const plantillaActual = plantillas.find(x => x.id === entidad?.plan_plantilla_id);

  const compatibles = useMemo(() => plantillas.filter(p => {
    if (!entidad) return false;
    if (entidad.tipo === 'comunidad') return p.naturaleza === 'comunidad';
    if (entidad.tipo === 'empresa') return p.naturaleza === 'empresa';
    return true;
  }), [plantillas, entidad]);

  useEffect(() => {
    let vigente = true;
    setPlantillaPrevia(null);
    setPlantillas([]);
    supabase.from('contabilidad_plan_plantillas')
      .select('*')
      .eq('activa', true)
      .order('origen')
      .order('nombre')
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) onError?.(error.message);
        else setPlantillas(data ?? []);
      });
    return () => { vigente = false; };
  }, [entidad?.id]);

  useEffect(() => {
    let vigente = true;
    setCuentasPrevias([]);
    setErrorPrevia(null);
    if (!plantillaPrevia) {
      setCargandoPrevia(false);
      return;
    }
    setCargandoPrevia(true);
    supabase.from('contabilidad_plan_plantilla_cuentas')
      .select('codigo,cuenta,nivel,imputable')
      .eq('plantilla_id', plantillaPrevia.id)
      .order('codigo')
      .then(({ data, error }) => {
        if (!vigente) return;
        setCargandoPrevia(false);
        if (error) setErrorPrevia(error.message);
        else setCuentasPrevias(data ?? []);
      })
      .catch(error => {
        if (!vigente) return;
        setCargandoPrevia(false);
        setErrorPrevia(error.message);
      });
    return () => { vigente = false; };
  }, [plantillaPrevia]);

  async function aplicarPlantilla(id) {
    if (!entidad || tieneMovimientos || aplicando) return;
    if (cuentas.length && !window.confirm('Se reemplazará el plan actual por una copia editable de esta plantilla. ¿Continuar?')) return;
    setAplicando(true);
    try {
      const { error } = await supabase.rpc('contabilidad_aplicar_plantilla', {
        p_entidad: entidad.id,
        p_plantilla: id
      });
      if (error) throw error;
      await onRecargar?.();
      onAviso?.('Plan aplicado. Puedes editar sus cuentas en Plan de cuentas.');
    } catch (error) {
      onError?.(error.message);
    } finally {
      setAplicando(false);
    }
  }

  async function crearVacio() {
    if (!entidad || tieneMovimientos || aplicando) return;
    if (!window.confirm('Se descartará el plan actual de esta entidad. ¿Continuar?')) return;
    setAplicando(true);
    const { error } = await supabase.rpc('contabilidad_crear_plan_vacio', { p_entidad: entidad.id });
    setAplicando(false);
    if (error) return onError?.(error.message);
    onAviso?.('Plan vacío creado. Ya puedes agregar cuentas manualmente.');
    await onRecargar?.();
  }

  async function importarArchivo(file) {
    if (!entidad || !file || tieneMovimientos) return;
    try {
      setAplicando(true);
      const filas = await leerArchivo(file);
      if (!filas.length) throw new Error('No se encontraron filas válidas. Usa columnas código y cuenta como mínimo.');
      const { error } = await supabase.rpc('contabilidad_importar_plan', {
        p_entidad: entidad.id,
        p_lineas: filas
      });
      if (error) throw error;
      onAviso?.('Plan importado correctamente: ' + filas.length + ' cuentas.');
      await onRecargar?.();
    } catch (e) {
      onError?.(e?.message || 'No se pudo importar el archivo.');
    } finally {
      setAplicando(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  }

  async function guardarComoPlantilla() {
    if (!entidad || !nombrePlantilla.trim() || !cuentas.length) return;
    setAplicando(true);
    const { error } = await supabase.rpc('contabilidad_guardar_plan_como_plantilla', {
      p_entidad: entidad.id,
      p_nombre: nombrePlantilla.trim()
    });
    setAplicando(false);
    if (error) return onError?.(error.message);
    setNombrePlantilla('');
    onAviso?.('Plan guardado como plantilla personalizada.');
    const { data } = await supabase.from('contabilidad_plan_plantillas').select('*').eq('activa',true).order('origen').order('nombre');
    setPlantillas(data ?? []);
  }

  async function alternarCentros() {
    const siguiente = !entidad.usa_centros_costo;
    setAplicando(true);
    const { error } = await supabase.rpc('contabilidad_configurar_centros', {
      p_entidad: entidad.id,
      p_usar: siguiente
    });
    setAplicando(false);
    if (error) return onError?.(error.message);
    onAviso?.(siguiente
      ? 'Centros de costo habilitados para la entidad.'
      : 'Centros de costo deshabilitados para nuevos asientos. El histórico se conserva.');
    await onRecargar?.();
  }

  function editarCentro(c = null) {
    setCentroEditando(c || { id:null });
    setCentroForm(c ? {
      codigo:c.codigo || '', nombre:c.nombre || '', descripcion:c.descripcion || '', activa:c.activa !== false
    } : { codigo:'', nombre:'', descripcion:'', activa:true });
  }

  async function guardarCentro(e) {
    e.preventDefault();
    if (!centroForm.codigo.trim() || !centroForm.nombre.trim()) return;
    setAplicando(true);
    const { error } = await supabase.rpc('contabilidad_guardar_centro', {
      p_entidad: entidad.id,
      p_id: centroEditando?.id || null,
      p_codigo: centroForm.codigo.trim(),
      p_nombre: centroForm.nombre.trim(),
      p_descripcion: centroForm.descripcion.trim() || null,
      p_activa: centroForm.activa
    });
    setAplicando(false);
    if (error) return onError?.(error.message);
    setCentroEditando(null);
    onAviso?.('Centro de costo guardado.');
    await onRecargar?.();
  }

  return (
    <div className="contabilidad-configuracion">
      <section className="tarjeta contabilidad-config-bloque">
        <div className="contabilidad-config-cabecera">
          <div>
            <h2 className="h3">Configuración contable</h2>
            <p className="micro apagado">Define el origen del plan de cuentas y protege el historial de la entidad.</p>
          </div>
          <span className={'chip ' + (tieneMovimientos ? 'chip-alerta' : 'chip-cumple')}>
            {tieneMovimientos ? 'Plan protegido' : 'Plan editable'}
          </span>
        </div>

        <div className="contabilidad-config-resumen">
          <div><span>Origen del plan</span><strong>{origenTexto(entidad, plantillaActual)}</strong></div>
          <div><span>Cuentas</span><strong>{cuentas.length}</strong></div>
          <div><span>Movimientos</span><strong>{asientos.filter(x => x.estado === 'contabilizado').length}</strong></div>
          <div><span>Centros de costo</span><strong>{entidad.usa_centros_costo ? 'Habilitados' : 'Deshabilitados'}</strong></div>
        </div>

        {tieneMovimientos ? (
          <div className="aviso contabilidad-regla-oro">
            <strong>Historial protegido.</strong> Ya existen movimientos contables. No puedes reemplazar el plan completo ni eliminar cuentas.
            Sí puedes renombrar cuentas, agregar subcuentas inferiores y desactivar cuentas que no tengan movimientos en el ejercicio actual.
          </div>
        ) : (
          <>
            <div className="contabilidad-config-subtitulo">
              <h3>Elegir origen del plan</h3>
              <p>Las plantillas son una referencia: se copian a la entidad y puedes editar sus cuentas en Plan de cuentas.
                Puedes cambiar de alternativa mientras la entidad no tenga movimientos.</p>
            </div>

            <div className="contabilidad-plantillas-grid">
              {compatibles.map(p => (
                <article key={p.id} className={'tarjeta contabilidad-plantilla-plan ' + (entidad.plan_plantilla_id === p.id ? 'activa' : '')}>
                  <span className="micro apagado">{p.origen === 'sistema' ? 'Plantilla predefinida' : 'Plantilla personalizada'}</span>
                  <strong>{p.nombre}</strong>
                  <button type="button" className="boton boton-texto" disabled={aplicando}
                          aria-expanded={plantillaPrevia?.id === p.id}
                          aria-controls="contabilidad-vista-previa"
                          onClick={() => setPlantillaPrevia(plantillaPrevia?.id === p.id ? null : p)}>
                    {plantillaPrevia?.id === p.id ? 'Ocultar plan' : 'Ver plan de cuentas'}
                  </button>
                  <button type="button" className="boton boton-secundario" disabled={aplicando}
                          onClick={() => aplicarPlantilla(p.id)}>
                    {entidad.plan_plantilla_id === p.id ? 'Volver a aplicar' : 'Usar esta plantilla'}
                  </button>
                </article>
              ))}
            </div>

            {plantillaPrevia && (
              <section id="contabilidad-vista-previa" className="tarjeta contabilidad-vista-previa" aria-live="polite">
                <h3>{plantillaPrevia.nombre}</h3>
                <p className="micro apagado">Vista previa de la referencia. Al asignarla, tendrás una copia editable para {entidad.nombre}.</p>
                {cargandoPrevia ? <p>Cargando plan de cuentas…</p> : errorPrevia ? (
                  <div role="alert">
                    <p>{errorPrevia}</p>
                    <button type="button" className="boton boton-secundario"
                            onClick={() => setPlantillaPrevia({ ...plantillaPrevia })}>Reintentar</button>
                  </div>
                ) : (
                  <>
                    <p className="micro">{cuentasPrevias.filter(c => c.imputable).length} cuentas de movimiento.</p>
                    <div className="tabla-responsive contabilidad-vista-previa-tabla">
                      <table className="tabla">
                        <thead><tr><th>Código</th><th>Cuenta</th><th>Uso</th></tr></thead>
                        <tbody>
                          {cuentasPrevias.map(c => (
                            <tr key={c.codigo} className={!c.imputable ? 'agrupadora' : ''}>
                              <td>{c.codigo}</td>
                              <td><span style={{ paddingLeft: Math.max(0, c.nivel - 1) * 12 }}>{c.cuenta}</span></td>
                              <td>{c.imputable ? 'Movimiento' : 'Agrupadora'}</td>
                            </tr>
                          ))}
                          {!cuentasPrevias.length && <tr><td colSpan="3">Esta plantilla no tiene cuentas.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" className="boton boton-secundario"
                            disabled={aplicando || !cuentasPrevias.length}
                            onClick={() => aplicarPlantilla(plantillaPrevia.id)}>
                      {aplicando ? 'Asignando…' : 'Asignar este plan a la entidad'}
                    </button>
                  </>
                )}
              </section>
            )}

            <div className="contabilidad-origen-alternativas">
              <div className="tarjeta">
                <strong>Importar plan existente</strong>
                <p className="micro apagado">Excel XLSX o CSV. Columnas mínimas: código y cuenta.</p>
                <input ref={archivoRef} type="file" accept=".xlsx,.csv"
                       disabled={aplicando} onChange={e => importarArchivo(e.target.files?.[0])} />
              </div>
              <div className="tarjeta">
                <strong>Crear desde cero</strong>
                <p className="micro apagado">Descarta el plan actual y permite armarlo manualmente desde Plan de cuentas.</p>
                <button type="button" className="boton boton-secundario" disabled={aplicando} onClick={crearVacio}>
                  Crear plan vacío
                </button>
              </div>
            </div>
          </>
        )}

        {cuentas.length > 0 && (
          <div className="contabilidad-guardar-plantilla">
            <button type="button" className="boton boton-secundario" disabled={aplicando} onClick={onVerPlan}>
              Ver y editar cuentas
            </button>
            <label className="campo crece">
              <span className="etiqueta-campo">Guardar plan actual como plantilla personalizada</span>
              <input value={nombrePlantilla} onChange={e => setNombrePlantilla(e.target.value)}
                     placeholder="Ej.: Comunidad mediana con piscina" />
            </label>
            <button type="button" className="boton boton-secundario"
                    disabled={aplicando || !nombrePlantilla.trim()} onClick={guardarComoPlantilla}>
              Guardar plantilla
            </button>
          </div>
        )}
      </section>

      <section className="tarjeta contabilidad-config-bloque">
        <div className="contabilidad-config-cabecera">
          <div>
            <h2 className="h3">Centros de costo</h2>
            <p className="micro apagado">Dimensión independiente para torres, sectores, etapas o proyectos. No duplica el plan de cuentas.</p>
          </div>
          <button type="button"
                  className={'boton ' + (entidad.usa_centros_costo ? 'boton-secundario' : '')}
                  disabled={aplicando} onClick={alternarCentros}>
            {entidad.usa_centros_costo ? 'Deshabilitar' : 'Habilitar'}
          </button>
        </div>

        <div className="aviso">
          Los movimientos anteriores sin centro se mantienen como <strong>General / Sin asignar</strong>.
          Al deshabilitar esta opción no se modifica el histórico.
        </div>

        {(entidad.usa_centros_costo || centros.length > 0) && (
          <>
            <div className="contabilidad-centros-toolbar">
              <span className="micro apagado">{centros.filter(x => x.activa).length} activos</span>
              <button type="button" className="boton boton-secundario" disabled={!entidad.usa_centros_costo}
                      onClick={() => editarCentro()}>+ Centro de costo</button>
            </div>

            {centroEditando && (
              <form className="tarjeta contabilidad-centro-form" onSubmit={guardarCentro}>
                <label className="campo">
                  <span className="etiqueta-campo">Código *</span>
                  <input value={centroForm.codigo} onChange={e => setCentroForm(v => ({...v,codigo:e.target.value}))} />
                </label>
                <label className="campo">
                  <span className="etiqueta-campo">Nombre *</span>
                  <input value={centroForm.nombre} onChange={e => setCentroForm(v => ({...v,nombre:e.target.value}))} />
                </label>
                <label className="campo crece">
                  <span className="etiqueta-campo">Descripción</span>
                  <input value={centroForm.descripcion} onChange={e => setCentroForm(v => ({...v,descripcion:e.target.value}))}
                         placeholder="Opcional" />
                </label>
                {centroEditando.id && (
                  <label className="campo">
                    <span className="etiqueta-campo">Estado</span>
                    <select value={centroForm.activa ? '1':'0'} onChange={e => setCentroForm(v => ({...v,activa:e.target.value==='1'}))}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </label>
                )}
                <div className="fila-botones">
                  <button type="button" className="boton boton-secundario" onClick={() => setCentroEditando(null)}>Cancelar</button>
                  <button type="submit" className="boton" disabled={aplicando}>Guardar</button>
                </div>
              </form>
            )}

            <div className="contabilidad-centros-lista">
              {centros.map(c => (
                <div key={c.id} className={!c.activa ? 'inactivo' : ''}>
                  <div>
                    <strong>{c.codigo} · {c.nombre}</strong>
                    <span>{c.descripcion || 'Sin descripción'}</span>
                  </div>
                  <div>
                    <span className={'chip ' + (c.activa ? 'chip-cumple' : '')}>{c.activa ? 'Activo' : 'Inactivo'}</span>
                    <button type="button" className="boton boton-texto" onClick={() => editarCentro(c)}>Editar</button>
                  </div>
                </div>
              ))}
              {!centros.length && <p className="micro apagado">Todavía no hay centros de costo.</p>}
            </div>
          </>
        )}
      </section>

      <section className="tarjeta contabilidad-config-bloque">
        <h2 className="h3">Reglas del plan</h2>
        <div className="contabilidad-reglas-grid">
          <div><strong>Hasta 5 niveles</strong><span>Los modelos base usan X.X.XX.XXX y permiten un quinto nivel .XXX.</span></div>
          <div><strong>Cuentas agrupadoras</strong><span>Una cuenta con subcuentas no acepta movimientos directos.</span></div>
          <div><strong>Código .099</strong><span>Se reserva para cuentas “Otros” dentro de cada grupo.</span></div>
          <div><strong>Protección histórica</strong><span>El primer asiento bloquea el reemplazo completo del plan.</span></div>
        </div>
      </section>
    </div>
  );
}
