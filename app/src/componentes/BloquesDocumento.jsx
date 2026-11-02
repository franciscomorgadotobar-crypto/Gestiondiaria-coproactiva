import {analizarBloquesDocumento} from '../lib/bloquesDocumento.js';
export {analizarBloquesDocumento} from '../lib/bloquesDocumento.js';
export default function BloquesDocumento({texto=''}){
 return <div className="doc-bloques">
  {analizarBloquesDocumento(texto).map((b,i)=>{
   if(b.tipo==='tabla')return <div className="doc-bloques-tabla-wrap" key={i}><table className="doc-bloques-tabla">
    <thead><tr>{b.filas[0].map((valor,j)=><th key={j} scope="col">{valor}</th>)}</tr></thead>
    <tbody>{b.filas.slice(1).map((fila,j)=><tr key={j}>{b.filas[0].map((_,k)=><td key={k}>{fila[k]||''}</td>)}</tr>)}</tbody>
   </table></div>;
   if(b.tipo==='lista')return <ul className="doc-bloques-lista" key={i}>{b.items.map((item,j)=><li key={j}>{item}</li>)}</ul>;
   return <p className="doc-bloques-parrafo" key={i}>{b.texto}</p>;
  })}
 </div>;
}
