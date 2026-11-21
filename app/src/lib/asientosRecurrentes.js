// Reutilización manual: no crea asientos ni movimientos contables.
export function borradorDesdeAsientoRecurrente(asiento, cuentas=[], centros=[]) {
  if (!asiento || !asiento.recurrente || asiento.estado !== 'contabilizado') return null;
  const disponibles = new Set(cuentas.filter(c=>c.activa && c.imputable!==false).map(c=>c.id));
  const centrosActivos = new Set(centros.filter(c=>c.activa).map(c=>c.id));
  const lineas = (asiento.contabilidad_asiento_lineas||[]).map(x=>({
    cuenta_id: disponibles.has(x.cuenta_id) ? x.cuenta_id : '',
    debe: Number(x.debe)>0 ? String(x.debe) : '',
    haber: Number(x.haber)>0 ? String(x.haber) : '',
    glosa: x.glosa||'',
    centro_costo_id: centrosActivos.has(x.centro_costo_id) ? x.centro_costo_id : ''
  }));
  return {
    glosa:asiento.glosa||'',
    proveedor_id:asiento.proveedor_id||'',
    recurrente:true,
    lineas
  };
}
