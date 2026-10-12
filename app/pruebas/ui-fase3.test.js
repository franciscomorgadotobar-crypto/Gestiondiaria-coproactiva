import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=r=>readFileSync(new URL('../src/'+r,import.meta.url),'utf8');
const panel=read('componentes/PanelEscritorio.jsx');
const router=read('App.jsx');
const confirmar=read('componentes/Confirmar.jsx');
const campos=read('componentes/DialogoCampos.jsx');
const foco=read('lib/focoDialogo.js');
const css=read('estilos/modulos.css');

test('cambiar de área navega a selector sin reiniciar la PWA',()=>{
  assert.match(panel,/function cambiarArea\(\)\s*\{\s*limpiarArea\(\);\s*navegar\('\/',\s*\{\s*state:\s*\{\s*selectorCoproactiva:\s*true/);
  assert.doesNotMatch(panel,/window\.location\.href\s*=\s*import\.meta\.env\.BASE_URL/);
  assert.match(router,/location\.state\?\.selectorCoproactiva === true/);
  assert.ok((panel.match(/onClick=\{cambiarArea\}/g)||[]).length>=2);
});
test('los dos diálogos comparten foco accesible y respetan Atrás Android',()=>{
  for(const componente of [confirmar,campos]) {
    assert.match(componente,/useAtrasCierraDialogo\(onCancelar\)/);
    assert.match(componente,/useFocoDialogo\(modalRef,onCancelar\)/);
    assert.match(componente,/ref=\{modalRef\}/);
    assert.match(componente,/aria-modal="true"/);
    assert.match(componente,/tabIndex=\{-1\}/);
    assert.match(componente,/modal-fondo-accesible/);
    assert.match(componente,/modal-accesible/);
  }
});
test('teclado atrapa Tab, permite Escape y devuelve foco anterior',()=>{
  assert.match(foco,/e\.key==='Escape'/);
  assert.match(foco,/e\.key!=='Tab'/);
  assert.match(foco,/elemento\.contains\(document\.activeElement\)/);
  assert.match(foco,/anterior\?\.isConnected/);
  assert.match(foco,/callback\.current\?\.\(\)/);
  assert.doesNotMatch(campos,/autoFocus=\{i === 0\}/);
});
test('el móvil respeta teclado virtual, desplazamiento y objetivos táctiles',()=>{
  assert.match(css,/\.modal-fondo-accesible/);
  assert.match(css,/max-height:\s*min\(86dvh/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/\.modal-accesible \.fila-botones/);
  assert.match(css,/min-height:\s*var\(--tactil\)/);
});
