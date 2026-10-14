/**
 * Recursos Android a partir del isotipo vectorial oficial de Coproactiva.
 * Requiere cap add android, cap sync android y npm run build (genera PNG web).
 */
import sharp from 'sharp';
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
await stat(res).catch(() => {
  throw Error('Primero ejecuta: npx cap add android && npx cap sync android');
});
const fuente = await readFile(path.join(root, 'public', 'iconos', 'iso.svg'), 'utf8');
const trazos = [...fuente.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g)]
  .map(([, d]) => '<path d="' + d + '"/>').join('');
if (trazos.length < 3) throw Error('El SVG del isotipo oficial está incompleto.');

const colorXml = '<?xml version="1.0" encoding="utf-8"?>\n'
  + '<resources><color name="coproactiva_launcher_bg">#FFFAF6</color></resources>\n';
await writeFile(path.join(res, 'values', 'coproactiva_brand.xml'), colorXml);
const adaptXml = '<?xml version="1.0" encoding="utf-8"?>\n'
  + '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
  + '<background android:drawable="@color/coproactiva_launcher_bg" />\n'
  + '<foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
  + '</adaptive-icon>\n';
const adaptive = path.join(res, 'mipmap-anydpi-v26');
await mkdir(adaptive, { recursive: true });
for (const nombre of ['ic_launcher.xml','ic_launcher_round.xml']) {
  await writeFile(path.join(adaptive, nombre), adaptXml);
}
const basePng = path.join(root, 'public', 'iconos', 'icono-app-20261013-512.png');
await stat(basePng);

for (const [densidad, px] of Object.entries({
  mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192
})) {
  const carpeta = path.join(res, 'mipmap-' + densidad);
  await mkdir(carpeta, {recursive:true});
  const legacy = await sharp(basePng).resize(px,px).png().toBuffer();
  await Promise.all(['ic_launcher.png','ic_launcher_round.png'].map(n =>
    writeFile(path.join(carpeta,n),legacy)));

  const dim = Math.round(px * 108 / 48);
  const esc = dim * 0.42 / 259.11;
  const ancho = 254.7 * esc, alto = 259.11 * esc;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim
    + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim + '">'
    + '<g fill="#d5863b" transform="translate('
    + ((dim-ancho)/2).toFixed(3) + ' ' + ((dim-alto)/2).toFixed(3)
    + ') scale(' + esc.toFixed(7) + ')">' + trazos + '</g></svg>';
  await sharp(Buffer.from(svg)).png()
    .toFile(path.join(carpeta,'ic_launcher_foreground.png'));
}

// En Android 12 la pantalla del SO usa el ícono adaptativo. En Android 11
// y anteriores, sincronizar también los recursos splash.png existentes.
const logo = await readFile(path.join(root,'public','brand','imagologo-vertical.svg'));
let splashCount = 0;
for (const d of await readdir(res,{withFileTypes:true})) {
  if (!d.isDirectory() || !d.name.startsWith('drawable')) continue;
  const carpeta = path.join(res,d.name);
  if (!(await readdir(carpeta)).includes('splash.png')) continue;
  const horizontal = d.name.includes('land');
  const w = horizontal ? 1600 : 900, h = horizontal ? 900 : 1600;
  const logoW = Math.round(Math.min(w * (horizontal ? 0.36 : 0.58), 460));
  const logoH = Math.round(logoW * 259.11 / 560.03);
  const fuenteLogo = await sharp(logo).resize(logoW,logoH).png().toBuffer();
  const buffer = await sharp({
    create:{width:w,height:h,channels:4,background:'#fffaf6'}
  }).composite([{
    input:fuenteLogo,top:Math.round((h-logoH)/2),left:Math.round((w-logoW)/2)
  }]).png().toBuffer();
  await writeFile(path.join(carpeta,'splash.png'),buffer);
  splashCount++;
}
// A la app interna no le conviene respaldar tokens/caché de usuarios en
// copias automáticas del teléfono. Tampoco habilitar HTTP no cifrado.
const manifestPath = path.join(root, 'android','app','src','main','AndroidManifest.xml');
let manifest = await readFile(manifestPath,'utf8');
if (!/<application\b/.test(manifest)) throw Error('AndroidManifest inválido.');
manifest = manifest.replace(/android:allowBackup="[^"]*"/g,'');
manifest = manifest.replace(/android:usesCleartextTraffic="[^"]*"/g,'');
manifest = manifest.replace(/<application\b/, '<application android:allowBackup="false" android:usesCleartextTraffic="false"');
await writeFile(manifestPath,manifest);

console.log('Íconos nativos y',splashCount,'variantes del splash preparadas.');

