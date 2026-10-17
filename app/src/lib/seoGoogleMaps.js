/**
 * Google Business Profile Performance API: indicadores de la ficha.
 * No confundir estas impresiones con las de Search Console ni los clics
 * con las sesiones de Google Analytics 4.
 *
 * La API puede devolver null para métricas no autorizadas o no disponibles.
 * Se conserva esa ausencia y jamás se presenta como cero.
 */
export const INDICADORES_PERFIL_GOOGLE = Object.freeze([
  {
    campo: 'impresionesMaps',
    titulo: 'Apariciones en Google Maps',
    detalle: 'Visualizaciones de la ficha en Maps · móvil y escritorio'
  },
  {
    campo: 'impresionesBusqueda',
    titulo: 'Apariciones en Búsqueda',
    detalle: 'Visualizaciones de la ficha en Google Search; no son impresiones SEO del sitio'
  },
  {
    campo: 'clicsWeb',
    titulo: 'Clics hacia el sitio',
    detalle: 'Accesos al sitio desde la ficha · no sesiones GA4'
  },
  {
    campo: 'clicsTelefono',
    titulo: 'Clics para llamar',
    detalle: 'Clics en el teléfono; no llamadas atendidas'
  },
  {
    campo: 'indicaciones',
    titulo: 'Solicitudes de indicaciones',
    detalle: 'Peticiones de ruta desde la ficha de Google'
  }
]);

export function indicadorPerfilGoogle(perfil, campo) {
  if (!perfil?.disponible) return null;
  const valor = perfil.resumen?.[campo];
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function datosPerfilGoogle(perfil) {
  return INDICADORES_PERFIL_GOOGLE.map(indicador => ({
    ...indicador,
    valor: indicadorPerfilGoogle(perfil, indicador.campo)
  }));
}
