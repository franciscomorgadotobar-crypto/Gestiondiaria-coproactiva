import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { inicioSegunArea } from '../../lib/area';
import './Comunidades.css';

const SECCIONES = [
  ['resumen', 'Resumen'],
  ['levantamientos', 'Levantamientos'],
  ['activos', 'Activos'],
  ['plan', 'Plan de mantención'],
  ['agenda', 'Agenda'],
  ['configuracion', 'Configuración']
];

const CHIP_CONTROL = {
  pendiente: ['chip-pendiente', 'Pendiente'],
  en_curso: ['chip-alerta', 'En curso'],
  pausado: ['chip-pausado', 'En pausa'],
  enviado: ['chip-cumple', 'Enviado'],
  anulado: ['chip-pendiente', 'Anulado']
};

const CHIP_AGENDA = {
  agendada: ['chip-tipo', 'Agendada'],
  en_curso: ['chip-alerta', 'En curso'],
  completada: ['chip-cumple', 'Completada'],
  cancelada: ['chip-pendiente', 'Cancelada']
};

const SUGERENCIAS = {
  ascensor: ['Mantención preventiva', 'Revisión de puertas', 'Revisión de sala de máquinas', 'Inspección de elementos de seguridad'],
  elevador: ['Mantención preventiva', 'Revisión de puertas', 'Inspección de elementos de seguridad'],
  hvac: ['Mantención preventiva', 'Limpieza de filtros', 'Revisión de refrigerante', 'Inspección eléctrica'],
  climatizacion: ['Mantención preventiva', 'Limpieza de filtros', 'Revisión de refrigerante'],
  'grupo electrogeno': ['Prueba de partida', 'Mantención preventiva', 'Revisión de batería', 'Revisión de combustible'],
  generador: ['Prueba de partida', 'Mantención preventiva', 'Revisión de batería'],
  bomba: ['Prueba de funcionamiento', 'Mantención preventiva', 'Revisión de sellos y fugas'],
  porton: ['Mantención preventiva', 'Revisión de motor y finales de carrera', 'Revisión de elementos de seguridad']
};

function normalizar(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fechaCL(valor, conHora = false) {
  if (!valor) return 'Sin fecha';
  // PostgreSQL entrega los campos DATE como AAAA-MM-DD. Construirlos directo con
  // new Date() los interpreta en UTC y en Chile puede mostrar el día anterior.
  const esSoloFecha = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(esSoloFecha ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', conHora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function sugerenciasPara(categoria) {
  const clave = normalizar(categoria);
  const encontrada = Object.keys(SUGERENCIAS).find(k => clave.includes(k));
  return encontrada ? SUGERENCIAS[encontrada] : ['Mantención preventiva', 'Inspección periódica'];
}

function fechaISOChile(valor = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(valor));
  const porTipo = Object.fromEntries(partes.map(p => [p.type, p.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}

function fechaUTCDesdeISO(valor) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function fechaISODesdeUTC(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return '';
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}

function ultimoDiaMesUTC(ano, mesIndice) {
  return new Date(Date.UTC(ano, mesIndice + 1, 0));
}

function fechaDiaMesUTC(ano, mesIndice, dia) {
  const ultimo = ultimoDiaMesUTC(ano, mesIndice).getUTCDate();
  return new Date(Date.UTC(ano, mesIndice, Math.min(Math.max(Number(dia) || 1, 1), ultimo)));
}

function sumarFrecuenciaFecha(fecha, unidad, valor, limiteTipo, diaLimite) {
  const n = Math.max(Number(valor) || 1, 1);
  const d = new Date(fecha.getTime());
  if (limiteTipo === 'fin_periodo') {
    if (unidad === 'dias') d.setUTCDate(d.getUTCDate() + n);
    else if (unidad === 'semanas') d.setUTCDate(d.getUTCDate() + n * 7);
    else if (unidad === 'meses') return ultimoDiaMesUTC(d.getUTCFullYear(), d.getUTCMonth() + n);
    else if (unidad === 'anos') return new Date(Date.UTC(d.getUTCFullYear() + n, 11, 31));
    return d;
  }
  if (limiteTipo === 'dia_mes' && unidad === 'meses') {
    return fechaDiaMesUTC(d.getUTCFullYear(), d.getUTCMonth() + n, diaLimite);
  }
  if (unidad === 'dias') d.setUTCDate(d.getUTCDate() + n);
  else if (unidad === 'semanas') d.setUTCDate(d.getUTCDate() + n * 7);
  else if (unidad === 'meses') {
    const diaOriginal = d.getUTCDate();
    const objetivo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    return fechaDiaMesUTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth(), diaOriginal);
  } else if (unidad === 'anos') {
    const mes = d.getUTCMonth();
    const dia = d.getUTCDate();
    return fechaDiaMesUTC(d.getUTCFullYear() + n, mes, dia);
  }
  return d;
}

function primeraFechaLimite(form) {
  if (form.frecuencia_unidad === 'unica' || form.limite_tipo === 'fecha_especifica') {
    return form.proxima_exigible || '';
  }
  const inicio = fechaUTCDesdeISO(form.fecha_inicio);
  if (!inicio) return '';
  const n = Math.max(Number(form.frecuencia_valor) || 1, 1);
  let limite;
  if (form.limite_tipo === 'fin_periodo') {
    if (form.frecuencia_unidad === 'dias') {
      limite = new Date(inicio.getTime());
      limite.setUTCDate(limite.getUTCDate() + n - 1);
    } else if (form.frecuencia_unidad === 'semanas') {
      limite = new Date(inicio.getTime());
      limite.setUTCDate(limite.getUTCDate() + n * 7 - 1);
    } else if (form.frecuencia_unidad === 'meses') {
      limite = ultimoDiaMesUTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + n - 1);
    } else if (form.frecuencia_unidad === 'anos') {
      limite = new Date(Date.UTC(inicio.getUTCFullYear() + n - 1, 11, 31));
    }
  } else if (form.limite_tipo === 'dia_mes' && form.frecuencia_unidad === 'meses') {
    limite = fechaDiaMesUTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + n - 1, form.dia_limite);
    if (limite < inicio) {
      limite = fechaDiaMesUTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + n, form.dia_limite);
    }
  }
  return limite ? fechaISODesdeUTC(limite) : '';
}

function previsualizarFechasLimite(form, cantidad = 3) {
  const primera = primeraFechaLimite(form);
  if (!primera) return [];
  const fechas = [primera];
  if (form.frecuencia_unidad === 'unica') return fechas;
  let actual = fechaUTCDesdeISO(primera);
  for (let i = 1; i < cantidad && actual; i += 1) {
    actual = sumarFrecuenciaFecha(actual, form.frecuencia_unidad, form.frecuencia_valor, form.limite_tipo, form.dia_limite);
    fechas.push(fechaISODesdeUTC(actual));
  }
  return fechas;
}

export default function Comunidades() {
  const { id } = useParams();
  return id ? <DetalleComunidad id={id} /> : <ListadoComunidades />;
}

function ListadoComunidades() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const [comunidades, setComunidades] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState(null);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    if (!perfil?.id) return;
    let vigente = true;
    Promise.all([
      supabase.from('comunidades')
        .select('id, nombre, comuna, direccion, latitud, longitud')
        .order('nombre'),
      supabase.from('notificaciones_mantenimiento')
        .select('id, comunidad_id, titulo, mensaje, creado_en')
        .eq('destinatario_id', perfil.id)
        .eq('leida', false)
        .order('creado_en', { ascending: false })
        .limit(10)
    ]).then(([rc, rn]) => {
      if (!vigente) return;
      if (rc.error) setError(rc.error.message);
      else setComunidades(rc.data ?? []);
      if (!rn.error) setAlertas(rn.data ?? []);
    });
    return () => { vigente = false; };
  }, [perfil?.id]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar);
    if (!q) return comunidades ?? [];
    return (comunidades ?? []).filter(c =>
      [c.nombre, c.comuna, c.direccion].some(v => normalizar(v).includes(q))
    );
  }, [comunidades, buscar]);

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }} onClick={() => navegar(inicioSegunArea())}>
            ‹ Inicio
          </button>
        </div>
        <h1 className="h3">Comunidades</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          Histórico, activos, levantamientos y mantenciones de cada edificio.
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

        {alertas.length > 0 && (
          <section className="comunidades-alertas">
            <h2 className="h4">Alertas de mantención</h2>
            {alertas.map(a => (
              <Link key={a.id} to={`/comunidades/${a.comunidad_id}`} className="comunidad-alerta comunidad-alerta-link">
                <strong>{a.titulo}</strong>
                <span className="micro">{a.mensaje}</span>
              </Link>
            ))}
          </section>
        )}

        <div className="campo comunidades-buscador">
          <label className="etiqueta-campo" htmlFor="buscar-comunidad">Buscar comunidad</label>
          <input
            id="buscar-comunidad"
            type="search"
            placeholder="Nombre, comuna o dirección"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
          />
        </div>

        {comunidades === null && !error && <p className="cargando">Cargando…</p>}
        {comunidades?.length === 0 && <p className="vacio">No hay comunidades registradas todavía.</p>}
        {comunidades && comunidades.length > 0 && visibles.length === 0 && (
          <p className="vacio">No hay comunidades que coincidan con la búsqueda.</p>
        )}

        <div className="comunidades-lista">
          {visibles.map(c => (
            <Link key={c.id} to={`/comunidades/${c.id}`} className="tarjeta comunidad-card" style={{ padding: 16 }}>
              <div className="fila">
                <strong className="crece">{c.nombre}</strong>
                <span aria-hidden="true">›</span>
              </div>
              <div className="comunidad-meta micro apagado">
                {c.comuna && <span>{c.comuna}</span>}
                {c.direccion && <span>{c.direccion}</span>}
                {c.latitud != null && c.longitud != null && <span>Ubicación registrada</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetalleComunidad({ id }) {
  const navegar = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { perfil } = useSesion();
  const puedeGestionar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  const seccionInicial = SECCIONES.some(([k]) => k === searchParams.get('seccion'))
    ? searchParams.get('seccion')
    : 'resumen';

  const [seccion, setSeccion] = useState(seccionInicial);
  const [comunidad, setComunidad] = useState(null);
  const [controles, setControles] = useState([]);
  const [activos, setActivos] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [ejecuciones, setEjecuciones] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [diagnosticoInicial, setDiagnosticoInicial] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [nuevoActivo, setNuevoActivo] = useState({
    nombre: '', categoria: '', ubicacion: '', marca: '', modelo: '', serie: '', estado: 'operativo', proveedor: '', documentos: ''
  });
  const [nuevaActividad, setNuevaActividad] = useState({
    activo_id: '', trabajo: '', frecuencia_unidad: '', frecuencia_valor: '', fecha_inicio: '', limite_tipo: 'fin_periodo', dia_limite: '', proxima_exigible: '', responsable_id: '', proveedor: '', evidencias: ''
  });
  const [nuevoAgendamiento, setNuevoAgendamiento] = useState({
    actividad_id: '', programado_para: '', responsable_id: ''
  });
  const [actividadAlertas, setActividadAlertas] = useState('');
  const [formAlertas, setFormAlertas] = useState({
    dias_antes: '7', mismo_dia: true, al_vencer: true, escalamiento_dias: '2', administracion: true, jefatura: false, escalar_jefatura: true, incluir_responsable: true
  });
  const [ubicacion, setUbicacion] = useState({ direccion: '', comuna: '', latitud: '', longitud: '' });

  async function cargar() {
    setCargando(true);
    setError(null);
    const [rc, rl, ra, rp, rag, rx, re, rr, rn] = await Promise.all([
      supabase.from('comunidades').select('id, nombre, comuna, direccion, latitud, longitud').eq('id', id).maybeSingle(),
      supabase.from('controles_con_avance')
        .select('id, comunidad_id, estado, enviado_en, programado_para, creado_en, checkin_en, responsable_id, responsable_nombre, plantilla_nombre, items_criticos, periodo')
        .eq('comunidad_id', id)
        .neq('estado', 'anulado')
        .order('programado_para', { ascending: false, nullsFirst: false }),
      supabase.from('activos_comunidad').select('*').eq('comunidad_id', id).order('nombre'),
      supabase.from('mantenimiento_actividades').select('*').eq('comunidad_id', id).eq('activa', true).order('creado_en'),
      supabase.from('mantenimiento_agendamientos').select('*').eq('comunidad_id', id).order('programado_para', { ascending: true }),
      supabase.from('ejecuciones_mantenimiento').select('*').eq('comunidad_id', id).order('realizado_en', { ascending: false }),
      // Un cliente no es responsable de mantención: es externo, no parte
      // del equipo.
      puedeGestionar
        ? supabase.from('perfiles').select('id, nombre, rol, activo').eq('activo', true).neq('rol', 'cliente').order('nombre')
        : Promise.resolve({ data: [], error: null }),
      puedeGestionar
        ? supabase.from('mantenimiento_alertas_config').select('*').eq('comunidad_id', id)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('notificaciones_mantenimiento')
        .select('*').eq('comunidad_id', id).eq('destinatario_id', perfil?.id ?? '').order('creado_en', { ascending: false }).limit(20)
    ]);

    const fallo = [rc, rl, ra, rp, rag, rx, re, rr, rn].find(r => r.error);
    if (fallo?.error) setError(fallo.error.message);
    if (rc.data) {
      setComunidad(rc.data);
      setUbicacion({
        direccion: rc.data.direccion ?? '',
        comuna: rc.data.comuna ?? '',
        latitud: rc.data.latitud ?? '',
        longitud: rc.data.longitud ?? ''
      });
    }
    setControles(rl.data ?? []);
    setActivos(ra.data ?? []);
    setActividades(rp.data ?? []);
    setAgenda(rag.data ?? []);
    setEjecuciones(rx.data ?? []);
    setEquipo(re.data ?? []);
    setReglas(rr.data ?? []);
    setNotificaciones(rn.data ?? []);
    setCargando(false);
  }

  /* El diagnóstico que se hizo cuando la comunidad todavía era un prospecto.
   * Queda ligado al prospecto, no a la comunidad: se busca el prospecto que se
   * ganó como esta comunidad y su diagnóstico vigente. Es información
   * comercial: solo la leen quienes trabajan el CRM (la base no se la entrega
   * a terreno), así que para los demás simplemente no aparece. */
  async function cargarDiagnosticoInicial() {
    if (!puedeGestionar) return setDiagnosticoInicial(null);
    const { data: origen } = await supabase.from('prospectos').select('id').eq('comunidad_id', id).limit(1);
    const prospectoId = origen?.[0]?.id;
    if (!prospectoId) return setDiagnosticoInicial(null);
    const { data: ctl } = await supabase.from('controles')
      .select('id, estado, enviado_en, creado_en')
      .eq('prospecto_id', prospectoId).eq('es_diagnostico', true).neq('estado', 'anulado')
      .limit(1);
    const control = ctl?.[0];
    if (!control) return setDiagnosticoInicial(null);
    const { data: resultado } = await supabase.from('diagnosticos_resultado')
      .select('score, nivel, linea_sugerida, linea_elegida, hallazgos_criticos')
      .eq('control_id', control.id).maybeSingle();
    setDiagnosticoInicial({ control, resultado: resultado ?? null });
  }

  useEffect(() => {
    if (!perfil?.id) return;
    cargar();
    cargarDiagnosticoInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, perfil?.id]);

  useEffect(() => {
    if (!actividadAlertas) return;
    const regla = reglas.find(r => r.actividad_id === actividadAlertas);
    if (!regla) {
      setFormAlertas({
        dias_antes: '7', mismo_dia: true, al_vencer: true, escalamiento_dias: '2', administracion: true, jefatura: false, escalar_jefatura: true, incluir_responsable: true
      });
      return;
    }
    setFormAlertas({
      dias_antes: (regla.dias_antes ?? []).join(','),
      mismo_dia: regla.avisar_mismo_dia,
      al_vencer: regla.avisar_al_vencer,
      escalamiento_dias: regla.escalamiento_dias ?? '',
      administracion: (regla.destinatarios_grupos ?? []).includes('administracion'),
      jefatura: (regla.destinatarios_grupos ?? []).includes('jefatura'),
      escalar_jefatura: (regla.escalamiento_grupos ?? []).includes('jefatura'),
      incluir_responsable: regla.incluir_responsable
    });
  }, [actividadAlertas, reglas]);

  function cambiarSeccion(s) {
    setSeccion(s);
    const p = new URLSearchParams(searchParams);
    if (s === 'resumen') p.delete('seccion'); else p.set('seccion', s);
    setSearchParams(p, { replace: true });
  }

  const activosPorId = useMemo(() => new Map(activos.map(a => [a.id, a])), [activos]);
  const actividadesPorId = useMemo(() => new Map(actividades.map(a => [a.id, a])), [actividades]);
  const equipoPorId = useMemo(() => new Map(equipo.map(p => [p.id, p])), [equipo]);
  const ejecucionPorAgenda = useMemo(() => new Map(ejecuciones.filter(e => e.agendamiento_id).map(e => [e.agendamiento_id, e])), [ejecuciones]);

  const kpisMantencion = useMemo(() => {
    const hoy = fechaISOChile();
    const ahora = Date.now();
    const abiertas = agenda.filter(a => !['completada', 'cancelada'].includes(a.estado));
    const conAgenda = new Set(abiertas.map(a => a.actividad_id));
    const vencimiento = a => a.vencimiento_original || (a.programado_para ? fechaISOChile(a.programado_para) : null);
    const pendientes = abiertas.filter(a => {
      const visitaYaPaso = a.programado_para && new Date(a.programado_para).getTime() <= ahora;
      const vencimientoYaPaso = vencimiento(a) && vencimiento(a) < hoy;
      return visitaYaPaso || vencimientoYaPaso;
    });
    const sinAgenda = actividades.filter(a => !conAgenda.has(a.id));
    const sinAgendaVencidas = sinAgenda.filter(a => a.proxima_exigible && a.proxima_exigible < hoy);
    const idsPendientes = new Set(pendientes.map(a => a.id));
    return {
      porAgendar: sinAgenda.filter(a => !a.proxima_exigible || a.proxima_exigible >= hoy).length,
      agendadas: abiertas.filter(a => !idsPendientes.has(a.id) && a.programado_para && new Date(a.programado_para).getTime() > ahora).length,
      pendientes: pendientes.length + sinAgendaVencidas.length
    };
  }, [actividades, agenda]);

  async function guardarActivo() {
    if (!nuevoActivo.nombre.trim() || !nuevoActivo.categoria.trim()) {
      return setError('El activo necesita al menos nombre y categoría.');
    }
    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.from('activos_comunidad').insert({
      comunidad_id: id,
      nombre: nuevoActivo.nombre.trim(),
      categoria: nuevoActivo.categoria.trim(),
      ubicacion: nuevoActivo.ubicacion.trim() || null,
      marca: nuevoActivo.marca.trim() || null,
      modelo: nuevoActivo.modelo.trim() || null,
      serie: nuevoActivo.serie.trim() || null,
      estado: nuevoActivo.estado,
      proveedor: nuevoActivo.proveedor.trim() || null,
      documentos: nuevoActivo.documentos.split(',').map(v => v.trim()).filter(Boolean)
    }).select().single();
    setGuardando(false);
    if (error) return setError(error.message);
    setActivos(xs => [...xs, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    setNuevoActivo({ nombre: '', categoria: '', ubicacion: '', marca: '', modelo: '', serie: '', estado: 'operativo', proveedor: '', documentos: '' });
  }

  async function guardarActividad() {
    if (!nuevaActividad.activo_id || !nuevaActividad.trabajo.trim()) {
      return setError('Elige un activo e indica el trabajo de mantención.');
    }
    if (!nuevaActividad.frecuencia_unidad) return setError('Define si es una intervención única o una frecuencia.');
    if (nuevaActividad.frecuencia_unidad !== 'unica' && Number(nuevaActividad.frecuencia_valor) < 1) {
      return setError('La frecuencia debe ser mayor que cero.');
    }
    if (nuevaActividad.frecuencia_unidad !== 'unica' && nuevaActividad.limite_tipo !== 'fecha_especifica' && !nuevaActividad.fecha_inicio) {
      return setError('Indica la fecha de inicio para calcular la fecha límite del período.');
    }
    if (nuevaActividad.limite_tipo === 'dia_mes' && (Number(nuevaActividad.dia_limite) < 1 || Number(nuevaActividad.dia_limite) > 31)) {
      return setError('El día límite del mes debe estar entre 1 y 31.');
    }
    const fechaLimite = primeraFechaLimite(nuevaActividad);
    if (!fechaLimite) return setError('Define la fecha límite de esta mantención.');
    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.from('mantenimiento_actividades').insert({
      comunidad_id: id,
      activo_id: nuevaActividad.activo_id,
      trabajo: nuevaActividad.trabajo.trim(),
      frecuencia_unidad: nuevaActividad.frecuencia_unidad,
      frecuencia_valor: nuevaActividad.frecuencia_unidad === 'unica' ? null : Number(nuevaActividad.frecuencia_valor),
      fecha_inicio: nuevaActividad.fecha_inicio || null,
      limite_tipo: nuevaActividad.frecuencia_unidad === 'unica' ? 'fecha_especifica' : nuevaActividad.limite_tipo,
      dia_limite: nuevaActividad.limite_tipo === 'dia_mes' ? Number(nuevaActividad.dia_limite) : null,
      proxima_exigible: fechaLimite,
      responsable_id: nuevaActividad.responsable_id || null,
      proveedor: nuevaActividad.proveedor.trim() || null,
      evidencias_requeridas: nuevaActividad.evidencias.split(',').map(v => v.trim()).filter(Boolean)
    }).select().single();
    setGuardando(false);
    if (error) return setError(error.message);
    setActividades(xs => [...xs, data]);
    setNuevaActividad({ activo_id: '', trabajo: '', frecuencia_unidad: '', frecuencia_valor: '', fecha_inicio: '', limite_tipo: 'fin_periodo', dia_limite: '', proxima_exigible: '', responsable_id: '', proveedor: '', evidencias: '' });
  }

  async function guardarAgendamiento() {
    if (!nuevoAgendamiento.actividad_id || !nuevoAgendamiento.programado_para) {
      return setError('Elige una actividad y una fecha para agendar la mantención.');
    }
    setGuardando(true);
    setError(null);
    const fecha = new Date(nuevoAgendamiento.programado_para).toISOString();
    const actividad = actividadesPorId.get(nuevoAgendamiento.actividad_id);
    const { data, error } = await supabase.from('mantenimiento_agendamientos').insert({
      comunidad_id: id,
      actividad_id: nuevoAgendamiento.actividad_id,
      programado_para: fecha,
      responsable_id: nuevoAgendamiento.responsable_id || actividad?.responsable_id || null,
      estado: 'agendada'
    }).select().single();
    setGuardando(false);
    if (error) return setError(error.message);
    setAgenda(xs => [...xs, data].sort((a, b) => new Date(a.programado_para) - new Date(b.programado_para)));
    setNuevoAgendamiento({ actividad_id: '', programado_para: '', responsable_id: '' });
  }

  async function reprogramar(item) {
    const valor = prompt('Nueva fecha y hora (AAAA-MM-DDTHH:MM)', item.programado_para?.slice(0, 16) ?? '');
    if (!valor) return;
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return setError('La nueva fecha no es válida.');
    const { data, error } = await supabase.from('mantenimiento_agendamientos')
      .update({ programado_para: d.toISOString(), reprogramado_en: new Date().toISOString(), reprogramado_por: perfil?.id ?? null })
      .eq('id', item.id).select().single();
    if (error) return setError(error.message);
    setAgenda(xs => xs.map(x => x.id === item.id ? data : x));
  }

  async function registrarEjecucion(item) {
    const actividad = actividadesPorId.get(item.actividad_id);
    const responsable = item.responsable_id ? equipoPorId.get(item.responsable_id)?.nombre : null;
    const quienSugerido = responsable || actividad?.proveedor || '';
    const ejecutor = prompt('¿Quién realizó la mantención?', quienSugerido);
    if (ejecutor === null) return;
    if (!ejecutor.trim()) return setError('Indica quién realizó la mantención.');

    const observaciones = prompt('¿Qué se realizó? Observaciones de la ejecución (opcional)');
    if (observaciones === null) return;
    const requeridas = actividad?.evidencias_requeridas ?? [];
    const mensajeEvidencia = requeridas.length
      ? `Respaldo o evidencias (requerido: ${requeridas.join(', ')}). Separa varias referencias por coma.`
      : 'URL o referencia del respaldo/evidencia (opcional). Separa varias referencias por coma.';
    const respaldo = prompt(mensajeEvidencia);
    if (respaldo === null) return;
    const evidencias = respaldo.split(',').map(v => v.trim()).filter(Boolean);
    if (requeridas.length && !evidencias.length) {
      return setError(`Esta actividad exige evidencia: ${requeridas.join(', ')}.`);
    }

    setGuardando(true);
    setError(null);
    const realizadoEn = new Date().toISOString();
    const { data: ejecucion, error: e1 } = await supabase.from('ejecuciones_mantenimiento').insert({
      comunidad_id: id,
      actividad_id: item.actividad_id,
      agendamiento_id: item.id,
      ejecutado_por: perfil?.id ?? null,
      ejecutor_texto: ejecutor.trim(),
      realizado_en: realizadoEn,
      observaciones: observaciones.trim() || null,
      respaldo_url: evidencias[0] || null,
      evidencias
    }).select().single();
    if (e1) { setGuardando(false); return setError(e1.message); }
    const { data, error: e2 } = await supabase.from('mantenimiento_agendamientos')
      .update({ estado: 'completada', completada_en: realizadoEn })
      .eq('id', item.id).select().single();
    setGuardando(false);
    if (e2) return setError(e2.message);
    setAgenda(xs => xs.map(x => x.id === item.id ? data : x));
    setEjecuciones(xs => [ejecucion, ...xs]);
  }

  async function guardarAlertas() {
    if (!actividadAlertas) return setError('Elige una actividad para configurar sus alertas.');
    const dias = [...new Set(formAlertas.dias_antes.split(',')
      .map(v => Number(v.trim())).filter(v => Number.isInteger(v) && v >= 0))]
      .sort((a, b) => b - a);
    const grupos = [
      formAlertas.administracion ? 'administracion' : null,
      formAlertas.jefatura ? 'jefatura' : null
    ].filter(Boolean);
    if (!grupos.length && !formAlertas.incluir_responsable) {
      return setError('Elige al menos un destinatario para las alertas.');
    }
    setGuardando(true);
    setError(null);
    const fila = {
      comunidad_id: id,
      actividad_id: actividadAlertas,
      dias_antes: dias,
      avisar_mismo_dia: formAlertas.mismo_dia,
      avisar_al_vencer: formAlertas.al_vencer,
      escalamiento_dias: formAlertas.escalamiento_dias === '' ? null : Number(formAlertas.escalamiento_dias),
      escalamiento_grupos: formAlertas.escalar_jefatura ? ['jefatura'] : [],
      destinatarios_grupos: grupos,
      incluir_responsable: formAlertas.incluir_responsable,
      canal_in_app: true,
      canal_email: false
    };
    const { data, error } = await supabase.from('mantenimiento_alertas_config')
      .upsert(fila, { onConflict: 'actividad_id' }).select().single();
    setGuardando(false);
    if (error) return setError(error.message);
    setReglas(xs => [...xs.filter(x => x.actividad_id !== data.actividad_id), data]);
  }

  async function guardarUbicacion() {
    const lat = ubicacion.latitud === '' ? null : Number(ubicacion.latitud);
    const lng = ubicacion.longitud === '' ? null : Number(ubicacion.longitud);
    if (lat != null && (lat < -90 || lat > 90)) return setError('La latitud no es válida.');
    if (lng != null && (lng < -180 || lng > 180)) return setError('La longitud no es válida.');
    setGuardando(true);
    const { data, error } = await supabase.from('comunidades').update({
      direccion: ubicacion.direccion.trim() || null,
      comuna: ubicacion.comuna.trim() || null,
      latitud: lat,
      longitud: lng
    }).eq('id', id).select('id, nombre, comuna, direccion, latitud, longitud').single();
    setGuardando(false);
    if (error) return setError(error.message);
    setComunidad(data);
  }

  async function marcarLeida(n) {
    const { error } = await supabase.from('notificaciones_mantenimiento').update({
      leida: true, leida_en: new Date().toISOString()
    }).eq('id', n.id);
    if (error) return setError(error.message);
    setNotificaciones(xs => xs.map(x => x.id === n.id ? { ...x, leida: true } : x));
  }

  if (cargando) return <div className="pantalla"><p className="cargando">Cargando…</p></div>;
  if (!comunidad) {
    return (
      <div className="pantalla"><div className="cuerpo">
        <div className="aviso aviso-critico">{error ?? 'Esta comunidad no existe o no tienes acceso.'}</div>
        <button className="boton boton-texto" onClick={() => navegar('/comunidades')}>‹ Comunidades</button>
      </div></div>
    );
  }

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }} onClick={() => navegar('/comunidades')}>
            ‹ Comunidades
          </button>
        </div>
        <h1 className="h3">{comunidad.nombre}</h1>
        <p className="chico apagado" style={{ margin: '4px 0 0' }}>
          {[comunidad.direccion, comunidad.comuna].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="pestanas" role="tablist" aria-label="Secciones de la comunidad">
          {SECCIONES.map(([clave, nombre]) => (
            <button key={clave} type="button" role="tab" aria-selected={seccion === clave}
                    className={seccion === clave ? 'activo' : ''}
                    onClick={() => cambiarSeccion(clave)}>
              {nombre}
            </button>
          ))}
        </div>

        {seccion === 'resumen' && (
          <Resumen
            controles={controles}
            activos={activos}
            actividades={actividades}
            agenda={agenda}
            kpis={kpisMantencion}
            notificaciones={notificaciones}
            marcarLeida={marcarLeida}
            diagnosticoInicial={diagnosticoInicial}
          />
        )}

        {seccion === 'levantamientos' && (
          <Levantamientos id={id} controles={controles} puedeGestionar={puedeGestionar} />
        )}

        {seccion === 'activos' && (
          <section>
            <div className="comunidad-seccion-titulo">
              <div>
                <h2 className="h4" style={{ margin: 0 }}>Activos</h2>
                <p className="micro apagado" style={{ margin: '3px 0 0' }}>Cada equipo o instalación se registra individualmente.</p>
              </div>
            </div>

            {puedeGestionar && (
              <div className="comunidad-form">
                <h3 className="h4" style={{ marginTop: 0 }}>Agregar activo</h3>
                <div className="comunidad-grid-2">
                  <Campo label="Nombre" valor={nuevoActivo.nombre} onChange={v => setNuevoActivo(x => ({ ...x, nombre: v }))} />
                  <Campo label="Categoría" valor={nuevoActivo.categoria} onChange={v => setNuevoActivo(x => ({ ...x, categoria: v }))} placeholder="Ascensor, bomba, HVAC…" />
                  <Campo label="Ubicación dentro de la comunidad" valor={nuevoActivo.ubicacion} onChange={v => setNuevoActivo(x => ({ ...x, ubicacion: v }))} />
                  <Campo label="Proveedor" valor={nuevoActivo.proveedor} onChange={v => setNuevoActivo(x => ({ ...x, proveedor: v }))} />
                  <Campo label="Marca" valor={nuevoActivo.marca} onChange={v => setNuevoActivo(x => ({ ...x, marca: v }))} />
                  <Campo label="Modelo" valor={nuevoActivo.modelo} onChange={v => setNuevoActivo(x => ({ ...x, modelo: v }))} />
                  <Campo label="Serie" valor={nuevoActivo.serie} onChange={v => setNuevoActivo(x => ({ ...x, serie: v }))} />
                  <Campo label="Documentos / respaldos" valor={nuevoActivo.documentos} onChange={v => setNuevoActivo(x => ({ ...x, documentos: v }))} placeholder="URLs o referencias, separadas por coma" />
                  <div className="campo">
                    <label className="etiqueta-campo">Estado</label>
                    <select value={nuevoActivo.estado} onChange={e => setNuevoActivo(x => ({ ...x, estado: e.target.value }))}>
                      <option value="operativo">Operativo</option>
                      <option value="observacion">En observación</option>
                      <option value="fuera_servicio">Fuera de servicio</option>
                      <option value="baja">Dado de baja</option>
                    </select>
                  </div>
                </div>
                <button className="boton boton-movil" onClick={guardarActivo} disabled={guardando}>Agregar activo</button>
              </div>
            )}

            {activos.length === 0 && <p className="vacio">Esta comunidad todavía no tiene activos registrados.</p>}
            {activos.map(a => (
              <article key={a.id} className="tarjeta" style={{ padding: 14, marginBottom: 10 }}>
                <div className="comunidad-linea-cabecera">
                  <strong>{a.nombre}</strong>
                  <span className="chip chip-tipo">{a.categoria}</span>
                  <span className="chip">{a.estado?.replaceAll('_', ' ')}</span>
                </div>
                <p className="micro apagado" style={{ margin: '7px 0 0' }}>
                  {[a.ubicacion, a.marca, a.modelo, a.serie && `Serie ${a.serie}`, a.proveedor].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                </p>
                {Array.isArray(a.documentos) && a.documentos.length > 0 && (
                  <div className="comunidad-documentos micro">
                    {a.documentos.map((doc, i) => /^https?:\/\//i.test(doc)
                      ? <a key={doc + i} href={doc} target="_blank" rel="noreferrer">Documento {i + 1}</a>
                      : <span key={doc + i}>{doc}</span>)}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {seccion === 'plan' && (
          <section>
            <h2 className="h4">Plan de mantención</h2>
            <p className="chico apagado">El plan define qué debe hacerse y con qué frecuencia. Agendar una visita es una ejecución distinta del plan.</p>

            {puedeGestionar && activos.length > 0 && (
              <div className="comunidad-form">
                <h3 className="h4" style={{ marginTop: 0 }}>Agregar actividad al plan</h3>
                <div className="campo">
                  <label className="etiqueta-campo">Activo</label>
                  <select value={nuevaActividad.activo_id} onChange={e => setNuevaActividad(x => ({ ...x, activo_id: e.target.value, trabajo: '' }))}>
                    <option value="">Elegir…</option>
                    {activos.filter(a => a.estado !== 'baja').map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.categoria}</option>)}
                  </select>
                  {nuevaActividad.activo_id && (
                    <div className="comunidad-sugerencias">
                      {sugerenciasPara(activosPorId.get(nuevaActividad.activo_id)?.categoria).map(s => (
                        <button key={s} type="button" className="comunidad-sugerencia" onClick={() => setNuevaActividad(x => ({ ...x, trabajo: s }))}>{s}</button>
                      ))}
                    </div>
                  )}
                  <p className="micro apagado" style={{ margin: '6px 0 0' }}>Las sugerencias solo completan el trabajo. La frecuencia siempre debe validarse antes de guardar.</p>
                </div>
                <Campo label="Trabajo" valor={nuevaActividad.trabajo} onChange={v => setNuevaActividad(x => ({ ...x, trabajo: v }))} />
                <div className="comunidad-subgrid">
                  <div className="campo">
                    <label className="etiqueta-campo">Tipo de frecuencia</label>
                    <select value={nuevaActividad.frecuencia_unidad} onChange={e => {
                      const unidad = e.target.value;
                      setNuevaActividad(x => ({
                        ...x,
                        frecuencia_unidad: unidad,
                        frecuencia_valor: unidad === 'unica' ? '' : x.frecuencia_valor,
                        limite_tipo: unidad === 'unica'
                          ? 'fecha_especifica'
                          : (!x.frecuencia_unidad || x.frecuencia_unidad === 'unica' ? 'fin_periodo' : x.limite_tipo),
                        dia_limite: unidad === 'meses' ? x.dia_limite : ''
                      }));
                    }}>
                      <option value="">Definir…</option>
                      <option value="unica">Intervención única</option>
                      <option value="dias">Cada N días</option>
                      <option value="semanas">Cada N semanas</option>
                      <option value="meses">Cada N meses</option>
                      <option value="anos">Cada N años</option>
                    </select>
                  </div>
                  {nuevaActividad.frecuencia_unidad && nuevaActividad.frecuencia_unidad !== 'unica' && (
                    <Campo label="Cada cuánto" tipo="number" min="1" valor={nuevaActividad.frecuencia_valor} onChange={v => setNuevaActividad(x => ({ ...x, frecuencia_valor: v }))} />
                  )}
                </div>
                <div className="comunidad-grid-2">
                  <Campo label="Fecha de inicio" tipo="date" valor={nuevaActividad.fecha_inicio} onChange={v => setNuevaActividad(x => ({ ...x, fecha_inicio: v }))} />
                  {nuevaActividad.frecuencia_unidad && nuevaActividad.frecuencia_unidad !== 'unica' && (
                    <div className="campo">
                      <label className="etiqueta-campo">Fecha límite</label>
                      <select value={nuevaActividad.limite_tipo} onChange={e => setNuevaActividad(x => ({ ...x, limite_tipo: e.target.value, dia_limite: '', proxima_exigible: '' }))}>
                        <option value="fin_periodo">Último día de cada período</option>
                        {nuevaActividad.frecuencia_unidad === 'meses' && <option value="dia_mes">Día fijo de cada mes</option>}
                        <option value="fecha_especifica">Definir primera fecha límite manualmente</option>
                      </select>
                    </div>
                  )}
                  {nuevaActividad.frecuencia_unidad === 'unica' && (
                    <Campo label="Fecha límite" tipo="date" valor={nuevaActividad.proxima_exigible} onChange={v => setNuevaActividad(x => ({ ...x, proxima_exigible: v }))} />
                  )}
                  {nuevaActividad.frecuencia_unidad !== 'unica' && nuevaActividad.limite_tipo === 'fecha_especifica' && (
                    <Campo label="Primera fecha límite" tipo="date" valor={nuevaActividad.proxima_exigible} onChange={v => setNuevaActividad(x => ({ ...x, proxima_exigible: v }))} />
                  )}
                  {nuevaActividad.frecuencia_unidad === 'meses' && nuevaActividad.limite_tipo === 'dia_mes' && (
                    <Campo label="Día límite del mes" tipo="number" min="1" max="31" valor={nuevaActividad.dia_limite} onChange={v => setNuevaActividad(x => ({ ...x, dia_limite: v }))} />
                  )}
                  <div className="campo">
                    <label className="etiqueta-campo">Responsable interno</label>
                    <select value={nuevaActividad.responsable_id} onChange={e => setNuevaActividad(x => ({ ...x, responsable_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {equipo.map(p => <option key={p.id} value={p.id}>{p.nombre} — {p.rol}</option>)}
                    </select>
                  </div>
                  <Campo label="Proveedor" valor={nuevaActividad.proveedor} onChange={v => setNuevaActividad(x => ({ ...x, proveedor: v }))} />
                </div>
                {previsualizarFechasLimite(nuevaActividad).length > 0 && (
                  <div className="aviso" style={{ marginBottom: 14 }}>
                    <strong>Fechas límite previstas</strong>
                    <div className="micro" style={{ marginTop: 5 }}>
                      {previsualizarFechasLimite(nuevaActividad).map((f, i) => (
                        <span key={f}>{i > 0 ? ' · ' : ''}{fechaCL(f)}</span>
                      ))}
                    </div>
                    {nuevaActividad.frecuencia_unidad !== 'unica' && nuevaActividad.limite_tipo === 'fin_periodo' && (
                      <p className="micro apagado" style={{ margin: '5px 0 0' }}>La visita puede agendarse después; la fecha límite no cambia.</p>
                    )}
                  </div>
                )}
                <Campo label="Evidencias requeridas" valor={nuevaActividad.evidencias} onChange={v => setNuevaActividad(x => ({ ...x, evidencias: v }))} placeholder="Foto, informe, certificado (separados por coma)" />
                <button className="boton boton-movil" onClick={guardarActividad} disabled={guardando}>Agregar al plan</button>
              </div>
            )}

            {activos.length === 0 && <div className="aviso">Registra al menos un activo antes de crear su plan de mantención.</div>}
            {actividades.length === 0 && activos.length > 0 && <p className="vacio">No hay actividades de mantención definidas todavía.</p>}
            {actividades.map(a => {
              const activo = activosPorId.get(a.activo_id);
              const frecuencia = a.frecuencia_unidad === 'unica'
                ? 'Intervención única'
                : `Cada ${a.frecuencia_valor} ${a.frecuencia_unidad}`;
              return (
                <article key={a.id} className="tarjeta" style={{ padding: 14, marginBottom: 10 }}>
                  <div className="comunidad-linea-cabecera">
                    <strong>{a.trabajo}</strong>
                    <span className="chip chip-tipo">{frecuencia}</span>
                  </div>
                  <p className="dato-chico" style={{ margin: '5px 0 0' }}>{activo?.nombre ?? 'Activo no disponible'}</p>
                  <p className="micro apagado" style={{ margin: '5px 0 0' }}>
                    Fecha límite actual: {a.proxima_exigible ? fechaCL(a.proxima_exigible) : 'por definir'}
                    {a.responsable_id ? ` · Responsable: ${equipoPorId.get(a.responsable_id)?.nombre ?? 'Asignado'}` : ''}
                  </p>
                  {a.evidencias_requeridas?.length > 0 && (
                    <p className="micro apagado" style={{ margin: '5px 0 0' }}>Evidencias: {a.evidencias_requeridas.join(', ')}</p>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {seccion === 'agenda' && (
          <section>
            <h2 className="h4">Agenda</h2>
            <p className="chico apagado">Reúne levantamientos y mantenciones de esta comunidad. En mantenciones, la fecha original se conserva aunque una visita se reprograme.</p>

            <h3 className="h4">Levantamientos</h3>
            {controles.filter(c => c.programado_para).length === 0 && <p className="vacio">No hay levantamientos con fecha programada.</p>}
            {controles.filter(c => c.programado_para)
              .slice()
              .sort((a, b) => new Date(a.programado_para) - new Date(b.programado_para))
              .map(c => {
                const [clase, texto] = CHIP_CONTROL[c.estado] ?? CHIP_CONTROL.pendiente;
                return (
                  <Link key={c.id} to={`/control/${c.id}`} className="tarjeta" style={{ padding: 14, marginBottom: 10, display: 'block' }}>
                    <div className="comunidad-linea-cabecera">
                      <strong>{c.plantilla_nombre ?? 'Levantamiento'}</strong>
                      <span className={'chip ' + clase}>{texto}</span>
                    </div>
                    <p className="dato-chico" style={{ margin: '8px 0 0' }}>{fechaCL(c.programado_para, true)}</p>
                    <p className="micro apagado" style={{ margin: '4px 0 0' }}>{c.responsable_nombre ?? 'Sin responsable asignado'}</p>
                  </Link>
                );
              })}

            <h3 className="h4" style={{ marginTop: 22 }}>Mantenciones</h3>
            {puedeGestionar && actividades.length > 0 && (
              <div className="comunidad-form">
                <h3 className="h4" style={{ marginTop: 0 }}>Agendar mantención</h3>
                <div className="campo">
                  <label className="etiqueta-campo">Actividad</label>
                  <select value={nuevoAgendamiento.actividad_id} onChange={e => setNuevoAgendamiento(x => ({ ...x, actividad_id: e.target.value }))}>
                    <option value="">Elegir…</option>
                    {actividades.map(a => <option key={a.id} value={a.id}>{activosPorId.get(a.activo_id)?.nombre ?? 'Activo'} — {a.trabajo}</option>)}
                  </select>
                </div>
                <div className="comunidad-grid-2">
                  <Campo label="Fecha y hora" tipo="datetime-local" valor={nuevoAgendamiento.programado_para} onChange={v => setNuevoAgendamiento(x => ({ ...x, programado_para: v }))} />
                  <div className="campo">
                    <label className="etiqueta-campo">Responsable de esta ejecución</label>
                    <select value={nuevoAgendamiento.responsable_id} onChange={e => setNuevoAgendamiento(x => ({ ...x, responsable_id: e.target.value }))}>
                      <option value="">Usar responsable del plan</option>
                      {equipo.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <button className="boton boton-movil" onClick={guardarAgendamiento} disabled={guardando}>Agendar</button>
              </div>
            )}

            {agenda.length === 0 && <p className="vacio">No hay mantenciones agendadas todavía.</p>}
            {agenda.map(item => {
              const actividad = actividadesPorId.get(item.actividad_id);
              const activo = activosPorId.get(actividad?.activo_id);
              const [clase, texto] = CHIP_AGENDA[item.estado] ?? CHIP_AGENDA.agendada;
              const vencida = !['completada', 'cancelada'].includes(item.estado) && ((item.programado_para && new Date(item.programado_para).getTime() <= Date.now()) || (item.vencimiento_original && item.vencimiento_original < fechaISOChile()));
              const ejecucion = ejecucionPorAgenda.get(item.id);
              return (
                <article key={item.id} className="tarjeta" style={{ padding: 14, marginBottom: 10 }}>
                  <div className="comunidad-linea-cabecera">
                    <div>
                      <strong>{actividad?.trabajo ?? 'Actividad de mantención'}</strong>
                      <p className="micro apagado" style={{ margin: '4px 0 0' }}>{activo?.nombre ?? ''}</p>
                    </div>
                    {vencida && <span className="chip chip-critico">Pendiente</span>}
                    <span className={'chip ' + clase}>{texto}</span>
                  </div>
                  <p className="dato-chico" style={{ margin: '8px 0 0' }}>Programada: {fechaCL(item.programado_para, true)}</p>
                  {item.vencimiento_original && (
                    <p className="micro apagado" style={{ margin: '4px 0 0' }}>Fecha límite original: {fechaCL(item.vencimiento_original)}</p>
                  )}
                  {item.programado_original && item.programado_original !== item.programado_para && (
                    <p className="micro apagado" style={{ margin: '4px 0 0' }}>Programación original: {fechaCL(item.programado_original, true)}</p>
                  )}
                  {item.responsable_id && <p className="micro apagado" style={{ margin: '4px 0 0' }}>Responsable: {equipoPorId.get(item.responsable_id)?.nombre ?? 'Asignado'}</p>}
                  {ejecucion && (
                    <div className="comunidad-ejecucion micro">
                      <strong>Ejecución registrada</strong>
                      <span>{fechaCL(ejecucion.realizado_en, true)} · {ejecucion.ejecutor_texto || 'Ejecutor no indicado'}</span>
                      {ejecucion.observaciones && <span>{ejecucion.observaciones}</span>}
                      {Array.isArray(ejecucion.evidencias) && ejecucion.evidencias.length > 0 && (
                        <span>{ejecucion.evidencias.join(' · ')}</span>
                      )}
                    </div>
                  )}
                  {puedeGestionar && !['completada', 'cancelada'].includes(item.estado) && (
                    <div className="comunidad-acciones">
                      <button className="boton boton-texto" onClick={() => reprogramar(item)}>Reprogramar</button>
                      <button className="boton boton-texto" onClick={() => registrarEjecucion(item)} disabled={guardando}>Registrar ejecución</button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {seccion === 'configuracion' && (
          <section>
            <h2 className="h4">Configuración</h2>

            {puedeGestionar ? (
              <>
                <div className="comunidad-form">
                  <h3 className="h4" style={{ marginTop: 0 }}>Ubicación de la comunidad</h3>
                  <p className="micro apagado">Esta ubicación pertenece al edificio y no depende de que ya exista un check-in.</p>
                  <div className="comunidad-grid-2">
                    <Campo label="Dirección" valor={ubicacion.direccion} onChange={v => setUbicacion(x => ({ ...x, direccion: v }))} />
                    <Campo label="Comuna" valor={ubicacion.comuna} onChange={v => setUbicacion(x => ({ ...x, comuna: v }))} />
                    <Campo label="Latitud" tipo="number" paso="any" valor={ubicacion.latitud} onChange={v => setUbicacion(x => ({ ...x, latitud: v }))} />
                    <Campo label="Longitud" tipo="number" paso="any" valor={ubicacion.longitud} onChange={v => setUbicacion(x => ({ ...x, longitud: v }))} />
                  </div>
                  <button className="boton boton-movil" onClick={guardarUbicacion} disabled={guardando}>Guardar ubicación</button>
                </div>

                <div className="comunidad-form">
                  <h3 className="h4" style={{ marginTop: 0 }}>Alertas de mantención</h3>
                  <div className="campo">
                    <label className="etiqueta-campo">Actividad</label>
                    <select value={actividadAlertas} onChange={e => setActividadAlertas(e.target.value)}>
                      <option value="">Elegir…</option>
                      {actividades.map(a => <option key={a.id} value={a.id}>{activosPorId.get(a.activo_id)?.nombre ?? 'Activo'} — {a.trabajo}</option>)}
                    </select>
                  </div>
                  <Campo label="Avisar N días antes" valor={formAlertas.dias_antes} onChange={v => setFormAlertas(x => ({ ...x, dias_antes: v }))} placeholder="7,1" />
                  <Campo label="Escalar si sigue vencida después de N días" tipo="number" min="1" valor={formAlertas.escalamiento_dias} onChange={v => setFormAlertas(x => ({ ...x, escalamiento_dias: v }))} />

                  <div className="comunidad-checks">
                    <Check texto="Avisar el mismo día" marcado={formAlertas.mismo_dia} onChange={v => setFormAlertas(x => ({ ...x, mismo_dia: v }))} />
                    <Check texto="Avisar al vencer" marcado={formAlertas.al_vencer} onChange={v => setFormAlertas(x => ({ ...x, al_vencer: v }))} />
                    <Check texto="Avisar a administración" marcado={formAlertas.administracion} onChange={v => setFormAlertas(x => ({ ...x, administracion: v }))} />
                    <Check texto="Avisar a jefatura en los avisos normales" marcado={formAlertas.jefatura} onChange={v => setFormAlertas(x => ({ ...x, jefatura: v }))} />
                    <Check texto="Escalar a jefatura si continúa vencida" marcado={formAlertas.escalar_jefatura} onChange={v => setFormAlertas(x => ({ ...x, escalar_jefatura: v }))} />
                    <Check texto="Avisar también al responsable de la ejecución" marcado={formAlertas.incluir_responsable} onChange={v => setFormAlertas(x => ({ ...x, incluir_responsable: v }))} />
                  </div>
                  <p className="micro apagado">Canal activo: aviso dentro del sistema. El modelo deja preparado el correo, pero no lo activa hasta incorporar un proveedor de envío.</p>
                  <button className="boton boton-movil" onClick={guardarAlertas} disabled={guardando || !actividadAlertas}>Guardar reglas</button>
                </div>
              </>
            ) : (
              <div className="aviso">La configuración de ubicación y alertas requiere permisos de gestión.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

const LINEAS_DIAGNOSTICO = { L1: 'Administración integral', L2: 'Nueva administración', L3: 'Asesoría externa' };

function DiagnosticoInicial({ diagnostico }) {
  const { control, resultado } = diagnostico;
  const [clase, texto] = CHIP_CONTROL[control.estado] ?? CHIP_CONTROL.pendiente;
  const linea = resultado ? LINEAS_DIAGNOSTICO[resultado.linea_elegida ?? resultado.linea_sugerida] : null;
  const criticos = resultado?.hallazgos_criticos?.length ?? 0;
  return (
    <Link to={`/control/${control.id}`} className="tarjeta" style={{ padding: 14, marginBottom: 12, display: 'block' }}>
      <div className="fila" style={{ gap: 8, marginBottom: 6 }}>
        <h2 className="h4 crece" style={{ margin: 0 }}>Diagnóstico inicial</h2>
        <span className={'chip ' + clase}>{texto}</span>
      </div>
      {resultado ? (
        <>
          <p className="dato-chico" style={{ margin: 0 }}>{resultado.score}% · {resultado.nivel}</p>
          <p className="micro" style={{ margin: '3px 0 0' }}>
            {[linea, `${criticos} hallazgo${criticos === 1 ? '' : 's'} crítico${criticos === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </p>
        </>
      ) : (
        <p className="micro" style={{ margin: 0 }}>Sin resultado guardado.</p>
      )}
      <p className="micro apagado" style={{ margin: '6px 0 0' }}>
        Hecho antes de ganar la comunidad · {fechaCL(control.enviado_en ?? control.creado_en)}
      </p>
    </Link>
  );
}

function Resumen({ controles, activos, actividades, agenda, kpis, notificaciones, marcarLeida, diagnosticoInicial }) {
  const criticos = controles.reduce((n, c) => n + (c.items_criticos ?? 0), 0);
  const abiertos = controles.filter(c => !['enviado', 'anulado'].includes(c.estado)).length;
  const proximas = agenda
    .filter(a => !['completada', 'cancelada'].includes(a.estado) && a.programado_para)
    .sort((a, b) => new Date(a.programado_para) - new Date(b.programado_para))
    .slice(0, 3);

  return (
    <section>
      <div className="tablero tablero-3">
        <div><p className="n">{kpis.porAgendar}</p><p className="r">Mantenciones por agendar</p></div>
        <div><p className="n">{kpis.agendadas}</p><p className="r">Mantenciones agendadas</p></div>
        <div><p className="n">{kpis.pendientes}</p><p className="r">Mantenciones pendientes</p></div>
      </div>

      {diagnosticoInicial && <DiagnosticoInicial diagnostico={diagnosticoInicial} />}

      <div className="comunidad-grid-2">
        <article className="tarjeta" style={{ padding: 14 }}>
          <h2 className="h4" style={{ marginTop: 0 }}>Operación</h2>
          <div className="comunidad-linea"><strong>{activos.length}</strong><span className="micro apagado">activos registrados</span></div>
          <div className="comunidad-linea"><strong>{actividades.length}</strong><span className="micro apagado">actividades en el plan</span></div>
          <div className="comunidad-linea"><strong>{abiertos}</strong><span className="micro apagado">levantamientos abiertos</span></div>
          <div className="comunidad-linea"><strong>{criticos}</strong><span className="micro apagado">hallazgos críticos registrados</span></div>
        </article>

        <article className="tarjeta" style={{ padding: 14 }}>
          <h2 className="h4" style={{ marginTop: 0 }}>Próximas mantenciones</h2>
          {proximas.length === 0 && <p className="vacio">Sin mantenciones próximas.</p>}
          {proximas.map(a => <div key={a.id} className="comunidad-linea"><strong>{fechaCL(a.programado_para, true)}</strong></div>)}
        </article>
      </div>

      {notificaciones.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h2 className="h4">Alertas de mantención</h2>
          {notificaciones.map(n => (
            <div key={n.id} className={'comunidad-alerta' + (n.leida ? ' leida' : '')}>
              <div className="fila">
                <div className="crece">
                  <strong>{n.titulo}</strong>
                  <p className="micro" style={{ margin: '3px 0 0' }}>{n.mensaje}</p>
                </div>
                {!n.leida && <button className="boton boton-texto" onClick={() => marcarLeida(n)}>Leída</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Levantamientos({ id, controles, puedeGestionar }) {
  return (
    <section>
      <div className="comunidad-seccion-titulo">
        <div>
          <h2 className="h4" style={{ margin: 0 }}>Levantamientos</h2>
          <p className="micro apagado" style={{ margin: '3px 0 0' }}>El histórico existente queda dentro de la comunidad.</p>
        </div>
        {puedeGestionar && <Link to={`/nuevo?comunidad=${id}`} className="boton boton-movil">Nuevo levantamiento</Link>}
      </div>

      {controles.length === 0 && <p className="vacio">Todavía no hay levantamientos en esta comunidad.</p>}
      {controles.map(c => {
        const [clase, texto] = CHIP_CONTROL[c.estado] ?? CHIP_CONTROL.pendiente;
        const fecha = c.enviado_en ?? c.checkin_en ?? c.programado_para ?? c.creado_en;
        return (
          <Link key={c.id} to={`/control/${c.id}`} className="tarjeta" style={{ padding: 14, marginBottom: 10, display: 'block' }}>
            <div className="fila" style={{ marginBottom: 6, flexWrap: 'wrap', rowGap: 6 }}>
              <span className="micro apagado crece">{fechaCL(fecha)}</span>
              {c.plantilla_nombre && <span className="chip chip-tipo">{c.plantilla_nombre}</span>}
              {c.estado === 'enviado' && c.items_criticos > 0 && <span className="chip chip-critico">{c.items_criticos} crítico{c.items_criticos > 1 ? 's' : ''}</span>}
              <span className={'chip ' + clase}>{texto}</span>
            </div>
            <p className="dato-chico" style={{ margin: 0, color: 'inherit' }}>{c.responsable_nombre ?? (c.responsable_id ? 'Otra persona del equipo' : 'Sin asignar')}</p>
            {c.periodo && <p className="micro apagado" style={{ margin: '4px 0 0' }}>{c.periodo}</p>}
          </Link>
        );
      })}
    </section>
  );
}

function Campo({ label, valor, onChange, placeholder = '', tipo = 'text', min, paso }) {
  return (
    <div className="campo">
      <label className="etiqueta-campo">{label}</label>
      <input type={tipo} value={valor} min={min} step={paso} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Check({ texto, marcado, onChange }) {
  return (
    <label className="comunidad-check">
      <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} />
      <span className="chico">{texto}</span>
    </label>
  );
}
