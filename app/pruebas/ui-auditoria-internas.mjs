/**
 * Auditoría UI/UX profunda: pantallas internas, editores, detalle, informes.
 * Mock del API remoto y sesión local para NO tocar datos productivos.
 *
 * Valida 360/390/768/1280px, sin recorte global, contenidos presentes y
 * capturas de las vistas que más trabajo concentran.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const userId='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const comunidadId='bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entidadId='ccccccc0-cccc-4ccc-8ccc-cccccccccccc';
const plantillaId='ddddddd0-dddd-4ddd-8ddd-dddddddddddd';
const ahora=Math.floor(Date.now()/1000);
const jwt=[
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:ahora+7200})).toString('base64url'),
  'firma-de-prueba'
].join('.');
const session={
  access_token:jwt,token_type:'bearer',expires_in:7200,expires_at:ahora+7200,
  refresh_token:'local',user:{
    id:userId,aud:'authenticated',role:'authenticated',email:'qa-ui@coproactiva.test',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},
    created_at:new Date().toISOString()
  }
};
const comunidad={id:comunidadId,nombre:'Comunidad Prueba de Auditoría',rut:'99.999.999-9',
  comuna:'Santiago',direccion:'Calle de Prueba 1234',estado:'activa',
  latitud:null,longitud:null};
const entidad={id:entidadId,nombre:'Entidad QA - Comunidad',rut:'',activa:true,
  plan_origen:'modelo',usa_centros_costo:false,comunidad_id:null};
const plantilla={id:plantillaId,nombre:'Control integral de prueba',
  descripcion:'Plantilla QA',activa:true,secuencial:false};
const vistas=[
  {slug:'nuevo-levantamiento',ruta:'/nuevo',texto:'Nuevo levantamiento'},
  {slug:'comunidades-lista',ruta:'/comunidades',texto:'Comunidades'},
  {slug:'comunidad-detalle',ruta:'/comunidades/'+comunidadId,texto:'Comunidad Prueba de Auditoría'},
  {slug:'plantillas',ruta:'/plantillas',texto:'Plantillas'},
  {slug:'editor-plantilla',ruta:'/plantillas/'+plantillaId,texto:'Control integral de prueba'},
  {slug:'importar-plantilla',ruta:'/plantillas/importar',texto:'Importar desde Excel'},
  {slug:'bitacora-nueva',ruta:'/bitacora/nueva',texto:'Nueva entrada de Bitácora'},
  {slug:'mantenciones',ruta:'/mantenciones',texto:'Mantenciones'},
  {slug:'contabilidad-asientos',ruta:'/contabilidad/asientos',texto:'Contabilidad'},
  {slug:'contabilidad-reportes',ruta:'/contabilidad/reportes',texto:'Contabilidad'},
  {slug:'contabilidad-plan',ruta:'/contabilidad/plan',texto:'Contabilidad'},
  {slug:'propiedad-nueva',ruta:'/propiedades/nueva',texto:'Nueva propiedad'},
  {slug:'proveedores-correos',ruta:'/proveedores/correos',texto:'Correos por clasificar'},
  {slug:'proveedores-postulantes',ruta:'/proveedores/postulantes',texto:'Postulantes'},
  {slug:'seo-audiencia',ruta:'/seo?vista=analytics',texto:'SEO y Analítica'},
  {slug:'seo-google-maps',ruta:'/seo?vista=business',texto:'SEO y Analítica'}
];

async function clickDestino(page,ruta,etiqueta) {
  const link=page.locator('a[href="'+ruta+'"]:visible').first();
  if(await link.count()) {
    await link.click();
    return;
  }
  // Móvil de Operación: opciones de baja frecuencia dentro de «Más».
  const mas=page.getByRole('button',{name:'Más',exact:true}).last();
  if(await mas.count()) {
    await mas.click();
    const menu=page.getByRole('dialog',{name:'Más opciones'});
    await menu.getByRole('button',{name:new RegExp(etiqueta,'i')}).click();
    return;
  }
  throw Error('No existe acceso visible a '+ruta);
}

async function irPantalla(page,vista) {
  // La PWA reabre SIEMPRE el Home de áreas, por lo que una URL profunda
  // cargada desde cero no equivale a navegar a esa pantalla.
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:22000});
  await page.getByRole('heading',{name:/Hola/}).waitFor({timeout:12000});
  const ruta=vista.ruta;
  const operacion=/^\/(nuevo|comunidades|plantillas|bitacora|mantenciones)/.test(ruta);
  const area=operacion ? /Operación/
    : ruta.startsWith('/contabilidad') ? /Gestión contable/
    : ruta.startsWith('/propiedades') ? /Arriendos y ventas/
    : ruta.startsWith('/proveedores') ? /Red de proveedores/
    : /SEO y Analítica/;
  await page.getByRole('button',{name:area}).first().click();

  if(operacion) {
    if(ruta==='/nuevo') await clickDestino(page,'/nuevo','Nuevo levantamiento');
    else if(ruta.startsWith('/comunidades')) {
      await clickDestino(page,'/comunidades','Comunidades');
      if(ruta!=='/comunidades')
        await page.locator('a[href="'+ruta+'"]:visible').first().click();
    } else if(ruta.startsWith('/plantillas')) {
      await clickDestino(page,'/plantillas','Plantillas');
      if(ruta!=='/plantillas')
        await page.locator('a[href="'+ruta+'"]:visible').first().click();
    } else if(ruta.startsWith('/bitacora')) {
      await clickDestino(page,'/bitacora','Bitácora');
      if(ruta!=='/bitacora')
        await page.locator('a[href="'+ruta+'"]:visible').first().click();
    } else if(ruta.startsWith('/mantenciones'))
      await clickDestino(page,'/mantenciones','Mantenciones');
  } else if(ruta.startsWith('/contabilidad/')) {
    await page.locator('a[href="'+ruta+'"]:visible').first().click();
  } else if(ruta.startsWith('/propiedades/')) {
    await page.locator('a[href^="/propiedades/nueva"]:visible').first().click();
  } else if(ruta.startsWith('/proveedores/')) {
    await page.locator('a[href="'+ruta+'"]:visible').first().click();
  } else if(ruta.startsWith('/seo?')) {
    const destino=new URLSearchParams(ruta.split('?')[1]).get('vista');
    const nombre=destino==='analytics' ? 'Audiencia' : 'Google Maps';
    const nav=page.locator('button[aria-label="Ir a '+nombre+'"]:visible').first();
    if(await nav.count()) await nav.click();
    else await page.getByRole('button',{name:nombre,exact:true}).first().click();
  }
  await page.waitForTimeout(120);
}

await mkdir('artifacts/ui/internas',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [360,390,768,1280]){
   const ctx=await browser.newContext({
     viewport:{width,height:844},
     deviceScaleFactor:1,isMobile:width<=390,hasTouch:width<=390,serviceWorkers:'block'
   });
   await ctx.addInitScript(({session})=>{
     localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
   },{session});
   await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
     const url=new URL(route.request().url());
     const p=url.pathname;
     const json=(body)=>route.fulfill({
       status:200,contentType:'application/json',headers:{'content-range':'0-0/*'},
       body:JSON.stringify(body)
     });
     if(p.includes('/auth/v1/user'))return json(session.user);
     if(p.includes('/rest/v1/perfiles'))return json({
       id:userId,nombre:'QA Coproactiva',rol:'superadmin',activo:true,
       bottom_nav:[],email:'qa-ui@coproactiva.test'
     });
     if(p.includes('/rest/v1/comunidades')) {
       if(url.searchParams.has('id'))return json(comunidad);
       return json([comunidad]);
     }
     if(p.includes('/rest/v1/contabilidad_entidades'))return json([entidad]);
     if(p.includes('/rest/v1/plantillas_control')){
       if(url.searchParams.has('id'))return json(plantilla);
       return json([plantilla]);
     }
     if(p.includes('/functions/v1/seo-propuestas'))return json({propuestas:[]});
     if(p.includes('/functions/v1/'))return json({
       disponible:false,searchConsole:{disponible:false},analytics:{disponible:false},
       resumen:{},version:{conectado:false},problemas:[],paginas:[],consultadoEn:new Date().toISOString()
     });
     if(p.includes('/rest/v1/'))return json([]);
     return json([]);
   });
   const page=await ctx.newPage();
   const failures=[];
   page.on('pageerror',e=>failures.push(e.message));
   for(const vista of vistas) {
     console.log('AUDIT '+vista.slug+' @ '+width+'px');
     await irPantalla(page,vista);
     await page.locator('.pantalla.modulo-unificado, .wa-page.modulo-unificado').first()
       .waitFor({timeout:10000});
     // Lazy modules and simulated data may require an extra render.
     await page.waitForTimeout(250);
     const metrics=await page.evaluate(()=>{
       const elems=[...document.querySelectorAll('.pantalla.modulo-unificado, .wa-page.modulo-unificado')];
       const root=elems[0];
       const body=document.body,html=document.documentElement;
       const header=root?.querySelector('.modulo-cabecera,.wa-header');
       const rect=header?.getBoundingClientRect();
       const fixed=[...document.querySelectorAll('.barra-inferior-movil')].filter(x=>getComputedStyle(x).display!=='none');
       return {
         url:location.pathname+location.search,
         scrollWidth:Math.max(body.scrollWidth,html.scrollWidth),
         viewport:innerWidth,
         headerWidth:rect?.width,
         contentText:root?.innerText?.slice(0,550) || '',
         bottomNav:fixed.length
       };
     });
     assert.ok(metrics.scrollWidth<=metrics.viewport+3,
       vista.slug+' ancho '+width+' desborde '+JSON.stringify(metrics));
     assert.ok(metrics.contentText.includes(vista.texto),
       vista.slug+' ancho '+width+' pantalla no disponible: '+metrics.contentText);
     if(width<=390) {
       assert.ok(metrics.headerWidth>0, vista.slug+' sin cabecera');
       await page.screenshot({
         path:'artifacts/ui/internas/'+vista.slug+'-'+width+'.png',
         fullPage:false
       });
     }
     console.log('OK '+vista.slug+' '+width+'px');
   }
   assert.deepEqual(failures,[],width+' px JS errors');
   await ctx.close();
 }
} finally { await browser.close(); }
