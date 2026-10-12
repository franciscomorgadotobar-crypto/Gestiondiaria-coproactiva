/**
 * Un cambio SEO aprobado no debe presentarse otra vez como recomendación nueva.
 * Las búsquedas siguen visibles en los informes de Search Console (datos históricos).
 * La regla NO usa parecido semántico indiscriminado: usa las consultas exactas
 * incluidas en la propuesta aprobada para no ocultar oportunidades diferentes.
 */
export const normalizarConsultaSEO = valor => String(valor ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .trim().replace(/\s+/g, ' ');

const ESTADOS_GESTIONADOS = new Set(['aprobada', 'preparada', 'integrada', 'publicada']);

export function clasificarOportunidadesSEO(lista = [], propuestas = null) {
  // Sin historial comprobado NO afirmar que las recomendaciones son nuevas.
  if (!Array.isArray(propuestas)) return {
    disponibles: false, nuevas: [], enGestion: [], coincidencias: []
  };
  const gestionadas = propuestas.filter(p => ESTADOS_GESTIONADOS.has(p.estado));
  const porConsulta = new Map();
  for (const p of gestionadas) {
    const consultas = Array.isArray(p.consultas) && p.consultas.length
      ? p.consultas : [p.consulta_principal];
    for (const consulta of consultas) {
      const key = normalizarConsultaSEO(consulta);
      if (key && !porConsulta.has(key)) porConsulta.set(key, p);
    }
  }
  const nuevas = [], coincidencias = [];
  for (const oportunidad of lista) {
    if (oportunidad.clase !== 'consulta') {
      nuevas.push(oportunidad);
      continue;
    }
    const vinculada = porConsulta.get(normalizarConsultaSEO(oportunidad.consulta));
    if (vinculada) coincidencias.push({ oportunidad, propuesta: vinculada });
    else nuevas.push(oportunidad);
  }
  return {disponibles: true, nuevas, enGestion: gestionadas, coincidencias};
}
