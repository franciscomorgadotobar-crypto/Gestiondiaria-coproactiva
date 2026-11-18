import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearIndiceConocimientos, filtrarConocimientos, normalizarConsulta } from '../src/lib/busquedaConocimientos.js';
import { obtenerLeccion } from '../src/datos/ley21442.lecciones.js';

const leer = ruta => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const contenidos = JSON.parse(leer('src/datos/ley21442.contenidos.json')).contenidos;
const indice = crearIndiceConocimientos(contenidos, obtenerLeccion);
const pagina = leer('src/paginas/panel/Conocimientos.jsx');
const estilos = leer('src/paginas/panel/Conocimientos.css');

test('Búsqueda abarca los 202 contenidos y respeta materias', () => {
  assert.equal(indice.length, 202);
  assert.equal(filtrarConocimientos(indice, '').length, 202);
  assert.equal(filtrarConocimientos(indice, '   ').length, 202);
  const categoria = contenidos[0].categoria;
  assert.ok(filtrarConocimientos(indice, '', categoria).length > 0);
  assert.ok(filtrarConocimientos(indice, '', categoria).every(x => x.categoria === categoria));
  assert.deepEqual(filtrarConocimientos(indice, 'conceptoinexistente123'), []);
});

test('Busca por título, concepto, artículo y texto desarrollado sin tildes', () => {
  assert.equal(normalizarConsulta('ADMINISTRACIÓN'), 'administracion');
  assert.equal(normalizarConsulta('Gestión Común'), 'gestion comun');
  const titulo = contenidos.find(x => /[áéíóú]/i.test(x.titulo));
  assert.ok(titulo, 'Se esperaba un título con tilde en el conjunto legal');
  const sinTildes = normalizarConsulta(titulo.titulo);
  assert.ok(filtrarConocimientos(indice, sinTildes).some(x => x.id === titulo.id));
  assert.ok(filtrarConocimientos(indice, titulo.titulo.toUpperCase()).some(x => x.id === titulo.id));
  const texto = indice.find(x => x.item.id === titulo.id).texto;
  assert.ok(texto.includes(normalizarConsulta(titulo.referencia)));
  assert.ok(texto.includes(normalizarConsulta(obtenerLeccion(titulo)?.desarrollo)));
  assert.deepEqual(
    filtrarConocimientos(indice, sinTildes).map(x=>x.id),
    filtrarConocimientos(indice, titulo.titulo).map(x=>x.id)
  );
});

test('Lupa está a la derecha, en la cabecera, y abre la búsqueda que ya filtra contenidos', () => {
  assert.match(pagina, /className="conocimientos-cabecera-acciones"/);
  assert.match(pagina, /className="conocimientos-buscar-boton"/);
  assert.match(pagina, /onClick=\{abrirBusqueda\} aria-label="Buscar dentro de los contenidos/);
  assert.match(pagina, /setBuscarVisible\(true\)/);
  assert.match(pagina, /buscadorEscritorioRef\.current\?\.focus\(\)/);
  assert.match(pagina, /filtros\(buscadorRef\)/);
  assert.match(pagina, /filtros\(buscadorEscritorioRef\)/);
  assert.match(pagina, /filtrarConocimientos\(indiceContenidos, busqueda, materia\)/);
  assert.match(pagina, /resultados\.length\} de \{contenidos\.length\} contenidos encontrados/);
  assert.match(estilos, /\.conocimientos-buscar-boton\{[\s\S]*?margin-left:auto/);
  assert.match(estilos, /margin-right:-8px/);
});
