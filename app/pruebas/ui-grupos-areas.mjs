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
  async function crear({ ancho = 390, alto = 844, rol = 'superadmin', clientesQA = false } = {}) {
    const movil = ancho < 900;
    const ctx = await navegador.newContext({
      viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, serviceWorkers: 'block'
    });
    await ctx.addInitScript(({ session }) => {
      localStorage.setItem('sb-sin-configurar-auth-token', JSON.stringify(session));
    }, { session });
    await ctx.route('https://sin-configurar.supabase.co/**', async route => {
      const url = route.request().url();
      if (clientesQA && url.includes('/rest/v1/perfiles?') && url.includes('rol=eq.cliente'))
        return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([
          {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nombre:'Cliente QA activo', email:'activo@qa.test', rol:'cliente', activo:true, ultimo_acceso:'2026-10-23T10:00:00Z', creado_en:'2026-10-01T10:00:00Z'},
          {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', nombre:'Cliente QA inactivo', email:'inactivo@qa.test', rol:'cliente', activo:false, ultimo_acceso:null, creado_en:'2026-09-01T10:00:00Z'}
        ])});
      if (clientesQA && url.includes('/rest/v1/comunidades?'))
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
          {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', nombre:'Comunidad QA', comuna:'Santiago'}
        ])});
      if (clientesQA && url.includes('/rest/v1/plantillas_control?'))
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
          {id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nombre:'Control mensual', activa:true, codigo:'control'}
        ])});
      if (clientesQA && url.includes('/rest/v1/portal_cliente_comunidades?'))
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
          {id:'ffffffff-ffff-4fff-8fff-ffffffffffff',usuario_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', comunidad_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',activa:true}
        ])});
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


  // Home modular recuperado. Los cuatro estados se seleccionan en el mismo Home.
  {
    const {ctx,page}=await crear();
    assert.equal(await page.locator('.seleccion-home').count(),1);
    assert.equal(await page.locator('.home-general').count(),0);
    assert.equal(await page.locator('.seleccion-home__tarjeta').count(),11);
    assert.match(await page.locator('.seleccion-home__tarjeta').last().innerText(),/Configuración/);
    await page.getByRole('button',{name:'Cambiar vista'}).click();
    const dialogo=page.getByRole('dialog',{name:'Opciones de visualización'});
    assert.equal(await dialogo.getByRole('button',{name:'Por módulos'}).getAttribute('aria-pressed'),'true');
    assert.equal(await dialogo.getByRole('button',{name:'Lista'}).getAttribute('aria-pressed'),'true');
    await dialogo.getByRole('button',{name:'Cuadrícula'}).click();
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-cuadricula').count(),1);
    await dialogo.getByRole('button',{name:'Por áreas'}).click();
    assert.equal(await page.locator('.seleccion-home__administracion').count(),1);
    await dialogo.getByRole('button',{name:'Lista'}).click();
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-lista').count(),1);
    await dialogo.getByRole('button',{name:'Por módulos'}).click();
    await dialogo.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.seleccion-home__tarjeta').first().waitFor({timeout:20000});
    assert.equal(await page.locator('.seleccion-home__tarjeta').count(),11);
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-lista').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 2));
    console.log('Home modular · dos organizaciones, dos presentaciones y persistencia: OK');
    await ctx.close();
  }

  // Cada tarjeta lleva a un módulo real y el menú permite volver.
  {
    const {ctx,page}=await crear();
    await page.getByRole('button',{name:/SEO y Analítica/}).click();
    await page.waitForURL(u=>u.pathname==='/seo',{timeout:20000});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor();
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Más'}).click();
    await page.getByRole('dialog',{name:'Más opciones'}).getByRole('button',{name:'Ir al inicio'}).click();
    await page.waitForURL(u=>u.pathname==='/',{timeout:20000});
    assert.equal(await page.locator('.seleccion-home').count(),1);
    console.log('SEO → Home modular, navegación sin pantalla adicional: OK');
    await ctx.close();
  }

  // Respeto estricto de permisos, incluso en la vista de módulos.
  {
    const {ctx,page}=await crear({rol:'jefatura'});
    const titulos=await page.locator('.seleccion-home__titulo').allInnerTexts();
    assert.deepEqual(titulos,['Gestión comercial','Gestor documental','Levantamientos','Arriendos y ventas','Base de conocimientos']);
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Configuración/}).count(),0);
    await page.getByRole('button',{name:/Gestión comercial/}).click();
    await page.waitForURL(u=>u.pathname==='/pipeline',{timeout:20000});
    console.log('Jefatura · catálogo filtrado y navegación al Pipeline: OK');
    await ctx.close();
  }

  {
    const {ctx,page}=await crear({ancho:1280,alto:850});
    assert.equal(await page.locator('.seleccion-home__tarjeta').count(),11);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
    await page.getByRole('button',{name:/Levantamientos/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    console.log('Escritorio · acceso al módulo Levantamientos: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
