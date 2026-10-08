import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import ProveedoresNavegacion from '../../componentes/ProveedoresNavegacion';
import { useSesion } from '../../lib/sesion';
import './WhatsApp.css';

const STATES = [
  ['nuevo','Nuevo'],
  ['revisado','En revisión'],
  ['contactado','Contactado'],
  ['entrevista','Entrevista'],
  ['contratado','Seleccionado'],
  ['descartado','No seleccionado'],
  ['base_futura','Base futura']
];

const date = v => v ? new Date(v).toLocaleDateString('es-CL') : '—';

export default function ProveedoresRecepcion({ vista }) {
  const { perfil } = useSesion();
  if (!perfil?.activo || !['admin','superadmin'].includes(perfil.rol)) {
    return <Navigate to="/" replace />;
  }
  return <Recepcion vista={vista} />;
}

function Recepcion({ vista }) {
  const isMail = vista === 'correos';
  const navegar = useNavigate();

  const [people,setPeople] = useState([]);
  const [mails,setMails] = useState([]);
  const [vendors,setVendors] = useState([]);
  const [selected,setSelected] = useState(null);
  const [form,setForm] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [filter,setFilter] = useState('pendientes');
  const [search,setSearch] = useState('');
  const [waOptions,setWaOptions] = useState([]);
  const [waLink,setWaLink] = useState('');
  const [classification,setClassification] = useState('postulante');
  const [name,setName] = useState('');
  const [target,setTarget] = useState('');
  const [history,setHistory] = useState([]);

  const load = useCallback(async () => {
    const results = await Promise.all([
      supabase.from('postulantes').select('*').order('editado_en',{ascending:false}).limit(500),
      supabase.from('proveedor_correos')
        .select('id,asunto,remitente_nombre,remitente_email,fecha_correo,snippet,cuerpo_texto,adjuntos,gmail_thread_id,clasificacion,proveedor_id,postulante_id')
        .order('fecha_correo',{ascending:false}).limit(250),
      supabase.from('proveedores').select('id,empresa,email').order('empresa').limit(1000),
      supabase.from('whatsapp_conversations')
        .select('id,motivo,datos,contacto:whatsapp_contacts(telefono,nombre_whatsapp)')
        .in('motivo',['postulacion','proveedor'])
        .order('iniciada_en',{ascending:false}).limit(200)
    ]);

    for (const r of results) if (r.error) setError(r.error.message);
    if (!results[0].error) setPeople(results[0].data ?? []);
    if (!results[1].error) setMails(results[1].data ?? []);
    if (!results[2].error) setVendors(results[2].data ?? []);
    if (!results[3].error) setWaOptions(results[3].data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setSelected(null);
    setForm(null);
    setError('');
    setSearch('');
  }, [vista]);

  const email = mails.find(x => x.id === selected);

  useEffect(() => {
    setName(email?.remitente_nombre || email?.remitente_email || '');
    setTarget('');
    setWaLink('');
  }, [selected,email?.remitente_nombre,email?.remitente_email]);

  useEffect(() => {
    setHistory([]);
    if (!form?.id) return;
    let live = true;
    supabase.from('proveedor_correos')
      .select('id,asunto,fecha_correo,cuerpo_texto,gmail_thread_id,adjuntos')
      .eq('postulante_id',form.id)
      .order('fecha_correo',{ascending:false})
      .then(r => {
        if (!live) return;
        if (r.error) setError(r.error.message);
        else setHistory(r.data ?? []);
      });
    return () => { live = false; };
  }, [form?.id]);

  async function classify() {
    setBusy(true);
    setError('');
    const r = await supabase.rpc('whatsapp_clasificar_correo',{
      p_correo:selected,
      p_clase:classification,
      p_nombre:name,
      p_destino:target || null,
      p_conversacion:waLink || null
    });
    if (r.error) setError(r.error.message);
    else {
      setSelected(null);
      await load();
    }
    setBusy(false);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fields = {
      nombre:form.nombre,
      email:form.email || null,
      telefono:form.telefono || null,
      comuna:form.comuna || null,
      cargo_propuesto:form.cargo_propuesto || null,
      estado:form.estado,
      notas:form.notas || null,
      editado_en:new Date().toISOString()
    };
    const r = form.id
      ? await supabase.from('postulantes').update(fields).eq('id',form.id)
      : await supabase.from('postulantes').insert({
          ...fields,origen:'manual',fecha_postulacion:new Date().toISOString()
        });
    if (r.error) setError(r.error.message);
    else {
      setForm(null);
      await load();
    }
    setBusy(false);
  }

  async function sync() {
    setBusy(true);
    setError('');
    const r = await supabase.functions.invoke('sincronizar-proveedores-gmail',{
      body:{origen:'manual'}
    });
    if (r.error) setError('No se pudo sincronizar el correo. Revisa su configuración.');
    else await load();
    setBusy(false);
  }

  const gmail = thread => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(thread)}`;

  const mailRows = useMemo(() => mails.filter(x =>
    filter === 'todos'
      || (filter === 'pendientes' ? x.clasificacion === null : x.clasificacion === filter)
  ), [mails,filter]);

  const postulantesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p =>
      [p.nombre,p.comuna,p.cargo_propuesto,p.email,p.telefono,p.estado]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [people,search]);

  const resumenPostulantes = useMemo(() => ({
    total: people.length,
    nuevos: people.filter(x => x.estado === 'nuevo').length,
    revision: people.filter(x => x.estado === 'revisado').length,
    seleccionados: people.filter(x => x.estado === 'contratado').length
  }), [people]);

  const resumenCorreos = useMemo(() => ({
    pendientes: mails.filter(x => x.clasificacion == null).length,
    proveedor: mails.filter(x => x.clasificacion === 'proveedor').length,
    postulante: mails.filter(x => x.clasificacion === 'postulante').length,
    otros: mails.filter(x => x.clasificacion === 'otro').length
  }), [mails]);

  if (isMail) {
    return (
      <div className="pantalla proveedores-pantalla proveedores-recepcion-pantalla">
        <header className="encabezado">
          <div className="proveedores-intro">
            <h1 className="h3">Correos por clasificar</h1>
            <p className="chico apagado proveedores-descripcion">
              Clasifica los antecedentes recibidos en contacto@coproactiva.cl. Los archivos permanecen disponibles en Gmail.
            </p>
          </div>
          <div className="acciones-proveedores-cabecera">
            <button className="boton" disabled={busy} onClick={sync}>
              {busy ? 'Sincronizando…' : 'Sincronizar correos'}
            </button>
            <button className="boton boton-secundario" disabled={busy} onClick={load}>Actualizar</button>
          </div>
        </header>

        <div className="cuerpo proveedores-recepcion-cuerpo">
          <ProveedoresNavegacion />
          {error && <div className="aviso aviso-critico" role="alert">{error}</div>}

          <section className="proveedores-recepcion-kpis">
            <div><strong>{resumenCorreos.pendientes}</strong><span>Pendientes</span></div>
            <div><strong>{resumenCorreos.proveedor}</strong><span>Proveedores</span></div>
            <div><strong>{resumenCorreos.postulante}</strong><span>Postulantes</span></div>
            <div><strong>{resumenCorreos.otros}</strong><span>Otros</span></div>
          </section>

          <section className="tarjeta proveedores-recepcion-toolbar">
            <label className="campo">
              <span className="etiqueta-campo">Estado</span>
              <select aria-label="Filtrar correos" value={filter} onChange={e=>setFilter(e.target.value)}>
                <option value="pendientes">Pendientes</option>
                <option value="todos">Todos</option>
                <option value="proveedor">Proveedores</option>
                <option value="postulante">Postulantes</option>
                <option value="otro">Otros</option>
              </select>
            </label>
            <p className="micro apagado">{mailRows.length} correo{mailRows.length === 1 ? '' : 's'} en esta vista</p>
          </section>

          <div className="proveedores-correo-layout">
            <aside className="tarjeta proveedores-correo-lista">
              <div className="proveedores-correo-lista-titulo">
                <strong>Bandeja</strong>
                <span className="micro apagado">{mailRows.length}</span>
              </div>
              <div className="proveedores-correo-scroll">
                {!mailRows.length
                  ? <p className="vacio">No hay correos en este filtro.</p>
                  : mailRows.map(m => (
                      <button className={'proveedores-correo-item ' + (selected === m.id ? 'selected' : '')}
                              key={m.id} onClick={()=>setSelected(m.id)}>
                        <strong>{m.asunto || 'Sin asunto'}</strong>
                        <span>{m.remitente_nombre || m.remitente_email}</span>
                        <small>{date(m.fecha_correo)} · {m.clasificacion || 'Pendiente'}</small>
                      </button>
                    ))}
              </div>
            </aside>

            <section className="tarjeta proveedores-correo-detalle">
              {email ? (
                <>
                  <div className="proveedores-correo-detalle-cabecera">
                    <div>
                      <span className="micro apagado">{date(email.fecha_correo)}</span>
                      <h2 className="h4">{email.asunto || 'Sin asunto'}</h2>
                      <p className="chico apagado">{email.remitente_nombre || 'Sin nombre'} · {email.remitente_email}</p>
                    </div>
                    <span className={'chip ' + (email.clasificacion ? 'chip-cumple' : 'chip-pendiente')}>
                      {email.clasificacion || 'Pendiente'}
                    </span>
                  </div>

                  <div className="proveedores-correo-contenido">
                    <pre className="wa-email-body">{email.cuerpo_texto || email.snippet || 'Sin texto'}</pre>
                    {email.adjuntos?.length > 0 && (
                      <p className="chico apagado">{email.adjuntos.length} archivo(s) asociados en Gmail.</p>
                    )}
                    <div className="proveedores-correo-links">
                      {email.gmail_thread_id
                        ? <a href={gmail(email.gmail_thread_id)} target="_blank" rel="noreferrer">Abrir correo y archivos en Gmail</a>
                        : <a href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:'+email.remitente_email)}`}
                             target="_blank" rel="noreferrer">Buscar correo en Gmail</a>}
                    </div>
                  </div>

                  {!email.clasificacion && (
                    <div className="proveedores-clasificacion">
                      <h3 className="h4">Clasificar correo</h3>
                      <div className="formulario-grid">
                        <label className="campo">
                          <span className="etiqueta-campo">Clasificación</span>
                          <select value={classification} onChange={e=>{
                            setClassification(e.target.value);
                            setTarget('');
                            setWaLink('');
                          }}>
                            <option value="postulante">Postulante</option>
                            <option value="proveedor">Proveedor</option>
                            <option value="otro">Otro correo</option>
                          </select>
                        </label>

                        {classification !== 'otro' && (
                          <>
                            <label className="campo">
                              <span className="etiqueta-campo">Registro existente</span>
                              <select value={target} onChange={e=>{
                                setTarget(e.target.value);
                                const row=(classification==='postulante'?people:vendors).find(x=>x.id===e.target.value);
                                if(row) setName(row.nombre||row.empresa);
                              }}>
                                <option value="">Crear o detectar por remitente</option>
                                {(classification==='postulante'?people:vendors).map(x=>(
                                  <option key={x.id} value={x.id}>{x.nombre||x.empresa} · {x.email||'Sin correo'}</option>
                                ))}
                              </select>
                            </label>

                            <label className="campo">
                              <span className="etiqueta-campo">
                                {classification==='proveedor' ? 'Nombre de empresa' : 'Nombre del postulante'}
                              </span>
                              <input value={name} maxLength={160} onChange={e=>setName(e.target.value)} />
                            </label>

                            <label className="campo">
                              <span className="etiqueta-campo">Conversación de WhatsApp (opcional)</span>
                              <select value={waLink} onChange={e=>setWaLink(e.target.value)}>
                                <option value="">Sin vínculo</option>
                                {waOptions
                                  .filter(x=>x.motivo===(classification==='postulante'?'postulacion':'proveedor'))
                                  .map(x=>(
                                    <option key={x.id} value={x.id}>
                                      {x.datos?.nombre||x.contacto?.nombre_whatsapp||'Contacto'} · {x.contacto?.telefono}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          </>
                        )}
                      </div>

                      <div className="proveedores-clasificacion-acciones">
                        <button className="boton"
                                disabled={busy || (classification!=='otro' && !name.trim())}
                                onClick={classify}>
                          Confirmar clasificación
                        </button>
                      </div>
                    </div>
                  )}

                  {email.postulante_id && (
                    <div className="aviso aviso-ok">Vinculado a un postulante. Revisa la sección Postulantes.</div>
                  )}
                  {email.proveedor_id && (
                    <div className="aviso aviso-ok"><Link to={`/proveedores/${email.proveedor_id}`}>Ver proveedor vinculado</Link></div>
                  )}
                </>
              ) : (
                <div className="proveedores-correo-placeholder">
                  <strong>Selecciona un correo</strong>
                  <p className="chico apagado">Aquí podrás revisar el contenido y clasificarlo.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla proveedores-pantalla proveedores-recepcion-pantalla">
      <header className="encabezado">
        <div className="proveedores-intro">
          <h1 className="h3">Postulantes</h1>
          <p className="chico apagado proveedores-descripcion">
            Postulaciones y antecedentes laborales recibidos por correo o ingresados manualmente.
          </p>
        </div>
        <div className="acciones-proveedores-cabecera">
          <button className="boton" onClick={()=>setForm({
            nombre:'',email:'',telefono:'',comuna:'',cargo_propuesto:'',estado:'nuevo',notas:''
          })}>
            Nuevo postulante
          </button>
          <button className="boton boton-secundario" onClick={load}>Actualizar</button>
        </div>
      </header>

      <div className="cuerpo proveedores-recepcion-cuerpo">
        <ProveedoresNavegacion />
        {error && <div className="aviso aviso-critico" role="alert">{error}</div>}

        <section className="proveedores-recepcion-kpis">
          <div><strong>{resumenPostulantes.total}</strong><span>Postulantes</span></div>
          <div><strong>{resumenPostulantes.nuevos}</strong><span>Nuevos</span></div>
          <div><strong>{resumenPostulantes.revision}</strong><span>En revisión</span></div>
          <div><strong>{resumenPostulantes.seleccionados}</strong><span>Seleccionados</span></div>
        </section>

        {!form && (
          <section className="tarjeta proveedores-recepcion-toolbar">
            <label className="campo proveedores-postulantes-buscar">
              <span className="etiqueta-campo">Buscar</span>
              <input type="search" value={search}
                     onChange={e=>setSearch(e.target.value)}
                     placeholder="Nombre, comuna, área, correo o teléfono" />
            </label>
            <p className="micro apagado">{postulantesFiltrados.length} resultado{postulantesFiltrados.length === 1 ? '' : 's'}</p>
          </section>
        )}

        {form ? (
          <form className="tarjeta proveedores-postulante-form" onSubmit={save}>
            <div className="proveedores-postulante-form-cabecera">
              <div>
                <span className="micro apagado">Postulantes</span>
                <h2 className="h4">{form.id ? 'Editar postulante' : 'Nuevo postulante'}</h2>
              </div>
            </div>
            <div className="formulario-grid">
              {[['nombre','Nombre'],['comuna','Comuna'],['cargo_propuesto','Área o cargo'],['email','Correo'],['telefono','Teléfono']]
                .map(([key,label])=>(
                  <label className="campo" key={key}>
                    <span className="etiqueta-campo">{label}</span>
                    <input required={key==='nombre'} type={key==='email'?'email':'text'}
                           value={form[key]??''} maxLength={200}
                           onChange={e=>setForm({...form,[key]:e.target.value})}/>
                  </label>
                ))}
              <label className="campo">
                <span className="etiqueta-campo">Estado</span>
                <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                  {STATES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="campo ancho-total">
                <span className="etiqueta-campo">Notas</span>
                <textarea rows={4} value={form.notas??''} maxLength={3500}
                          onChange={e=>setForm({...form,notas:e.target.value})}/>
              </label>
            </div>
            <div className="proveedores-postulante-form-acciones">
              <button type="button" className="boton boton-secundario" onClick={()=>setForm(null)}>Cancelar</button>
              <button className="boton" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>

            {history.length > 0 && (
              <div className="proveedores-postulante-historial">
                <h3 className="h4">Correos asociados</h3>
                {history.map(m=>(
                  <div key={m.id} className="proveedores-postulante-correo">
                    <strong>{m.asunto} · {date(m.fecha_correo)}</strong>
                    <pre className="wa-email-body">{m.cuerpo_texto}</pre>
                    {m.gmail_thread_id && <a href={gmail(m.gmail_thread_id)} target="_blank" rel="noreferrer">Revisar correo y CV en Gmail</a>}
                  </div>
                ))}
              </div>
            )}
          </form>
        ) : (
          <section className="tarjeta proveedores-postulantes-tabla">
            <div className="tabla-responsive">
              <table className="tabla">
                <thead>
                  <tr><th>Nombre</th><th>Comuna</th><th>Área</th><th>Estado</th><th>Ingreso</th><th>Contacto</th></tr>
                </thead>
                <tbody>
                  {postulantesFiltrados.map(p=>(
                    <tr key={p.id}>
                      <td><button className="boton boton-texto proveedores-postulante-nombre" onClick={()=>setForm(p)}>{p.nombre}</button></td>
                      <td>{p.comuna||'—'}</td>
                      <td>{p.cargo_propuesto||'Por revisar'}</td>
                      <td><span className="chip chip-pendiente">{STATES.find(x=>x[0]===p.estado)?.[1]??p.estado}</span></td>
                      <td>{date(p.fecha_postulacion||p.creado_en)}</td>
                      <td>{p.email||p.telefono||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!postulantesFiltrados.length && <p className="vacio">No hay postulantes para esta búsqueda.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
