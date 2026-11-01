import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Vite resuelve imports sin extensión. Para probar la plantilla real en Node
// conservamos el código íntegro y apuntamos el import a su archivo .js.
const ruta = new URL('../src/lib/informe.js', import.meta.url);
const fuente = readFileSync(ruta, 'utf8');
const criteriosUrl = new URL('../src/lib/criterios.js', import.meta.url).href;
const guionesUrl = new URL('../src/lib/guionesGlobales.js', import.meta.url).href;
const paraNode = fuente.replace("from './criterios';", "from '" + criteriosUrl + "';")
  .replace("from './guionesGlobales';", "from '" + guionesUrl + "';");
const { informeHtml } = await import('data:text/javascript;base64,' + Buffer.from(paraNode).toString('base64'));

function informeDePrueba() {
  let correlativo = 0;
  const items = Array.from({ length: 33 }, (_, i) => {
    const cantidad = i === 0 ? 13 : i <= 4 ? 4 : 3;
    const fotos = Array.from({ length: cantidad }, (_, j) => ({
      url: 'https://ejemplo.invalid/evidencia-' + (++correlativo) + '.jpg',
      descripcion: 'Evidencia ' + correlativo,
      ...(i === 0 ? { criterio_id: j < 10 ? 'porton' : 'sensor' } : {})
    }));
    return {
      texto: 'Punto ' + (i + 1),
      descripcion: i === 0 ? 'Revisión detallada de accesos y seguridad.' : 'Inspección visual.',
      estado: 'cumple',
      tipo_ingreso: i === 0 ? 'opciones' : 'texto',
      config: i === 0 ? { criterios: [
        { id: 'porton', texto: 'Funcionamiento del portón' },
        { id: 'sensor', texto: 'Funcionamiento de sensores' }
      ] } : {},
      respuesta: i === 0
        ? { criterios: { porton: { opcion: 'Cumple' }, sensor: { opcion: 'Cumple' } } }
        : { texto: 'Revisado' },
      fotos
    };
  });
  return informeHtml({
    comunidad: { nombre: 'Reserva de prueba', direccion: 'Avenida Ejemplo 123', comuna: 'Coquimbo' },
    control: { periodo: 'Octubre 2026', responsable: 'Técnico de prueba' },
    categorias: [{ nombre: 'Accesos y seguridad', descripcion: 'Descripción de categoría', items }]
  });
}

test('el informe conserva 33 puntos y 113 fotografías, incluidas las asociadas a criterios', () => {
  const html = informeDePrueba();
  assert.match(html, /33<\/p><p class="r">Puntos revisados/);
  assert.match(html, /113<\/p><p class="r">Fotografías/);
  assert.equal((html.match(/<figure>/g) ?? []).length, 113);
  assert.equal((html.match(/evidencia-\d+\.jpg/g) ?? []).length, 113);
  assert.match(html, /Descripción de categoría/);
  assert.match(html, /Funcionamiento del portón/);
  assert.match(html, /Sin registro/);
});

test('los criterios con muchas fotos quedan fuera de la cabecera, y las tarjetas largas pueden dividirse', () => {
  const html = informeDePrueba();
  assert.match(html, /<div class="item-cab">[\s\S]*?<\/div>\s*<div class="resultados-criterios">/);
  assert.match(html, /@page\s*\{\s*size: A4/);
  assert.match(html, /\.resultado-criterio\s*\{[^}]*break-inside: auto;/);
  assert.match(html, /\.item-cab\s*\{\s*break-inside: auto;/);
  assert.match(html, /\.fotos figure\s*\{[^}]*break-inside: avoid;/);
  assert.match(html, /\.atencion-fila\s*\{[^}]*break-inside: avoid;/);
});

test('no imprime automáticamente con imágenes pendientes o fallidas', () => {
  assert.match(fuente, /Promise\.race\(\[recursos, tope\]\)/);
  assert.match(fuente, /if \(resultado !== 'listo' \|\| pendientes\.length\)/);
  assert.match(fuente, /!img\.complete \|\| img\.naturalWidth === 0/);
  assert.match(fuente, /setTimeout\(\(\) => listo\('tiempo-agotado'\), 60000\)/);
  assert.match(fuente, /@media print \{ #aviso-impresion-coproactiva \{ display: none !important;/);
  assert.doesNotMatch(fuente, /setTimeout\(listo, 15000\)/);
});
