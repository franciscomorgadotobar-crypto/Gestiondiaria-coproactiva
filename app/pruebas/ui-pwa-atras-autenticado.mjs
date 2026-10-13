/*
 * Regresión autenticada REAL en Chromium móvil.
 * Perfil y respuestas Supabase se simulan dentro del navegador local
 * (no se usan credenciales reales ni se modifica la base de producción).
 * Detecta el bug observado en Android: al entrar por la PWA en SEO,
 * Retroceder debe abrir / con el Home de módulos, NO salir al escritorio.
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
  async function crearPagina() {
    const ctx = await navegador.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:1,
      isMobile:true,hasTouch:true,serviceWorkers:'block'
    });
    await ctx.addInitScript(({session,userId})=>{
      localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
      localStorage.setItem('coproactiva_area:'+userId,'seo');
    },{session,userId});
    await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
      const url=route.request().url();
      if(url.includes('/rest/v1/perfiles?')) return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({
          id:userId,nombre:'QA Coproactiva',rol:'superadmin',
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
    const page = await ctx.newPage();
    page.on('pageerror',e=>console.error('QA pageerror:',e.message));
    return {ctx,page};
  }

  // Escenario exacto del video: PWA inicia en / (icono del escritorio), el
  // área recordada la lleva automáticamente a SEO y Android hace Atrás.
  {
    const {ctx,page}=await crearPagina();
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.waitForURL(/\/seo(?:\?|$)/,{timeout:20000});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    const antes=await page.evaluate(()=>({
      url:location.pathname,idx:history.state?.idx,history:history.length
    }));
    assert.ok(antes.idx>=1,'SEO necesita Home real detrás: '+JSON.stringify(antes));
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/',{timeout:10000});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:10000});
    assert.ok(await page.getByRole('button',{name:/SEO y Analítica/}).count()>0,
      'Atrás debe mostrar el selector de módulos, no /ingreso ni el escritorio');
    console.log('PWA entrada / → SEO recordado → ATRÁS → Home: OK');
    await ctx.close();
  }

  // PWA restaurada en URL /seo con un idx VIEJO de sesión anterior. El
  // arranque debe crear historial nuevo ANTES de montar el router.
  {
    const {ctx,page}=await crearPagina();
    await ctx.addInitScript(()=>{
      if(location.pathname==='/seo'){
        history.replaceState({
          idx:13,key:'sesion-antigua',usr:{desdeSelectorCoproactiva:true}
        },'',location.href);
      }
    });
    await page.goto(base+'/seo',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
    const antes=await page.evaluate(()=>({
      url:location.pathname,idx:history.state?.idx,
      state:history.state,history:history.length
    }));
    assert.equal(antes.idx,1,'El arranque debería reinicializar el stack: '+JSON.stringify(antes));
    await page.goBack();
    await page.waitForURL(url=>url.pathname==='/',{timeout:10000});
    await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:10000});
    console.log('PWA ruta /seo con estado antiguo → ATRÁS → Home: OK');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
