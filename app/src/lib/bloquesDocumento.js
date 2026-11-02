// Analizador puro para exportación PDF y vista HTML coherente.
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
  if(/^([-•\u2013]|\d+[.)])\s/.test(linea)){
   const items=[];
   while(i<lineas.length&&/^([-•\u2013]|\d+[.)])\s/.test(lineas[i].trim())){
    items.push(lineas[i].trim().replace(/^([-•\u2013]|\d+[.)])\s/,''));
    i++;
   }
   bloques.push({tipo:'lista',items});continue;
  }
  const parrafo=[];
  while(i<lineas.length&&lineas[i].trim()&&!lineas[i].includes('|')&&!/^([-•\u2013]|\d+[.)])\s/.test(lineas[i].trim())){parrafo.push(lineas[i].trim());i++;}
  if(parrafo.length)bloques.push({tipo:'parrafo',texto:parrafo.join(' ')});
  else{bloques.push({tipo:'parrafo',texto:lineas[i].trim()});i++;}
 }
 return bloques;
}
