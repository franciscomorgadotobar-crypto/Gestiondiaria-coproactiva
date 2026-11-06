/**
 * Motor de avances compartido: levantamientos y compromisos.
 *
 * Los adaptadores del dominio indican qué significa "completado": respuesta
 * con evidencia válida en Levantamientos o porcentaje/check en Compromisos.
 * La persistencia permanece en su tabla/trigger original.
 */
export const limitarAvance = valor => Math.min(100, Math.max(0, Number(valor) || 0));

export function ordenarAvances(items = [], campo = 'orden') {
  return items.map((item, indice) => ({ item, indice }))
    .sort((a, b) => (Number(a.item?.[campo]) || 0) - (Number(b.item?.[campo]) || 0)
      || a.indice - b.indice)
    .map(({ item }) => item);
}

export function resumenAvances(items = [], { completado = x => Boolean(x?.completada), avance = x => x?.avance } = {}) {
  const total = items.length;
  const terminados = items.filter(completado).length;
  const porcentaje = total ? Math.round(items.reduce((suma, item) =>
    suma + limitarAvance(completado(item) ? 100 : avance(item)), 0) / total) : 0;
  return { total, completados: terminados, pendientes: total - terminados, porcentaje };
}

export function primerPendienteAvances(items = [], completado = x => Boolean(x?.completada)) {
  return items.findIndex(item => !completado(item));
}

export function bloqueadoPorSecuencia({ secuencial = false, indice, primerPendiente }) {
  return Boolean(secuencial && primerPendiente !== -1 && indice > primerPendiente);
}

export function agruparAvances(items = [], {
  grupo = item => item?.grupo || 'General',
  completado = item => Boolean(item?.completada),
  critico = item => item?.estado === 'critico'
} = {}) {
  const porGrupo = new Map();
  for (const item of ordenarAvances(items)) {
    const nombre = grupo(item);
    if (!porGrupo.has(nombre)) porGrupo.set(nombre, []);
    porGrupo.get(nombre).push(item);
  }
  return [...porGrupo].map(([nombre, lista]) => ({
    nombre, items: lista,
    evaluados: lista.filter(completado).length,
    criticos: lista.filter(critico).length
  }));
}

/** Estado gráfico común; no reemplaza los estados contables o contractuales. */
export function estadoVisualAvance({ completada = false, avance = 0, critico = false, espera = false } = {}) {
  if (critico) return 'critico';
  if (completada) return 'completado';
  if (espera) return 'en_espera';
  return limitarAvance(avance) > 0 ? 'en_curso' : 'pendiente';
}
