import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=leer('src/paginas/panel/Inicio.jsx');
const css=leer('src/paginas/panel/InicioLegibilidad.css');
const comunidad=leer('src/paginas/panel/Comunidades.jsx');

test('Operaciones ofrece selección de comunidad visible y navegable',()=>{
 assert.match(home,/<Link to="\/comunidades" className="acceso acceso-principal" aria-label="Seleccionar comunidad">/);
 assert.match(home,/<span>Seleccionar comunidad<\/span>/);
 assert.match(home,/inicio-seleccionar-comunidad-movil/);
 assert.match(home,/to="\/comunidades" className="boton boton-secundario inicio-seleccionar-comunidad-movil"/);
 assert.match(comunidad,/seccion === 'compromisos' && <Compromisos comunidadId=\{id\}/);
});
test('La tarjeta naranja no puede heredar letras blancas sobre un fondo claro',()=>{
 assert.match(css,/\.inicio-pantalla \.accesos-inicio \.acceso\.acceso-principal\{/);
 assert.match(css,/background:#fff1e5/);
 assert.match(css,/color:#512d1e/);
 assert.match(css,/\.acceso\.acceso-principal > span\{color:inherit\}/);
 assert.match(css,/@media\(max-width:899px\)/);
 assert.match(css,/\.inicio-accion-principal \.inicio-seleccionar-comunidad-movil/);
 assert.match(css,/\.accesos-inicio \.acceso:not\(\.acceso-principal\)/);
 assert.doesNotMatch(css,/\.inicio-pantalla \.accesos-inicio\{\s*display:none!important/);
});
