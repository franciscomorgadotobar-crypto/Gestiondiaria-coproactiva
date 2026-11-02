import {normalizarSeccionVerificable,verificacionMarcada,etiquetasVerificacion,limpiarInstruccionesDeModelo} from '../lib/verificacionesDocumentales.js';

/** Vista previa compartida por todos los tipos de documentos. */
export default function BloquesDocumento({texto='',clave='',contenido={}}){
 const {bloques,items}=normalizarSeccionVerificable(texto);
 const mostrar=Object.prototype.hasOwnProperty.call(contenido,'_verificaciones');
 const [positivo,negativo]=etiquetasVerificacion(clave);
 const estado=id=>verificacionMarcada(contenido,clave,id)?positivo:negativo;
 return <div className="doc-bloques">
  {mostrar&&items.length===1&&items[0].tipo==='seccion'&&
   <span className="doc-bloques-estado">{estado('seccion')}</span>}
  {bloques.map((b,i)=>{
   if(b.tipo==='tabla')return <div className="doc-bloques-tabla-wrap" key={i}><table className="doc-bloques-tabla">
    <thead><tr>{b.filas[0].map((valor,j)=><th key={j} scope="col">{valor}</th>)}{mostrar&&<th scope="col">Estado</th>}</tr></thead>
    <tbody>{b.filas.slice(1).map((fila,j)=><tr key={j}>
     {b.filas[0].map((_,k)=><td key={k}>{mostrar?limpiarInstruccionesDeModelo(fila[k]):fila[k]||''}</td>)}
     {mostrar&&<td className="doc-bloques-estado">{estado(b.items[j].id)}</td>}
    </tr>)}</tbody>
   </table></div>;
   if(b.tipo==='lista')return <ul className="doc-bloques-lista" key={i}>
    {b.items.map((item,j)=><li key={j}>{item.titulo}
     {mostrar&&<span className="doc-bloques-estado"> · {estado(item.id)}</span>}
    </li>)}
   </ul>;
   return <p className="doc-bloques-parrafo" key={i}>{b.texto}</p>;
  })}
 </div>;
}
