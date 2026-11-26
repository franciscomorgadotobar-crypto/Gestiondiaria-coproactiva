/**
 * JARVIS - Geometría de las cuatro vistas en Chromium real.
 * Datos simulados: no lee la base, no guarda y no envía comunicaciones.
 * Comprueba que el Home no muestra Jarvis y prueba el módulo por su ruta interna.
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
const user={id,aud:'authenticated',role:'authenticated',email:'jarvis@coproactiva.test',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:jwt,token_type:'bearer',expires_at:now+7200,expires_in:7200,
 refresh_token:'solo-qa',user};
const perfil={id,nombre:'QA Jarvis',rol:'superadmin',activo:true,bottom_nav:[],email:user.email};
const c1='c1111111-1111-4111-8111-111111111111',c2='c2222222-2222-4222-8222-222222222222';
const r1='e1111111-1111-4111-8111-111111111111',r2='e2222222-2222-4222-8222-222222222222';
const largo='Recepción documental del proyecto con un título deliberadamente extenso para forzar el ajuste de línea en pantallas angostas';
const item=(clave,ambito,urgencia,dias,titulo,extra={})=>({clave,ambito,tipo:'qa',titulo,
 detalle:'En ejecución · 64% de avance · Responsable de prueba',comunidad_id:c1,
 comunidad:'Condominio de prueba con nombre largo (Inmobiliaria)',prospecto_id:null,
 fecha:dias===null?null:'2026-11-15',dias,urgencia,
 accion:'Registrar avance o cerrar el compromiso antes de la próxima reunión con el comité',
 ruta:'/compromisos',...extra});
const datos={
 agenda:[
  item('a','operacion','vencido',-125,largo),
  item('b','comercial','hoy',0,'Hacer seguimiento a la propuesta',{comunidad_id:null,comunidad:null}),
  item('c','legal','semana',4,'Rendición de cuentas mensual al comité'),
  item('d','proveedores','proximo',21,'10 postulantes sin revisar',{comunidad_id:null,comunidad:null}),
  item('e','legal','brecha',null,'Asamblea ordinaria anual',{detalle:'Sin fecha registrada · Ley 21.442, artículo 14',ruta:'/jarvis?vista=ciclo'}),
  item('f','operacion','brecha',null,'Comité de administración',{comunidad_id:c2,comunidad:'Reserva de prueba'})
 ],
 analisis:[{fecha:'2026-11-15',generado_en:new Date().toISOString(),
  resumen:'Hay un compromiso con atraso relevante y dos prospectos sin seguimiento. La prioridad del día es cerrar la recepción documental.',
  prioridades:[{titulo:'Cerrar la recepción documental',detalle:'Lleva más de cuatro meses de atraso.',ruta:'/compromisos'},
   {titulo:'Responder al prospecto pendiente',detalle:'Correo recibido sin respuesta.'}],
  riesgos:[{titulo:'Sin fecha de asamblea registrada',detalle:'No es posible anticipar la citación.'}]}],
 comunidades:[{id:c1,nombre:'Condominio de prueba con nombre largo (Inmobiliaria)',estado:'activo'},
  {id:c2,nombre:'Reserva de prueba',estado:'activo'}],
 reglas:[{id:r1,codigo:'ASAMBLEA_ORDINARIA',titulo:'Asamblea ordinaria anual',descripcion:'',base:'Ley 21.442, artículo 14',frecuencia_meses:12,anticipo_dias:45},
  {id:r2,codigo:'CERT_ASCENSORES',titulo:'Certificación de ascensores',descripcion:'',base:'Normativa sectorial de ascensores',frecuencia_meses:null,anticipo_dias:60}],
 ciclo:[{comunidad_id:c1,regla_id:r1,aplica:true,ultima_fecha:'2026-03-10',proxima_fecha:null},
  {comunidad_id:c2,regla_id:r2,aplica:false,ultima_fecha:null,proxima_fecha:null}],
 asumidos:[{id:'j1',titulo:largo,tipo:'informe',contraparte:'Inmobiliaria de prueba – Contacto',fecha_limite:'2026-10-08',prioridad:'alta',estado:'pendiente',responsable:'QA'},
  {id:'j2',titulo:'Responder consulta de cobertura',tipo:'respuesta',contraparte:null,fecha_limite:null,prioridad:'media',estado:'pendiente',responsable:null}]
};
const ANCHOS=[320,360,390,412,768,1280];
const MARGEN=12,TOL=3;
const VISTAS=[['Lo que viene','agenda'],['Datos por completar','brechas'],['Ciclo legal','ciclo'],['Compromisos asumidos','asumidos']];

await mkdir('artifacts/ui',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.UI_QA_CHROME||undefined});
try{
 for(const width of ANCHOS){
  const ctx=await browser.newContext({viewport:{width,height:860},deviceScaleFactor:1,
   isMobile:width<=412,hasTouch:width<=412,serviceWorkers:'block'});
  await ctx.addInitScript(({session})=>{
   localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(session));
  },{session});
  const escrituras=[];
  await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const json=body=>route.fulfill({status:200,contentType:'application/json',
    headers:{'content-range':'0-0/*'},body:JSON.stringify(body)});
   if(path.includes('/auth/v1/user'))return json(user);
   if(path.includes('/rest/v1/perfiles'))return json(url.searchParams.has('id')?perfil:[perfil]);
   if(path.includes('/rest/v1/rpc/jarvis_agenda'))return json(datos.agenda);
   if(req.method()!=='GET'&&req.method()!=='HEAD'){escrituras.push(req.method()+' '+path);return json([]);}
   if(path.endsWith('/jarvis_analisis'))return json(datos.analisis);
   if(path.endsWith('/jarvis_ciclo_reglas'))return json(datos.reglas);
   if(path.endsWith('/jarvis_ciclo_comunidad'))return json(datos.ciclo);
   if(path.endsWith('/jarvis_compromisos'))return json(datos.asumidos);
   if(path.endsWith('/comunidades'))return json(datos.comunidades);
   return json([]);
  });
  const page=await ctx.newPage();
  const errores=[];
  page.on('pageerror',e=>errores.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).first().waitFor({timeout:16000});
  assert.equal(await page.locator('.seleccion-home__tarjeta').filter({hasText:'Jarvis'}).count(),0);
  await page.goto(base+'/jarvis',{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname==='/jarvis',{timeout:15000});
  await page.getByRole('heading',{name:'Jarvis',exact:true}).waitFor({timeout:16000});
  await page.locator('.jarvis-indicador').first().waitFor();

  const conteos=await page.locator('.jarvis-indicador strong').allTextContents();
  assert.deepEqual(conteos,['1','1','1','2'],'Indicadores: atraso, hoy, semana, datos por completar');
  await page.getByText('Atraso de 125 días').waitFor();

  for(const [nombre,slug] of VISTAS){
   await page.locator('.jarvis-vistas').getByRole('button',{name:nombre,exact:true}).click();
   await page.waitForTimeout(120);
   const m=await page.evaluate(()=>{
    const px=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
    const raiz=document.querySelector('.jarvis');
    const visibles=sel=>[...raiz.querySelectorAll(sel)].filter(e=>e.getClientRects().length);
    return {
     overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
     titulo:px(raiz.querySelector('h1')),
     tarjetas:visibles('.tarjeta').map(px),
     botones:visibles('.jarvis-cuerpo .boton, .jarvis-indicador').map(px),
     campos:visibles('.jarvis-cuerpo :is(input,select)').map(e=>({...px(e),fuente:parseFloat(getComputedStyle(e).fontSize)})),
     actual:raiz.querySelector('.jarvis-vistas [aria-current="page"]')?.textContent
    };
   });
   const etiqueta='jarvis/'+slug+' @ '+width+'px';
   assert.equal(m.actual,nombre,etiqueta+' pestaña activa');
   assert.ok(m.overflow<=width+2,etiqueta+' desbordamiento del documento '+JSON.stringify(m.overflow));
   assert.ok(m.tarjetas.length>0,etiqueta+' sin tarjetas');
   for(const [i,t] of [m.titulo,...m.tarjetas,...m.botones,...m.campos].entries()){
    assert.ok(t.left>=MARGEN-TOL&&t.right<=width-MARGEN+TOL,etiqueta+' elemento '+i+' fuera del margen '+JSON.stringify(t));
   }
   if(width<=412){
    for(const b of m.botones)assert.ok(b.height>=44-0.5,etiqueta+' botón bajo 44 px '+JSON.stringify(b));
    for(const c of m.campos){
     assert.ok(c.height>=44-0.5,etiqueta+' campo bajo 44 px '+JSON.stringify(c));
     assert.ok(c.fuente>=16,etiqueta+' campo provoca zoom móvil '+JSON.stringify(c));
    }
   }
   await page.screenshot({path:'artifacts/ui/jarvis-'+slug+'-'+width+'.png',fullPage:true});
   console.log('JARVIS '+etiqueta+' '+JSON.stringify({tarjetas:m.tarjetas.length,overflow:m.overflow-width}));
  }

  // El ciclo calcula la próxima fecha y "No aplica" guarda sin recargar la página.
  await page.locator('.jarvis-vistas').getByRole('button',{name:'Ciclo legal',exact:true}).click();
  await page.getByText('Próxima: 10-03-2027').waitFor();
  await page.getByRole('button',{name:'Sí aplica'}).first().waitFor();
  await page.getByRole('button',{name:'No aplica'}).first().click();
  await page.getByText(/Fecha guardada/).waitFor();
  assert.ok(escrituras.some(e=>e.startsWith('POST')&&e.endsWith('/jarvis_ciclo_comunidad')),
   'El cambio del ciclo se guarda en jarvis_ciclo_comunidad: '+JSON.stringify(escrituras));
  assert.deepEqual(errores,[],'Excepciones JS en '+width+'px');
  await ctx.close();
 }
}finally{await browser.close();}
