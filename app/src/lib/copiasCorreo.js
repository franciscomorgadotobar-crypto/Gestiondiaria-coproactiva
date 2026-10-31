/** Analiza entradas opcionales CC/CCO (separadas por coma, punto y coma o línea). */
const REGEX=/^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;
export function analizarCorreosCopia(texto,etiqueta='CC'){
  const datos=String(texto??'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
  const invalidos=datos.filter(x=>x.length>254||!REGEX.test(x));
  const lista=[...new Set(datos.filter(x=>REGEX.test(x)).map(x=>x.toLowerCase()))];
  const error=invalidos.length?etiqueta+': revisa las direcciones inválidas.':lista.length>10
    ?etiqueta+': máximo 10 correos.':'';
  return {lista,error};
}
export function prepararCopias(cc,cco){
  const paraCC=analizarCorreosCopia(cc,'CC');
  const paraCCO=analizarCorreosCopia(cco,'CCO');
  return {cc:paraCC.lista,cco:paraCCO.lista,
    errores:[paraCC.error,paraCCO.error].filter(Boolean)};
}
