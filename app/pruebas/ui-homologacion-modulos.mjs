/**
 * QA de homologación de las pantallas públicas del Home.
 * Los perfiles y respuestas se simulan localmente en Chromium; no hay
 * consultas ni modificaciones a la BD real del usuario.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

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
  user:{id:userId,aud:'authenticated',role:'authenticated',
    email:'qa-local@coproactiva.test',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},
    created_at:new Date().toISOString()}
};
// Cuatro grupos en el selector; las demás secciones se abren dentro de su
// grupo (pestañas de Comercial, «Más» o barra lateral de Operaciones).
const areas=[
  {name:/Gestión comercial/,heading:/Pipeline comercial/,slug:'crm'},
  {name:/Operación de comunidades/,heading:/Hola/,slug:'operacion'},
  {name:/Gestión comercial/,seccion:['/propiedades','Arriendos y ventas'],heading:/Propiedades/,slug:'propiedades'},
  {name:/Operación de comunidades/,seccion:['/proveedores','Proveedores'],heading:/Proveedores/,slug:'proveedores'},
  {name:/Operación de comunidades/,seccion:['/whatsapp','WhatsApp'],heading:/WhatsApp/,slug:'whatsapp'},
  {name:/Gestión contable/,heading:/Contabilidad/,slug:'contabilidad'},
  {name:/Gestión comercial/,seccion:['/seo','SEO'],heading:/SEO y Analítica/,slug:'seo'},
  {name:/Configuración/,heading:/Configuración/,slug:'configuracion'}
];

async function abrirSeccion(page,ruta,etiqueta) {
  const link=page.locator('a[href="'+ruta+'"]:visible').first();
  if(await link.count()) return link.click();
  await page.getByRole('button',{name:'Más',exact:true}).last().click();
  await page.getByRole('dialog',{name:'Más opciones'}).getByRole('button',{name:new RegExp(etiqueta,'i')}).click();
}
await mkdir('artifacts/ui',{recursive:true});
const browser = await chromium.launch({headless:true});
try {
  for(const width of [390,1280]){
    const ctx = await browser.newContext({
      viewport:{width,height:850},isMobile:width<=390,hasTouch:width<=390,
      deviceScaleFactor:1,serviceWorkers:'block'
    });
    await ctx.addInitScript(({session})=>{
      localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
    },{session});
    await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
      const url=route.request().url();
      if(url.includes('/rest/v1/perfiles?'))return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({id:userId,nombre:'QA Coproactiva',rol:'superadmin',
          activo:true,bottom_nav:[],email:'qa-local@coproactiva.test'})
      });
      if(url.includes('/auth/v1/user'))return route.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify(session.user)
      });
      if(url.includes('/functions/v1/seo-propuestas'))return route.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({propuestas:[]})
      });
      if(url.includes('/functions/v1/'))return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({disponible:false,version:{conectado:false},error:'QA aislada',
          google:{disponible:false},problemas:[],paginas:[]})
      });
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    const page=await ctx.newPage();
    for(const area of areas){
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
      await page.getByRole('button',{name:area.name}).first().click();
      if(area.seccion){
        await page.waitForURL(u=>u.pathname!=='/',{timeout:17000});
        await abrirSeccion(page,...area.seccion);
      }
      await page.getByRole('heading',{name:area.heading}).first().waitFor({timeout:17000});
      const aspecto = await page.evaluate(()=>{
        const modulo=document.querySelector('.pantalla.modulo-unificado, .wa-page.modulo-unificado');
        if(!modulo)return {missing:true,ruta:location.pathname};
        const style=getComputedStyle(modulo);
        const html=document.documentElement;
        const encabezado=modulo.querySelector('.modulo-cabecera, .wa-header');
        return {
          ruta:location.pathname,
          fondo:style.backgroundColor,
          radio:style.getPropertyValue('--radio-tarjeta').trim(),
          ancho:window.innerWidth,
          documento:html.scrollWidth,
          encabezado:!!encabezado
        };
      });
      assert.ok(!aspecto.missing,area.slug+' sin estilo global '+JSON.stringify(aspecto));
      assert.equal(aspecto.radio,'16px',area.slug+' debe heredar radio corporativo');
      if(area.slug!=='whatsapp')
        assert.equal(aspecto.fondo,'rgb(247, 244, 240)',area.slug+' fondo cálido');
      assert.ok(aspecto.encabezado,area.slug+' sin encabezado homogéneo');
      if(width<=390)assert.ok(aspecto.documento<=aspecto.ancho+2,
        'Desbordamiento de '+area.slug+' '+JSON.stringify(aspecto));
      await page.screenshot({
        path:'artifacts/ui/homologado-'+area.slug+'-'+width+'.png',
        fullPage:false
      });
      console.log('UI '+area.slug+' @ '+width+': OK');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
