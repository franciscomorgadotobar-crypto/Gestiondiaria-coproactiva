/**
 * Iconos PWA generados a partir del isotipo VECTORIAL OFICIAL de Coproactiva.
 * No usar el mockup rasterizado como logo: el SVG autorizado mantiene su trazo.
 *
 * Se ejecuta antes de vite build (y vite dev) para generar PNG reales de
 * 64/192/512 y 512 maskable. Android no garantiza reconocer SVG como icono.
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = path.join(raiz, 'public', 'iconos');
const fuente = await readFile(path.join(carpeta, 'iso.svg'), 'utf8');
const trazos = [...fuente.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g)]
  .map(([, d]) => '<path d="' + d + '"/>').join('');
if (trazos.length < 3 || !fuente.includes('viewBox="0 0 254.7 259.11"')) {
  throw new Error('No se encuentra el isotipo SVG oficial de Coproactiva.');
}
await mkdir(carpeta, { recursive: true });

const VERSION = '20261013';
const ICONOS = [
  { tamano: 64, marca: 302, archivo: 'icono-app-' + VERSION + '-64.png' },
  { tamano: 192, marca: 302, archivo: 'icono-app-' + VERSION + '-192.png' },
  { tamano: 512, marca: 302, archivo: 'icono-app-' + VERSION + '-512.png' },
  { tamano: 512, marca: 265, archivo: 'icono-app-' + VERSION + '-maskable-512.png' }
];

// 512px en coordenadas vectoriales. La versión maskable utiliza un símbolo
// algo menor, dentro del diámetro seguro 80% de Android.
for (const icono of ICONOS) {
  const escala = icono.marca / 259.11;
  const ancho = 254.7 * escala;
  const posX = (512 - ancho) / 2;
  const posY = (512 - icono.marca) / 2;
  const vector = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
    '<rect width="512" height="512" fill="#fffaf6"/>',
    '<g fill="#d5863b" transform="translate(' + posX.toFixed(3) + ' ' + posY.toFixed(3) + ') scale(' + escala.toFixed(7) + ')">',
    trazos, '</g></svg>'
  ].join('');
  await sharp(Buffer.from(vector))
    .resize(icono.tamano, icono.tamano, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(carpeta, icono.archivo));
  process.stdout.write('Icono oficial generado: ' + icono.archivo + '\n');
}
