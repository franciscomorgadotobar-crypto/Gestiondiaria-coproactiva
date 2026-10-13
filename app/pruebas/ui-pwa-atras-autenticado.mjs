/*
 * Regresión en Chromium móvil con perfil Supabase simulado:
 * no se consulta ni modifica la base real.
 *
 * Nueva regla: abrir/reabrir la PWA siempre muestra el Home que corresponda
 * al rol. Solo una selección EXPLÍCITA abre SEO/CRM/otros módulos.
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
    await page.getByRole('button',{name:/SEO y Analítica/}).waitFor({timeout:15000});
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(await page.locator('.seo-pantalla').count(),0);
    const area=await page.evaluate(({userId})=>localStorage.getItem('coproactiva_area:'+userId),{userId});
    assert.equal(area,null,'el área recordada se elimina al abrir');

    // Solo al elegir el módulo debe entrar en SEO; Atrás retorna al Home.
    await page.getByRole('button',{name:/SEO y Analítica/}).click();
    await page.waitForURL(/\/seo(?:\?|$)/,{timeout:20000});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/',{timeout:10000});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:10000});
    console.log('PWA Home primero → selección de SEO → Atrás → Home: OK');
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
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.ok(await page.getByRole('button',{name:/Gestión comercial/}).count()>0);
    console.log('Jefatura → selector filtrado por permisos: OK');
    await ctx.close();
  }

  // Un usuario de terreno no recibe nunca el selector administrativo.
  {
    const {ctx,page}=await crearPagina('terreno');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    assert.equal(await page.getByRole('button',{name:/Gestión comercial/}).count(),0);
    assert.equal(new URL(page.url()).pathname,'/');
    console.log('Terreno → Inicio propio sin selector de módulos: OK');
    await ctx.close();
  }

  // El perfil cliente comienza en su portal, aunque la URL anterior fuera SEO.
  {
    const {ctx,page}=await crearPagina('cliente');
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname==='/portal',{timeout:20000});
    assert.equal(await page.getByRole('button',{name:/SEO y Analítica/}).count(),0);
    console.log('Cliente → portal propio sin selector administrativo: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
