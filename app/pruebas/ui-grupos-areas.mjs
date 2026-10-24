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
    assert.equal(await menu.getByRole('group', { name: 'Módulos y acciones de Operaciones' }).count(), 1);
    assert.equal(await menu.getByRole('group', { name: 'Cuenta y navegación' }).count(), 1);
    for (const nombre of ['Proveedores', 'WhatsApp']) assert.equal(await menu.getByRole('button', { name: nombre }).count(), 1, nombre);
    await menu.getByRole('button', { name: 'Proveedores' }).click();
    await page.waitForURL(u => u.pathname === '/proveedores', { timeout: 20000 });
    assert.equal(await page.locator('.barra-inferior-movil').count(), 1, 'Proveedores conserva la barra de Operaciones');
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(u => u.pathname === '/inicio', { timeout: 10000 });
    console.log('Teléfono · Operaciones: Más → Proveedores → Volver → Inicio: OK');
    await ctx.close();
  }

  // Teléfono pequeño · «Más» debe caber y poder desplazar opciones largas.
  {
    const {ctx,page} = await crear({ancho:360,alto:550});
    await page.getByRole('button',{name:/Operación de comunidades/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Más'}).click();
    const menu=page.getByRole('dialog',{name:'Más opciones'});
    await menu.waitFor();
    const medidas=await menu.evaluate(el=>{
      const r=el.getBoundingClientRect(), nav=document.querySelector('.barra-inferior-movil');
      return {top:r.top,bottom:r.bottom,navTop:nav.getBoundingClientRect().top,
        scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
    });
    assert.ok(medidas.top>=-1&&medidas.bottom<=medidas.navTop+2,
      'Menú Más no puede ocupar la barra de navegación ni salir de la pantalla: '+JSON.stringify(medidas));
    assert.ok(medidas.scrollHeight>=medidas.clientHeight,'menú permite contenido largo');
    await menu.getByRole('button',{name:'Cambiar de área'}).click();
    await page.waitForURL(u=>u.pathname==='/',{timeout:15000});
    console.log('Móvil 360x550 · Más desplazable y con navegación accesible: OK');
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
    for (const nombre of ['Nueva propiedad', 'Cambiar de área'])
      assert.equal(await menu.getByRole('button', { name: nombre }).count(), 1, nombre);
    await menu.getByRole('button', { name: 'Nueva propiedad' }).click();
    await page.waitForURL(u => u.pathname === '/propiedades/nueva', { timeout: 20000 });
    await barra.getByRole('button', { name: 'Arriendos' }).click();
    await page.waitForURL(u => u.pathname === '/propiedades', { timeout: 20000 });
    await barra.getByRole('button', { name: 'SEO', exact: true }).click();
    await page.waitForURL(u => u.pathname === '/seo', { timeout: 20000 });
    await page.getByRole('combobox', { name: 'Sección de SEO' }).waitFor({ timeout: 20000 });
    assert.equal(await page.locator('.barra-inferior-movil').count(), 1, 'SEO mantiene barra Comercial');
    assert.equal(await page.locator('.seo-barra-inferior').count(), 0, 'sin barra SEO duplicada');
    await barra.getByRole('button', { name: 'Más' }).click();
    const menuSEO = page.getByRole('dialog', { name: 'Más opciones' });
    assert.equal(await menuSEO.getByRole('group', { name: 'Cuenta y navegación' }).count(), 1);
    assert.equal(await menuSEO.getByRole('group', { name: /Módulos y acciones/ }).count(), 0,
      'SEO sin acciones ajenas no muestra un grupo vacío');
    assert.equal(await menuSEO.getByRole('button', { name: 'Nueva propiedad' }).count(), 0,
      'SEO no debe mostrar acciones de Arriendos');
    assert.equal(await menuSEO.getByRole('link', { name: /Mi cuenta/ }).count(), 1);
    assert.equal(await menuSEO.getByRole('button', { name: /Cambiar de área/ }).count(), 1);
    await page.getByRole('button', { name: 'Cerrar menú' }).click();
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

  // Teléfono · Administración y ajustes
  {
    const { ctx, page } = await crear();
    await page.getByRole('button', { name: /Administración y ajustes/ }).click();
    await page.waitForURL(u => u.pathname === '/configuracion', { timeout: 20000 });
    assert.deepEqual((await page.locator('.barra-inferior-movil .nav-movil-item').allInnerTexts()).map(x => x.trim()),
      ['Ajustes', 'Equipo', 'Clientes', 'Más']);
    console.log('Teléfono · Configuración: barra inferior: OK');
    await ctx.close();
  }

  // Teléfono · Clientes: listado primero, ficha y permisos en secciones separadas.
  {
    const {ctx, page} = await crear({clientesQA:true});
    await page.getByRole('button',{name:/Administración y ajustes/}).click();
    await page.waitForURL(u=>u.pathname==='/configuracion');
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Clientes'}).click();
    await page.waitForURL(u=>u.pathname==='/clientes');
    await page.getByRole('heading',{name:'Clientes y accesos'}).waitFor();
    const ejesClientes=await page.evaluate(()=>{
      const cabeza=document.querySelector('.clientes-pantalla .modulo-cabecera');
      const cuerpo=document.querySelector('.clientes-pantalla .clientes-cuerpo');
      return [parseFloat(getComputedStyle(cabeza).paddingLeft),
        parseFloat(getComputedStyle(cuerpo).paddingLeft)];
    });
    assert.ok(Math.abs(ejesClientes[0]-ejesClientes[1])<=1,
      'Clientes mantiene cabecera y contenido alineados: '+JSON.stringify(ejesClientes));
    assert.equal(await page.locator('.clientes-lista-item').count(),1,'por defecto solo activos');
    assert.equal(await page.locator('.clientes-ficha').count(),0,'ninguna ficha abierta automáticamente');
    assert.equal(await page.locator('.barra-area-cambiar').count(),0,'sin botón Cambiar de área duplicado arriba');
    await page.getByRole('checkbox',{name:'Mostrar inactivos'}).check();
    assert.equal(await page.locator('.clientes-lista-item').count(),2,'puede mostrar las cuentas dadas de baja');
    await page.getByRole('button',{name:'Abrir ficha de Cliente QA activo'}).click();
    await page.waitForURL(u=>u.pathname==='/clientes' && u.searchParams.has('cliente'));
    await page.getByRole('heading',{name:'Cliente QA activo'}).waitFor();
    assert.equal(await page.locator('.clientes-lista-item').count(),0,'ficha reemplaza a listado');
    await page.getByRole('tab',{name:'Comunidades y permisos'}).click();
    await page.getByRole('button',{name:/Ver permisos de Comunidad QA/}).click();
    await page.getByText('Control mensual',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Actividad'}).click();
    await page.getByText('Detalle de uso todavía no disponible').waitFor();
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(u=>u.pathname==='/clientes' && !u.searchParams.has('cliente'));
    assert.equal(await page.locator('.clientes-lista-item').count(),2);
    assert.equal(await page.locator('.barra-inferior-movil').count(),1);
    console.log('Clientes: listado activo → ficha → permisos → actividad → volver al listado: OK');
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
    assert.deepEqual((await page.locator('.barra-lateral .grupo-navegacion-boton').allInnerTexts()).map(t => t.trim().replace(/[⌄›]/g, '').trim()),
      ['Comercial', 'Operaciones', 'Finanzas', 'Administración y ajustes']);
    assert.equal(await page.locator('.barra-lateral .grupo-navegacion-boton.activo').count(), 1);

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
    assert.equal(await page.locator('.barra-lateral .grupo-navegacion-boton.activo').innerText().then(t => t.includes('Operaciones')), true);
    // En escritorio se cambia de área desde el propio menú, sin volver
    // al selector; SEO conserva el menú Comercial visible.
    await page.locator('.grupo-navegacion-boton').filter({ hasText: 'Comercial' }).click();
    await page.waitForURL(u => u.pathname === '/pipeline', { timeout: 15000 });
    await page.locator('.barra-lateral').getByRole('link', { name: 'SEO y analítica' }).click();
    await page.waitForURL(u => u.pathname === '/seo', { timeout: 15000 });
    assert.equal(await page.locator('.grupo-navegacion-boton.activo').innerText().then(t => t.includes('Comercial')), true);
    await page.locator('.grupo-navegacion-boton').filter({ hasText: 'Finanzas' }).click();
    await page.waitForURL(u => u.pathname === '/contabilidad', { timeout: 15000 });
    await page.locator('.grupo-navegacion-boton').filter({ hasText: 'Administración y ajustes' }).click();
    await page.waitForURL(u => u.pathname === '/configuracion', { timeout: 15000 });
    await page.getByRole('heading', { name: 'Administración y ajustes' }).waitFor({ timeout: 15000 });
    console.log('Escritorio · cambio directo entre áreas, SEO y Administración: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
