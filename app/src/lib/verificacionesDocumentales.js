/**
 * Estados checklist reutilizables en TODAS las familias documentales.
 *
 * Los textos de plantilla permanecen intactos para permitir una redacción
 * complementaria opcional. Las marcas viven en contenido._verificaciones,
 * el mismo JSON versionado por documentos_gestion/documentos_versiones.
 */
import {analizarBloquesDocumento} from './bloquesDocumento.js';

export const ETIQUETAS_VERIFICACION=Object.freeze({
 antecedentes:['Recibido','Pendiente de recepción'],
 pendientes:['Recibido','Pendiente de recepción'],
 documentacion:['Recibido','Pendiente de recepción'],
 gestiones:['Realizada','Pendiente'],
 entregables:['Entregado','Pendiente'],
 resultados:['Verificado','Por verificar'],
 compromisos:['Cumplido','Pendiente'],
 coordinaciones:['Coordinado','Pendiente'],
 hitos:['Completado','Pendiente'],
 proximos_pasos:['Realizado','Pendiente'],
 observaciones:['Revisado','Por revisar'],
 responsables:['Confirmado','Por confirmar'],
 resumen:['Revisado','Por revisar']
});
export function etiquetasVerificacion(clave){
 return ETIQUETAS_VERIFICACION[clave]||['Verificado','Por verificar'];
}
export function normalizarSeccionVerificable(texto){
 const bloques=analizarBloquesDocumento(texto||'');
 let indice=0;
 const items=[];
 const analizados=bloques.map(b=>{
  if(b.tipo==='tabla'){
   const filas=b.filas.slice(1).map(fila=>{
    const id=String(indice++);
    const descripcion=fila.join(' · ');
    const titulo=(/^\d+$/.test(fila[0])?fila[1]:fila[0])||descripcion;
    const item={id,titulo,descripcion,tipo:'tabla',fila};
    items.push(item);
    return item;
   });
   return {...b,items:filas};
  }
  if(b.tipo==='lista'){
   const valores=b.items.map(titulo=>{
    const item={id:String(indice++),titulo,descripcion:'',tipo:'lista'};
    items.push(item);
    return item;
   });
   return {...b,items:valores};
  }
  return b;
 });
 if(!items.length&&String(texto||'').trim()){
  items.push({id:'seccion',titulo:'Confirmar el contenido de esta sección',descripcion:'',tipo:'seccion'});
 }
 return {bloques:analizados,items};
}
export function verificacionMarcada(contenido,clave,id){
 return contenido?._verificaciones?.[clave]?.[id]===true;
}
export function actualizarVerificacion(contenido,clave,id,marcada){
 return {...contenido,_verificaciones:{
  ...(contenido?._verificaciones||{}),
  [clave]:{...(contenido?._verificaciones?.[clave]||{}),[id]:Boolean(marcada)}
 }};
}
export function resumenVerificaciones(contenido,clave){
 const items=normalizarSeccionVerificable(contenido?.[clave]||'').items;
 return {total:items.length,completados:items.filter(x=>verificacionMarcada(contenido,clave,x.id)).length};
}
