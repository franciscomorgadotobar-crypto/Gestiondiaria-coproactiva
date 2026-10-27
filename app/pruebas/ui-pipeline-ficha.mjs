import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const uid='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const lead='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Math.floor(Date.now()/1000);
const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:now+7200})).toString('base64url'),
  'firma-qa'].join('.');
const usuario={id:uid,aud:'authenticated',role:'authenticated',email:'qa@coproactiva.test',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const sesion={access_token:jwt,token_type:'bearer',expires_in:7200,expires_at:now+7200,
 refresh_token:'refresh-qa',user:usuario};
const perfil={id:uid,nombre:'QA Comercial',rol:'superadmin',activo:true,bottom_nav:[],email:usuario.email};
const prospecto={id:lead,nombre_condominio:'Edificio de prueba',nombre_contacto:'Contacto QA',
 direccion:'Pasaje 10',comuna:'San Bernardo',telefono:'+56912345678',email:'qa-lead@example.test',
 etapa:'nuevo',proxima_accion:'Llamar mañana',fecha_proxima_accion:null,
 observaciones:'Contacto ingresado en pruebas',tipo_servicio:'administracion',fuente:'qa',
 creado_en:'2026-10-20T12:00:00Z',responsable_id:uid};

const navegador=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const mobile=width<900;
  const ctx=await navegador.newContext({viewport:{width,height:840},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await ctx.addInitScript(({sesion})=>{localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(sesion));},{sesion});
  await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    if(path.includes('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(usuario)});
    if(path.includes('/rest/v1/perfiles')){
      const unico=url.searchParams.toString().includes('id=eq.');
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unico?perfil:[perfil])});
    }
    if(path.includes('/rest/v1/prospectos')){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([prospecto])});
    }
    if(path.includes('/functions/v1/correo-archivos')){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,archivos:[]})});
    }
    if(path.includes('/rest/v1/plantillas_correo_crm')||path.includes('/rest/v1/controles')||
      path.includes('/rest/v1/diagnosticos_resultado')||path.includes('/rest/v1/drive_archivos_comunidad')){
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    }
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Gestión comercial/}).click();
  await page.waitForURL(u=>u.pathname==='/pipeline',{timeout:20000});
  await page.getByRole('button',{name:'Gestionar prospecto Edificio de prueba'}).waitFor({timeout:15000});
  assert.equal(await page.getByRole('link',{name:'Iniciar diagnóstico'}).count(),0,'embudo sin diagnóstico');
  assert.equal(await page.getByRole('heading',{name:'Editar prospecto'}).count(),0);
  await page.getByRole('button',{name:'Gestionar prospecto Edificio de prueba'}).click();
  await page.getByRole('heading',{name:'Gestionar prospecto'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('prospecto'),lead);
  assert.equal(await page.getByRole('heading',{name:'Editar prospecto'}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Iniciar diagnóstico'}).count(),1);
  const whatsapp=page.getByRole('link',{name:'WhatsApp'});
  assert.match(await whatsapp.getAttribute('href'),/wa\.me\/56912345678/);
  assert.equal(await page.getByRole('link',{name:'Llamar'}).getAttribute('href'),'tel:+56912345678');

  await page.getByRole('button',{name:'Editar datos'}).click();
  await page.getByRole('heading',{name:'Editar prospecto'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('accion'),'editar');
  await page.getByRole('button',{name:'‹ Volver a la ficha'}).click();
  await page.getByRole('heading',{name:'Gestionar prospecto'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Editar prospecto'}).count(),0);
  await page.getByRole('button',{name:'Enviar correo'}).click();
  await page.getByRole('heading',{name:/Enviar correo a Contacto QA/}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('accion'),'correo');
  await page.getByRole('button',{name:'‹ Volver a la ficha'}).click();
  await page.getByRole('heading',{name:'Gestionar prospecto'}).waitFor();
  await page.getByRole('button',{name:'‹ Volver al embudo'}).click();
  await page.getByRole('button',{name:'Gestionar prospecto Edificio de prueba'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('prospecto'),null);
  assert.deepEqual(errors,[],'sin errores JS al navegar');
  console.log('Pipeline QA '+width+'px: embudo → ficha → editar/correo → ficha → embudo OK');
  await ctx.close();
 }
}finally{await navegador.close();}
