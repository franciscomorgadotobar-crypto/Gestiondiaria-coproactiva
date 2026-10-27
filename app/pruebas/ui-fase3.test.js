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

test('Home único sustituye selector de módulos y conserva navegación SPA',()=>{
 assert.match(panel,/function cambiarArea\(\)/);
 assert.match(panel,/navegar\('\/', \{ replace:true \}\)/);
 assert.doesNotMatch(panel,/window\.location\.href\s*=\s*import\.meta\.env\.BASE_URL/);
 assert.match(router,/return <PanelEscritorio><HomeGeneral \/><\/PanelEscritorio>/);
 assert.doesNotMatch(router,/<SeleccionArea/);
 assert.doesNotMatch(router,/function RestaurarAreaGuardada/);
 assert.ok((panel.match(/onClick=\{cambiarArea\}/g)||[]).length>=1);
 assert.match(panel,/Ir al inicio/);
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

test('Volver es consecutivo y no acumula pantallas de selección',()=>{
 const verificar=rutas=>{
   for(let i=0;i<rutas.length-1;i++)
     assert.equal(destinoVolverPorJerarquia(rutas[i]),rutas[i+1]);
 };
 verificar(['/comunidades/123','/comunidades','/']);
 verificar(['/control/123/editar','/control/123','/inicio','/']);
 verificar(['/bitacora/nueva','/bitacora','/']);
 verificar(['/plantillas/importar','/plantillas','/']);
 verificar(['/proveedores/comunicaciones','/proveedores','/']);
 verificar(['/propiedades/abc','/propiedades','/']);
 verificar(['/seo','/']);
 verificar(['/compromisos','/']);
 verificar(['/contabilidad/reportes','/contabilidad','/']);
 verificar(['/equipo','/configuracion','/']);
 for(const raiz of ['/inicio','/pipeline','/contabilidad','/configuracion'])
   assert.equal(destinoVolverPorJerarquia(raiz),'/');
});
test('cuenta y notificaciones vuelven al Home transversal',()=>{
 assert.equal(destinoVolverPorJerarquia('/mi-cuenta'),'/');
 assert.equal(destinoVolverPorJerarquia('/notificaciones'),'/');
});
test('portal cliente y entrada no pasan por selector interno',()=>{
  for(const ruta of ['/','/portal','/portal/comunidades/123','/ingreso','/clave'])
    assert.equal(destinoVolverPorJerarquia(ruta),null);
});
test('Volver sigue sin forzar salida de la PWA',()=>{
 const nav=read('lib/navegacion.jsx');
 assert.match(nav,/limpiarArea\(\)/);
 assert.match(nav,/return navegar\('\/', \{ replace:true \}\)/);
 assert.doesNotMatch(nav,/return navegar\(-1\)/);
});
