import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import PropuestaDoc from '../../componentes/PropuestaDocumento';
import {calcularHonorarios} from '../../lib/calculoHonorarios';
import {fechaLocalInput} from '../../lib/plantillasDocumentales';
import {modeloEditable} from '../../lib/plantillasDocumentalesEditables';
import {nombreDocumentoDePlantilla,prepararTituloImpresion} from '../../lib/nombresDocumentales';
import '../../lib/propuestaDocPage';
import './Propuestas.css';
import { OPCIONES_PROPUESTA, etiquetaProspecto, datosDesdeProspecto,
  propuestaDelProspecto, conflictoAsociacion } from '../../lib/propuestasProspectos';

const COMUNAS_RM = ['Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa', 'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'];

const BLANK = { comunidad: '', direccion: '', comuna: '', destinatario: '', fecha: '', vigencia: '30', tipoHonorarios: 'porcentaje', base: '', pct: '9', montoFijo: '', montoFijoTipo: 'neto', diasPago: '5', mesesContrato: '12', email: '', firmante: '', cargo: '' };
const KEY_ACTUAL = 'coproactiva.propuesta.actual.v1';
// La firma usa la letra manuscrita de marca, que solo aparece dentro del
// documento. En el teléfono el documento queda oculto tras el formulario y el
// navegador no descarga la letra hasta imprimir, cuando ya es tarde: se pide al
// abrir la pantalla y se espera (con tope) antes de abrir el diálogo.
const FUENTE_FIRMA = "400 39px 'Retro Signature'";
const cargarFuenteFirma = () => Promise.race([
  document.fonts?.load?.(FUENTE_FIRMA) ?? Promise.resolve(),
  new Promise(resolver => setTimeout(resolver, 3000))
]).catch(() => {});

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const datosPropuesta = valor => {
  const {urgencia, ...datos} = valor || {};
  return {...BLANK, ...datos};
};

function computeAll(d) {
  const valores = calcularHonorarios(d);
  let fechaTexto = '';
  if (d.fecha) {
    const [y, m, day] = d.fecha.split('-').map(Number);
    fechaTexto = new Date(y, m - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return {
    ...valores,
    base: valores.base !== null ? clp(valores.base) : '',
    pct: valores.pct !== null ? String(valores.pct).replace('.', ',')+'%' : '',
    neto: valores.neto !== null ? clp(valores.neto) : '',
    iva: valores.iva !== null ? clp(valores.iva) : '',
    total: valores.total !== null ? clp(valores.total) : '',
    pctNum: valores.pct,
    fechaTexto
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
    try{setD(datosPropuesta(JSON.parse(localStorage.getItem(KEY_ACTUAL+':'+perfil.id)||'{}')));}
    catch{setD({...BLANK});}
    setBorradorListo(true);
  },[perfil?.id]);
  // La fuente de verdad es Supabase: la antigua API Netlify sigue operativa
  // únicamente durante la migración de las propuestas históricas.
  const [plantillaGlobal,setPlantillaGlobal]=React.useState(null);
  const [plantillaLista,setPlantillaLista]=React.useState(false);
  const [errorPlantilla,setErrorPlantilla]=React.useState('');
  React.useEffect(()=>{
    let vigente=true;
    const leer=()=>supabase.from('plantillas_documentales_app').select('contenido').eq('tipo','propuesta_comercial')
     .maybeSingle().then(({data,error})=>{if(!vigente)return;
       setErrorPlantilla(error?.message||'');
       if(!error){setPlantillaGlobal(data?.contenido||null);setPlantillaLista(true);}
     });
    leer();
    const actualizar=()=>{if(document.visibilityState==='visible')leer();};
    window.addEventListener('focus',actualizar);
    return()=>{vigente=false;window.removeEventListener('focus',actualizar);};
  },[]);
  const [clientes,setClientes]=React.useState({});
  const [registros,setRegistros]=React.useState({});
  const [opts, setOpts] = React.useState({ portada: true, numeros: true, honorarios: true });
  const [sel, setSel] = React.useState('');
  const [prospectos,setProspectos]=React.useState([]);
  const [prospectoId,setProspectoId]=React.useState('');
  const [cargandoProspectos,setCargandoProspectos]=React.useState(true);
  const [revisionProspectos,setRevisionProspectos]=React.useState(0);
  const abiertoDesdeUrl=React.useRef('');
  const restaurarNombreImpresion=React.useRef(null);

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

  // La lista se consulta directamente en el mismo Pipeline; no depende de
  // que ya se haya guardado una propuesta para mostrar el nombre del prospecto.
  React.useEffect(()=>{
    let vigente=true;
    setCargandoProspectos(true);
    supabase.from('prospectos')
      .select('id,nombre_condominio,nombre_contacto,direccion,comuna,etapa')
      .order('nombre_condominio',{ascending:true})
      .then(({data,error})=>{
        if(!vigente)return;
        setCargandoProspectos(false);
        if(error){setAviso('No se pudieron cargar los prospectos: '+error.message);return;}
        setProspectos(data||[]);
      });
    return ()=>{vigente=false;};
  },[revisionProspectos]);

  function seleccionarProspecto(id){
    setProspectoId(id);
    if(!id){setSel('');setD({...BLANK,fecha:fechaLocalInput()});setOpts({...OPCIONES_PROPUESTA});setAviso('');return;}
    const p=prospectos.find(item=>item.id===id);
    if(!p)return;
    const registro=propuestaDelProspecto(registros,id);
    if(registro){
      setSel(registro.nombre);
      setD(datosPropuesta(registro.datos));
      setOpts({...OPCIONES_PROPUESTA,...registro.opciones});
      setAviso('');
    }else{
      setSel('');
      setD(datosDesdeProspecto(p,{...BLANK,fecha:fechaLocalInput()}));
      setOpts({...OPCIONES_PROPUESTA});
      setAviso('');
    }
  }

  React.useEffect(()=>{
    const id=busqueda.get('prospecto');
    if(!id||busqueda.get('documento')||cargandoProspectos||cargando||!borradorListo||abiertoDesdeUrl.current===id)return;
    const p=prospectos.find(item=>item.id===id);
    if(!p)return;
    abiertoDesdeUrl.current=id;
    seleccionarProspecto(id);
  },[busqueda,prospectos,cargandoProspectos,cargando,registros,borradorListo]);

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
  const nombreDocumento=nombreDocumentoDePlantilla('propuesta_comercial',d.comunidad);
  React.useEffect(()=>{cargarFuenteFirma();},[]);
  const imprimirPdf=async()=>{
    if(!d.comunidad?.trim()){
      setAviso('Selecciona o ingresa el nombre del cliente antes de generar el PDF.');
      return;
    }
    await cargarFuenteFirma();
    restaurarNombreImpresion.current?.();
    restaurarNombreImpresion.current=prepararTituloImpresion('propuesta_comercial',d.comunidad);
    window.print();
  };
  React.useEffect(()=>{
    const finalizar=()=>{
      restaurarNombreImpresion.current?.();
      restaurarNombreImpresion.current=null;
    };
    window.addEventListener('afterprint',finalizar);
    return()=>{window.removeEventListener('afterprint',finalizar);finalizar();};
  },[]);

  const guardar = async () => {
    if(guardando||cargando)return;
    if(!prospectoId&&!sel){setAviso('Selecciona un prospecto del CRM antes de guardar.');return;}
    if(!sel&&!plantillaLista){setAviso('No se ha cargado la plantilla.');return;}
    const cliente=d.comunidad.trim();
    if (!cliente) { setAviso('Escribe el nombre del cliente o comunidad antes de guardar.'); return; }
    const nombre=nombreDocumentoDePlantilla('propuesta_comercial',cliente);
    const guardadaActual=sel?registros[sel]:null;
    const conMismoNombre=registros[nombre];
    if (conMismoNombre&&conMismoNombre.id!==guardadaActual?.id) {
      setAviso('Ya hay una propuesta guardada con este título y cliente. Selecciónala para editarla.');
      return;
    }
    if (conflictoAsociacion(registros,nombre,prospectoId) &&
        conMismoNombre?.id!==guardadaActual?.id) {
      setAviso('Este documento pertenece a otro prospecto.');
      return;
    }
    setGuardando(true);setAviso('');
    const plantillaVigente=d.plantillaContenido??(sel?null:{...modeloEditable('propuesta_comercial'),...(plantillaGlobal||{})});
    const payload={
      nombre,datos:datosPropuesta({...d,plantillaContenido:plantillaVigente}),opciones:opts,
      prospecto_id:prospectoId||null,
      actualizado_por:perfil?.id
    };
    const consulta=supabase.from('propuestas_comerciales');
    const {data,error}=(guardadaActual?.id
      ? await consulta.update(payload).eq('id',guardadaActual.id)
          .select('id,nombre,datos,opciones,prospecto_id,actualizado_en').single()
      : await consulta.insert(payload)
          .select('id,nombre,datos,opciones,prospecto_id,actualizado_en').single());
    if(error){setAviso('No se pudo guardar: '+error.message);}
    else{
      setClientes(actual=>{
        const siguiente={...actual};
        if(sel&&sel!==nombre)delete siguiente[sel];
        siguiente[nombre]=data.datos;
        return siguiente;
      });
      setRegistros(actual=>{
        const siguiente={...actual};
        if(sel&&sel!==nombre)delete siguiente[sel];
        siguiente[nombre]=data;
        return siguiente;
      });
      setSel(nombre);setD(actual=>({...actual,plantillaContenido:plantillaVigente}));
      setAviso(prospectoId?'Documento guardado y disponible en la ficha comercial.':'Documento guardado en el Gestor documental.');
    }
    setGuardando(false);
  };
  const cargar=nombre=>{
    setSel(nombre);
    if(clientes[nombre]){
      setD(datosPropuesta(clientes[nombre]));
      setOpts({...OPCIONES_PROPUESTA,...registros[nombre]?.opciones});
      setProspectoId(registros[nombre]?.prospecto_id||'');
    }else {setProspectoId('');setD({...BLANK,fecha:fechaLocalInput()});setOpts({...OPCIONES_PROPUESTA});}
  };
  React.useEffect(()=>{
    const id=busqueda.get('documento');
    if(!id || cargando||!borradorListo||abiertoDesdeUrl.current==='documento:'+id)return;
    const registro=Object.values(registros).find(r=>r.id===id);
    if(!registro)return;
    abiertoDesdeUrl.current='documento:'+id;
    setSel(registro.nombre);
    setD(datosPropuesta(registro.datos));
    setOpts({...OPCIONES_PROPUESTA,...registro.opciones});
    setProspectoId(registro.prospecto_id||'');
  },[busqueda,registros,cargando,borradorListo]);
  const eliminar=async ()=>{
    if(!sel||!registros[sel]||!window.confirm('¿Eliminar esta propuesta guardada?'))return;
    setGuardando(true);setAviso('');
    const {error}=await supabase.from('propuestas_comerciales').delete().eq('id',registros[sel].id);
    if(error)setAviso('No se pudo eliminar: '+error.message);
    else{
      const siguientes={...clientes};delete siguientes[sel];setClientes(siguientes);
      const siguienteIndice={...registros};delete siguienteIndice[sel];setRegistros(siguienteIndice);
      setSel('');setProspectoId('');setD({...BLANK,fecha:fechaLocalInput()});setOpts({...OPCIONES_PROPUESTA});setAviso('Propuesta eliminada.');
    }
    setGuardando(false);
  };
  const nueva=()=>{
    setD({...BLANK,fecha:fechaLocalInput()});setSel('');setProspectoId('');
    setOpts({...OPCIONES_PROPUESTA});setAviso('');
  };

  const p = panelStyles;
  const pctFuera = calc.tipoHonorarios === 'porcentaje' && calc.pctNum != null && (calc.pctNum < 8 || calc.pctNum > 10);

  return (
    <div className={'propuesta-app'+(vistaMovil==='doc'?' show-doc':'')}>
      <div className="propuesta-mobile-tabs" role="group" aria-label="Vista de propuestas">
        <button className={vistaMovil==='form'?'activo':''} type="button" onClick={()=>setVistaMovil('form')}>Datos</button>
        <button className={vistaMovil==='doc'?'activo':''} type="button" onClick={()=>setVistaMovil('doc')}>Vista previa</button>
      </div>
      <aside className="propuesta-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src={import.meta.env.BASE_URL+'brand/imagologo-horizontal-naranja.svg'} alt="Coproactiva" style={{height:28,width:'auto'}} />
        </div>
        <div className="propuesta-toolbar"><Link to="/documentos">← Gestor documental</Link></div>
        {aviso&&<p role="status" className="propuesta-aviso">{aviso}</p>}

        <div style={p.group}>
          <h2 style={{margin:"0 0 6px",fontSize:20,color:"#2b3138"}}>Propuesta comercial</h2>
          <p style={{margin:"0 0 16px",fontSize:13,color:"#696969"}}>Plantilla seleccionada desde el Gestor documental. Los datos del CRM se completan automáticamente.</p>
          {errorPlantilla&&<p role="alert" style={p.warn}>No se pudo cargar la plantilla: {errorPlantilla}</p>}
          <h2 style={p.groupTitle}>Cliente del CRM</h2>
          <Field label="Seleccionar prospecto del Pipeline">
            <select style={p.input} value={prospectoId} disabled={cargandoProspectos||cargando||guardando}
              onChange={e=>seleccionarProspecto(e.target.value)}
              aria-label="Seleccionar prospecto de Coproactiva">
              <option value="">{cargandoProspectos?'Cargando prospectos…':'- Selecciona un prospecto -'}</option>
              {prospectos.map(pr=><option key={pr.id} value={pr.id}>{etiquetaProspecto(pr)}</option>)}
            </select>
          </Field>
          <div className="propuesta-prospecto-acciones">
            <span>{cargandoProspectos ? 'Consultando Pipeline…' : ''}</span>
            <button type="button" onClick={()=>setRevisionProspectos(n=>n+1)}
              disabled={cargandoProspectos||guardando}>Actualizar lista</button>
          </div>
          {prospectoId&&<p className="propuesta-prospecto-asociado">
            <span aria-hidden="true">✓</span>
            <strong>{prospectos.find(pr=>pr.id===prospectoId)?.nombre_condominio||'Prospecto'}</strong>
            <Link to={'/pipeline?prospecto='+prospectoId}>Ver ficha comercial</Link>
          </p>}
        </div>
        <div style={{...p.group,border:'1px solid #e9e6e2',borderRadius:8,padding:12}}>
          <p style={{margin:'0 0 8px',fontSize:13}}><strong>{nombreDocumento}</strong></p>
          <p style={{margin:'0 0 12px',fontSize:12,color:'#696969'}}>{prospectoId?'Se guarda automáticamente en la ficha comercial.':'Selecciona un prospecto para vincular el documento al CRM.'}</p>
          {opts.honorarios&&!calc.total&&<p style={p.warn}>Completa los honorarios si están disponibles. Si aún no los conoces, puedes guardar la propuesta como borrador.</p>}
          <button style={{...p.btn,width:'100%'}} onClick={guardar} disabled={guardando||cargando||!d.comunidad.trim()||(!sel&&(!prospectoId||!plantillaLista))}>{guardando?'Guardando…':sel?'Guardar cambios':'Guardar documento en CRM'}</button>
          <button type="button" style={{...p.btnGhost,width:'100%',marginTop:8}} onClick={()=>{setVistaMovil('doc');document.querySelector('.propuesta-docwrap')?.scrollTo({top:0});}}>Vista previa</button>
          {sel&&prospectoId&&<Link style={{display:'block',marginTop:10,fontSize:13}} to={'/pipeline?prospecto='+encodeURIComponent(prospectoId)}>Ir a la ficha comercial →</Link>}
        </div>

        <details style={p.group}>
          <summary style={{...p.groupTitle,cursor:"pointer"}}>Datos de la comunidad y fecha</summary>
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
        </details>

        <details style={p.group} open={!calc.total||undefined}>
          <summary style={{...p.groupTitle,cursor:"pointer"}}>Honorarios y condiciones</summary>
          <Field label="Modalidad de cobro">
            <div className="propuesta-modalidades" role="group" aria-label="Modalidad de honorarios">
              <button type="button" aria-pressed={calc.tipoHonorarios==='porcentaje'}
                className={calc.tipoHonorarios==='porcentaje'?'activo':''}
                onClick={()=>set('tipoHonorarios','porcentaje')}>% gastos comunes</button>
              <button type="button" aria-pressed={calc.tipoHonorarios==='fijo'}
                className={calc.tipoHonorarios==='fijo'?'activo':''}
                onClick={()=>set('tipoHonorarios','fijo')}>Monto fijo</button>
            </div>
          </Field>
          {calc.tipoHonorarios==='porcentaje'?(
            <>
              {pctFuera ? <p style={p.warn}>Porcentaje de referencia: entre 8% y 10%.</p> : null}
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
            </>
          ):(
            <>
              <Field label="Ingresar honorario como">
                <select style={p.input} value={d.montoFijoTipo||'neto'} onChange={e=>set('montoFijoTipo',e.target.value)}>
                  <option value="neto">Neto (sin IVA)</option>
                  <option value="bruto">Bruto (IVA incluido)</option>
                </select>
              </Field>
              <Field label={d.montoFijoTipo==='bruto'?'Monto mensual bruto ($)':'Monto mensual neto ($)'}>
                <input type="number" min="0" step="1" style={p.input} value={d.montoFijo||''}
                  onChange={e=>set('montoFijo',e.target.value)} placeholder="450000" />
              </Field>
            </>
          )}
          <div style={{ margin: '4px 0 14px' }}>
            <div style={p.computed}><span>Honorario neto</span><strong>{calc.neto || '-'}</strong></div>
            <div style={p.computed}><span>IVA (19%)</span><strong>{calc.iva || '-'}</strong></div>
            <div style={{ ...p.computed, borderBottom: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#2b3138' }}><span>Total mensual</span><strong>{calc.total || '-'}</strong></div>
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
        </details>

        <details style={p.group}>
          <summary style={{...p.groupTitle,cursor:"pointer"}}>Emisor</summary>
          <Field label="Correo de contacto">
            <input style={p.input} value={d.email} onChange={e => set('email', e.target.value)} placeholder="contacto@coproactiva.cl" />
          </Field>
          <Field label="Firma">
            <input style={p.input} value={d.firmante} onChange={e => set('firmante', e.target.value)} placeholder="Osmar André Meza Aguilar" />
          </Field>
          <Field label="Cargo">
            <input style={p.input} value={d.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Contador Auditor · Administrador Inscrito · Representante Legal" />
          </Field>
        </details>

        <details style={p.group}>
          <summary style={{...p.groupTitle,cursor:"pointer"}}>Opciones del documento</summary>

          {[['portada', 'Incluir portada'], ['numeros', 'Numerar secciones'], ['honorarios', 'Incluir honorarios']].map(([k, t]) => (
            <label key={k} style={p.toggleRow}>
              <input type="checkbox" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} />
              <span>{t}</span>
            </label>
          ))}
        </details>
        <button style={{ ...p.btnGhost, width: '100%', marginBottom: 12 }} onClick={imprimirPdf}>Imprimir / PDF</button>
        <details style={p.group}>
          <summary style={{...p.groupTitle,cursor:"pointer"}}>Administrar propuestas existentes</summary>
          <Field label="Cargar propuesta guardada">
            <select style={p.input} value={sel} disabled={guardando||cargando} onChange={e=>cargar(e.target.value)}>
              <option value="">{cargando?'Cargando propuestas…':'Seleccionar propuesta'}</option>
              {Object.keys(clientes).sort().map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <div style={{display:"flex",gap:8}}>
            <button style={p.btnGhost} onClick={nueva} disabled={guardando}>Nueva</button>
            <button style={p.btnGhost} onClick={eliminar} disabled={!sel||guardando}>Eliminar</button>
          </div>
          {sel&&<button type="button" style={{...p.btnGhost,width:"100%",marginTop:10}} disabled={!plantillaLista||guardando} onClick={()=>{if(window.confirm("¿Actualizar esta propuesta con la plantilla vigente?")){setD(actual=>({...actual,plantillaContenido:{...modeloEditable('propuesta_comercial'),...(plantillaGlobal||{})}}));setAviso("Plantilla aplicada. Guarda los cambios para conservarla.");}}}>Actualizar desde plantilla vigente</button>}
          <p style={{fontSize:12,color:"#696969"}}>Para editar la plantilla maestra, vuelve al Gestor documental.</p>
        </details>
      </aside>
      <main className="propuesta-docwrap">
        <PropuestaDoc d={d} calc={calc} opts={opts}
          plantillaContenido={d.plantillaContenido??(sel?null:plantillaGlobal)} />
      </main>
    </div>
  );
}


