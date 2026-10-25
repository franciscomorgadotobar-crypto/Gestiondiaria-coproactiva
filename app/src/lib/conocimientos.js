/**
 * Preferencia personal, como la mascota del CRM: nunca desactiva el módulo.
 * Se guarda por cuenta en este dispositivo, sin cambios de base de datos.
 */
export const EVENTO_PREFERENCIA = 'coproactiva:conocimientos-preferencia';
const PREFIJO = 'coproactiva:conocimientos:automaticas:';
export const CLAVE_INICIO = 'coproactiva:conocimientos:inicio:';
export const CLAVE_RECIENTES = 'coproactiva:conocimientos:recientes:';

export function leerAutomaticas(usuarioId) {
  if (!usuarioId) return false;
  try { return localStorage.getItem(PREFIJO + usuarioId) !== '0'; }
  catch { return true; }
}
export function guardarAutomaticas(usuarioId, valor) {
  if (!usuarioId) return;
  try { localStorage.setItem(PREFIJO + usuarioId, valor ? '1' : '0'); } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO_PREFERENCIA, { detail: { usuarioId, activas: Boolean(valor) } }));
}
export function elegirCapsula(capsulas, recientes = [], azar = Math.random) {
  const elegibles = capsulas.filter(c => c.automatico && c.texto && c.id);
  const disponibles = elegibles.filter(c => !recientes.includes(c.id));
  const bolsa = disponibles.length ? disponibles : elegibles;
  if (!bolsa.length) return null;
  return bolsa[Math.min(bolsa.length - 1, Math.floor(azar() * bolsa.length))];
}
