import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true,
    hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));

  // Simula una descarga de JS 1 segundo más lenta: el HTML inicial debe
  // enseñar el isotipo oficial y barra ANTES de que React se descargue.
  await page.route('**/src/main.jsx', async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto(base + '/ingreso', { waitUntil: 'domcontentloaded' });
  const splash = page.locator('#splash-inicial');
  await splash.waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.locator('.splash-logo').count(),1);
  assert.equal(await page.locator('.splash-barra').count(),1);
  assert.equal(await page.locator('.splash-logo').getAttribute('alt'),'Coproactiva');

  await page.screenshot({ path: 'artifacts/ui/splash-coproactiva-390.png' });
  await page.getByRole('heading',{name:'Ingresar'}).waitFor({timeout:15000});
  await splash.waitFor({state:'detached',timeout:8000});
  assert.deepEqual(errors,[],'Errores JS del arranque');
  const png = await page.request.get(base+'/iconos/icono-app-20261013-512.png');
  assert.equal(png.status(),200,'Icono Android debe estar disponible desde la PWA');
  assert.match(png.headers()['content-type']||'',/image\/png/);
  const logo = await page.request.get(base+'/brand/imagologo-vertical.svg');
  assert.equal(logo.status(),200,'El imagologo oficial debe estar publicado');
  console.log('Splash PWA: visible antes de React, logo/barra correctos, se retira al cargar la app.');
  await context.close();
} finally {
  await browser.close();
}
