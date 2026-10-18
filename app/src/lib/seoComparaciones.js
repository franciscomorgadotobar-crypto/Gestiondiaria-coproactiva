/** Comparaciones ejecutivas basadas solo en datos numéricos verificables.
 * CTR: puntos porcentuales. Posición: posiciones (menor es mejor).
 * Conteos: variación relativa; si la base previa era 0 no hay % calculable.
 */
export function compararIndicador(actual, anterior, tipo='relativo') {
  if (actual == null || anterior == null || actual === '' || anterior === '') return null;
  const a=Number(actual), b=Number(anterior);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a<0 || b<0) return null;
  if (tipo === 'posicion' && (a === 0 || b === 0)) return null;
  if (tipo === 'relativo' && b === 0 && a !== 0) return null;

  const diferencia = tipo === 'relativo'
    ? (b === 0 ? 0 : (a-b)*100/b)
    : tipo === 'puntos' ? (a-b)*100 : a-b;
  if (!Number.isFinite(diferencia)) return null;
  const delta = Math.abs(diferencia) < 0.05 ? 0 : diferencia;
  const etiqueta = (delta>0?'+':'') +
    delta.toLocaleString('es-CL',{maximumFractionDigits:1,minimumFractionDigits:1}) +
    (tipo==='relativo'?'%':tipo==='puntos'?' pp':' posiciones');
  const favorable = delta===0?'neutro'
    : (tipo==='posicion'?delta<0:delta>0)?'sube':'baja';
  const flecha = delta<0?'↘':delta>0?'↗':'→';
  return {etiqueta, favorable, flecha};
}
