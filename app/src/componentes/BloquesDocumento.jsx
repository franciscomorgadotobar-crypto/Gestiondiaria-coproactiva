// Un mismo contenido editable puede incluir párrafos, listas y tablas sencillas.
// La edición se mantiene en texto para poder cambiar filas y columnas sin
// requerir un editor HTML, que es difícil de usar desde el teléfono.
export function analizarBloquesDocumento(valor=''){
 const lineas=String(valor||'').split(/\r?\n/);
 const bloques=[];
 let i=0;
 while(i<lineas.length){
  const linea=lineas[i].trim();
  if(!linea){i++;continue;}
  if(linea.includes('|')&&lineas[i+1]?.includes('|')){
   const filas=[];
   while(i<lineas.length&&lineas[i].includes('|')){
    filas.push(lineas[i].split('|').map(c=>c.trim()));
    i++;
   }
   if(filas.length>1){bloques.push({tipo:'tabla',filas});continue;}
   bloques.push({tipo:'parrafo',texto:filas[0].join(' | ')});continue;
  }
  if(/^([-•–]|\d+[.)])\s/.test(linea)){
   const items=[];
   while(i<lineas.length&&/^([-•–]|\d+[.)])\s/.test(lineas[i].trim())){
    items.push(lineas[i].trim().replace(/^([-•–]|\d+[.)])\s/,''));
    i++;
   }
   bloques.push({tipo:'lista',items});continue;
  }
  const parrafo=[];
  while(i<lineas.length&&lineas[i].trim()&&!lineas[i].includes('|')&&!/^([-•–]|\d+[.)])\s/.test(lineas[i].trim())){parrafo.push(lineas[i].trim());i++;}
  if(parrafo.length)bloques.push({tipo:'parrafo',texto:parrafo.join(' ')});
  else{bloques.push({tipo:'parrafo',texto:lineas[i].trim()});i++;}
 }
 return bloques;
}
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
