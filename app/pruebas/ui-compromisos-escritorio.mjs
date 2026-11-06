/**
 * QA Chromium: Compromisos se gestionan dentro de Comunidades.
 * Fixtures locales de Supabase sin datos ni escrituras reales.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const id='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const comunidadId='bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ahora=Math.floor(Date.now()/1000);
const token=[
 Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
 Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:ahora+7200})).toString('base64url'),
 'firma-qa'
].join('.');
const user={id,aud:'authenticated',role:'authenticated',email:'ux@coproactiva.test',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:token,token_type:'bearer',expires_at:ahora+7200,
 expires_in:7200,refresh_token:'test',user};
const perfil={id,nombre:'QA',rol:'superadmin',activo:true,bottom_nav:[],email:user.email};
const comunidad={id:comunidadId,nombre:'Reserva Santa Clara',comuna:'Coquimbo',
 direccion:'Calle de pruebas 10',estado:'activo',rut:'',latitud:null,longitud:null};
const compromisos=Array.from({length:24},(_,i)=>({
 id:'cccccccc-cccc-4ccc-8ccc-'+String(i+1).padStart(12,'0'),
 comunidad_id:comunidadId,titulo:'Compromiso de prueba '+String(i+1),
 responsable:'Equipo de administración',estado:i<3?'completado':i<8?'en_curso':'pendiente',
 avance:i<3?100:i<8?40:0,fecha_limite:'2026-11-20',fecha_proxima_accion:'2026-11-05',
 orden:i+1,creado_en:'2026-11-02T12:00:00.000Z'
}));
const subtareas=Array.from({length:9},(_,i)=>({
 id:'dddddddd-dddd-4ddd-8ddd-'+String(i+1).padStart(12,'0'),
 compromiso_id:compromisos[0].id,titulo:'Documento de respaldo '+(i+1),
 completada:i<6,avance:i<6?100:0,orden:i+1
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
   const url=new URL(route.request().url()),path=url.pathname;
   const json=body=>route.fulfill({status:200,contentType:'application/json',
    headers:{'content-range':'0-23/24'},body:JSON.stringify(body)});
   if(path.includes('/auth/v1/user'))return json(user);
   if(path.includes('/rest/v1/perfiles'))
     return json(url.searchParams.has('id')?perfil:[perfil]);
   if(path.includes('/rest/v1/comunidades'))
     return json(url.searchParams.has('id')?comunidad:[comunidad]);
   if(path.includes('/rest/v1/compromisos_subtareas')){
    if(route.request().method()==='PATCH'){
     const datos=JSON.parse(route.request().postData()||'{}');
     assert.deepEqual(Object.keys(datos),['titulo'],'Sólo se modifica el título');
     return json({...subtareas[0],titulo:datos.titulo});
    }
    return json(subtareas);
   }
   if(path.includes('/rest/v1/compromisos_administracion'))return json(compromisos);
   if(path.includes('/rpc/'))return json([]);
   if(path.includes('/functions/v1/'))return json({});
   return json([]);
  });
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).first().waitFor({timeout:18000});
  // La ruta / es el selector modular; el acceso que se prueba está en Operaciones.
  await page.goto(base+'/inicio',{waitUntil:'domcontentloaded'});
  await page.locator('.inicio-pantalla').waitFor({state:'visible',timeout:15000});
  // Regresión del botón vacío: el CTA de comunidad debe tener texto visible y
  // contraste suficiente tanto en escritorio como en la presentación móvil.
  const acceso=page.getByRole('link',{name:'Seleccionar comunidad'}).first();
  await acceso.waitFor({state:'visible',timeout:12000});
  assert.equal(new URL(await acceso.getAttribute('href'),base).pathname,'/comunidades');
  const contraste=await acceso.evaluate(el=>{
    const estilos=getComputedStyle(el);
    const rgb=valor=>(valor.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
    const brillo=valor=>{
      const canales=rgb(valor).map(n=>{
        const v=n/255;
        return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
      });
      return canales[0]*0.2126+canales[1]*0.7152+canales[2]*0.0722;
    };
    const a=brillo(estilos.color),b=brillo(estilos.backgroundColor);
    return {proporcion:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),
      color:estilos.color,fondo:estilos.backgroundColor,texto:el.textContent};
  });
  assert.ok(contraste.proporcion>=4.5,
    'Selector de comunidad ilegible '+width+'px: '+JSON.stringify(contraste));
  await page.evaluate(()=>{
   window.history.pushState({qa:true},'','/compromisos');
   window.dispatchEvent(new PopStateEvent('popstate',{state:window.history.state}));
  });
  await page.waitForURL(u=>u.pathname==='/comunidades',{timeout:20000});
  assert.equal(await page.locator('a[href="/compromisos"]').count(),0,'Sin submenú de compromisos');
  await page.getByRole('link',{name:/Reserva Santa Clara/}).first().click();
  await page.waitForURL(u=>u.pathname==='/comunidades/'+comunidadId,{timeout:18000});
  await page.getByRole('tab',{name:'Gestiones y avances'}).click();
  await page.waitForURL(u=>u.searchParams.get('seccion')==='compromisos',{timeout:15000});
  await page.getByRole('button',{name:/Todas 24/}).click();
  await page.locator('.compromisos-item').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.compromisos-item').count(),24,'24 gestiones incluidas las históricas');
  await page.locator('.compromisos-item').first().locator('summary.compromisos-fila').click();
  await page.locator('.compromisos-indice-item').first().waitFor({timeout:12000});
  assert.equal(await page.locator('.compromisos-indice-item').count(),9,'9 actividades en índice numerado');
  assert.equal(await page.locator('.compromisos-subtarea-card').count(),0,'El detalle queda plegado');
  await page.screenshot({path:'artifacts/ui/compromisos-lista-'+width+'.png',fullPage:false});
  const alturaIndice=await page.locator('.compromisos-indice-item').first().evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(alturaIndice<80,'Fila de lista demasiado alta '+width+': '+alturaIndice);
  await page.locator('.compromisos-indice-item').first().getByRole('button',{name:/Abrir actividad 1/}).click();
  await page.locator('.compromisos-subtarea-card').first().waitFor({timeout:12000});
  const geo=await page.evaluate(()=>{
   const card=document.querySelector('.compromisos-subtarea-card').getBoundingClientRect();
   const summary=document.querySelector('.compromisos-item>.compromisos-fila').getBoundingClientRect();
   return {cardHeight:card.height,summaryHeight:summary.height,
    scrollWidth:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)};
  });
  assert.equal(await page.locator('.compromisos-subtarea-card').count(),1,'Solo una actividad en detalle');
  assert.ok(geo.cardHeight<(width<=390?270:220),'Detalle individual demasiado alto '+width+': '+JSON.stringify(geo));
  assert.ok(geo.summaryHeight<110,'Cabecera sobredimensionada');
  assert.ok(geo.scrollWidth<=width+2,'Desbordamiento horizontal '+width+': '+JSON.stringify(geo));
  await page.screenshot({path:'artifacts/ui/compromisos-detalle-'+width+'.png',fullPage:false});
  const fila=page.locator('.compromisos-subtarea-card').first();
  await fila.getByRole('button',{name:'Editar título'}).click();
  await fila.getByLabel('Título de la subtarea').fill('Subtarea corregida '+width);
  await fila.getByRole('button',{name:'Guardar',exact:true}).click();
  await fila.getByText('Subtarea corregida '+width,{exact:true}).waitFor();
  assert.ok(page.url().includes('/comunidades/'+comunidadId+'?seccion=compromisos'),
    'no debe navegar al editar');
  await fila.locator('summary[aria-label^="Adjuntos de esta subtarea"]').click();
  await fila.getByText('Adjuntos · Google Drive').waitFor();
  assert.deepEqual(errors,[],'Excepciones en Chromium '+width);
  await ctx.close();
  console.log('COMUNIDADES Y COMPROMISOS OK '+width+'px '+JSON.stringify(geo));
 }
}finally{await browser.close();}
