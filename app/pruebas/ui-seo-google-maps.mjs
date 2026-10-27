/**
 * QA móvil de SEO y Google Maps con respuestas de Google/Supabase SIMULADAS.
 * Nunca accede a credenciales ni datos de producción.
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
const respuestaPerfil = {
  disponible:true,inicio:'2026-09-17',fin:'2026-10-14',consultadoEn:new Date().toISOString(),
  resumen:{impresionesMaps:101,impresionesBusqueda:202,clicsWeb:9,
    clicsTelefono:3,indicaciones:7},
  anterior:{inicio:'2026-08-20',fin:'2026-09-16',
    resumen:{impresionesMaps:80,impresionesBusqueda:180,clicsWeb:6,clicsTelefono:2,indicaciones:5}},
  metricas:{},palabras:[],nota:'Datos locales QA'
};
const resumen = {
  searchConsole:{disponible:true,totales:{clics:64,impresiones:3822,ctr:0.017,posicion:9.1},
    anterior:{clics:50,impresiones:3000,ctr:0.013,posicion:11.2},tendencia:[],consultas:[],paginas:[],hasta:'2026-10-14'},
  analytics:{disponible:true,totales:{sesiones:68,usuarios:31},
    anterior:{sesiones:50,usuarios:25},eventos:[{clave:'generate_lead',valores:[3,0]}],
    eventosAnteriores:[{clave:'generate_lead',valores:[2,0]}],
    tendencia:[],canales:[],paginas:[]}
};
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    deviceScaleFactor:1,serviceWorkers:'block'
  });
  await context.addInitScript(({session})=>{
    localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
  },{session});

  let perfilDisponible=true;
  await context.route('https://sin-configurar.supabase.co/**',async route=>{
    const url=route.request().url();
    const payload=route.request().postDataJSON?.() || {};
    if(url.includes('/rest/v1/perfiles?')) return route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({id:userId,nombre:'QA Coproactiva',rol:'superadmin',activo:true,
        bottom_nav:[],email:'qa-local@coproactiva.test'})
    });
    if(url.includes('/auth/v1/user')) return route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(session.user)
    });
    if(url.includes('/functions/v1/seo-analitica')){
      const respuestas={
        estado:{consultadoEn:new Date().toISOString()},
        resumen,
        'business-profile':perfilDisponible?respuestaPerfil:{disponible:false,error:'No conectado'},
        'tag-manager':{version:{conectado:false}},
        auditoria:{url:'https://www.coproactiva.cl/',status:200,problemas:[],sitemap:{urls:[]}},
        'ga4-tiempo-real':{disponible:true,usuariosActivos:0,eventos:0}
      };
      return route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(respuestas[payload.accion] || {disponible:false})});
    }
    if(url.includes('/functions/v1/seo-propuestas')) return route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify({propuestas:[]})
    });
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });

  const page=await context.newPage();
  const errores=[];
  page.on('pageerror',e=>errores.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:20000});
  // SEO se abre desde su tarjeta del Home modular.
  await page.getByRole('button',{name:/SEO y Analítica/}).click();
  await page.getByRole('heading',{name:'SEO y Analítica'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:/Apariciones en Google Maps.*Fuente: Business Profile/}).waitFor({timeout:20000});
  await page.getByText('101',{exact:true}).waitFor({timeout:20000});
  // Confirmar variaciones de las tres APIs sin alterar el diseño móvil.
  await page.getByText(/\+0,4 pp/).waitFor({timeout:10000});
  await page.getByText('-2,1 posiciones',{exact:false}).waitFor({timeout:10000});
  await page.getByText(/\+36,0%/).waitFor({timeout:10000});
  await page.getByText(/\+26,3%/).waitFor({timeout:10000});

  for(const title of [
    'Apariciones en Google Maps','Apariciones en Búsqueda','Clics hacia el sitio',
    'Clics para llamar','Solicitudes de indicaciones'
  ])assert.equal(await page.getByText(title,{exact:true}).count(),1,title);

  // SEO usa un selector interno, sin sustituir el menú principal de Comercial.
  const selectorSEO = page.getByRole('combobox',{name:'Sección de SEO'});
  assert.equal(await selectorSEO.count(),1);
  assert.equal(await page.locator('.barra-inferior-movil').count(),1);
  for (const valor of ['analytics','business','oportunidades','seguimiento'])
    assert.equal(await selectorSEO.locator('option[value="'+valor+'"]').count(),1,valor);

  const width = await page.evaluate(()=>({inner:window.innerWidth,
    html:document.documentElement.scrollWidth}));
  assert.ok(width.html <= width.inner+2,'Dashboard sin desbordamiento: '+JSON.stringify(width));
  await mkdir('artifacts/ui',{recursive:true});
  await page.getByRole('button',{name:/Apariciones en Google Maps.*Fuente: Business Profile/})
    .scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/ui/seo-google-maps-dashboard-390.png'});

  await selectorSEO.selectOption('business');
  await page.getByRole('heading',{name:'Google Business Profile · métricas oficiales'})
    .waitFor({timeout:12000});
  assert.equal(new URL(page.url()).searchParams.get('vista'),'business');

  await selectorSEO.selectOption('oportunidades');
  await page.waitForURL(url => url.searchParams.get('vista') === 'oportunidades');
  await selectorSEO.selectOption('seguimiento');
  await page.waitForURL(url => url.searchParams.get('vista') === 'seguimiento');
  assert.equal(await page.locator('.seo-barra-inferior').count(),0);
  assert.equal(await page.locator('.barra-inferior-movil').count(),1);
  assert.deepEqual(errores,[],'Errores JS en dashboard móvil');

  console.log('Google Maps: cinco métricas GBP + selector SEO + barra Comercial, sin desbordamiento (390 px): OK');
  await context.close();
} finally {
  await browser.close();
}
