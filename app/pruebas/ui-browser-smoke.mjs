import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.UI_QA_URL || 'http://127.0.0.1:5173';
const anchos = [360,390,768,1280];
await mkdir('artifacts/ui', {recursive:true});
const navegador = await chromium.launch({headless:true});
let errores = [];
try {
  for (const ancho of anchos) {
    const contexto = await navegador.newContext({
      viewport:{width:ancho,height:800},
      deviceScaleFactor:1,
      isMobile:ancho<=390,
      hasTouch:ancho<=390,
    });
    const pagina = await contexto.newPage();
    const erroresPagina = [];
    pagina.on('pageerror',e=>erroresPagina.push(e.message));
    const respuesta = await pagina.goto(base+'/ingreso',{waitUntil:'networkidle',timeout:40000});
    assert.ok(respuesta?.ok(),'No abre ingreso '+ancho);
    await pagina.getByRole('heading',{name:'Ingresar'}).waitFor();
    assert.equal(await pagina.locator('#email').count(),1);
    assert.equal(await pagina.locator('#clave').count(),1);
    assert.equal(await pagina.getByRole('button',{name:'Entrar'}).count(),1);
    const tamanos = await pagina.evaluate(()=>{
      const email=document.querySelector('#email');
      const clave=document.querySelector('#clave');
      const w=window.innerWidth;
      return {
        viewport:w,
        html:document.documentElement.scrollWidth,
        cuerpo:document.body.scrollWidth,
        email:parseFloat(getComputedStyle(email).fontSize),
        clave:parseFloat(getComputedStyle(clave).fontSize),
        inputDentro:email.getBoundingClientRect().right<=w+1,
        claveDentro:clave.getBoundingClientRect().right<=w+1,
      };
    });
    assert.ok(tamanos.html<=tamanos.viewport+2,
      'Desbordamiento horizontal en ingreso '+ancho+': '+JSON.stringify(tamanos));
    assert.ok(tamanos.inputDentro&&tamanos.claveDentro,
      'Campos recortados en ingreso '+ancho);
    if(ancho<=390){
      assert.ok(tamanos.email>=16 && tamanos.clave>=16,
        'Entradas móviles deben tener al menos 16 px: '+JSON.stringify(tamanos));
    }
    await pagina.screenshot({path:'artifacts/ui/ingreso-'+ancho+'.png',fullPage:true});
    // Las rutas internas sin sesión deben protegerse, nunca mostrar datos privados.
    await pagina.goto(base+'/comunidades',{waitUntil:'networkidle',timeout:40000});
    await pagina.waitForURL(/\/ingreso(?:\?|$)/,{timeout:15000});
    assert.equal(await pagina.getByRole('heading',{name:'Ingresar'}).count(),1);
    assert.deepEqual(erroresPagina,[],'Errores React en '+ancho);
    console.log('UI navegador OK '+ancho+'px',JSON.stringify(tamanos));
    await contexto.close();
  }
} catch(error) {
  errores.push(error);
} finally {
  await navegador.close();
}
if(errores.length)throw errores[0];
console.log('QA visual de ingreso y protección de rutas: 4 resoluciones correctas.');
