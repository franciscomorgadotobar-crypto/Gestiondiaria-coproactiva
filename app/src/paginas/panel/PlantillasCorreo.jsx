import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {useSesion} from '../../lib/sesion';
import {VARIABLES_CORREO,completarCorreo,pendientesCorreo} from '../../lib/plantillasCorreo';
import './PlantillasCorreo.css';
const vacia={nombre:'',asunto:'',cuerpo:'',categoria:'Personalizadas',uso:'',etapa_crm:'',
 adjunto_sugerido:'',sugerida:false,variantes:[]};
const CATEGORIAS=['Captación','Reuniones','Propuesta y dudas comerciales','Cierre y puesta en marcha',
 'Gestión y avances','Proveedores','Personal','Personalizadas'];
const CCO_RECOMENDADO='osmarmeza.adm7@gmail.com · franciscomorgadotobar@gmail.com';
export default function PlantillasCorreo(){
 const {perfil}=useSesion();
 const [params]=useSearchParams();
 const [plantillas,setPlantillas]=useState(null);
 const [actual,setActual]=useState(null);
 const [form,setForm]=useState(vacia);
 const [prospectos,setProspectos]=useState([]);
 const [vista,setVista]=useState('');
 const [categoria,setCategoria]=useState(params.get('categoria')==='Proveedores'?'Proveedores':'Todas');
 const [buscar,setBuscar]=useState('');
 const [varianteEditor,setVarianteEditor]=useState('principal');
 const [error,setError]=useState(''),[aviso,setAviso]=useState(''),[guardando,setGuardando]=useState(false);
 async function cargar(){
   const [a,b]=await Promise.all([
     supabase.from('plantillas_correo_crm').select('*').eq('activa',true).order('codigo',{ascending:true,nullsFirst:false}),
     supabase.from('prospectos').select('id,nombre_condominio,nombre_contacto,email,direccion,comuna,unidades').order('nombre_condominio').limit(150)
   ]);
   if(a.error||b.error)setError(a.error?.message||b.error?.message);
   setPlantillas(a.data||[]);setProspectos(b.data||[]);
 }
 useEffect(()=>{cargar()},[]);
 function editar(item){
   setActual(item?.id||'nuevo');
   setForm(item?{...vacia,...item,variantes:Array.isArray(item.variantes)?item.variantes:[]}:vacia);
   setVarianteEditor('principal');
   setError('');setAviso('');
 }
 async function guardar(e){
   e.preventDefault();
   if(!form.nombre.trim()||!form.cuerpo.trim())return setError('Nombre y mensaje son obligatorios.');
   setGuardando(true);setError('');setAviso('');
   const datos={nombre:form.nombre.trim(),asunto:form.asunto.trim(),cuerpo:form.cuerpo,
     categoria:form.categoria||'Personalizadas',uso:form.uso,etapa_crm:form.etapa_crm,
     adjunto_sugerido:form.adjunto_sugerido,variantes:form.variantes,
     actualizado_en:new Date().toISOString()};
   const r=actual==='nuevo'
     ?await supabase.from('plantillas_correo_crm').insert({...datos,creada_por:perfil?.id}).select('id').single()
     :await supabase.from('plantillas_correo_crm').update(datos).eq('id',actual).select('id').single();
   if(r.error)setError(r.error.message);
   else{setActual(null);setAviso('Plantilla guardada.');await cargar();}
   setGuardando(false);
 }
 async function borrar(p){
   if(!window.confirm('¿Eliminar la plantilla '+p.nombre+'?'))return;
   const {error:err}=await supabase.from('plantillas_correo_crm').delete().eq('id',p.id).select('id').single();
   if(err)setError(err.message);
   else {setActual(null);setAviso('Plantilla eliminada.');await cargar();}
 }
 const prospecto=prospectos.find(x=>x.id===vista)||{};
 const cuerpoEditor=varianteEditor==='principal'?form.cuerpo:(form.variantes?.[Number(varianteEditor)]?.cuerpo||'');
 const camposPendientes=pendientesCorreo(completarCorreo(form.asunto,prospecto,perfil?.nombre),
   completarCorreo(cuerpoEditor,prospecto,perfil?.nombre));
 const visibles=(plantillas||[]).filter(p=>
   (categoria==='Todas'||(p.categoria||'Personalizadas')===categoria)&&
   (!buscar.trim()||[p.nombre,p.asunto,p.uso,p.etapa_crm,p.categoria].join(' ').toLowerCase().includes(buscar.toLocaleLowerCase('es-CL').trim())));
 const categoriasVisibles=CATEGORIAS.filter(cat=>visibles.some(p=>(p.categoria||'Personalizadas')===cat));
 return <div className="pantalla modulo-unificado plantillas-correo">
  <header className="encabezado modulo-cabecera"><div>
    <h1 className="h3">Plantillas de correo</h1>
    <p className="chico apagado">Plantillas compartidas por CRM y Proveedores, con envío desde cada ficha o módulo.</p>
  </div></header>
  <div className="cuerpo modulo-contenido plantillas-correo-cuerpo">
    {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
    {aviso&&<div className="aviso" role="status">{aviso}</div>}
    <div className="plantillas-correo-cabecera">
      <Link to="/pipeline" className="boton boton-secundario">‹ CRM</Link>
      <Link to="/proveedores" className="boton boton-secundario">Proveedores</Link>
      <button type="button" className="boton boton-primario" onClick={()=>editar(null)}>+ Nueva plantilla</button>
    </div>
    <p className="chico apagado">Variables frecuentes: {VARIABLES_CORREO.join(' · ')}</p>
    <div className="tarjeta plantillas-correo-criterios"><strong>Convenciones del catálogo</strong>
      <p>Trato de usted; sin firma incorporada. CCO por defecto en envíos desde el CRM: {CCO_RECOMENDADO}.</p>
      <p>Los campos entre <code>{'{{llaves}}'}</code> y las instrucciones entre [corchetes] deben completarse o eliminarse antes del envío. El motor agrega la firma del usuario y registra las aperturas detectadas si están activadas.</p>
    </div>
    <div className="plantillas-correo-filtros">
      <label>Área<select value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="Todas">Todas las áreas</option>{CATEGORIAS.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
      <label>Buscar<input type="search" value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Nombre, asunto o etapa…" /></label>
      <span className="chico apagado">{visibles.length} plantillas</span>
    </div>
    {actual&&<form className="tarjeta plantillas-correo-editor" onSubmit={guardar}>
      <h2 className="h4">{actual==='nuevo'?'Nueva plantilla':'Editar plantilla'}</h2>
      <label>Nombre<input required maxLength={120} value={form.nombre}
        onChange={e=>setForm(x=>({...x,nombre:e.target.value}))}/></label>
      <label>Asunto<input maxLength={160} value={form.asunto}
        onChange={e=>setForm(x=>({...x,asunto:e.target.value}))}/></label>
      <label>Área<select value={form.categoria} onChange={e=>setForm(x=>({...x,categoria:e.target.value}))}>
        {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label>Cuándo usarla<textarea rows={2} value={form.uso} onChange={e=>setForm(x=>({...x,uso:e.target.value}))}/></label>
      <label>Etapa CRM<input value={form.etapa_crm} onChange={e=>setForm(x=>({...x,etapa_crm:e.target.value}))}/></label>
      <label>Adjunto indicado<input value={form.adjunto_sugerido} onChange={e=>setForm(x=>({...x,adjunto_sugerido:e.target.value}))}/></label>
      {form.variantes?.length>0&&<label>Variante<select value={varianteEditor} onChange={e=>setVarianteEditor(e.target.value)}>
        <option value="principal">A - breve</option>
        {form.variantes.map((v,i)=><option key={i} value={String(i)}>{v.nombre}</option>)}
      </select></label>}
      <label>Mensaje<textarea rows={12} required value={cuerpoEditor}
        onChange={e=>setForm(x=>varianteEditor==='principal'?{...x,cuerpo:e.target.value}:{
          ...x,variantes:x.variantes.map((v,i)=>i===Number(varianteEditor)?{...v,cuerpo:e.target.value}:v)
        })}/></label>
      <div className="plantillas-correo-variables">
        {VARIABLES_CORREO.map(v=><button type="button" className="boton boton-texto" key={v}
          onClick={()=>setForm(x=>varianteEditor==='principal'?{...x,cuerpo:x.cuerpo+v}:{...x,
            variantes:x.variantes.map((variante,i)=>i===Number(varianteEditor)?{...variante,cuerpo:variante.cuerpo+v}:variante)
          })}>{v}</button>)}
      </div>
      <label>Comprobar con datos de
        <select value={vista} onChange={e=>setVista(e.target.value)}>
          <option value="">Ejemplo genérico</option>
          {prospectos.map(p=><option key={p.id} value={p.id}>{p.nombre_condominio}</option>)}
        </select>
      </label>
      <div className="plantillas-correo-previa">
        <strong>{completarCorreo(form.asunto,prospecto,perfil?.nombre)||'Sin asunto'}</strong>
        <p>{completarCorreo(cuerpoEditor,prospecto,perfil?.nombre)||'Escribe para ver la vista previa.'}</p>
        {(camposPendientes.variables.length>0||camposPendientes.instrucciones.length>0)&&
          <p className="plantillas-correo-alerta">Revisar antes de enviar: {camposPendientes.variables.length>0?'variables sin completar ('+camposPendientes.variables.join(', ')+'). ':''}{camposPendientes.instrucciones.length>0?'instrucciones entre corchetes.':''}</p>}
      </div>
      <div className="fila">
        <button type="button" className="boton boton-secundario" onClick={()=>setActual(null)}>Cancelar</button>
        <button className="boton boton-primario" disabled={guardando}>{guardando?'Guardando…':'Guardar plantilla'}</button>
      </div>
    </form>}
    {plantillas===null?<p className="cargando">Cargando plantillas…</p>
      :<div className="plantillas-correo-lista">
       {categoriasVisibles.map(cat=><section key={cat} className="plantillas-correo-grupo">
         <h2 className="h4">{cat} <small>({visibles.filter(p=>(p.categoria||'Personalizadas')===cat).length})</small></h2>
         {visibles.filter(p=>(p.categoria||'Personalizadas')===cat).map(p=>
          <details key={p.id} className="tarjeta plantillas-correo-item">
            <summary><strong>{p.codigo?p.codigo+' · ':''}{p.nombre}</strong><span aria-hidden="true">⌄</span></summary>
            <div className="plantillas-correo-detalle">
              {p.sugerida&&<p className="chico apagado">Plantilla sugerida, sin correo enviado equivalente.</p>}
              {p.uso&&<p><strong>Cuándo:</strong> {p.uso}</p>}
              {p.etapa_crm&&<p><strong>Etapa CRM:</strong> {p.etapa_crm}</p>}
              {p.adjunto_sugerido&&<p><strong>Adjunto indicado:</strong> {p.adjunto_sugerido} (no adjuntado automáticamente)</p>}
              <p><strong>Asunto:</strong> {p.asunto}</p>
              <p className="plantillas-correo-cuerpo">{p.cuerpo}</p>
              {Array.isArray(p.variantes)&&p.variantes.map((v,i)=>
                <div key={i}><strong>{v.nombre}</strong><p className="plantillas-correo-cuerpo">{v.cuerpo}</p></div>)}
              <div className="fila">
                <button type="button" className="boton boton-secundario" onClick={()=>editar(p)}>Editar</button>
                <button type="button" className="boton boton-texto" onClick={()=>borrar(p)}>Eliminar</button>
              </div>
            </div>
          </details>)}
       </section>)}
       {!visibles.length&&<div className="tarjeta plantillas-correo-detalle">
        {plantillas.length?'No hay plantillas que coincidan con el filtro.':'Sin plantillas guardadas.'}
       </div>}
      </div>}
  </div>
 </div>
}
