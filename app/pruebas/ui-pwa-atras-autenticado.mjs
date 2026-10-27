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

  // Apertura nueva: Home único, nunca se restaura SEO desde un área guardada.
  {
    const {ctx,page}=await crearPagina();
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    await page.getByRole('heading',{name:'Módulos de trabajo'}).waitFor();
    assert.equal(await page.locator('.seleccion-home').count(),0);
    assert.equal(await page.locator('.seo-pantalla').count(),0);
    const area=await page.evaluate(({userId})=>localStorage.getItem('coproactiva_area:'+userId),{userId});
    assert.equal(area,null,'la preferencia de área antigua no modifica la apertura');
    await page.getByRole('button',{name:/Comercial/}).click();
    await page.getByRole('link',{name:/SEO y Analítica/}).click();
    await page.waitForURL(url=>url.pathname==='/seo',{timeout:20000});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    // Al recargar, sigue en el mismo módulo y conserva sus filtros.
    await page.getByRole('combobox',{name:'Período de análisis'}).selectOption('90');
    await page.getByRole('combobox',{name:'Sección de SEO'}).selectOption('business');
    await page.waitForURL(url=>url.pathname==='/seo'
       && url.searchParams.get('vista')==='business'
       && url.searchParams.get('dias')==='90',{timeout:12000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    assert.equal(new URL(page.url()).searchParams.get('vista'),'business');
    assert.equal(await page.getByRole('combobox',{name:'Período de análisis'}).inputValue(),'90');
    // Retroceso consecutivo: SEO Business → SEO Resumen → Home.
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(url=>url.pathname==='/seo' && !url.searchParams.has('vista'),{timeout:15000});
    await page.locator('.barra-area-volver').click();
    await page.waitForURL(url=>url.pathname==='/',{timeout:15000});
    await page.getByRole('heading',{name:'Módulos de trabajo'}).waitFor();
    console.log('PWA Inicio → SEO → filtros → recarga → Inicio único: OK');
    await ctx.close();
  }

  // Chrome/PWA reabierto en URL antigua: la nueva apertura regresa al Home.
  {
    const {ctx,page}=await crearPagina();
    await ctx.addInitScript(()=>{
      if(location.pathname==='/seo') history.replaceState(
        {idx:13,key:'sesion-antigua',usr:{desdeSelectorCoproactiva:true}},'',location.href);
    });
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname==='/',{timeout:20000});
    await page.getByRole('heading',{name:'Módulos de trabajo'}).waitFor();
    assert.equal(await page.locator('.seo-pantalla').count(),0);
    console.log('PWA restablecida → Home único: OK');
    await ctx.close();
  }

  // Jefatura ve Comercial y Operaciones sin acceso a Finanzas ni SEO.
  {
    const {ctx,page}=await crearPagina('jefatura');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Módulos de trabajo'}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:/Finanzas/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Administración y ajustes/}).count(),0);
    await page.getByRole('button',{name:/Comercial/}).click();
    assert.equal(await page.getByRole('link',{name:/SEO y Analítica/}).count(),0);
    await page.getByRole('link',{name:/Pipeline comercial/}).click();
    await page.waitForURL(url=>url.pathname==='/pipeline',{timeout:20000});
    console.log('Jefatura → Home filtrado y Pipeline: OK');
    await ctx.close();
  }

  // Terreno utiliza exactamente el mismo Home pero solo ve sus módulos.
  {
    const {ctx,page}=await crearPagina('terreno');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Módulos de trabajo'}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:/Comercial/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Finanzas/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Operaciones/}).count(),1);
    console.log('Terreno → Home único de operaciones: OK');
    await ctx.close();
  }

  // Cliente sigue aislado en portal (sin Home administrativo).
  {
    const {ctx,page}=await crearPagina('cliente');
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname==='/portal',{timeout:20000});
    assert.equal(await page.locator('.home-general').count(),0);
    console.log('Cliente → portal propio: OK');
    await ctx.close();
  }

} finally {
  await navegador.close();
}
