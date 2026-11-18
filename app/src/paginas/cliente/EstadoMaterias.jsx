import {Fragment,useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {descargarDeDrive,sePuedeVer,verEnDrive} from '../../lib/drive';
import './EstadoMaterias.css';

export const ESTADOS_MATERIAS={
  completado:{nombre:'Completado',ayuda:'terminado'},
  en_curso:{nombre:'En curso',ayuda:'en trámite o a la espera de respuesta'},
  pendiente:{nombre:'Pendiente',ayuda:'por iniciar'}
};
const VACIO={materia:'',avance:'pendiente',estado_detalle:'',a_cargo_de:''};
const fechaChile=()=>new Intl.DateTimeFormat('sv-SE',{
  timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const fechaInforme=fecha=>fecha?new Intl.DateTimeFormat('es-CL',{
  timeZone:'UTC',day:'numeric',month:'long',year:'numeric'
}).format(new Date(fecha+'T12:00:00Z')):'';

function EtiquetaAvance({valor}){
  const estado=ESTADOS_MATERIAS[valor]||ESTADOS_MATERIAS.pendiente;
  return <span className={'estado-materias__estado estado-materias__estado--'+valor}>
    <span className="estado-materias__punto" aria-hidden="true"/>{estado.nombre}
  </span>;
}

function FormularioMateria({form,cambiar,guardar,cancelar,guardando,nuevo}){
  return <form className="estado-materias__editor" onSubmit={guardar} aria-label={nuevo?'Nueva materia':'Editar materia'}>
    <div className="estado-materias__editor-titulo">{nuevo?'Nueva materia':'Editar materia'}</div>
    <div className="estado-materias__campos">
      <label>Materia
        <input required maxLength={180} value={form.materia}
          onChange={e=>cambiar(v=>({...v,materia:e.target.value}))}/>
      </label>
      <label>Avance
        <select value={form.avance} onChange={e=>cambiar(v=>({...v,avance:e.target.value}))}>
          {Object.entries(ESTADOS_MATERIAS).map(([valor,v])=>
            <option key={valor} value={valor}>{v.nombre}</option>)}
        </select>
      </label>
      <label className="estado-materias__campo-detalle">Estado (descripción de la gestión)
        <textarea rows={3} value={form.estado_detalle}
          onChange={e=>cambiar(v=>({...v,estado_detalle:e.target.value}))}
          placeholder="Situación actual, acuerdos o respuesta pendiente"/>
      </label>
      <label>A cargo de
        <input list="estado-materias-responsables" maxLength={160} value={form.a_cargo_de}
          onChange={e=>cambiar(v=>({...v,a_cargo_de:e.target.value}))}
          placeholder="Coproactiva, inmobiliaria u otro"/>
      </label>
    </div>
    <div className="estado-materias__editor-acciones">
      <button type="submit" className="boton boton-primario" disabled={guardando}>
        {guardando?'Guardando…':'Guardar cambios'}
      </button>
      <button type="button" className="boton boton-secundario" onClick={cancelar} disabled={guardando}>
        Cancelar
      </button>
    </div>
  </form>;
}


/* Una materia puede tener varios respaldos existentes en Drive. El vínculo no
 * mueve, copia ni elimina el archivo, y la API aplica permisos por comunidad. */
function DocumentosMateria({comunidadId,materia,documentos,disponibles,administrador,onVincular,onDesvincular}){
  const [seleccion,setSeleccion]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [error,setError]=useState('');
  const candidatos=disponibles.filter(d=>!documentos.some(v=>v.id===d.id));
  if(!administrador&&!documentos.length)return null;

  async function ejecutar(accion){
    if(ocupado)return;
    setError('');setOcupado(true);
    try{await accion();}
    catch(e){setError(e?.message||'No se pudo completar la acción con el documento.');}
    finally{setOcupado(false);}
  }

  return <section className="estado-materias__documentos" aria-label={'Respaldos de '+materia.materia}>
    <strong className="estado-materias__documentos-titulo">
      Adjuntos {documentos.length>0&&<span>({documentos.length})</span>}
    </strong>
    {documentos.map(doc=><div className="estado-materias__documento" key={doc.id}>
      <span className="estado-materias__documento-nombre">{doc.nombre}</span>
      {administrador&&!doc.visible_cliente&&<small className="estado-materias__documento-privado">No visible al cliente</small>}
      <div className="estado-materias__documento-acciones">
        {sePuedeVer(doc.mime)&&<button type="button" disabled={ocupado}
          onClick={()=>ejecutar(()=>verEnDrive(comunidadId,doc))}>Ver</button>}
        <button type="button" disabled={ocupado}
          onClick={()=>ejecutar(()=>descargarDeDrive(comunidadId,doc))}>Descargar</button>
        {administrador&&<button type="button" disabled={ocupado}
          onClick={()=>ejecutar(()=>onDesvincular(materia.id,doc.id))}>Desvincular</button>}
      </div>
    </div>)}
    {administrador&&<div className="estado-materias__vinculacion">
      {candidatos.length>0?<><label>
        Asociar archivo existente
        <select value={seleccion} disabled={ocupado}
          onChange={e=>setSeleccion(e.target.value)}>
          <option value="">Selecciona un documento de Drive</option>
          {candidatos.map(doc=><option key={doc.id} value={doc.id}>{doc.nombre}</option>)}
        </select>
      </label>
      <button className="boton boton-secundario" type="button" disabled={!seleccion||ocupado}
        onClick={()=>ejecutar(async()=>{await onVincular(materia.id,seleccion);setSeleccion('');})}>
        {ocupado?'Procesando…':'Vincular'}
      </button></>:<span className="micro apagado">No hay otros documentos disponibles en Drive.</span>}
    </div>}
    {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
  </section>;
}

/**
 * Estado de avance por materia, reproduciendo el formato del informe de Santa Clara.
 * Las gestiones contractuales anteriores se mantienen en su tabla original.
 */
export default function EstadoMaterias({comunidadId,nombreComunidad='',administrador=false,soloLecturaCliente=false}){
  const [materias,setMaterias]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const [editando,setEditando]=useState(null);
  const [form,setForm]=useState(VACIO);
  const [guardando,setGuardando]=useState(false);
  const [documentosPorMateria,setDocumentosPorMateria]=useState({});
  const [documentosDisponibles,setDocumentosDisponibles]=useState([]);

  async function cargarDocumentos(listaMaterias){
    const ids=listaMaterias.map(x=>x.id);
    if(!ids.length){setDocumentosPorMateria({});setDocumentosDisponibles([]);return;}
    try{
      const [archivos,vinculos]=await Promise.all([
        supabase.rpc('drive_listar_documentos',{
          p_comunidad_id:comunidadId,p_origen_tipo:null,p_origen_id:null,p_incluir_eliminados:false
        }),
        supabase.from('estado_materia_documentos').select('materia_id,documento_id').in('materia_id',ids)
      ]);
      if(archivos.error)throw archivos.error;
      if(vinculos.error)throw vinculos.error;
      const docs=(archivos.data||[]).filter(d=>!d.eliminado_en&&(!soloLecturaCliente||d.visible_cliente===true));
      const indice=new Map(docs.map(d=>[d.id,d]));
      const porMateria={};
      for(const relacion of vinculos.data||[]){
        const doc=indice.get(relacion.documento_id);
        if(!doc)continue;
        (porMateria[relacion.materia_id]??=[]).push(doc);
      }
      setDocumentosDisponibles(docs);
      setDocumentosPorMateria(porMateria);
    }catch(e){
      setError('No se pudieron cargar los documentos vinculados: '+(e?.message||'Error desconocido'));
    }
  }

  async function vincularDocumento(materiaId,documentoId){
    if(!administrador)throw new Error('Esta vista es de solo lectura.');
    const {error:err}=await supabase.from('estado_materia_documentos')
      .insert({materia_id:materiaId,documento_id:documentoId});
    if(err)throw err;
    await cargarDocumentos(materias);
  }

  async function desvincularDocumento(materiaId,documentoId){
    if(!administrador)throw new Error('Esta vista es de solo lectura.');
    if(!window.confirm('¿Desvincular el archivo de esta materia? El documento se conserva en Google Drive.'))return;
    const {error:err}=await supabase.from('estado_materia_documentos').delete()
      .eq('materia_id',materiaId).eq('documento_id',documentoId);
    if(err)throw err;
    await cargarDocumentos(materias);
  }

  async function cargar(){
    if(!comunidadId)return;
    setCargando(true);
    // Clientes y vista previa consultan únicamente materias publicadas.
    // Supabase aplica además la RLS por comunidad y cuenta autorizada.
    let consulta=supabase.from('estado_avance_materias')
      .select('id,comunidad_id,orden,materia,avance,estado_detalle,a_cargo_de,fecha_informe,actualizado_en')
      .eq('comunidad_id',comunidadId);
    if(soloLecturaCliente)consulta=consulta.eq('publicado',true);
    const {data,error:err}=await consulta
      .order('orden',{ascending:true})
      .order('creado_en',{ascending:true});
    if(err)setError('No fue posible cargar el estado por materia: '+err.message);
    else{setMaterias(data||[]);setError('');await cargarDocumentos(data||[]);}
    setCargando(false);
  }
  useEffect(()=>{setEditando(null);cargar();},[comunidadId,soloLecturaCliente]);

  function abrir(item){
    if(!administrador)return;
    setError('');
    setForm(item?{
      materia:item.materia,avance:item.avance,estado_detalle:item.estado_detalle||'',
      a_cargo_de:item.a_cargo_de||''
    }:{...VACIO});
    setEditando(item?.id||'nuevo');
  }
  function cancelar(){setEditando(null);setForm({...VACIO});setError('');}
  async function guardar(e){
    e.preventDefault();
    if(!administrador||guardando)return;
    const materia=form.materia.trim();
    if(!materia){setError('La materia es obligatoria.');return;}
    const cambios={
      materia,avance:form.avance,estado_detalle:form.estado_detalle.trim(),
      a_cargo_de:form.a_cargo_de.trim(),fecha_informe:fechaChile()
    };
    setGuardando(true);setError('');
    try{
      const consulta=editando==='nuevo'
        ?supabase.from('estado_avance_materias').insert({
          ...cambios,comunidad_id:comunidadId,
          orden:Math.max(0,...materias.map(x=>Number(x.orden)||0))+1
        })
        :supabase.from('estado_avance_materias').update(cambios)
          .eq('id',editando).eq('comunidad_id',comunidadId);
      const {data,error:err}=await consulta.select('id').single();
      if(err)throw err;
      if(!data?.id)throw new Error('No se confirmó el guardado de la materia.');
      setEditando(null);setForm({...VACIO});
      await cargar();
    }catch(err){setError('No se pudo guardar la materia: '+(err.message||'Error desconocido'));}
    finally{setGuardando(false);}
  }

  const fecha= materias.map(x=>x.fecha_informe).filter(Boolean).sort().at(-1);
  const titulo='Estado de avances y compromisos - '+(nombreComunidad||'Comunidad');
  const editarProps={form,cambiar:setForm,guardar,cancelar,guardando};
  const documentoProps={comunidadId,disponibles:documentosDisponibles,administrador,
    onVincular:vincularDocumento,onDesvincular:desvincularDocumento};
  return <section className="estado-materias" aria-label="Estado de avances y compromisos">
    <header className="estado-materias__cabecera">
      <div className="estado-materias__identificacion">
        <p className="estado-materias__antetitulo">Seguimiento de la comunidad</p>
        <h2>{titulo}</h2>
        {fecha&&<p className="estado-materias__fecha">Al {fechaInforme(fecha)}.</p>}
      </div>
      {administrador&&<button type="button" className="boton boton-secundario estado-materias__nuevo"
        onClick={()=>abrir(null)}>+ Nueva materia</button>}
    </header>
    <h3 className="estado-materias__subtitulo"><span>01</span> Estado por materia</h3>
    {error&&<div className="aviso aviso-critico" role="alert">{error}</div>}
    <datalist id="estado-materias-responsables">
      <option value="Coproactiva"/><option value="Inmobiliaria"/><option value="Ambas partes"/>
    </datalist>
    {editando==='nuevo'&&<FormularioMateria {...editarProps} nuevo/>}
    {cargando?<p className="cargando">Cargando materias…</p>
    :!materias.length?<div className="estado-materias__vacio">
      No hay materias registradas para esta comunidad.
      {administrador&&' Puedes comenzar con “Nueva materia”.'}
    </div>
    :<>
      <div className="estado-materias__tabla-contenedor">
        <table className="estado-materias__tabla">
          <caption>Estado por materia de {nombreComunidad||'la comunidad'}</caption>
          <thead><tr>
            <th scope="col">Materia</th><th scope="col">Avance</th>
            <th scope="col">Estado</th><th scope="col">A cargo de</th>
          </tr></thead>
          <tbody>{materias.map(item=><Fragment key={item.id}>
            <tr key={item.id} className="estado-materias__fila">
              <td>{administrador
                ?<button type="button" className="estado-materias__materia" onClick={()=>abrir(item)}
                    aria-label={'Editar materia: '+item.materia}>
                  {item.materia}<span className="estado-materias__lapiz" aria-hidden="true">✎</span>
                </button>
                :<span>{item.materia}</span>}</td>
              <td><EtiquetaAvance valor={item.avance}/></td>
              <td className="estado-materias__detalle">
                <div>{item.estado_detalle||'Sin información'}</div>
                <DocumentosMateria {...documentoProps} materia={item}
                  documentos={documentosPorMateria[item.id]||[]}/>
              </td>
              <td>{item.a_cargo_de||'Sin información'}</td>
            </tr>
            {editando===item.id&&<tr key={'editar-'+item.id} className="estado-materias__edicion-fila">
              <td colSpan={4}><FormularioMateria {...editarProps}/></td>
            </tr>}
          </Fragment>)}</tbody>
        </table>
      </div>
      <div className="estado-materias__movil">
        {materias.map(item=><div className="estado-materias__movil-tarjeta" key={item.id}>
          <div className="estado-materias__movil-cabecera">
            <div className="estado-materias__movil-materia">
              {administrador?<button type="button" className="estado-materias__materia"
                aria-label={'Editar materia: '+item.materia} onClick={()=>abrir(item)}>
                  {item.materia}<span className="estado-materias__lapiz" aria-hidden="true">✎</span>
                </button>:<strong>{item.materia}</strong>}
            </div>
            <EtiquetaAvance valor={item.avance}/>
          </div>
          <p className="estado-materias__movil-estado">{item.estado_detalle||'Sin información'}</p>
          <DocumentosMateria {...documentoProps} materia={item}
            documentos={documentosPorMateria[item.id]||[]}/>
          <p className="estado-materias__movil-responsable"><strong>A cargo de:</strong> {item.a_cargo_de||'Sin información'}</p>
          {editando===item.id&&<FormularioMateria {...editarProps}/>}
        </div>)}
      </div>
    </>}
    <div className="estado-materias__leyenda" aria-label="Definiciones de los estados">
      {Object.entries(ESTADOS_MATERIAS).map(([clave,valor])=>
        <span key={clave}><EtiquetaAvance valor={clave}/>: {valor.ayuda}</span>)}
    </div>
    <footer className="estado-materias__pie">
      <span>Coproactiva Administración SpA</span>
      <span>{nombreComunidad||'Comunidad'} · Avances y compromisos</span>
    </footer>
  </section>;
}
