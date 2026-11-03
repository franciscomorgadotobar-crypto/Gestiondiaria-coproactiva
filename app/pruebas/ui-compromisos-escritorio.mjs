/**
 * Regresión visual: tarjetas y filtros no pueden estirarse en escritorio.
 * Usa fixtures locales; no se conecta a datos de Coproactiva.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const id='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const comunidadId='bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Math.floor(Date.now()/1000);
const token=[
 Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
 Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:now+7200})).toString('base64url'),
 'firma-qa'
].join('.');
const user={id,aud:'authenticated',role:'authenticated',email:'ux@coproactiva.test',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:token,token_type:'bearer',expires_at:now+7200,
 expires_in:7200,refresh_token:'test',user};
const perfil={id,nombre:'QA',rol:'superadmin',activo:true,bottom_nav:[],email:user.email};
const comunidad={id:comunidadId,nombre:'Reserva Santa Clara',comuna:'Coquimbo'};
const compromisos=Array.from({length:24},(_,i)=>({
 id:'cccccccc-cccc-4ccc-8ccc-'+String(i+1).padStart(12,'0'),
 comunidad_id:comunidadId,
 titulo:'Compromiso de prueba '+String(i+1),
 responsable:'Equipo de administración',
 estado:i<3?'completado':i<8?'en_curso':'pendiente',
 avance:i<3?100:i<8?40:0,
 fecha_limite:'2026-11-20',fecha_proxima_accion:'2026-11-05',
 orden:i+1,creado_en:'2026-11-02T12:00:00.000Z'
}));
const widths=[390,768,1280,1556];
await mkdir('artifacts/ui',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of widths){
  const ctx=await browser.newContext({viewport:{width,height:900},
   serviceWorkers:'block',deviceScaleFactor:1,isMobile:width<=390,hasTouch:width<=390});
  await ctx.addInitScript(s=>{localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(s));},session);
  await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
   const url=new URL(route.request().url());
   const path=url.pathname;
   const json=body=>route.fulfill({status:200,contentType:'application/json',
    headers:{'content-range':'0-23/24'},body:JSON.stringify(body)});
   if(path.includes('/auth/v1/user'))return json(user);
   if(path.includes('/rest/v1/perfiles'))return json(url.searchParams.has('id')?perfil:[perfil]);
   if(path.includes('/rest/v1/compromisos_administracion')){
    if(route.request().method()==='PATCH'){
     const datos=JSON.parse(route.request().postData()||'{}');
     assert.deepEqual(Object.keys(datos),['titulo'],'solo se debe modificar el título');
     return json({...compromisos[0],titulo:datos.titulo});
    }
    return json(compromisos);
   }
   if(path.includes('/rest/v1/comunidades'))return json([comunidad]);
   if(path.includes('/functions/v1/'))return json({});
   return json([]);
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).first().waitFor({timeout:18000});
  await page.evaluate(()=>{
   window.history.pushState({qa:true},'','/compromisos');
   window.dispatchEvent(new PopStateEvent('popstate',{state:window.history.state}));
  });
  await page.getByRole('heading',{name:'Compromisos y avances'}).waitFor({timeout:18000});
  await page.getByText('Reserva Santa Clara').first().waitFor();
  await page.locator('.compromisos-general-enlace').first().waitFor({timeout:10000});
  await page.waitForTimeout(150);
  const geo=await page.evaluate(()=>{
   const rect=s=>{
    const e=document.querySelector(s);if(!e)return null;
    const r=e.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};
   };
   return {
    title:rect('.compromisos-general h1'),
    filters:rect('.compromisos-general-filtros'),
    select:rect('.compromisos-general-filtros select'),
    input:rect('.compromisos-general-filtros input'),
    overview:rect('.compromisos-general-kpis'),
    group:rect('.compromisos-general-grupo'),
    button:rect('.compromisos-general-desplegar'),
    first:rect('.compromisos-general-enlace'),
    items:document.querySelectorAll('.compromisos-general-enlace').length,
    scroll:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),
    rowStyle:getComputedStyle(document.querySelector('.compromisos-general-cuerpo')).gridAutoRows,
    contentAlign:getComputedStyle(document.querySelector('.compromisos-general-cuerpo')).alignContent
   };
  });
  const label='Compromisos '+width+' px';
  assert.equal(geo.items,24,label+' deben aparecer 24 compromisos desde el inicio');
  assert.ok(geo.filters.height<(width<=640?180:105),label+' filtros demasiado altos: '+JSON.stringify(geo));
  assert.ok(geo.select.height>=42&&geo.select.height<=50,label+' selector mal encuadrado '+JSON.stringify(geo));
  assert.ok(geo.input.height>=42&&geo.input.height<=50,label+' buscador mal encuadrado '+JSON.stringify(geo));
  assert.ok(geo.button.height<110,label+' tarjeta de comunidad gigante '+JSON.stringify(geo));
  assert.ok(geo.first.height<160,label+' fila desproporcionada '+JSON.stringify(geo));
  assert.ok(geo.overview&&geo.overview.height<125,label+' resumen global sobredimensionado '+JSON.stringify(geo));
  assert.ok(geo.overview.y-geo.filters.bottom<45,label+' espacio vacío antes del resumen '+JSON.stringify(geo));
  assert.ok(geo.group.y-geo.overview.bottom<45,label+' espacio vacío antes de grupos '+JSON.stringify(geo));
  assert.ok(geo.scroll<=width+2,label+' desborda el viewport '+JSON.stringify(geo));
  assert.equal(geo.contentAlign,'start',label+' el grid debe alinearse arriba');
  if(width>=900){
   assert.ok(Math.abs(geo.select.y-geo.input.y)<3,label+' filtros de PC deben estar alineados');
   assert.ok(geo.first.width>700,label+' filas en escritorio demasiado estrechas');
  }
  await page.screenshot({path:'artifacts/ui/compromisos-compacto-'+width+'.png',fullPage:false});
  // Edición directa sin abandonar la lista de Compromisos y avances.
  const fila=page.locator('.compromisos-general-enlace').first();
  await fila.getByRole('button',{name:'Editar título'}).click();
  const tituloEditado='Compromiso renombrado en '+width+'px';
  await fila.getByLabel('Título del compromiso').fill(tituloEditado);
  await fila.getByRole('button',{name:'Guardar',exact:true}).click();
  await fila.getByRole('link',{name:new RegExp(tituloEditado)}).waitFor();
  assert.ok(page.url().endsWith('/compromisos'),label+' no debe navegar al editar');

  await page.locator('.compromisos-general-desplegar').click();
  assert.equal(await page.locator('.compromisos-general-enlace').count(),0,label+' debe poder contraerse');
  await page.locator('.compromisos-general-desplegar').click();
  assert.equal(await page.locator('.compromisos-general-enlace').count(),24,label+' debe poder expandirse');
  await page.locator('.compromisos-general-filtros select').selectOption('completado');
  assert.equal(await page.locator('.compromisos-general-enlace').count(),3,label+' filtros deben funcionar');
  await page.locator('.compromisos-general-filtros select').selectOption('todos');
  await page.locator('.compromisos-general-filtros input').fill('Compromiso de prueba 1');
  assert.ok(await page.locator('.compromisos-general-enlace').count()>=1,label+' buscador debe funcionar');
  assert.deepEqual(errors,[],label+' excepciones en la página');
  await ctx.close();
  console.log('COMPROMISOS VISUAL OK '+label+' '+JSON.stringify({filters:geo.filters.height,group:geo.button.height,first:geo.first.height}));
 }
}finally{await browser.close();}
