/*
 * Chromium móvil con perfil Supabase simulado (no toca la base real).
 * El botón del correo de nuevo prospecto (`/pipeline?etapa=nuevo&origen=correo`)
 * abre Pipeline directo en una apertura nueva, con el Home único detrás y el área
 * CRM elegida. Una URL interna sin esa marca sigue abriendo el Home.
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
  async function abrir(ruta) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block'
    });
    await ctx.addInitScript(({ session }) => {
      localStorage.setItem('sb-sin-configurar-auth-token', JSON.stringify(session));
    }, { session });
    await ctx.route('https://sin-configurar.supabase.co/**', async route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/perfiles?')) return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: userId, nombre: 'QA', rol: 'superadmin', activo: true, bottom_nav: [], email: 'qa-local@coproactiva.test' })
      });
      if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const page = await ctx.newPage();
    await page.goto(base + ruta, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    return { ctx, page };
  }

  {
    const { ctx, page } = await abrir('/pipeline?etapa=nuevo&origen=correo');
    const url = new URL(page.url());
    assert.equal(url.pathname, '/pipeline', 'abre Pipeline, no el Home');
    assert.equal(url.search, '?etapa=nuevo', 'sin la marca origen');
    assert.equal(await page.evaluate(id => localStorage.getItem('coproactiva_area:' + id), userId), 'comercial');
    assert.equal(await page.getByText('Módulos de trabajo').count(), 0);
    await page.goBack();
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/', 'Atrás vuelve al Home');
    console.log('OK enlace de correo → Pipeline; Atrás → Home');
    await ctx.close();
  }

  {
    const { ctx, page } = await abrir('/pipeline');
    assert.equal(new URL(page.url()).pathname, '/', 'sin marca mantiene la política de Home');
    assert.ok(await page.getByText('Módulos de trabajo').count() > 0);
    console.log('OK /pipeline sin marca → Home');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
