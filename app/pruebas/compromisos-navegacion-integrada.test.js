import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const listado=leer('src/paginas/panel/CompromisosGeneral.jsx');
const ficha=leer('src/paginas/cliente/Compromisos.jsx');
const visual=leer('pruebas/ui-compromisos-escritorio.mjs');
const estilo=leer('src/paginas/panel/CompromisosGeneral.css');
const inicio=leer('src/paginas/panel/Inicio.jsx');

test('Abrir un compromiso no navega a Comunidades ni abandona el tablero',()=>{
 assert.match(listado,/const \[seleccionadoId,setSeleccionadoId\]=useState\(null\)/);
 assert.match(listado,/onClick=\{\(\)=>abrirCompromiso\(c\.id\)\}/);
 assert.match(listado,/aria-expanded=\{seleccionadoId===c\.id\}/);
 assert.match(listado,/compromisos-general-detalle-integrado/);
 assert.doesNotMatch(listado,/to=\{'\/comunidades\/'\+encodeURIComponent\(id\)\+'\?seccion=compromisos'\}/);
 assert.match(listado,/<Compromisos comunidadId=\{c\.comunidad_id\} administrador=\{puedeGestionar\}/);
 assert.match(visual,/abrir compromiso no debe salir del tablero/);
});
test('El detalle usa una sola ficha, sin repetir menús, indicadores ni crear compromiso',()=>{
 assert.match(ficha,/seleccionadoId = null, integrado = false/);
 assert.match(ficha,/if\(seleccionadoId\)consulta=consulta\.eq\('id',seleccionadoId\)/);
 assert.match(ficha,/!integrado&&<header className="compromisos-cabecera"/);
 assert.match(ficha,/!integrado&&!cargando&&compromisos\.length>0/);
 assert.match(ficha,/administrador&&!integrado&&<details className="tarjeta compromisos-crear-desplegable"/);
 assert.match(ficha,/const Etiqueta=integrado\?'div':'details'/);
 assert.match(visual,/solo una ficha integrada/);
 assert.match(estilo,/\.compromisos-general-detalle-integrado/);
});
test('Se conserva gestión de subtareas, títulos y Drive, con retorno al resumen',()=>{
 assert.match(ficha,/onActualizado/);
 assert.match(ficha,/await recargarYNotificar\(\)/);
 assert.match(listado,/async function actualizarListado\(\)/);
 assert.match(ficha,/Adjuntos de esta subtarea/);
 assert.match(ficha,/guardarTituloDirecto/);
 assert.match(ficha,/marcarSubtarea/);
 assert.match(ficha,/cambiarProgresoSubtarea/);
});
test('Inicio integra el tablero sin repetir la navegación lateral',()=>{
 assert.match(inicio,/<CompromisosGeneral integrado \/>/);
 assert.doesNotMatch(inicio,/<nav className="accesos-inicio"/);
 assert.match(listado,/role="tablist"/);
 assert.match(listado,/vista==='responsable'/);
 assert.match(listado,/compromisos-general-nuevo-form/);
});
