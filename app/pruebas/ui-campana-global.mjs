/**
 * Verificación de campana única en la app con sesión y APIs simuladas.
 * No toca usuarios ni datos de producción.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base=process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const id='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ahora=Math.floor(Date.now()/1000);
const jwt=[
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:ahora+7200})).toString('base64url'),
  'firma-de-prueba'
].join('.');
const sesion={
  access_token:jwt,token_type:'bearer',expires_in:7200,expires_at:ahora+7200,
  refresh_token:'solo-qa',user:{id,aud:'authenticated',role:'authenticated',
    email:'campana@coproactiva.test',app_metadata:{provider:'email',providers:['email']},
    user_metadata:{},created_at:new Date().toISOString()}
};
const notificacion={
  id:'ddddddd0-dddd-4ddd-8ddd-dddddddddddd',tipo:'correo_apertura',
  titulo:'Apertura detectada',mensaje:'Cliente abrió correo de prueba',
  prospecto_id:'eeeeeee0-eeee-4eee-8eee-eeeeeeeeeeee',
  correo_origen:'crm',correo_registro_id:null,proveedor_id:null,bitacora_id:null,
  creado_en:new Date().toISOString(),leida:false
};
const rutas=['/','/inicio','/pipeline','/proveedores','/comunidades','/contabilidad','/notificaciones'];
const anchos=[320,360,390,768,1280];
await mkdir('artifacts/ui/campana-global',{recursive:true});
const navegador=await chromium.launch({headless:true});
try {
  for(const ancho of anchos){
    const contexto=await navegador.newContext({
      viewport:{width:ancho,height:800},deviceScaleFactor:1,
      isMobile:ancho<=390,hasTouch:ancho<=390,serviceWorkers:'block'
    });
    await contexto.addInitScript(s=>localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(s)),sesion);
    await contexto.route('https://sin-configurar.supabase.co/**',async route=>{
      const u=new URL(route.request().url()),ruta=u.pathname;
      const headers={'content-range':'0-0/1','access-control-expose-headers':'content-range'};
      const responder=body=>route.fulfill({
        status:200,contentType:'application/json',headers,
        body:route.request().method()==='HEAD'?'':JSON.stringify(body)
      });
      if(ruta.includes('/auth/v1/user'))return responder(sesion.user);
      if(ruta.includes('/rest/v1/perfiles'))return responder(
        u.searchParams.has('id')
          ? {id,nombre:'QA Coproactiva',rol:'superadmin',activo:true,bottom_nav:[]}
          : []);
      if(ruta.includes('/rest/v1/notificaciones_mantenimiento'))return responder([]);
      if(ruta.includes('/rest/v1/notificaciones'))return responder([notificacion]);
      if(ruta.includes('/functions/v1/'))return responder({
        disponible:false,searchConsole:{disponible:false},analytics:{disponible:false},
        resumen:{},paginas:[],problemas:[]
      });
      return responder([]);
    });
    const page=await contexto.newPage();
    const errores=[];
    page.on('pageerror',e=>errores.push(e.message));
    for(const ruta of rutas){
      await page.goto(base+ruta,{waitUntil:'domcontentloaded',timeout:25000});
      const boton=page.locator('.campana-contenedor > .campana:visible');
      await boton.first().waitFor({timeout:17000});
      assert.equal(await boton.count(),1,'Debe haber exactamente una campana visible en '+ruta+' @ '+ancho);
      await boton.click();
      const popup=page.locator('.campana-panel:visible');
      await popup.waitFor({timeout:5000});
      const metrics=await popup.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
          width:innerWidth,height:innerHeight,body:document.documentElement.scrollWidth,
          enBody:el.parentElement===document.body,
          scrollInterno:getComputedStyle(el.querySelector('.campana-panel-lista')).overflowY};
      });
      assert.ok(metrics.enBody,'Panel no está en portal '+ruta);
      assert.ok(metrics.left>=-1 && metrics.right<=metrics.width+1,'Panel desbordado horizontalmente '+ruta+' '+ancho+': '+JSON.stringify(metrics));
      assert.ok(metrics.top>=0 && metrics.bottom<=metrics.height+2,'Panel desbordado verticalmente '+ruta+' '+ancho+': '+JSON.stringify(metrics));
      assert.ok(metrics.body<=metrics.width+2,'Desborde global '+ruta+' '+ancho+': '+JSON.stringify(metrics));
      assert.equal(metrics.scrollInterno,'auto');
      if(ancho<=390 && ['/', '/inicio', '/proveedores'].includes(ruta)){
        await page.screenshot({path:'artifacts/ui/campana-global/'+ruta.replaceAll('/','-').replace(/^$/,'home')+'-'+ancho+'.png'});
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.campana-panel').count(),0,'Escape no cerró '+ruta);
      if(ruta==='/notificaciones'){
        await boton.click();
        await page.getByRole('button',{name:'Ver todas'}).click();
        assert.ok(new URL(page.url()).pathname==='/notificaciones');
      }
      console.log('Campana '+ruta+' @ '+ancho+'px OK');
    }
    assert.deepEqual(errores,[],'Error JS '+ancho+': '+errores.join(' / '));
    await contexto.close();
  }
}finally{await navegador.close();}
