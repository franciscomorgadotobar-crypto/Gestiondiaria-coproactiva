import {useState} from 'react';
import {normalizarSeccionVerificable,verificacionMarcada,actualizarVerificacion,resumenVerificaciones,etiquetasVerificacion} from '../lib/verificacionesDocumentales.js';
import './SeccionChecklist.css';

/**
 * Las acciones de un modelo son casillas, no texto bruto.
 * Redacción adicional siempre está disponible, pero no es necesaria para
 * registrar recepción, cumplimiento o revisión de un ítem.
 */
export default function SeccionChecklist({clave,nombre,contenido,disabled=false,onChange}){
 const [editar,setEditar]=useState(false);
 const texto=contenido?.[clave]||'';
 const {items}=normalizarSeccionVerificable(texto);
 const {total,completados}=resumenVerificaciones(contenido,clave);
 const [positivo,negativo]=etiquetasVerificacion(clave);
 return <section className="doc-check-seccion" aria-label={nombre}>
  <div className="doc-check-encabezado">
   <strong>{nombre}</strong>
   <span className="doc-check-contador">{completados} de {total} marcados</span>
  </div>
  <p className="doc-check-ayuda">Marca los elementos confirmados. Los que no marques seguirán como pendientes.</p>
  <div className="doc-check-lista">
   {items.map(item=>{
    const marcado=verificacionMarcada(contenido,clave,item.id);
    return <label className={'doc-check-item '+(marcado?'marcado':'')} key={item.id}>
     <input type="checkbox" checked={marcado} disabled={disabled}
      onChange={e=>onChange(actualizarVerificacion(contenido,clave,item.id,e.target.checked))}/>
     <span className="doc-check-textos">
      <strong>{item.titulo}</strong>
      {item.descripcion&&item.descripcion!==item.titulo&&<small>{item.descripcion}</small>}
     </span>
     <span className="doc-check-estado">{marcado?positivo:negativo}</span>
    </label>;
   })}
  </div>
  <button type="button" className="doc-check-editar" disabled={disabled}
   aria-expanded={editar} onClick={()=>setEditar(v=>!v)}>
   {editar?'Ocultar edición adicional':'Editar redacción y detalles (opcional)'}
  </button>
  {editar&&<label className="doc-check-textarea">
    Texto de {nombre.toLowerCase()}
    <textarea rows={7} maxLength={18000} disabled={disabled}
     value={texto} onChange={e=>onChange({...contenido,[clave]:e.target.value})}
     placeholder="Solo si necesitas modificar el texto original o agregar un antecedente."/>
  </label>}
 </section>;
}
