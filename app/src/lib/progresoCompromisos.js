/** Cálculos de presentación. La fuente autoritativa es el trigger de PostgreSQL. */
export const porcentajeSubtareas=items=>items.length?
 Math.round(items.reduce((s,x)=>s+(x.completada?100:Math.min(99,Math.max(0,Number(x.avance)||0))),0)/items.length):0;
export function resumenGlobalCompromisos(items=[]){
 const total=items.length;
 const completados=items.filter(x=>x.estado==='completado').length;
 const abiertos=total-completados;
 const porcentaje=total?Math.round(items.reduce((s,x)=>
  s+Math.min(100,Math.max(0,Number(x.avance)||0)),0)/total):0;
 return {total,completados,abiertos,porcentaje};
}
