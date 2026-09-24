import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import './Pipeline.css';

/* Pipeline comercial: leads y prospectos en un embudo hasta ganarse o perderse.
 *
 * No hay una tabla "leads" separada de "prospectos": un lead es simplemente un
 * prospecto en una etapa temprana (nuevo/contacto). Partirlos en dos tablas
 * solo existía en el CRM viejo porque Sheets obligaba a esa separación; acá no
 * hace falta, y evita el parche de "convertir lead en prospecto" de ese
 * sistema.
 *
 * Al ganar un prospecto se crea la comunidad real y queda enlazada: es el
 * puente hacia la operación (levantamientos, mantención, portal cliente).
 */

const ETAPAS = [
  ['nuevo', 'Nuevo'],
  ['contacto', 'Contacto'],
  ['diagnostico', 'Diagnóstico'],
  ['propuesta', 'Propuesta'],
  ['negociacion', 'Negociación'],
  ['ganado', 'Ganado'],
  ['perdido', 'Perdido']
];

const TIPOS_SERVICIO = [
  ['administracion', 'Administración'],
  ['auditoria', 'Auditoría'],
  ['asesoria', 'Asesoría'],
  ['primera_administracion', 'Primera administración'],
  ['otro', 'Otro']
];

const VACIO = {
  nombre_condominio: '', direccion: '', comuna: '', unidades: '',
  nombre_contacto: '', cargo_contacto: '', telefono: '', email: '',
  tipo_servicio: '', fuente: '', responsable_id: '',
  proxima_accion: '', fecha_proxima_accion: '', observaciones: ''
};

function fechaCL(valor, conHora = false) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-CL', conHora
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Pipeline() {
  const { perfil } = useSesion();
  const [prospectos, setProspectos] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [error, setError] = useState(null);
  const [etapa, setEtapa] = useState('nuevo');
  const [abierto, setAbierto] = useState(null);   // id en edición, o 'nuevo'
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    const [rp, re] = await Promise.all([
      supabase.from('prospectos').select('*').order('creado_en', { ascending: false }),
      supabase.from('perfiles').select('id, nombre, rol, activo').eq('activo', true).order('nombre')
    ]);
    if (rp.error) return setError(rp.error.message);
    if (re.error) return setError(re.error.message);
    setProspectos(rp.data ?? []);
    setEquipo(re.data ?? []);
  }

  useEffect(() => { cargar(); }, []);

  const porEtapa = useMemo(() => {
    const m = new Map(ETAPAS.map(([k]) => [k, []]));
    for (const p of prospectos ?? []) {
      if (!m.has(p.etapa)) m.set(p.etapa, []);
      m.get(p.etapa).push(p);
    }
    return m;
  }, [prospectos]);

  const activos = (prospectos ?? []).filter(p => p.etapa !== 'ganado' && p.etapa !== 'perdido').length;
  const ganadosMes = (prospectos ?? []).filter(p => {
    if (p.etapa !== 'ganado' || !p.editado_en) return false;
    const d = new Date(p.editado_en), h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth();
  }).length;
  const enDiagnostico = porEtapa.get('diagnostico')?.length ?? 0;
  const perdidos = porEtapa.get('perdido')?.length ?? 0;

  function abrirNuevo() {
    setForm(VACIO);
    setAbierto('nuevo');
  }

  function abrirEdicion(p) {
    setForm({
      nombre_condominio: p.nombre_condominio ?? '', direccion: p.direccion ?? '', comuna: p.comuna ?? '',
      unidades: p.unidades ?? '', nombre_contacto: p.nombre_contacto ?? '', cargo_contacto: p.cargo_contacto ?? '',
      telefono: p.telefono ?? '', email: p.email ?? '', tipo_servicio: p.tipo_servicio ?? '',
      fuente: p.fuente ?? '', responsable_id: p.responsable_id ?? '',
      proxima_accion: p.proxima_accion ?? '',
      fecha_proxima_accion: p.fecha_proxima_accion ? p.fecha_proxima_accion.slice(0, 16) : '',
      observaciones: p.observaciones ?? ''
    });
    setAbierto(p.id);
  }

  function cerrarForm() {
    setAbierto(null);
    setForm(VACIO);
  }

  async function guardar() {
    if (!form.nombre_condominio.trim()) return setError('Falta el nombre del condominio o edificio.');
    setGuardando(true);
    setError(null);

    const cuerpo = {
      nombre_condominio: form.nombre_condominio.trim(),
      direccion: form.direccion.trim() || null,
      comuna: form.comuna.trim() || null,
      unidades: form.unidades ? Number(form.unidades) : null,
      nombre_contacto: form.nombre_contacto.trim() || null,
      cargo_contacto: form.cargo_contacto.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      tipo_servicio: form.tipo_servicio || null,
      fuente: form.fuente.trim() || null,
      responsable_id: form.responsable_id || null,
      proxima_accion: form.proxima_accion.trim() || null,
      fecha_proxima_accion: form.fecha_proxima_accion ? new Date(form.fecha_proxima_accion).toISOString() : null,
      observaciones: form.observaciones.trim() || null,
      fecha_ultima_interaccion: new Date().toISOString()
    };

    if (abierto === 'nuevo') {
      cuerpo.responsable_id = cuerpo.responsable_id || perfil?.id || null;
      cuerpo.fecha_primer_contacto = new Date().toISOString();
      const { data, error } = await supabase.from('prospectos').insert(cuerpo).select().single();
      setGuardando(false);
      if (error || !data) return setError(error?.message || 'No se pudo crear el lead.');
      setProspectos(xs => [data, ...(xs ?? [])]);
      setEtapa(data.etapa);
      cerrarForm();
      return;
    }

    const { data, error } = await supabase.from('prospectos').update(cuerpo).eq('id', abierto).select().single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(p => p.id === abierto ? data : p));
    cerrarForm();
  }

  async function cambiarEtapa(p, nuevaEtapa) {
    if (nuevaEtapa === p.etapa) return;
    if (nuevaEtapa === 'ganado') return convertirEnComunidad(p);

    let motivo = p.motivo_perdida ?? null;
    if (nuevaEtapa === 'perdido') {
      motivo = window.prompt('¿Motivo de la pérdida? (opcional)', p.motivo_perdida ?? '') ?? p.motivo_perdida ?? null;
    }

    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.from('prospectos')
      .update({ etapa: nuevaEtapa, motivo_perdida: nuevaEtapa === 'perdido' ? motivo : null, fecha_ultima_interaccion: new Date().toISOString() })
      .eq('id', p.id).select().single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(x => x.id === p.id ? data : x));
  }

  async function convertirEnComunidad(p) {
    const ok = window.confirm(`"${p.nombre_condominio}" pasará a Ganado y se creará como comunidad para gestionarla operativamente (levantamientos, mantención, portal cliente). ¿Continuar?`);
    if (!ok) return;

    setGuardando(true);
    setError(null);
    const { data: comunidad, error: errorComunidad } = await supabase.from('comunidades')
      .insert({ nombre: p.nombre_condominio, direccion: p.direccion, comuna: p.comuna })
      .select().single();
    if (errorComunidad) {
      setGuardando(false);
      return setError(errorComunidad.message);
    }

    const { data, error } = await supabase.from('prospectos')
      .update({ etapa: 'ganado', comunidad_id: comunidad.id, fecha_ultima_interaccion: new Date().toISOString() })
      .eq('id', p.id).select().single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(x => x.id === p.id ? data : x));
  }

  const lista = porEtapa.get(etapa) ?? [];

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila">
          <div className="crece">
            <h1 className="h3">Pipeline comercial</h1>
            <p className="chico apagado" style={{ margin: '4px 0 0' }}>
              Leads y prospectos hasta ganarse o perderse.
            </p>
          </div>
          <button type="button" className="boton" onClick={abrirNuevo}>Nuevo lead</button>
        </div>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="tablero">
          <div><p className="n">{activos}</p><p className="r">Activos</p></div>
          <div><p className="n">{enDiagnostico}</p><p className="r">En diagnóstico</p></div>
          <div className="ok"><p className="n">{ganadosMes}</p><p className="r">Ganados este mes</p></div>
          <div className={perdidos ? 'alerta' : ''}><p className="n">{perdidos}</p><p className="r">Perdidos</p></div>
        </div>

        <nav className="pipeline-tabs" aria-label="Etapas del pipeline">
          {ETAPAS.map(([clave, texto]) => (
            <button key={clave} type="button"
                    className={'pipeline-tab' + (etapa === clave ? ' activa' : '')}
                    onClick={() => setEtapa(clave)}>
              {texto}
              <span className="pipeline-tab-contador">{porEtapa.get(clave)?.length ?? 0}</span>
            </button>
          ))}
        </nav>

        {abierto && (
          <FormularioProspecto
            form={form} setForm={setForm} equipo={equipo}
            esNuevo={abierto === 'nuevo'} guardando={guardando}
            onGuardar={guardar} onCancelar={cerrarForm}
          />
        )}

        {prospectos === null && !error && <p className="cargando">Cargando…</p>}

        {prospectos !== null && (
          <div className="pipeline-lista">
            {lista.length === 0 && <p className="vacio">No hay prospectos en esta etapa.</p>}
            {lista.map(p => (
              <TarjetaProspecto key={p.id} p={p} equipo={equipo} guardando={guardando}
                                 onEditar={() => abrirEdicion(p)}
                                 onCambiarEtapa={nuevaEtapa => cambiarEtapa(p, nuevaEtapa)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaProspecto({ p, equipo, guardando, onEditar, onCambiarEtapa }) {
  const responsable = equipo.find(e => e.id === p.responsable_id);
  const vencida = p.fecha_proxima_accion && new Date(p.fecha_proxima_accion) < new Date();

  return (
    <article className="tarjeta pipeline-tarjeta">
      <div className="fila" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="crece">
          <strong className="dato-chico" style={{ display: 'block' }}>{p.nombre_condominio}</strong>
          {(p.comuna || p.direccion) && (
            <span className="micro apagado">{[p.direccion, p.comuna].filter(Boolean).join(', ')}</span>
          )}
        </div>
        <button type="button" className="editar" onClick={onEditar}>Editar</button>
      </div>

      {(p.nombre_contacto || p.telefono || p.email) && (
        <p className="micro" style={{ margin: '6px 0 0' }}>
          {p.nombre_contacto}{p.cargo_contacto ? ` · ${p.cargo_contacto}` : ''}
          {(p.telefono || p.email) && <span className="apagado"> — {[p.telefono, p.email].filter(Boolean).join(' · ')}</span>}
        </p>
      )}

      <div className="fila" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
        {p.fuente && <span className="chip chip-tipo">{p.fuente}</span>}
        {p.unidades && <span className="chip chip-tipo">{p.unidades} unidades</span>}
        {responsable && <span className="chip chip-tipo">{responsable.nombre}</span>}
      </div>

      {p.proxima_accion && (
        <p className={'micro' + (vencida ? ' pipeline-vencida' : ' apagado')} style={{ margin: '8px 0 0' }}>
          {vencida ? 'Vencida: ' : 'Próxima acción: '}{p.proxima_accion}
          {p.fecha_proxima_accion && ` · ${fechaCL(p.fecha_proxima_accion, true)}`}
        </p>
      )}

      {p.etapa === 'perdido' && p.motivo_perdida && (
        <p className="micro apagado" style={{ margin: '8px 0 0' }}>Motivo: {p.motivo_perdida}</p>
      )}

      <div className="campo" style={{ marginTop: 10, marginBottom: 0 }}>
        <label className="etiqueta-campo">Etapa</label>
        <select value={p.etapa} disabled={guardando} onChange={e => onCambiarEtapa(e.target.value)}>
          {ETAPAS.map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
        </select>
      </div>
    </article>
  );
}

function FormularioProspecto({ form, setForm, equipo, esNuevo, guardando, onGuardar, onCancelar }) {
  function set(campo, valor) { setForm(x => ({ ...x, [campo]: valor })); }

  return (
    <div className="tarjeta pipeline-formulario">
      <h2 className="h4" style={{ marginTop: 0 }}>{esNuevo ? 'Nuevo lead' : 'Editar prospecto'}</h2>

      <Campo label="Nombre del condominio o edificio *" valor={form.nombre_condominio} onChange={v => set('nombre_condominio', v)} />
      <div className="pipeline-grid-2">
        <Campo label="Dirección" valor={form.direccion} onChange={v => set('direccion', v)} />
        <Campo label="Comuna" valor={form.comuna} onChange={v => set('comuna', v)} />
      </div>
      <div className="pipeline-grid-2">
        <Campo label="N° de unidades" tipo="number" valor={form.unidades} onChange={v => set('unidades', v)} />
        <div className="campo">
          <label className="etiqueta-campo">Tipo de servicio</label>
          <select value={form.tipo_servicio} onChange={e => set('tipo_servicio', e.target.value)}>
            <option value="">Sin definir</option>
            {TIPOS_SERVICIO.map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
          </select>
        </div>
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Nombre de contacto" valor={form.nombre_contacto} onChange={v => set('nombre_contacto', v)} />
        <Campo label="Cargo del contacto" valor={form.cargo_contacto} onChange={v => set('cargo_contacto', v)} />
      </div>
      <div className="pipeline-grid-2">
        <Campo label="Teléfono" valor={form.telefono} onChange={v => set('telefono', v)} />
        <Campo label="Correo" tipo="email" valor={form.email} onChange={v => set('email', v)} />
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Fuente" valor={form.fuente} onChange={v => set('fuente', v)} placeholder="Referido, web, llamada…" />
        <div className="campo">
          <label className="etiqueta-campo">Responsable</label>
          <select value={form.responsable_id} onChange={e => set('responsable_id', e.target.value)}>
            <option value="">Sin asignar</option>
            {equipo.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Próxima acción" valor={form.proxima_accion} onChange={v => set('proxima_accion', v)} placeholder="Llamar, enviar propuesta…" />
        <Campo label="Fecha próxima acción" tipo="datetime-local" valor={form.fecha_proxima_accion} onChange={v => set('fecha_proxima_accion', v)} />
      </div>

      <div className="campo">
        <label className="etiqueta-campo">Observaciones</label>
        <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
      </div>

      <div className="fila-botones">
        <button type="button" className="boton boton-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="button" className="boton" onClick={onGuardar} disabled={guardando}>Guardar</button>
      </div>
    </div>
  );
}

function Campo({ label, tipo = 'text', valor, onChange, placeholder }) {
  return (
    <div className="campo">
      <label className="etiqueta-campo">{label}</label>
      <input type={tipo} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
