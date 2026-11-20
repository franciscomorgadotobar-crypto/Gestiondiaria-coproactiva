const COMUNAS_RM = ['Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa', 'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'];

const BLANK = { comunidad: '', direccion: '', comuna: '', destinatario: '', fecha: '', vigencia: '30', tipoHonorarios: 'porcentaje', base: '', pct: '9', montoFijo: '', montoFijoTipo: 'neto', diasPago: '5', mesesContrato: '12', email: '', firmante: '', cargo: '' };
const KEY_ACTUAL = 'coproactiva.propuesta.actual.v1';
const KEY_CLIENTES = 'coproactiva.propuesta.clientes.v1';
const API_CLIENTES = '/api/propuestas';

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const numOf = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; };

function computeAll(d) {
  const base = numOf(d.base), pct = numOf(d.pct);
  const tipoHonorarios = d.tipoHonorarios === 'fijo' ? 'fijo' : 'porcentaje';
  const montoFijo = numOf(d.montoFijo);
  const montoFijoTipo = d.montoFijoTipo === 'bruto' ? 'bruto' : 'neto';

  let neto = null, iva = null, total = null;
  if (tipoHonorarios === 'porcentaje' && base != null && base >= 0 && pct != null && pct >= 0) {
    neto = Math.round(base * pct / 100);
  } else if (tipoHonorarios === 'fijo' && montoFijo != null && montoFijo >= 0) {
    if (montoFijoTipo === 'bruto') {
      total = Math.round(montoFijo);
      neto = Math.round(total / 1.19);
      iva = total - neto;
    } else {
      neto = Math.round(montoFijo);
    }
  }
  if (neto != null && total == null) {
    iva = Math.round(neto * 0.19);
    total = neto + iva;
  }

  let fechaTexto = '';
  if (d.fecha) {
    const [y, m, day] = d.fecha.split('-').map(Number);
    fechaTexto = new Date(y, m - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const pctTxt = pct != null ? String(pct).replace('.', ',') + '%' : '';
  return {
    tipoHonorarios, montoFijoTipo,
    base: base != null ? clp(base) : '', pct: pctTxt,
    neto: neto != null ? clp(neto) : '', iva: iva != null ? clp(iva) : '',
    total: total != null ? clp(total) : '',
    fechaTexto, pctNum: pct
  };
}

const panelStyles = {
  label: { display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8b939b', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #ddd7cf', borderRadius: 2, background: '#fff', font: '400 14.5px var(--font-body)', color: '#2b3138', outline: 'none' },
  group: { marginBottom: 22 },
  groupTitle: { margin: '0 0 12px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#2b3138', paddingBottom: 8, borderBottom: '1px solid #e9e6e2' },
  field: { marginBottom: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  btn: { flex: 1, padding: '11px 12px', border: '1px solid #2b3138', background: '#2b3138', color: '#fff', font: '600 11px var(--font-display)', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 },
  btnGhost: { flex: 1, padding: '11px 12px', border: '1px solid #ddd7cf', background: 'transparent', color: '#4a5a68', font: '600 11px var(--font-display)', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: '#3a4149', marginBottom: 8, cursor: 'pointer' },
  warn: { margin: '0 0 12px', padding: '8px 10px', background: '#fdf3e6', border: '1px solid #f0dcbd', fontSize: 12.5, lineHeight: 1.45, color: '#8a5f22' },
  computed: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: '#3a4149', padding: '6px 0', borderBottom: '1px dotted #ddd7cf' }
};

const Field = ({ label, children }) => (
  <div style={panelStyles.field}>
    <label style={panelStyles.label}>{label}</label>
    {children}
  </div>
);

function App() {
  const [d, setD] = React.useState(() => {
    try { const previous = JSON.parse(localStorage.getItem(KEY_ACTUAL) || '{}'); delete previous.urgencia; return { ...BLANK, ...previous }; } catch (e) { return { ...BLANK }; }
  });
  const [clientes, setClientes] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_CLIENTES) || '{}'); } catch (e) { return {}; }
  });
  const [opts, setOpts] = React.useState({ portada: true, numeros: true, honorarios: true });
  const [sel, setSel] = React.useState('');

  React.useEffect(() => { localStorage.setItem(KEY_ACTUAL, JSON.stringify(d)); }, [d]);

  // Al abrir, trae la lista de clientes guardados desde el servidor
  // (asi queda disponible en cualquier dispositivo), y de paso refresca
  // la copia local que se usa como respaldo si no hay conexion.
  React.useEffect(() => {
    fetch(API_CLIENTES).then(r => r.ok ? r.json() : null).then(list => {
      if (list) { setClientes(list); localStorage.setItem(KEY_CLIENTES, JSON.stringify(list)); }
    }).catch(() => {});
  }, []);

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const calc = computeAll(d);

  const guardar = () => {
    const nombre = d.comunidad.trim();
    if (!nombre) { alert('Escribe el nombre de la comunidad antes de guardar.'); return; }
    const { urgencia, ...datosPropuesta } = d;
    const next = { ...clientes, [nombre]: datosPropuesta };
    setClientes(next); localStorage.setItem(KEY_CLIENTES, JSON.stringify(next)); setSel(nombre);
    fetch(API_CLIENTES, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, data: datosPropuesta })
    }).catch(() => {});
  };
  const cargar = nombre => { setSel(nombre); if (clientes[nombre]) { const { urgencia, ...datosPropuesta } = clientes[nombre]; setD({ ...BLANK, ...datosPropuesta }); } };
  const eliminar = () => {
    if (!sel || !clientes[sel]) return;
    const next = { ...clientes }; delete next[sel];
    setClientes(next); localStorage.setItem(KEY_CLIENTES, JSON.stringify(next)); setSel('');
    fetch(API_CLIENTES, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: sel })
    }).catch(() => {});
  };
  const nueva = () => { setD({ ...BLANK }); setSel(''); };

  const p = panelStyles;
  const pctFuera = calc.tipoHonorarios === 'porcentaje' && calc.pctNum != null && (calc.pctNum < 8 || calc.pctNum > 10);

  return (
    <div className="app">
      <aside className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src="./logo-coproactiva.svg" alt="CoproActiva" style={{ height: 20, width: 'auto' }} />
        </div>
        <p style={{ margin: '10px 0 22px', fontSize: 13, lineHeight: 1.5, color: '#6b7480' }}>Generador de propuestas comerciales. Completa los datos y el documento se arma solo.</p>

        <div style={p.group}>
          <h2 style={p.groupTitle}>Clientes guardados</h2>
          <Field label="Cargar propuesta">
            <select style={p.input} value={sel} onChange={e => cargar(e.target.value)}>
              <option value="">— Selecciona un cliente —</option>
              {Object.keys(clientes).sort().map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={p.btn} onClick={guardar}>Guardar</button>
            <button style={p.btnGhost} onClick={nueva}>Nueva</button>
            <button style={p.btnGhost} onClick={eliminar} disabled={!sel}>Borrar</button>
          </div>
        </div>

        <div style={p.group}>
          <h2 style={p.groupTitle}>Comunidad</h2>
          <Field label="Nombre del edificio o condominio">
            <input style={p.input} value={d.comunidad} onChange={e => set('comunidad', e.target.value)} placeholder="Edificio Parque Bustamante" />
          </Field>
          <Field label="Dirección">
            <input style={p.input} value={d.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Bustamante 250" />
          </Field>
          <Field label="Comuna (Región Metropolitana)">
            <select style={p.input} value={d.comuna} onChange={e => set('comuna', e.target.value)}>
              <option value="">— Selecciona comuna —</option>
              {COMUNAS_RM.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Preparada para">
            <input style={p.input} value={d.destinatario} onChange={e => set('destinatario', e.target.value)} placeholder="Comité de Administración" />
          </Field>
          <div className="row" style={p.row}>
            <div>
              <label style={p.label}>Fecha</label>
              <input type="date" style={p.input} value={d.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div>
              <label style={p.label}>Vigencia (días)</label>
              <input type="number" min="1" style={p.input} value={d.vigencia} onChange={e => set('vigencia', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={p.group}>
          <h2 style={p.groupTitle}>Honorarios</h2>
          <Field label="Modalidad del honorario">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['porcentaje', '% de gastos comunes'],
                ['fijo', 'Monto fijo']
              ].map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={calc.tipoHonorarios === valor}
                  onClick={() => set('tipoHonorarios', valor)}
                  style={{
                    ...p.btnGhost, flex: 'auto', textTransform: 'none',
                    letterSpacing: 0, fontSize: 13, lineHeight: 1.4,
                    background: calc.tipoHonorarios === valor ? '#fcf1e7' : '#fff',
                    color: calc.tipoHonorarios === valor ? '#9a551c' : '#4a5a68',
                    borderColor: calc.tipoHonorarios === valor ? '#d5863b' : '#ddd7cf'
                  }}
                >{texto}</button>
              ))}
            </div>
          </Field>
          {calc.tipoHonorarios === 'porcentaje' ? (
            <>
              {pctFuera ? <p style={p.warn}>El porcentaje de referencia debe estar entre 8% y 10%.</p> : null}
              <div className="row" style={p.row}>
                <div>
                  <label style={p.label}>Base mensual de gastos comunes ($)</label>
                  <input type="number" min="0" step="1000" style={p.input}
                    value={d.base} onChange={e => set('base', e.target.value)} placeholder="4500000" />
                </div>
                <div>
                  <label style={p.label}>Porcentaje (%)</label>
                  <input type="number" min="8" max="10" step="0.1" style={p.input}
                    value={d.pct} onChange={e => set('pct', e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label="Valor que ingresarás">
                <select style={p.input} value={d.montoFijoTipo || 'neto'}
                  onChange={e => set('montoFijoTipo', e.target.value)}>
                  <option value="neto">Monto neto (sin IVA)</option>
                  <option value="bruto">Monto bruto (IVA incluido)</option>
                </select>
              </Field>
              <Field label={d.montoFijoTipo === 'bruto' ? 'Honorario mensual bruto ($)' : 'Honorario mensual neto ($)'}>
                <input type="number" min="0" step="1000" style={p.input}
                  value={d.montoFijo || ''} onChange={e => set('montoFijo', e.target.value)}
                  placeholder="450000" />
              </Field>
            </>
          )}
          <div style={{ margin: '4px 0 14px' }}>
            <div style={p.computed}><span>Honorario neto</span><strong>{calc.neto || '—'}</strong></div>
            <div style={p.computed}><span>IVA (19%)</span><strong>{calc.iva || '—'}</strong></div>
            <div style={{ ...p.computed, borderBottom: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#2b3138' }}><span>Total mensual</span><strong>{calc.total || '—'}</strong></div>
          </div>
          <div className="row" style={p.row}>
            <div>
              <label style={p.label}>Días de pago</label>
              <input type="number" min="1" style={p.input} value={d.diasPago} onChange={e => set('diasPago', e.target.value)} />
            </div>
            <div>
              <label style={p.label}>Meses de contrato</label>
              <input type="number" min="1" style={p.input} value={d.mesesContrato} onChange={e => set('mesesContrato', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={p.group}>
          <h2 style={p.groupTitle}>Emisor</h2>
          <Field label="Correo de contacto">
            <input style={p.input} value={d.email} onChange={e => set('email', e.target.value)} placeholder="contacto@coproactiva.cl" />
          </Field>
          <Field label="Firma">
            <input style={p.input} value={d.firmante} onChange={e => set('firmante', e.target.value)} placeholder="Osmar André Meza Aguilar" />
          </Field>
          <Field label="Cargo">
            <input style={p.input} value={d.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Contador Auditor · Administrador Inscrito · Representante Legal" />
          </Field>
        </div>

        <div style={p.group}>
          <h2 style={p.groupTitle}>Documento</h2>
          {[['portada', 'Incluir portada'], ['numeros', 'Numerar secciones'], ['honorarios', 'Incluir honorarios']].map(([k, t]) => (
            <label key={k} style={p.toggleRow}>
              <input type="checkbox" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} />
              <span>{t}</span>
            </label>
          ))}
          <button style={{ ...p.btn, width: '100%', marginTop: 12 }} onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </aside>
      <main className="docwrap">
        <PropuestaDoc d={d} calc={calc} opts={opts} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
