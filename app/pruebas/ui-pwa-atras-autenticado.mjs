/*
 * Regresión en Chromium móvil con perfil Supabase simulado:
 * no se consulta ni modifica la base real.
 *
 * Apertura nueva muestra Home según perfil. Una recarga conserva la página,
 * la pestaña y el período de SEO. Solo una selección EXPLÍCITA abre módulos
 * tras una apertura nueva.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const userId = 'aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ahora = Math.floor(Date.now()/1000);
const jwt = [
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:ahora+7200})).toString('base64url'),
  'firma-de-prueba-local'
].join('.');
const session = {
  access_token:jwt,token_type:'bearer',expires_in:7200,expires_at:ahora+7200,
  refresh_token:'refresh-de-prueba-local',
  user:{
    id:userId,aud:'authenticated',role:'authenticated',
    email:'qa-local@coproactiva.test',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},
    created_at:new Date().toISOString()
  }
};

const navegador = await chromium.launch({headless:true});
try {
  async function crearPagina(rol='superadmin') {
    const ctx = await navegador.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:1,
      isMobile:true,hasTouch:true,serviceWorkers:'block'
    });
    await ctx.addInitScript(({session,userId})=>{
      localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
      localStorage.setItem('coproactiva_area:'+userId,'seo'); // preferencia antigua: NO debe autorestaurarse
    },{session,userId});
    await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
      const url=route.request().url();
      if(url.includes('/rest/v1/perfiles?')) return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({
          id:userId,nombre:'QA Coproactiva',rol,
          activo:true,bottom_nav:[],email:'qa-local@coproactiva.test'
        })
      });
      if(url.includes('/auth/v1/user')) return route.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify(session.user)
      });
      if(url.includes('/functions/v1/')) return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({disponible:false,google:{disponible:false},error:'Datos QA aislados'})
      });
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    const page=await ctx.newPage();
    page.on('pageerror',e=>console.error('QA pageerror:',e.message));
    return {ctx,page};
  }

  // Al tocar el ícono, SEO guardado no puede abrirse automáticamente.
  {
    const {ctx,page}=await crearPagina();
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    await page.getByRole('button',{name:/Gestión comercial/}).waitFor({timeout:15000});
    // Cuatro grupos: Comercial, Operaciones, Finanzas y Configuración.
    for(const nombre of [/Gestión comercial/,/Operación de comunidades/,/Gestión contable/,/Configuración/])
      assert.equal(await page.getByRole('button',{name:nombre}).count(),1,String(nombre));
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica|Red de proveedores|Recepción y atención/}).count(),0);
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(await page.locator('.seo-pantalla').count(),0);
    const area=await page.evaluate(({userId})=>localStorage.getItem('coproactiva_area:'+userId),{userId});
    assert.equal(area,null,'el área recordada se elimina al abrir');

    // Solo al elegir el grupo se entra; SEO es una sección de Comercial.
    await page.getByRole('button',{name:/Gestión comercial/}).click();
    await page.waitForURL(url=>url.pathname==='/pipeline',{timeout:20000});
    const pestanas=page.locator('.subnav-grupo-movil .subnav-grupo-item');
    assert.deepEqual(await pestanas.allInnerTexts(),['Pipeline','Arriendos y ventas','SEO y analítica']);
    await page.locator('.subnav-grupo-movil').getByRole('link',{name:'SEO y analítica'}).click();
    await page.waitForURL(/\/seo(?:\?|$)/,{timeout:20000});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});

    // La recarga no debe hacer volver al selector ni borrar filtros.
    await page.getByRole('combobox',{name:'Período de análisis'}).selectOption('90');
    await page.getByRole('button',{name:'Ir a Google Maps'}).click();
    await page.waitForURL(url=>url.pathname==='/seo'
      && url.searchParams.get('vista')==='business'
      && url.searchParams.get('dias')==='90',{timeout:12000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    assert.equal(new URL(page.url()).pathname,'/seo','recarga conserva SEO');
    assert.equal(new URL(page.url()).searchParams.get('vista'),'business','recarga conserva Google Maps');
    assert.equal(await page.getByRole('combobox',{name:'Período de análisis'}).inputValue(),'90','recarga conserva días');
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),0,'sin selector tras recarga');
    console.log('SEO → Google Maps · 90 días → recarga → misma vista y período: OK');

    // Atrás desde la pestaña recupera primero el Dashboard y luego Home.
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/seo' && !url.searchParams.has('vista'),{timeout:10000});
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/pipeline',{timeout:10000});
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/',{timeout:10000});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:10000});
    console.log('PWA Home → Comercial → SEO → Atrás → Pipeline → Home: OK');
    await ctx.close();
  }

  // Chrome/PWA reabre el documento de un módulo con estado de historial viejo.
  // La URL se sustituye por el Home ANTES de montar BrowserRouter.
  {
    const {ctx,page}=await crearPagina();
    await ctx.addInitScript(()=>{
      if(location.pathname==='/seo'){
        history.replaceState({idx:13,key:'sesion-antigua',usr:{desdeSelectorCoproactiva:true}},'',location.href);
      }
    });
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(await page.locator('.seo-pantalla').count(),0);
    assert.equal(await page.evaluate(()=>history.state?.idx),0);
    console.log('PWA restaurada en /seo → Home directo sin reabrir SEO: OK');
    await ctx.close();
  }

  // Jefatura ve el selector con sus áreas autorizadas y nunca SEO ni Contabilidad.
  {
    const {ctx,page}=await crearPagina('jefatura');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:/Gestión contable/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Configuración/}).count(),0);
    assert.ok(await page.getByRole('button',{name:/Gestión comercial/}).count()>0);
    assert.ok(await page.getByRole('button',{name:/Operación de comunidades/}).count()>0);
    await page.getByRole('button',{name:/Gestión comercial/}).click();
    await page.waitForURL(url=>url.pathname==='/pipeline',{timeout:20000});
    assert.deepEqual(await page.locator('.subnav-grupo-movil .subnav-grupo-item').allInnerTexts(),['Pipeline','Arriendos y ventas']);
    console.log('Jefatura → selector y Comercial filtrados por permisos: OK');
    await ctx.close();
  }

  // Un usuario de terreno no recibe nunca el selector administrativo.
  {
    const {ctx,page}=await crearPagina('terreno');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Operación de comunidades/}).count(),0);
    assert.equal(new URL(page.url()).pathname,'/');
    console.log('Terreno → Inicio propio sin selector de módulos: OK');
    await ctx.close();
  }

  // El perfil cliente comienza en su portal, aunque la URL anterior fuera SEO.
  {
    const {ctx,page}=await crearPagina('cliente');
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname==='/portal',{timeout:20000});
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),0);
    console.log('Cliente → portal propio sin selector administrativo: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
