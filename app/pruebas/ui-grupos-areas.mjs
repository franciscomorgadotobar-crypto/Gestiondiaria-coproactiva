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

  // Doble organización del selector: módulos independientes y áreas.
  {
    const {ctx,page}=await crear();
    await page.getByRole('button',{name:'Cambiar vista'}).click();
    await page.getByRole('group',{name:'Organización'}).getByRole('button',{name:'Por módulos'}).click();
    await page.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),1);
    assert.equal(await page.locator('.seleccion-home__tarjeta').count(),9,'8 módulos originales y un acceso a conocimientos');
    assert.equal(await page.getByRole('button',{name:/Comunidades administradas, levantamientos y mantención/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),1);
    const originales=(await page.locator('.seleccion-home__tarjeta .seleccion-home__titulo').allInnerTexts());
    assert.deepEqual(originales,[
      'Gestión comercial','Levantamientos','Arriendos y ventas','Red de proveedores',
      'Recepción y atención','Gestión contable','SEO y Analítica','Base de conocimientos','Configuración'
    ]);
    await page.getByRole('button',{name:/SEO y Analítica/}).click();
    await page.waitForURL(u=>u.pathname==='/seo',{timeout:20000});
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Más'}).click();
    const mas=page.getByRole('dialog',{name:'Más opciones'});
    assert.equal(await mas.getByRole('group',{name:'Todos los módulos'}).count(),1);
    await mas.getByRole('button',{name:'Levantamientos',exact:true}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    assert.equal(await page.locator('.barra-inferior-movil').count(),1);
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Más'}).click();
    await page.getByRole('dialog',{name:'Más opciones'}).getByRole('button',{name:'Cambiar vista o módulo'}).click();
    await page.waitForURL(u=>u.pathname==='/',{timeout:15000});
    const cambiarVista=page.getByRole('button',{name:'Cambiar vista'});
    assert.match(await cambiarVista.innerText(),/Por módulos · Lista/,
      'La organización y presentación persisten al volver al Home');
    await cambiarVista.click();
    const menuVista=page.getByRole('dialog',{name:'Opciones de visualización'});
    const organizacion=menuVista.getByRole('group',{name:'Organización'});
    const presentacion=menuVista.getByRole('group',{name:'Presentación'});
    assert.equal(await organizacion.getByRole('button',{name:'Por módulos'}).getAttribute('aria-pressed'),'true');
    assert.equal(await presentacion.getByRole('button',{name:'Lista'}).getAttribute('aria-pressed'),'true');

    // Los dos ajustes funcionan de forma independiente, con cuatro combinaciones.
    await presentacion.getByRole('button',{name:'Cuadrícula'}).click();
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-cuadricula').count(),1);
    assert.equal(await page.locator('.seleccion-home__tarjeta').last().locator('.seleccion-home__titulo').innerText(),'Configuración');
    await organizacion.getByRole('button',{name:'Por áreas'}).click();
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-cuadricula').count(),1);
    assert.equal(await page.locator('.seleccion-home__administracion').count(),1,
      'Administración y ajustes queda al final de la vista por áreas');
    await presentacion.getByRole('button',{name:'Lista'}).click();
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-lista').count(),1);
    await organizacion.getByRole('button',{name:'Por módulos'}).click();
    assert.equal(await page.locator('.seleccion-home__tarjetas.vista-lista').count(),1);
    await menuVista.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    assert.equal(await cambiarVista.getAttribute('aria-expanded'),'false');
    await cambiarVista.click();
    await organizacion.getByRole('button',{name:'Por áreas'}).click();
    await menuVista.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    assert.equal(await page.locator('.seleccion-home__administracion').count(),1);
    console.log('Selector: 8 tarjetas originales + Base de conocimientos → SEO → Levantamientos → Por áreas: OK');
    await ctx.close();
  }

  // La cápsula educativa replica la mascota del CRM: temporal, lateral y enlazada a la lección.
  {
    const { ctx, page } = await crear({ ancho: 1280, alto: 850 });
    await page.getByRole('button', { name: /Operación de comunidades/ }).click();
    await page.waitForURL(u => u.pathname === '/inicio', { timeout: 20000 });
    const aviso = page.locator('.conocimiento-mascota.is-visible');
    await aviso.waitFor({ timeout: 10000 });
    const anterior = await aviso.locator('.conocimiento-mascota__texto').innerText();
    await aviso.getByRole('button', { name: 'Siguiente dato educativo' }).click();
    const siguiente = await aviso.locator('.conocimiento-mascota__texto').innerText();
    assert.notEqual(anterior, siguiente, 'No repetir inmediatamente una cápsula');
    await aviso.getByRole('button', { name: /Conoce más/ }).click();
    await page.waitForURL(u => u.pathname === '/conocimientos' && u.searchParams.has('capsula'), { timeout: 20000 });
    await page.getByRole('heading', { name: 'Desarrollo del tema', exact: true }).waitFor({timeout:15000});
    console.log('Cápsula lateral tipo mascota: bienvenida, siguiente y enlace a la ficha: OK');
    await ctx.close();
  }

  // Móvil: tres botones exactos, búsqueda a demanda y expansión en el mismo recuadro.
  {
    const {ctx,page}=await crear({ancho:390,alto:844});
    await page.getByRole('button',{name:'Cambiar vista'}).click();
    await page.getByRole('group',{name:'Organización'}).getByRole('button',{name:'Por módulos'}).click();
    await page.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    await page.getByRole('button',{name:/Base de conocimientos/}).click();
    await page.waitForURL(u=>u.pathname==='/conocimientos',{timeout:20000});
    const barra=page.locator('.barra-inferior-movil');
    assert.deepEqual((await barra.locator('.nav-movil-item').allInnerTexts()).map(x=>x.trim()),
      ['Aprendizaje','Buscar','Más'],'La barra exclusiva no duplica navegación');
    assert.equal(await page.locator('.conocimientos-filtros-escritorio:visible').count(),0,
      'El buscador no ocupa espacio en el listado');
    await page.locator('.conocimientos-tarjeta').first().waitFor({timeout:20000});
    assert.equal(await page.locator('.conocimientos-tarjeta').count(),202);
    const primera=page.locator('.conocimientos-tarjeta').first();
    await primera.locator('.conocimientos-tarjeta-resumen').click();
    assert.equal(await primera.locator('.conocimientos-tarjeta-desarrollo').count(),1);
    assert.equal(await page.locator('.conocimientos-tarjeta-desarrollo').count(),1);
    await primera.locator('.conocimientos-tarjeta-resumen').click();
    assert.equal(await primera.locator('.conocimientos-tarjeta-desarrollo').count(),0);
    await barra.getByRole('button',{name:'Buscar'}).click();
    const buscador=page.getByRole('dialog',{name:'Buscar en Base de conocimientos'});
    await buscador.waitFor();
    await buscador.getByRole('searchbox').fill('condominio');
    await buscador.getByRole('button',{name:/Ver \d+ contenidos/}).click();
    assert.ok((await page.locator('.conocimientos-tarjeta').count())>0);
    assert.ok((await page.locator('.conocimientos-tarjeta').count())<202,
      'La lupa filtra el catálogo');
    await barra.getByRole('button',{name:'Aprendizaje'}).click();
    assert.equal(await page.locator('.conocimientos-tarjeta').count(),202,
      'Aprendizaje recupera la biblioteca completa');
    await barra.getByRole('button',{name:'Más'}).click();
    const menu=page.getByRole('dialog',{name:'Más opciones'});
    const switchAvisos=menu.getByRole('switch',{name:'Mostrar avisos educativos automáticos'});
    assert.equal(await switchAvisos.getAttribute('aria-checked'),'true');
    await switchAvisos.click();
    assert.equal(await switchAvisos.getAttribute('aria-checked'),'false');
    await switchAvisos.click();
    assert.equal(await switchAvisos.getAttribute('aria-checked'),'true');
    console.log('Aprendizaje móvil: acordeones, lupa, filtros, barra de tres accesos y avisos: OK');
    await ctx.close();
  }

  // En escritorio el modo plano no obliga a pasar por un grupo.
  {
    const {ctx,page}=await crear({ancho:1280,alto:850});
    await page.getByRole('button',{name:'Cambiar vista'}).click();
    await page.getByRole('group',{name:'Organización'}).getByRole('button',{name:'Por módulos'}).click();
    await page.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    await page.getByRole('button',{name:/Levantamientos/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    const enlaces=page.locator('.barra-lateral .enlace-lateral');
    const titulos=await enlaces.allInnerTexts();
    for(const nombre of ['Gestión comercial','Levantamientos','Arriendos y ventas','Red de proveedores','Recepción y atención','Gestión contable','SEO y Analítica','Configuración'])
      assert.ok(titulos.includes(nombre), 'Falta módulo '+nombre);
    assert.equal(await page.locator('.barra-lateral .grupo-navegacion-boton').count(),0,
      'Modo módulos sin menú de grupos desplegables');
    await page.locator('.barra-lateral').getByRole('link',{name:'Base de conocimientos'}).click();
    await page.waitForURL(u=>u.pathname==='/conocimientos',{timeout:20000});
    await page.getByRole('heading',{name:'Base de conocimientos',exact:true}).waitFor();
    assert.equal(await page.locator('.conocimientos-tarjeta').count(),202,'El módulo lista las 202 cápsulas');
    const primera=page.locator('.conocimientos-tarjeta').first();
    await primera.locator('.conocimientos-tarjeta-resumen').click();
    await page.waitForURL(u=>u.pathname==='/conocimientos' && u.searchParams.has('capsula'));
    assert.equal(await primera.locator('.conocimientos-tarjeta-desarrollo').count(),1,
      'La explicación se expande dentro de su tarjeta');
    await primera.getByRole('heading',{name:'Desarrollo del tema'}).waitFor();
    assert.equal(await page.locator('.conocimientos-lectura').count(),0,'No existe lector separado');
    await page.locator('.barra-lateral').getByRole('link',{name:'SEO y Analítica'}).click();
    await page.waitForURL(u=>u.pathname==='/seo',{timeout:20000});
    assert.equal(await page.locator('.barra-lateral .enlace-lateral.activo').count(),1);
    console.log('Escritorio: Base de conocimientos independiente → 202 fichas → SEO: OK');
    await ctx.close();
  }

  // La vista por módulos respeta permisos y no confunde elementos de cuenta.
  {
    const {ctx,page}=await crear({rol:'jefatura'});
    await page.getByRole('button',{name:'Cambiar vista'}).click();
    await page.getByRole('group',{name:'Organización'}).getByRole('button',{name:'Por módulos'}).click();
    await page.getByRole('button',{name:'Cerrar opciones de vista'}).click();
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Contabilidad/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Configuración/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Levantamientos/}).count(),1);
    console.log('Jefatura: selector de módulos sin funciones restringidas: OK');
    await ctx.close();
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
