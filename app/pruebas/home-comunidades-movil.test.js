import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lista=leer('src/paginas/panel/Comunidades.jsx');
const cssLista=leer('src/paginas/panel/Comunidades.css');
const home=leer('src/paginas/panel/Inicio.jsx');
const cssHome=leer('src/paginas/panel/InicioLegibilidad.css');
const menu=leer('src/componentes/PanelEscritorio.jsx');
const browser=leer('pruebas/ui-grupos-areas.mjs');

test('Comunidades usa una fila accesible por registro y conserva búsqueda',()=>{
 assert.match(lista,/role="listitem" key=\{c\.id\} className="comunidad-fila"/);
 assert.match(lista,/aria-label=\{\x60Abrir comunidad:/);
 assert.match(lista,/c\.nombre/);
 assert.match(lista,/c\.comuna/);
 assert.match(lista,/c\.direccion/);
 assert.match(lista,/c\.latitud != null && c\.longitud != null/);
 assert.match(lista,/setBuscar/);
 assert.match(cssLista,/\.comunidad-fila-enlace\{/);
 assert.match(cssLista,/min-height:78px/);
 assert.match(cssLista,/\.comunidades-kpis\{display:none\}/);
});
test('Barra móvil de Operaciones se limita a tres accesos fijos',()=>{
 assert.match(menu,/enOperacion \? \['inicio', 'comunidades', 'levantamientos'\] : \[\]/);
 assert.doesNotMatch(menu,/preferidos\.filter/);
 assert.match(menu,/\x27notificaciones\x27, etiqueta: \x27Notificaciones\x27, ruta: \x27\/notificaciones\x27/);
 assert.match(menu,/const mostrarMasMovil = mostrarBarraMovil && !enOperacion/);
});
test('Home móvil separa trabajo y herramientas secundarias',()=>{
 assert.match(home,/inicio-accion-principal/);
 assert.match(home,/details className="inicio-herramientas"/);
 assert.match(home,/accesos-inicio-desktop/);
 assert.match(home,/accesos-inicio-movil/);
 assert.match(home,/herramientas\.map/);
 assert.match(cssHome,/inicio-cuerpo>\.inicio-trabajo\{order:3\}/);
 assert.match(cssHome,/inicio-cuerpo>\.tarjeta-mapa\{order:5/);
 assert.match(cssHome,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(cssHome,/accesos-inicio-desktop\{display:none!important\}/);
});
test('Chromium prueba 320 y 390 px sin duplicados ni desbordamiento',()=>{
 assert.match(browser,/for\(const ancho of \[320,390\]\)/);
 assert.match(browser,/comunidad-fila/);
 assert.match(browser,/Comunidades lista/);
 assert.match(browser,/Inicio','Comunidades','Levantamientos/);
});
