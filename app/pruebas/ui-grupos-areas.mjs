/*
 * Grupos del selector (24-10-2026), en Chromium con perfil Supabase simulado.
 * No consulta ni modifica la base real.
 * - Operaciones: Proveedores y WhatsApp quedan en "Más" (teléfono) y en la
 *   barra lateral (escritorio); Volver desde Proveedores lleva al inicio de
 *   Operaciones.
 * - Comercial en escritorio: Pipeline, Arriendos y ventas, Nueva propiedad y SEO.
 * - Finanzas abre Contabilidad.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const userId = 'aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ahora = Math.floor(Date.now() / 1000);
const jwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: ahora + 7200 })).toString('base64url'),
  'firma-de-prueba-local'
].join('.');
const session = {
  access_token: jwt, token_type: 'bearer', expires_in: 7200, expires_at: ahora + 7200,
  refresh_token: 'refresh-de-prueba-local',
  user: {
    id: userId, aud: 'authenticated', role: 'authenticated', email: 'qa-local@coproactiva.test',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    created_at: new Date().toISOString()
  }
};

const navegador = await chromium.launch({ headless: true });
try {
  async function crear({ ancho = 390, alto = 844, rol = 'superadmin' } = {}) {
    const movil = ancho < 900;
    const ctx = await navegador.newContext({
      viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, serviceWorkers: 'block'
    });
    await ctx.addInitScript(({ session }) => {
      localStorage.setItem('sb-sin-configurar-auth-token', JSON.stringify(session));
    }, { session });
    await ctx.route('https://sin-configurar.supabase.co/**', async route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/perfiles?')) return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: userId, nombre: 'QA Coproactiva', rol, activo: true, bottom_nav: [], email: 'qa-local@coproactiva.test' })
      });
      if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
      if (url.includes('/functions/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ disponible: false }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('QA pageerror:', e.message));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Hola/ }).waitFor({ timeout: 20000 });
    return { ctx, page };
  }

  // Teléfono · Operaciones
  {
    const { ctx, page } = await crear();
    await page.getByRole('button', { name: /Operación de comunidades/ }).click();
    await page.waitForURL(u => u.pathname === '/inicio', { timeout: 20000 });
    assert.deepEqual((await page.locator('.barra-inferior-movil .nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Inicio', 'Comunidades', 'Levantamientos', 'Notificaciones', 'Más']);
    await page.locator('.barra-inferior-movil').getByRole('button', { name: 'Más' }).click();
    const menu = page.getByRole('dialog', { name: 'Más opciones' });
    await menu.waitFor();
    for (const nombre of ['Proveedores', 'WhatsApp']) assert.equal(await menu.getByRole('button', { name: nombre }).count(), 1, nombre);
    await menu.getByRole('button', { name: 'Proveedores' }).click();
    await page.waitForURL(u => u.pathname === '/proveedores', { timeout: 20000 });
    assert.equal(await page.locator('.barra-inferior-movil').count(), 1, 'Proveedores conserva la barra de Operaciones');
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(u => u.pathname === '/inicio', { timeout: 10000 });
    console.log('Teléfono · Operaciones: Más → Proveedores → Volver → Inicio: OK');
    await ctx.close();
  }

  // Teléfono · Comercial: barra principal constante y selector interno SEO.
  {
    const { ctx, page } = await crear();
    await page.getByRole('button', { name: /Gestión comercial/ }).click();
    await page.waitForURL(u => u.pathname === '/pipeline', { timeout: 20000 });
    const barra = page.locator('.barra-inferior-movil');
    assert.deepEqual((await barra.locator('.nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Pipeline', 'Arriendos', 'SEO', 'Notificaciones', 'Más']);
    await barra.getByRole('button', { name: 'Más' }).click();
    const menu = page.getByRole('dialog', { name: 'Más opciones' });
    for (const nombre of ['Nueva propiedad', 'Cambiar de área']) assert.equal(await menu.getByRole('button', { name: nombre }).count(), 1, nombre);
    await menu.getByRole('button', { name: 'Nueva propiedad' }).click();
    await page.waitForURL(u => u.pathname === '/propiedades/nueva', { timeout: 20000 });
    await page.locator('.barra-inferior-movil').getByRole('button', { name: 'Arriendos' }).click();
    await page.waitForURL(u => u.pathname === '/propiedades', { timeout: 20000 });
    await page.locator('.barra-inferior-movil').getByRole('button', { name: 'SEO', exact: true }).click();
    await page.waitForURL(u => u.pathname === '/seo', { timeout: 20000 });
    await page.getByRole('combobox', { name: 'Sección de SEO' }).waitFor({ timeout: 20000 });
    assert.equal(await page.locator('.barra-inferior-movil').count(), 1, 'SEO mantiene barra Comercial');
    assert.equal(await page.locator('.seo-barra-inferior').count(), 0, 'sin barra SEO duplicada');
    assert.deepEqual((await barra.locator('.nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Pipeline', 'Arriendos', 'SEO', 'Notificaciones', 'Más']);
    await page.getByRole('combobox', { name: 'Sección de SEO' }).selectOption('business');
    await page.waitForURL(u => u.searchParams.get('vista') === 'business', { timeout: 10000 });
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(u => u.pathname === '/seo' && !u.searchParams.has('vista'), { timeout: 10000 });
    await barra.getByRole('button', { name: 'Pipeline' }).click();
    await page.waitForURL(u => u.pathname === '/pipeline', { timeout: 20000 });
    console.log('Teléfono · Comercial: barra persistente, SEO Google Maps y regreso a Pipeline: OK');
    await ctx.close();
  }

  // Teléfono · Finanzas
  {
    const { ctx, page } = await crear();
    await page.getByRole('button', { name: /Gestión contable/ }).click();
    await page.waitForURL(u => u.pathname === '/contabilidad', { timeout: 20000 });
    const barra = page.locator('.barra-inferior-movil');
    assert.deepEqual((await barra.locator('.nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Resumen', 'Asientos', 'Reportes', 'Plan de cuentas', 'Más']);
    assert.equal(await page.locator('.contabilidad-nav:visible').count(), 0, 'sin pestañas duplicadas en el teléfono');
    await barra.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('dialog', { name: 'Más opciones' }).getByRole('button', { name: 'Entidades' }).click();
    await page.waitForURL(u => u.pathname === '/contabilidad/entidades', { timeout: 20000 });
    console.log('Teléfono · Finanzas: barra inferior y Más → Entidades: OK');
    await ctx.close();
  }

  // Teléfono · Configuración
  {
    const { ctx, page } = await crear();
    await page.getByRole('button', { name: /Configuración/ }).click();
    await page.waitForURL(u => u.pathname === '/configuracion', { timeout: 20000 });
    assert.deepEqual((await page.locator('.barra-inferior-movil .nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Ajustes', 'Equipo', 'Clientes', 'Más']);
    console.log('Teléfono · Configuración: barra inferior: OK');
    await ctx.close();
  }

  // Escritorio · barras laterales por grupo
  {
    const { ctx, page } = await crear({ ancho: 1280, alto: 860 });
    await page.getByRole('button', { name: /Gestión comercial/ }).click();
    await page.waitForURL(u => u.pathname === '/pipeline', { timeout: 20000 });
    const lateral = page.locator('.barra-lateral .enlace-lateral');
    assert.deepEqual((await lateral.allInnerTexts()).map(t => t.trim()),
      ['Pipeline', 'Arriendos y ventas', 'Nueva propiedad', 'SEO y analítica']);
    assert.equal((await page.locator('.barra-lateral .etiqueta-lateral').innerText()).trim().toLowerCase(), 'comercial');

    await page.goto(base + '/inicio', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Hola/ }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /Operación de comunidades/ }).click();
    await page.waitForURL(u => u.pathname === '/inicio', { timeout: 20000 });
    const textos = (await lateral.allInnerTexts()).map(t => t.trim());
    for (const nombre of ['Inicio', 'Comunidades', 'Mantenciones', 'Proveedores', 'WhatsApp']) assert.ok(textos.includes(nombre), nombre);
    assert.ok(!textos.includes('Postulantes'), 'subsecciones solo dentro de Proveedores');
    await page.locator('.barra-lateral').getByRole('link', { name: 'Proveedores' }).click();
    await page.waitForURL(u => u.pathname === '/proveedores', { timeout: 20000 });
    const dentro = (await lateral.allInnerTexts()).map(t => t.trim());
    for (const nombre of ['Postulantes', 'Correos', 'Comunicaciones']) assert.ok(dentro.includes(nombre), nombre);
    assert.equal((await page.locator('.barra-lateral .etiqueta-lateral').innerText()).trim().toLowerCase(), 'operaciones');
    console.log('Escritorio · Comercial y Operaciones con sus secciones: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
