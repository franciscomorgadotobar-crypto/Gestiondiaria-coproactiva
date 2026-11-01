import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import PropuestaDoc from '../../componentes/PropuestaDocumento';
import '../../lib/propuestaDocPage';
import './Propuestas.css';

const COMUNAS_RM = ['Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa', 'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'];

const BLANK = { comunidad: '', direccion: '', comuna: '', destinatario: '', fecha: '', vigencia: '30', base: '', pct: '9', urgencia: '', diasPago: '5', mesesContrato: '12', email: '', firmante: '', cargo: '' };
const KEY_ACTUAL = 'coproactiva.propuesta.actual.v1';

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const numOf = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; };

function computeAll(d) {
  const base = numOf(d.base), pct = numOf(d.pct), urg = numOf(d.urgencia);
  const neto = base != null && pct != null ? Math.round(base * pct / 100) : null;
  const iva = neto != null ? Math.round(neto * 0.19) : null;
  const total = neto != null && iva != null ? neto + iva : null;
  let fechaTexto = '';
  if (d.fecha) {
    const [y, m, day] = d.fecha.split('-').map(Number);
    fechaTexto = new Date(y, m - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const pctTxt = pct != null ? String(pct).replace('.', ',') + '%' : '';
  return {
    base: base != null ? clp(base) : '', pct: pctTxt,
    neto: neto != null ? clp(neto) : '', iva: iva != null ? clp(iva) : '',
    total: total != null ? clp(total) : '', urgencia: urg != null ? clp(urg) : '',
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

export default function Propuestas() {
  const {perfil}=useSesion();
  const [busqueda]=useSearchParams();
  const [cargando,setCargando]=React.useState(true);
  const [guardando,setGuardando]=React.useState(false);
  const [aviso,setAviso]=React.useState('');
  const [vistaMovil,setVistaMovil]=React.useState('form');
  const [d,setD]=React.useState({...BLANK});
  const [borradorListo,setBorradorListo]=React.useState(false);
  React.useEffect(()=>{
    if(!perfil?.id)return;
    try{setD({...BLANK,...JSON.parse(localStorage.getItem(KEY_ACTUAL+':'+perfil.id)||'{}')});}
    catch{setD({...BLANK});}
    setBorradorListo(true);
  },[perfil?.id]);
  // La fuente de verdad es Supabase: la antigua API Netlify sigue operativa
  // únicamente durante la migración de las propuestas históricas.
  const [clientes,setClientes]=React.useState({});
  const [registros,setRegistros]=React.useState({});
  const [opts, setOpts] = React.useState({ portada: true, numeros: true, honorarios: true });
  const [sel, setSel] = React.useState('');

  React.useEffect(()=>{
    if(!perfil?.id||!borradorListo)return;
    try{localStorage.setItem(KEY_ACTUAL+':'+perfil.id,JSON.stringify(d));}
    catch{/* El guardado principal de propuestas ocurre en Supabase. */}
  },[d,perfil?.id,borradorListo]);

  React.useEffect(()=>{
    let vigente=true;
    supabase.from('propuestas_comerciales')
      .select('id,nombre,datos,opciones,prospecto_id,actualizado_en')
      .order('actualizado_en',{ascending:false}).then(({data,error})=>{
        if(!vigente)return;
        if(error)setAviso('No se pudieron cargar las propuestas: '+error.message);
        else {
          const lista={};const indices={};
          for(const item of data||[]){lista[item.nombre]=item.datos;indices[item.nombre]=item;}
          setClientes(lista);setRegistros(indices);
        }
        setCargando(false);
      });
    return ()=>{vigente=false;};
  },[]);

  React.useEffect(()=>{
    const id=busqueda.get('prospecto');
    if(!id)return;
    let vivo=true;
    supabase.from('prospectos').select('id,nombre_condominio,direccion,comuna,nombre_contacto,email')
      .eq('id',id).maybeSingle().then(({data})=>{
        if(!vivo||!data)return;
        // Un prospecto distinto nunca hereda los honorarios del borrador anterior.
        setD({
          ...BLANK,
          comunidad:data.nombre_condominio||'',
          direccion:data.direccion||'',
          comuna:data.comuna||'',
          destinatario:data.nombre_contacto||'',
          email:data.email||''
        });
        setSel('');
      });
    return ()=>{vivo=false;};
  },[busqueda]);

  React.useEffect(()=>{
    let raf=0;
    const ajustar=()=>{
      const envoltura=document.querySelector('.propuesta-docwrap');
      const pagina=envoltura?.querySelector('doc-page');
      if(!pagina)return;
      pagina.style.transform='none';
      envoltura.style.height='';
      if(window.innerWidth>980||vistaMovil!=='doc')return;
      const hoja=pagina.shadowRoot?.querySelector('.sheet');
      if(!hoja)return;
      const estilos=getComputedStyle(pagina);
      const padding=(parseFloat(estilos.paddingLeft)||0)+(parseFloat(estilos.paddingRight)||0);
      const ancho=hoja.getBoundingClientRect().width+padding;
      if(!ancho)return;
      const alto=hoja.getBoundingClientRect().height+
        (parseFloat(estilos.paddingTop)||0)+(parseFloat(estilos.paddingBottom)||0);
      const escala=Math.min(1,envoltura.clientWidth/ancho);
      pagina.style.transformOrigin='top left';
      pagina.style.transform='scale('+escala+')';
      envoltura.style.height=Math.ceil(alto*escala)+'px';
    };
    const programar=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(ajustar);};
    const imprimir=()=>{
      const pagina=document.querySelector('.propuesta-docwrap doc-page');
      const wrap=document.querySelector('.propuesta-docwrap');
      if(pagina)pagina.style.transform='';
      if(wrap)wrap.style.height='';
    };
    programar();
    window.addEventListener('resize',programar);
    window.addEventListener('beforeprint',imprimir);
    window.addEventListener('afterprint',programar);
    document.fonts?.ready?.then(programar);
    return ()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener('resize',programar);
      window.removeEventListener('beforeprint',imprimir);
      window.removeEventListener('afterprint',programar);
    };
  },[vistaMovil,d,opts]);

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const calc = computeAll(d);

  const guardar = async () => {
    const nombre = d.comunidad.trim();
    if (!nombre) { setAviso('Escribe el nombre de la comunidad antes de guardar.'); return; }
    setGuardando(true);setAviso('');
    const payload={
      nombre,datos:d,opciones:opts,
      prospecto_id:registros[sel]?.prospecto_id||busqueda.get('prospecto')||null,
      actualizado_por:perfil?.id
    };
    const {data,error}=await supabase.from('propuestas_comerciales')
      .upsert(payload,{onConflict:'nombre'})
      .select('id,nombre,datos,opciones,prospecto_id,actualizado_en').single();
    if(error){setAviso('No se pudo guardar: '+error.message);}
    else{
      setClientes(actual=>({...actual,[nombre]:data.datos}));
      setRegistros(actual=>({...actual,[nombre]:data}));
      setSel(nombre);setAviso('Propuesta guardada en Gestión Diaria.');
    }
    setGuardando(false);
  };
  const cargar=nombre=>{
    setSel(nombre);
    if(clientes[nombre]){
      setD({...BLANK,...clientes[nombre]});
      setOpts({...{portada:true,numeros:true,honorarios:true},...registros[nombre]?.opciones});
    }
  };
  React.useEffect(()=>{
    const id=busqueda.get('documento');
    if(!id || cargando)return;
    const registro=Object.values(registros).find(r=>r.id===id);
    if(!registro)return;
    setSel(registro.nombre);
    setD({...BLANK,...registro.datos});
    setOpts({...{portada:true,numeros:true,honorarios:true},...registro.opciones});
  },[busqueda,registros,cargando]);
  const eliminar=async ()=>{
    if(!sel||!registros[sel]||!window.confirm('¿Eliminar esta propuesta guardada?'))return;
    setGuardando(true);setAviso('');
    const {error}=await supabase.from('propuestas_comerciales').delete().eq('id',registros[sel].id);
    if(error)setAviso('No se pudo eliminar: '+error.message);
    else{
      const siguientes={...clientes};delete siguientes[sel];setClientes(siguientes);
      const siguienteIndice={...registros};delete siguienteIndice[sel];setRegistros(siguienteIndice);
      setSel('');setAviso('Propuesta eliminada.');
    }
    setGuardando(false);
  };
  async function importarAnterior(evento){
    const archivo=evento.target.files?.[0];
    evento.target.value='';
    if(!archivo)return;
    if(archivo.size>5*1024*1024){setAviso('El respaldo supera 5 MB.');return;}
    setGuardando(true);setAviso('');
    try{
      const json=JSON.parse(await archivo.text());
      if(!json||typeof json!=='object'||Array.isArray(json))
        throw new Error('El respaldo debe contener un objeto JSON por nombre de comunidad');
      const entradas=Object.entries(json);
      if(entradas.length>1000)throw new Error('Máximo 1.000 propuestas por importación');
      const conocidas=new Set(Object.keys(clientes));
      const importables=entradas.flatMap(([nombre,datos])=>{
        const n=String(nombre).trim();
        if(!n||n.length>160||conocidas.has(n)||!datos||typeof datos!=='object'||Array.isArray(datos))
          return [];
        conocidas.add(n);
        return [{nombre:n,datos,opciones:{portada:true,numeros:true,honorarios:true},
          creado_por:perfil.id,actualizado_por:perfil.id}];
      });
      if(!importables.length){setAviso('No hay propuestas nuevas en el respaldo.');return;}
      let incorporadas=0;
      for(let i=0;i<importables.length;i+=50){
        const {data,error}=await supabase.from('propuestas_comerciales')
          .upsert(importables.slice(i,i+50),{onConflict:'nombre',ignoreDuplicates:true})
          .select('id,nombre,datos,opciones,prospecto_id,actualizado_en');
        if(error)throw error;
        const nuevos={};const indices={};
        for(const item of data||[]){nuevos[item.nombre]=item.datos;indices[item.nombre]=item;}
        setClientes(v=>({...v,...nuevos}));setRegistros(v=>({...v,...indices}));
        incorporadas+=(data||[]).length;
      }
      setAviso('Se importaron '+incorporadas+' propuestas. Las originales siguen en Netlify.');
    }catch(e){setAviso('Error de importación: '+(e?.message||'archivo inválido'));}
    finally{setGuardando(false);}
  }

  const nueva=()=>{setD({...BLANK});setSel('');setAviso('');};

  const p = panelStyles;
  const pctFuera = calc.pctNum != null && (calc.pctNum < 8 || calc.pctNum > 10);

  return (
    <div className={'propuesta-app'+(vistaMovil==='doc'?' show-doc':'')}>
      <div className="propuesta-mobile-tabs" role="group" aria-label="Vista de propuestas">
        <button className={vistaMovil==='form'?'activo':''} type="button" onClick={()=>setVistaMovil('form')}>Formulario</button>
        <button className={vistaMovil==='doc'?'activo':''} type="button" onClick={()=>setVistaMovil('doc')}>Documento</button>
      </div>
      <aside className="propuesta-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src={import.meta.env.BASE_URL+'brand/imagologo-horizontal-naranja.svg'} alt="Coproactiva" style={{height:28,width:'auto'}} />
        </div>
        <p style={{margin:'10px 0 14px',fontSize:13,lineHeight:1.5,color:'#6b7480'}}>Generador de propuestas comerciales integrado con Gestión Diaria.</p>
        <div className="propuesta-toolbar"><Link to="/documentos">Volver al gestor documental</Link><span>Documentos / Propuestas</span></div>
        {aviso&&<p role="status" className="propuesta-aviso">{aviso}</p>}

        <div style={p.group}>
          <h2 style={p.groupTitle}>Clientes guardados</h2>
          <Field label="Cargar propuesta">
            <select style={p.input} value={sel} onChange={e => cargar(e.target.value)}>
              <option value="">{cargando?'Cargando propuestas...':'- Selecciona una propuesta -'}</option>
              {Object.keys(clientes).sort().map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={p.btn} onClick={guardar} disabled={guardando||cargando}>{guardando?'Guardando...':'Guardar'}</button>
            <button style={p.btnGhost} onClick={nueva}>Nueva</button>
            <button style={p.btnGhost} onClick={eliminar} disabled={!sel||guardando}>Borrar</button>
          </div>
          {perfil?.rol==='superadmin'&&<div className="propuesta-migrar">
            <label>Importar propuestas anteriores (respaldo JSON)
              <input type="file" accept=".json,application/json" disabled={guardando||cargando}
                onChange={importarAnterior}/>
            </label>
            <small>No sobrescribe propuestas ya guardadas ni elimina el origen.</small>
          </div>}
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
              <option value="">- Selecciona comuna -</option>
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
          {pctFuera ? <p style={p.warn}>El modelo fija el porcentaje entre 8% y 10%.</p> : null}
          <div className="row" style={p.row}>
            <div>
              <label style={p.label}>Base mensual GG.CC. ($)</label>
              <input type="number" min="0" step="1000" style={p.input} value={d.base} onChange={e => set('base', e.target.value)} placeholder="4500000" />
            </div>
            <div>
              <label style={p.label}>Porcentaje (%)</label>
              <input type="number" min="8" max="10" step="0.1" style={p.input} value={d.pct} onChange={e => set('pct', e.target.value)} />
            </div>
          </div>
          <div style={{ margin: '4px 0 14px' }}>
            <div style={p.computed}><span>Honorario neto</span><strong>{calc.neto || '-'}</strong></div>
            <div style={p.computed}><span>IVA (19%)</span><strong>{calc.iva || '-'}</strong></div>
            <div style={{ ...p.computed, borderBottom: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#2b3138' }}><span>Total mensual</span><strong>{calc.total || '-'}</strong></div>
          </div>
          <Field label="Gasto autónomo urgencias ($)">
            <input type="number" min="0" step="10000" style={p.input} value={d.urgencia} onChange={e => set('urgencia', e.target.value)} placeholder="300000" />
          </Field>
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
      <main className="propuesta-docwrap">
        <PropuestaDoc d={d} calc={calc} opts={opts} />
      </main>
    </div>
  );
}


