import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Devuelve estado de una pestaña a partir de la URL (fuente de verdad).
 * Cada selección hace push al historial del navegador / botón Atrás Android.
 * Mantiene los demás parámetros, por ejemplo ?comunidad=..&vista=...
 * No intercepta popstate, no crea entradas ficticias, no bloquea salida de PWA.
 */
export function obtenerValorNavegable(search, nombre, valores, inicial) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const valor = params.get(nombre);
  return valores.includes(valor) ? valor : inicial;
}
export function cambiarValorNavegable(search, nombre, destino, inicial, valores) {
  const base = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  if (!valores.includes(destino)) return new URLSearchParams(base);
  const nuevos = new URLSearchParams(base);
  if (destino === inicial) nuevos.delete(nombre);
  else nuevos.set(nombre, destino);
  return nuevos;
}
export function usePestanaHistorial(nombre, inicial, valores) {
  const [params, setParams] = useSearchParams();
  const valor = obtenerValorNavegable(params, nombre, valores, inicial);
  const setValor = useCallback((nuevo, opciones = {}) => {
    const destino = typeof nuevo === 'function' ? nuevo(valor) : nuevo;
    if (!valores.includes(destino) || destino === valor) return;
    setParams(actual => cambiarValorNavegable(actual, nombre, destino, inicial, valores),
      {replace: Boolean(opciones.replace),preventScrollReset:true});
  }, [valor, nombre, inicial, valores, setParams]);
  return [valor, setValor];
}
