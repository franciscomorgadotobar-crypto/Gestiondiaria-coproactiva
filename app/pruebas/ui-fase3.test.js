import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { destinoVolverPorJerarquia } from '../src/lib/jerarquia.js';

const read=r=>readFileSync(new URL('../src/'+r,import.meta.url),'utf8');
const panel=read('componentes/PanelEscritorio.jsx');
const router=read('App.jsx');
const confirmar=read('componentes/Confirmar.jsx');
const campos=read('componentes/DialogoCampos.jsx');
const foco=read('lib/focoDialogo.js');
const css=read('estilos/modulos.css');

test('cambiar de área navega a selector sin reiniciar la PWA',()=>{
  assert.match(panel,/function cambiarArea\(\)\s*\{\s*limpiarArea\(\);/);
  assert.match(panel,/const pasos = pasosHastaSelector\(window\.history\.state\)/);
  assert.match(panel,/if \(pasos !== null\) return navegar\(pasos\)/);
  assert.match(panel,/navegar\('\/', \{ replace: true, state: \{ selectorCoproactiva: true \} \}\)/);
  assert.doesNotMatch(panel,/window\.location\.href\s*=\s*import\.meta\.env\.BASE_URL/);
  assert.match(router,/if \(!tieneCRM\(perfil\)\) return <PanelEscritorio><Inicio \/><\/PanelEscritorio>/);
  assert.match(router,/return <SeleccionArea \/>/);
  assert.doesNotMatch(router,/function RestaurarAreaGuardada/);
  assert.ok((panel.match(/onClick=\{cambiarArea\}/g)||[]).length>=1);
  assert.match(panel,/organizacion === 'modulos' \? 'Cambiar vista o módulo' : 'Cambiar de área'/);
  assert.doesNotMatch(panel,/className="barra-area-cambiar"/);
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

test('Volver por niveles termina en selección de área, no sale de la PWA',()=>{
  const verificar = (rutas, inicio='/inicio') => {
    for (let i=0; i<rutas.length-1; i++)
      assert.equal(destinoVolverPorJerarquia(rutas[i], inicio), rutas[i+1],
        'desde ' + rutas[i] + ' debe retroceder a ' + rutas[i+1]);
  };
  verificar(['/comunidades/123','/comunidades','/inicio','/']);
  verificar(['/control/123/editar','/control/123','/inicio','/']);
  verificar(['/bitacora/nueva','/bitacora','/inicio','/']);
  verificar(['/plantillas/importar','/plantillas','/inicio','/']);
  // Grupos: Operaciones incluye Proveedores y WhatsApp; Comercial incluye
  // Arriendos y ventas y SEO; Finanzas es Contabilidad.
  verificar(['/proveedores/comunicaciones','/proveedores','/inicio','/']);
  verificar(['/whatsapp/conversaciones','/whatsapp','/inicio','/']);
  verificar(['/propiedades/abc','/propiedades','/pipeline','/']);
  verificar(['/seo','/pipeline','/']);
  verificar(['/contabilidad/reportes','/contabilidad','/']);
  verificar(['/equipo','/configuracion','/']);
  verificar(['/ayuda/practica-levantamiento','/ayuda','/inicio','/']);
  for(const raiz of ['/inicio','/pipeline','/contabilidad','/configuracion'])
    assert.equal(destinoVolverPorJerarquia(raiz),'/');
});
test('cuenta y notificaciones regresan al inicio del área correcta',()=>{
  for(const raiz of ['/pipeline','/seo','/contabilidad','/whatsapp','/inicio']){
    assert.equal(destinoVolverPorJerarquia('/mi-cuenta',raiz),raiz);
    assert.equal(destinoVolverPorJerarquia('/notificaciones',raiz),raiz);
  }
});
test('portal cliente y entrada no pasan por selector interno',()=>{
  for(const ruta of ['/','/portal','/portal/comunidades/123','/ingreso','/clave'])
    assert.equal(destinoVolverPorJerarquia(ruta),null);
});
test('Volver distingue perfiles y marca explícitamente el selector',()=>{
  const nav=read('lib/navegacion.jsx');
  assert.match(nav,/if \(!puedeCambiarArea\) return/);
  assert.match(nav,/replace: true, state: \{ selectorCoproactiva: true \}/);
  assert.match(nav,/limpiarArea\(\)/);
  assert.doesNotMatch(nav,/return navegar\(-1\)/);
});
