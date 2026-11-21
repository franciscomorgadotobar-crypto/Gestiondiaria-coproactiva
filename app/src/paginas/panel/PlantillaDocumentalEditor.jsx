import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import PropuestaDoc from '../../componentes/PropuestaDocumento';
import '../../lib/propuestaDocPage';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO} from '../../lib/plantillasDocumentales';
import {CAMPOS_PROPUESTA_PLANTILLA,modeloEditable,contenidoEditable,filas,interpolar} from '../../lib/plantillasDocumentalesEditables';
import './PlantillaDocumentalEditor.css';

export default function PlantillaDocumentalEditor(){
 const {tipo}=useParams();
 const navegar=useNavigate();
 const plantilla=TIPOS_DOCUMENTO.find(t=>t.id===tipo);
 const campos=tipo==='propuesta_comercial'?CAMPOS_PROPUESTA_PLANTILLA:(CAMPOS_POR_TIPO[tipo]||[]);
 const [contenido,setContenido]=useState(()=>modeloEditable(tipo));
 const [busqueda,setBusqueda]=useState('');
 const [mostrarVista,setMostrarVista]=useState(false);
 const [version,setVersion]=useState(null);
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [aviso,setAviso]=useState('');
 const [error,setError]=useState('');
 const [inicial,setInicial]=useState(()=>modeloEditable(tipo));
 useEffect(()=>{
  if(!plantilla){setCargando(false);return;}
  let vivo=true;
  setCargando(true);setError('');
  supabase.from('plantillas_documentales_app').select('contenido,version')
   .eq('tipo',tipo).maybeSingle().then(({data,error:err})=>{
    if(!vivo)return;
    if(err)setError('No se pudo cargar la plantilla: '+err.message);
    else{
     const plantillaActual=contenidoEditable(tipo,data?.contenido);
     setContenido(plantillaActual);setInicial(plantillaActual);
     setVersion(data?.version??null);
    }
    setCargando(false);
   });
  return()=>{vivo=false;};
 },[tipo]);
 const cambiado=useMemo(()=>JSON.stringify(contenido)!==JSON.stringify(inicial),[contenido,inicial]);
 const camposAgrupados=useMemo(()=>{
  const texto=busqueda.trim().toLocaleLowerCase('es');
  const visibles=campos.filter(([clave,nombre,grupo])=>clave!=='saludo' &&
    (!texto||[clave,nombre,grupo||'Contenido',contenido[clave]].some(x=>String(x||'').toLocaleLowerCase('es').includes(texto))));
  const grupos=[...new Set(visibles.map(([, ,grupo])=>grupo||'Contenido'))];
  return grupos.map(grupo=>({grupo,campos:visibles.filter(([, ,g])=>(g||'Contenido')===grupo)}));
 },[campos,busqueda,contenido]);
 async function guardar(){
  if(guardando||cargando||!plantilla)return;
  const limpio=Object.fromEntries(campos.map(([key])=>[key,String(contenido[key]||'').trim()]));
  if(tipo==='propuesta_comercial'&&!limpio.portadaTitulo){setError('Indica un título para la portada.');return;}
  if(Object.values(limpio).join('').length>100000){setError('La plantilla excede el límite de texto permitido.');return;}
  if(tipo==='propuesta_comercial'){
   for(const [campo,columnas] of [['enfoques',2],['areas',2],['plan',2],['entregables',2],['sla',4]]){
    const lineas=limpio[campo].split(/\r?\n/).filter(x=>x.trim());
    if(lineas.length&&filas(limpio[campo],columnas).length!==lineas.length){
     setError('Revisa la tabla "'+campo+'": cada línea debe tener '+columnas+' columnas separadas por |.');return;
    }
   }
  }
  setGuardando(true);setError('');setAviso('');
  const {data,error:err}=await supabase.rpc('guardar_plantilla_documental_app',{
   p_tipo:tipo,p_contenido:limpio,p_version_esperada:version
  });
  if(err)setError('No se pudo guardar la plantilla: '+err.message);
  else{
   const modelo=contenidoEditable(tipo,data.contenido);
   setContenido(modelo);setInicial(modelo);setVersion(data.version);
   setAviso('Plantilla guardada. Los próximos documentos utilizarán esta versión. Los documentos anteriores no se modifican.');
  }
  setGuardando(false);
 }
 function restaurar(){
  if(!window.confirm('¿Restaurar el texto original de esta plantilla? Tendrás que guardar para aplicar los cambios.'))return;
  setContenido(modeloEditable(tipo));setAviso('');
 }
 if(!plantilla)return <main className="plantilla-documental-editor"><Link to="/documentos">← Gestor documental</Link><p>Plantilla no reconocida.</p></main>;
 return <main className="plantilla-documental-editor">
  <header className="plantilla-documental-editor-cabecera">
   <div><Link to="/documentos">← Gestor documental</Link>
    <h1>Editar plantilla · {plantilla.titulo}</h1>
    <p>Define el texto base para futuros documentos. No cambia documentos ya guardados ni sus versiones.</p>
   </div>
   <div className="plantilla-documental-editor-acciones">
    {tipo==='propuesta_comercial'&&<button type="button" className="boton boton-secundario"
      onClick={()=>setMostrarVista(prev=>!prev)} disabled={cargando}>
      {mostrarVista?'Ocultar vista previa':'Vista previa completa'}
    </button>}
    <button type="button" className="boton boton-secundario" onClick={restaurar} disabled={cargando||guardando}>Restaurar original</button>
    <button type="button" className="boton" onClick={guardar} disabled={cargando||guardando||!cambiado}>
     {guardando?'Guardando…':version?'Guardar nueva versión':'Guardar plantilla'}
    </button>
   </div>
  </header>
  {error&&<p role="alert" className="aviso aviso-critico">{error}</p>}
  {aviso&&<p role="status" className="aviso aviso-ok">{aviso}</p>}
  {cargando?<p>Cargando plantilla…</p>:<div className="plantilla-documental-editor-contenido">
   <div className="plantilla-documental-editor-info">
    <strong>{version?'Versión '+version:'Modelo original'}</strong>
    <span>{cambiado?'Cambios sin guardar':'Sin cambios pendientes'}</span>
   </div>
   {tipo==='propuesta_comercial'&&<div className="plantilla-documental-editor-saludo">
    <label className="plantilla-documental-editor-campo">
     <strong>Saludo del documento <small>(puedes cambiarlo libremente)</small></strong>
     <textarea rows={2} value={contenido.saludo??''}
       onChange={e=>setContenido(prev=>({...prev,saludo:e.target.value}))}/>
    </label>
    <p><strong>Ejemplo con un destinatario:</strong> {interpolar(contenido.saludo,{destinatario:'Paulina Silva'})}</p>
    <small>Usa el marcador <code>{'{{destinatario}}'}</code> para insertar el contacto o comité seleccionado en la propuesta.</small>
   </div>}
   <label className="plantilla-documental-editor-buscar">
    Buscar un texto, título o sección para editar
    <input type="search" placeholder="Por ejemplo: presentación, honorarios, saludo, pie de página…" value={busqueda}
     onChange={e=>setBusqueda(e.target.value)} />
   </label>
   <div className="plantilla-documental-editor-grupos">
    {camposAgrupados.length===0&&<p>No se encontraron campos con esa búsqueda.</p>}
    {camposAgrupados.map(({grupo,campos:items})=><details className="plantilla-documental-editor-grupo"
      key={grupo+(busqueda?'buscando':'')}
      defaultOpen={grupo==='Presentación'||Boolean(busqueda)}>
      <summary>{grupo} <span>{items.length} campos editables</span></summary>
      <div className="plantilla-documental-editor-grupo-campos">
       {items.map(([key,nombre])=><label key={key} className="plantilla-documental-editor-campo">
        <strong>{nombre}</strong>
        <textarea rows={['presentacion','condiciones','areas','enfoques','plan','sla'].includes(key)?6:Math.min(11,Math.max(2,contenido[key]?.split('\n').length+1||2))}
         value={contenido[key]??''} onChange={e=>setContenido(prev=>({...prev,[key]:e.target.value}))} />
       </label>)}
      </div>
    </details>)}
   </div>
   <div className="plantilla-documental-editor-pie">
    <span>Los marcadores entre llaves se completan automáticamente al generar la propuesta, cuando corresponda.</span>
    <Link to={tipo==='propuesta_comercial'?'/propuestas':'/documentos/nuevo?tipo='+tipo}>Crear documento con esta plantilla</Link>
   </div>
  </div>}
  {!cargando&&mostrarVista&&tipo==='propuesta_comercial'&&
    <section className="plantilla-documental-editor-preview" aria-label="Vista previa de propuesta comercial">
     <h2>Vista previa de la plantilla</h2>
     <p>Ejemplo de datos para comprobar formato y redacción. No es una propuesta real ni se guarda como documento.</p>
     <PropuestaDoc
      d={{comunidad:'Comunidad de ejemplo',direccion:'Dirección de ejemplo',comuna:'Santiago',
        destinatario:'Nombre del contacto',vigencia:'30',diasPago:'5',mesesContrato:'12',
        email:'contacto@coproactiva.cl',firmante:'',cargo:''}}
      calc={{fechaTexto:'20 de noviembre de 2026',tipoHonorarios:'fijo',neto:'$450.000',iva:'$85.500',total:'$535.500'}}
      opts={{portada:true,numeros:true,honorarios:true}} plantillaContenido={contenido}/>
    </section>}
 </main>;
}
