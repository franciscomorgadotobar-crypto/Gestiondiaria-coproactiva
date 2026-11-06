/** Adaptador de Compromisos al motor común; PostgreSQL sigue siendo autoritativo. */
import {limitarAvance,resumenAvances} from './motorAvances.js';

export const porcentajeSubtareas=items=>resumenAvances(items,{
 completado:x=>Boolean(x.completada),
 avance:x=>Math.min(99,limitarAvance(x.avance))
}).porcentaje;

export function resumenGlobalCompromisos(items=[]){
 const total=items.length;
 const completados=items.filter(x=>x.estado==='completado').length;
 const abiertos=total-completados;
 // El global muestra el avance persistido, incluidas fichas históricas.
 const porcentaje=resumenAvances(items,{completado:()=>false,avance:x=>x.avance}).porcentaje;
 return {total,completados,abiertos,porcentaje};
}
