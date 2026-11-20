// Cálculo comercial de honorarios mensuales de Coproactiva (valores CLP).
// Las autorizaciones de gastos operativos pertenecen al contrato, no a la propuesta.
export const IVA_PROPUESTA = 0.19;

export function montoNoNegativo(valor) {
  if (valor == null || String(valor).trim() === '') return null;
  const s = String(valor).trim();
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  if (!/^\d+(?:\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function calcularHonorarios(datos = {}) {
  const tipoHonorarios = datos.tipoHonorarios === 'fijo' ? 'fijo' : 'porcentaje';
  const montoFijoTipo = datos.montoFijoTipo === 'bruto' ? 'bruto' : 'neto';
  const base = montoNoNegativo(datos.base);
  const pct = montoNoNegativo(datos.pct);
  let neto = null, iva = null, total = null;

  if (tipoHonorarios === 'porcentaje' && base !== null && pct !== null) {
    neto = Math.round(base * pct / 100);
  }
  if (tipoHonorarios === 'fijo') {
    const monto = montoNoNegativo(datos.montoFijo);
    if (monto !== null) {
      if (montoFijoTipo === 'bruto') {
        total = Math.round(monto);
        neto = Math.round(total / (1 + IVA_PROPUESTA));
        iva = total - neto;
      } else {
        neto = Math.round(monto);
      }
    }
  }
  if (neto !== null && total === null) {
    iva = Math.round(neto * IVA_PROPUESTA);
    total = neto + iva;
  }
  return { tipoHonorarios, montoFijoTipo, base, pct, neto, iva, total };
}
