/**
 * Regla editorial transversal Coproactiva:
 * usar siempre guion ASCII (-) en textos, nunca raya/em dash ni en dash.
 * No modificar identificadores, correos ni código fuente almacenado.
 */
export const normalizarGuiones = valor =>
  typeof valor === 'string' ? valor.replace(/[—–]/g, '-') : valor;

/**
 * Normaliza la presentación visible, incluso textos procedentes de Supabase
 * y módulos lazy. No altera formularios, campos editables o bloques de código.
 */
export function instalarGuionesGlobales(raiz) {
  if (!raiz || typeof MutationObserver === 'undefined') return () => {};
  const ignorados = 'input,textarea,select,option,script,style,pre,code,[contenteditable]:not([contenteditable="false"]),[data-conservar-guiones]';
  function revisar(nodo) {
    if (nodo.nodeType === 3) {
      if (!/[—–]/.test(nodo.nodeValue || '')) return;
      if (nodo.parentElement?.closest(ignorados)) return;
      nodo.nodeValue = normalizarGuiones(nodo.nodeValue);
      return;
    }
    if (nodo.nodeType !== 1 && nodo.nodeType !== 11) return;
    if (nodo.nodeType === 1 && nodo.matches(ignorados)) return;
    const doc = nodo.ownerDocument || document;
    const walker = doc.createTreeWalker(nodo, NodeFilter.SHOW_TEXT);
    let texto;
    while ((texto = walker.nextNode())) {
      if (!/[—–]/.test(texto.nodeValue || '')) continue;
      if (texto.parentElement?.closest(ignorados)) continue;
      texto.nodeValue = normalizarGuiones(texto.nodeValue);
    }
  }
  revisar(raiz);
  const observer = new MutationObserver(cambios => {
    for (const cambio of cambios) {
      if (cambio.type === 'characterData') revisar(cambio.target);
      else for (const nodo of cambio.addedNodes) revisar(nodo);
    }
  });
  observer.observe(raiz, {subtree:true,childList:true,characterData:true});
  return () => observer.disconnect();
}
