import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

// Prueba de navegador real: el PDF es una impresión de HTML, no un jsPDF.
const fuente = readFileSync(new URL('../src/lib/informe.js', import.meta.url), 'utf8');
const criterios = new URL('../src/lib/criterios.js', import.meta.url).href;
const guiones = new URL('../src/lib/guionesGlobales.js', import.meta.url).href;
const codigo = fuente.replace("from './criterios';", "from '" + criterios + "';")
  .replace("from './guionesGlobales';", "from '" + guiones + "';");
const { informeHtml } = await import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'));

const svg = numero => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
  '<rect width="800" height="600" fill="#e8e4de"/>' +
  '<text x="200" y="300" font-size="64" fill="#2b3138">Foto ' + numero + '</text></svg>'
);
let numeroFoto = 0;
const items = Array.from({ length: 33 }, (_, i) => {
  const cantidad = i === 0 ? 13 : i <= 4 ? 4 : 3;
  const fotos = Array.from({ length: cantidad }, (_, j) => {
    numeroFoto++;
    return {
      url: svg(numeroFoto),
      descripcion: 'Evidencia ' + numeroFoto,
      ...(i === 0 ? { criterio_id: j < 10 ? 'porton' : 'sensor' } : {})
    };
  });
  return {
    texto: 'Punto ' + (i + 1) + ' de revisión',
    descripcion: i === 0 ? 'Revisión de portón, sensores y apertura. ' .repeat(5) : 'Descripción de inspección',
    tipo_ingreso: i === 0 ? 'opciones' : 'texto',
    estado: 'cumple',
    config: i === 0 ? { criterios: [
      { id: 'porton', texto: 'Funcionamiento del portón' },
      { id: 'sensor', texto: 'Sensores de seguridad' }
    ] } : {},
    respuesta: i === 0 ? { criterios: {
      porton: { opcion: 'Cumple' }, sensor: { opcion: 'Cumple' }
    } } : { texto: 'Revisión realizada con fotografías' },
    fotos
  };
});
assert.equal(numeroFoto, 113);
const html = informeHtml({
  comunidad: { nombre: 'Reserva Santa Clara (datos de prueba)', direccion: 'Avenida Ejemplo 1855', comuna: 'Coquimbo' },
  control: { periodo: 'Octubre 2026', plantilla_nombre: 'Primera visita', responsable: 'Inspector de prueba' },
  categorias: [{ nombre: 'Accesos y seguridad', descripcion: 'Inspección de accesos', items }]
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const recursos = await page.evaluate(() => ({
    total: document.querySelectorAll('.fotos img').length,
    cargadas: [...document.querySelectorAll('.fotos img')].filter(img => img.complete && img.naturalWidth > 0).length,
    criterios: document.querySelectorAll('.resultado-criterio').length,
    tamanho: getComputedStyle(document.querySelector('.resultado-criterio')).breakInside
  }));
  assert.equal(recursos.total, 113);
  assert.equal(recursos.cargadas, 113);
  assert.equal(recursos.criterios, 2);
  assert.equal(recursos.tamanho, 'auto');

  await page.emulateMedia({ media: 'print' });
  mkdirSync('artifacts/ui', { recursive: true });
  const pdf = await page.pdf({
    path: 'artifacts/ui/informe-prueba-33-puntos-113-fotos.pdf',
    printBackground: true,
    preferCSSPageSize: true
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.ok(paginas >= 5 && paginas < 50, 'Paginación A4 inesperada: ' + paginas);
  console.log('Informe PDF validado: 33 puntos, 113 fotos, ' + paginas + ' páginas A4');
} finally {
  await browser.close();
}
