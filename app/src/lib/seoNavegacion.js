export const SEO_ACCESOS_DIRECTOS = ['resumen', 'consultas', 'oportunidades', 'seguimiento'];
export const SEO_MENU_PARAMETRO = 'seoMenu';

export function abrirMenuSEO(search) {
  const parametros = new URLSearchParams(search);
  parametros.set(SEO_MENU_PARAMETRO, 'mas');
  return parametros;
}

export function cerrarMenuSEO(search) {
  const parametros = new URLSearchParams(search);
  parametros.delete(SEO_MENU_PARAMETRO);
  return parametros;
}

/* Seleccionar desde Más sustituye la entrada temporal del menú y preserva
 * cualquier parámetro ajeno; con Atrás se recupera la pestaña anterior. */
export function seleccionarSeccionSEO(search, destino, vistasValidas) {
  const parametros = cerrarMenuSEO(search);
  if (!vistasValidas.includes(destino)) return parametros;
  if (destino === 'resumen') parametros.delete('vista');
  else parametros.set('vista', destino);
  return parametros;
}
