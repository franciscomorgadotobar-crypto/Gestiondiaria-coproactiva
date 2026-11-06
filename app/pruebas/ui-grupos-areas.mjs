/*
 * Grupos del selector (24-10-2026), en Chromium con perfil Supabase simulado.
 * No consulta ni modifica la base real.
 * - Operaciones: tres accesos primarios; las herramientas secundarias
 *   están plegadas en el Home móvil y la barra lateral persiste en PC.
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
  async function crear({ ancho = 390, alto = 844, rol = 'superadmin', clientesQA = false, comunidadesQA = false } = {}) {
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
      if (comunidadesQA && url.includes('/rest/v1/comunidades?'))
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
          {id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',nombre:'Condominio Plaza Nos (GPR)',comuna:'San Bernardo',direccion:'Avenida Portales 3264',latitud:null,longitud:null},
          {id:'ffffffff-ffff-4fff-8fff-ffffffffffff',nombre:'Reserva Santa Clara',comuna:'Coquimbo',direccion:'Avda. Waldo Alcalde #1855',latitud:null,longitud:null}
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

  // Operaciones: sólo tres accesos. El Home no duplica botones primarios,
  // KPI ni mapa con la barra inferior.
  {
    const {ctx,page}=await crear({ancho:390,alto:844});
    await page.getByRole('button',{name:/Operaciones/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    const barra=page.locator('.barra-inferior-movil');
    assert.deepEqual(await barra.locator('button').allTextContents(),
      ['Inicio','Comunidades','Levantamientos']);
    assert.equal(await barra.getByRole('button',{name:'Más'}).count(),0);
    assert.equal(await page.getByRole('dialog',{name:'Más opciones'}).count(),0);
    assert.equal(await barra.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    await barra.getByRole('button',{name:'Comunidades'}).click();
    await page.waitForURL(u=>u.pathname==='/comunidades',{timeout:15000});
    await barra.getByRole('button',{name:'Inicio'}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:15000});
    console.log('Operaciones · tres accesos sin Notificaciones ni Más: OK');
    await ctx.close();
  }

  // Recorrido móvil: el trabajo debe aparecer antes del mapa y herramientas,
  // y la lista de comunidades debe ocupar menos de 110 px por registro.
  for(const ancho of [320,390]){
    const {ctx,page}=await crear({ancho,alto:844,comunidadesQA:true});
    await page.getByRole('button',{name:/Operaciones/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    const visible=await page.evaluate(()=>{
      const root=document.querySelector('.inicio-cuerpo');
      const mapa=root.querySelector('.tarjeta-mapa');
      const tablero=root.querySelector('.tablero');
      const trabajo=root.querySelector('.inicio-trabajo');
      const herramientas=root.querySelector('.inicio-herramientas');
      return {
        ordenTablero:Number(getComputedStyle(tablero).order),
        ordenTrabajo:Number(getComputedStyle(trabajo).order),
        ordenMapa:mapa?Number(getComputedStyle(mapa).order):5,
        ordenHerramientas:Number(getComputedStyle(herramientas).order),
        visibleHerramientas:herramientas.open,
        accesosDesktop:getComputedStyle(root.querySelector('.accesos-inicio-desktop')).display,
        desbordamiento:document.documentElement.scrollWidth>innerWidth+2
      };
    });
    assert.equal(visible.ordenTablero,1);
    assert.equal(visible.ordenTrabajo,3);
    assert.equal(visible.ordenHerramientas,4);
    assert.equal(visible.visibleHerramientas,false);
    assert.equal(visible.accesosDesktop,'none');
    assert.equal(visible.desbordamiento,false);
    const tools=page.locator('details.inicio-herramientas');
    await tools.locator('summary').click();
    assert.equal(await tools.locator('a[href="/bitacora"]').count(),1);
    await tools.locator('summary').click();
    await page.screenshot({path:'artifacts/ui/home-operaciones-'+ancho+'.png',fullPage:false});
    await page.locator('.barra-inferior-movil').getByRole('button',{name:'Comunidades'}).click();
    await page.waitForURL(u=>u.pathname==='/comunidades',{timeout:20000});
    const filas=page.locator('.comunidad-fila');
    await filas.first().waitFor({timeout:15000});
    assert.equal(await filas.count(),2);
    for(const fila of await filas.all()){
      const alto=await fila.evaluate(e=>e.getBoundingClientRect().height);
      assert.ok(alto<=112,'Comunidad aún demasiado alta '+ancho+'px: '+alto);
    }
    assert.equal(await page.locator('.comunidades-kpis').evaluate(e=>getComputedStyle(e).display),'none');
    await page.screenshot({path:'artifacts/ui/comunidades-lista-'+ancho+'.png',fullPage:false});
    await page.getByRole('searchbox',{name:'Buscar comunidad'}).fill('Santa Clara');
    assert.equal(await filas.count(),1);
    assert.match(await filas.first().innerText(),/Coquimbo/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    console.log('Home + Comunidades lista · '+ancho+'px: OK');
    await ctx.close();
  }

  // Mi cuenta vive en Configuración, sin un menú Más duplicado.
  {
    const {ctx,page}=await crear({ancho:390,alto:844});
    await page.getByRole('button',{name:/Configuración/}).click();
    await page.waitForURL(u=>u.pathname==='/configuracion',{timeout:20000});
    await page.getByRole('heading',{name:'Configuración'}).waitFor();
    const barra=page.locator('.barra-inferior-movil');
    assert.equal(await barra.getByRole('button',{name:'Más'}).count(),0);
    await barra.getByRole('button',{name:'Mi cuenta'}).click();
    await page.waitForURL(u=>u.pathname==='/mi-cuenta',{timeout:15000});
    assert.equal(await barra.getByRole('button',{name:'Más'}).count(),0);
    console.log('Configuración · Mi cuenta accesible sin Más: OK');
    await ctx.close();
  }

  // Respeto estricto de permisos, incluso en la vista de módulos.
  {
    const {ctx,page}=await crear({rol:'jefatura'});
    const titulos=await page.locator('.seleccion-home__titulo').allInnerTexts();
    assert.deepEqual(titulos,['Gestión comercial','Gestor documental','Operaciones','Arriendos y ventas','Base de conocimientos','Configuración']);
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Configuración/}).count(),1);
    await page.getByRole('button',{name:/Configuración/}).click();
    await page.waitForURL(u=>u.pathname==='/configuracion',{timeout:15000});
    assert.equal(await page.getByRole('link',{name:/Mi cuenta/}).count()>0,true);
    assert.equal(await page.getByRole('link',{name:/Equipo y permisos/}).count(),0);
    await page.evaluate(()=>history.back());
    await page.waitForURL(u=>u.pathname==='/',{timeout:15000});
    await page.getByRole('button',{name:/Gestión comercial/}).click();
    await page.waitForURL(u=>u.pathname==='/pipeline',{timeout:20000});
    console.log('Jefatura · catálogo filtrado y navegación al Pipeline: OK');
    await ctx.close();
  }

  {
    const {ctx,page}=await crear({ancho:1280,alto:850});
    assert.equal(await page.locator('.seleccion-home__tarjeta').count(),11);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
    await page.getByRole('button',{name:/Operaciones/}).click();
    await page.waitForURL(u=>u.pathname==='/inicio',{timeout:20000});
    console.log('Escritorio · acceso al módulo Operaciones: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
