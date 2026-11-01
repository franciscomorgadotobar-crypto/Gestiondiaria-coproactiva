/**
 * CONTRATO VISUAL DE COPROACTIVA - Prueba de geometría en Chromium real.
 * No lee datos reales, no guarda y no envía comunicaciones.
 * Testea posición real en vez de buscar únicamente cadenas CSS.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const id='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now=Math.floor(Date.now()/1000);
const jwt=[
 Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
 Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:now+7200})).toString('base64url'),
 'firma-local-qa'
].join('.');
const user={id,aud:'authenticated',role:'authenticated',email:'diseno@coproactiva.test',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:jwt,token_type:'bearer',expires_at:now+7200,expires_in:7200,
 refresh_token:'solo-qa',user};
const perfil={id,nombre:'QA visual',rol:'superadmin',activo:true,bottom_nav:[],email:user.email};
const rutas=[
 {ruta:'/pipeline',nombre:'Pipeline comercial',slug:'pipeline',card:'.pipeline-indicador'},
 {ruta:'/documentos',nombre:'Gestor documental',slug:'documentos',card:'.documentos-plantilla'},
 {ruta:'/propiedades',nombre:'Propiedades',slug:'propiedades',card:'.propiedades-sitio'},
 {ruta:'/seo',nombre:'SEO y Analítica',slug:'seo',card:'.seo-exec-kpi'}
];
const ANCHOS=[320,360,390,412,768,1280];
const MARGEN=12;
const tolerancia=3;
const geom=el=>{
 const r=el?.getBoundingClientRect();
 return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;
};
const fmt=(v)=>JSON.stringify(v);
function dentro(r,w,etiqueta){
 assert.ok(r,etiqueta+' no está visible');
 assert.ok(r.left>=MARGEN-tolerancia,etiqueta+' pegado al borde izquierdo: '+fmt({r,w}));
 assert.ok(r.right<=w-MARGEN+tolerancia,etiqueta+' invade margen derecho: '+fmt({r,w}));
}
async function verificar(page,vista,width){
 await page.getByRole('heading',{name:new RegExp(vista.nombre,'i')}).first().waitFor({timeout:16000});
 await page.waitForTimeout(100);
 const info=await page.evaluate(({slug,card})=>{
  const root=document.querySelector('.comercial-'+slug);
  const title=root?.querySelector('h1');
  const header=root?.querySelector('.documentos-gestor-cabecera, .modulo-cabecera');
  const eyebrow=root?.querySelector('.comercial-eyebrow');
  const first=root?.querySelector(card);
  const cards=[...root?.querySelectorAll(card)||[]];
  const search=root?.querySelector('.documentos-caja-busqueda');
  const layout=root?.querySelector('.documentos-layout');
  const layoutColumns=layout?getComputedStyle(layout).gridTemplateColumns:'';
  const px=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {
   left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height
  }};
  const docButtons=[...root?.querySelectorAll('.documentos-plantilla>.boton')||[]];
  const filters=root?.querySelector('.documentos-filtros');
  return {
   slug,route:location.pathname,viewport:innerWidth,
   scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
   root:px(root),header:px(header),title:px(title),eyebrow:px(eyebrow),
   first:px(first),search:px(search),second:px(cards[1]),layoutColumns,
   buttons:docButtons.map(px),filters:filters?{width:filters.clientWidth,scrollWidth:filters.scrollWidth}:null,
   headings:[...root?.querySelectorAll('h1')||[]].map(e=>e.textContent)
  };
 },{slug:vista.slug,card:vista.card});
 const label=vista.slug+' @ '+width+'px';
 assert.equal(info.route,vista.ruta,label+' ruta equivocada '+fmt(info));
 assert.ok(info.root,label+' no montó el módulo');
 assert.ok(info.scrollWidth<=width+2,label+' desbordamiento del documento '+fmt(info));
 dentro(info.title,width,label+' título');
 dentro(info.eyebrow,width,label+' etiqueta');
 if(info.first)dentro(info.first,width,label+' primera tarjeta');
 if(vista.slug==='documentos'){
  dentro(info.search,width,label+' buscador');
  for(const [i,b] of info.buttons.entries())dentro(b,width,label+' CTA '+i);
  assert.ok(Math.abs(info.eyebrow.left-info.search.left)<=tolerancia,
   label+' desalineación cabecera / búsqueda '+fmt(info));
  if(width<=412){
   assert.ok(info.second?.top>=info.first?.bottom-1,
    label+' plantillas no apiladas verticalmente '+fmt(info));
   assert.ok(info.first?.width >=width-2*(MARGEN+8),
    label+' tarjeta demasiado estrecha '+fmt(info));
   // La barra de filtros es un deslizamiento intencional; no el documento.
   assert.ok(info.filters?.scrollWidth>=info.filters?.width);
   assert.ok(info.layoutColumns.trim().split(' ').length===1,
    label+' Biblioteca y plantillas deben estar en una sola columna '+fmt(info));
  }
 } else if(info.first){
  // El título y la primera tarjeta mantienen la misma columna óptica.
  assert.ok(Math.abs(info.title.left-info.first.left)<=tolerancia+1,
   label+' título y tarjetas no comparten margen '+fmt(info));
 }
 await page.screenshot({path:'artifacts/ui/contrato-'+vista.slug+'-'+width+'.png',fullPage:false});
 console.log('CONTRATO '+label+' '+fmt({
   titleX:Math.round(info.title.left),cardX:Math.round(info.first?.left||0),
   ancho:Math.round(info.first?.width||0),overflow:info.scrollWidth-width
 }));
}

await mkdir('artifacts/ui',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of ANCHOS){
  const ctx=await browser.newContext({viewport:{width,height:860},
   deviceScaleFactor:1,isMobile:width<=412,hasTouch:width<=412,serviceWorkers:'block'});
  await ctx.addInitScript(({session})=>{
   localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
  },{session});
  await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
   const url=new URL(route.request().url());
   const path=url.pathname;
   const json=body=>route.fulfill({status:200,contentType:'application/json',
    headers:{'content-range':'0-0/*'},body:JSON.stringify(body)});
   if(path.includes('/auth/v1/user'))return json(user);
   if(path.includes('/rest/v1/perfiles'))return json(url.searchParams.has('id')?perfil:[perfil]);
   if(path.includes('/functions/v1/correo-archivos'))return json({ok:true,archivos:[]});
   if(path.includes('/functions/v1/'))return json({
    disponible:false,searchConsole:{disponible:false},analytics:{disponible:false},
    resumen:{},version:{conectado:false},problemas:[],paginas:[],consultadoEn:new Date().toISOString()
   });
   return json([]);
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).first().waitFor({timeout:16000});
  await page.locator('.seleccion-home__tarjeta').filter({hasText:'Gestión comercial'}).first().click();
  await page.waitForURL(u=>u.pathname==='/pipeline',{timeout:15000});
  for(const vista of rutas){
   if(vista.ruta!=='/pipeline'){
    // Navegación interna por popstate: conserva sesión y evita la regla de
    // "nueva apertura de PWA" que redirige correctamente al Home.
    await page.evaluate(ruta=>{
     window.history.pushState({qa:true},'',ruta);
     window.dispatchEvent(new PopStateEvent('popstate',{state:window.history.state}));
    },vista.ruta);
   }
   await verificar(page,vista,width);
  }
  assert.deepEqual(errors,[],'Excepciones JS en '+width+'px');
  await ctx.close();
 }
}finally{await browser.close();}
