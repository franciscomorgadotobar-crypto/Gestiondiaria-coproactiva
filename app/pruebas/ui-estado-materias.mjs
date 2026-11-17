/**
 * QA visual / interacción del nuevo Estado por materia. Fixtures exclusivamente locales;
 * ninguna petición llega a la base real ni modifica registros de Santa Clara.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const usuarioId='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const comunidadId='bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ahora=Math.floor(Date.now()/1000);
const token=[
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:usuarioId,role:'authenticated',exp:ahora+7200})).toString('base64url'),
  'firma-de-qa'
].join('.');
const user={id:usuarioId,aud:'authenticated',role:'authenticated',
  email:'qa@coproactiva.test',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:token,token_type:'bearer',expires_at:ahora+7200,
  expires_in:7200,refresh_token:'qa-local',user};
const perfil={id:usuarioId,nombre:'QA',rol:'superadmin',activo:true,email:user.email,bottom_nav:[]};
const comunidad={id:comunidadId,nombre:'Reserva Santa Clara',comuna:'Coquimbo',
 direccion:'Calle de pruebas',estado:'activo',latitud:null,longitud:null};
const registros=[
 ['Designación del primer administrador','completado','Escritura pública del 13 de octubre de 2026','Coproactiva'],
 ['RUT de la comunidad','completado','53.328.255-5','Coproactiva'],
 ['Cuenta corriente de la comunidad','completado','Cuenta habilitada','Coproactiva'],
 ['Contraparte de la inmobiliaria','completado','Designadas las contrapartes','Inmobiliaria'],
 ['Contrato de administración','en_curso','En revisión','Ambas partes'],
 ['Observaciones al reglamento de copropiedad','en_curso','Enviadas a la inmobiliaria','Inmobiliaria'],
 ['Visita inicial e informe de gestión del primer mes','completado','Realizados y enviados','Coproactiva'],
 ['Seguridad, conserjería y fondo operacional inicial','en_curso','En revisión','Inmobiliaria'],
 ['Seguro colectivo contra incendio','pendiente','Por cotizar','Coproactiva'],
 ['Plan de emergencia y evacuación','pendiente','Por elaborar','Coproactiva'],
 ['Mantención de áreas verdes','pendiente','Cotización pendiente','Coproactiva'],
 ['Entrega de los bienes comunes de la Etapa I','pendiente','Fecha por confirmar','Inmobiliaria']
];
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/ui',{recursive:true});
try {
 for (const ancho of [320,390,768,1280]) {
  const datos=registros.map((r,i)=>({
   id:'cccccccc-cccc-4ccc-8ccc-'+String(i+1).padStart(12,'0'),
   comunidad_id:comunidadId,orden:i+1,materia:r[0],avance:r[1],
   estado_detalle:r[2],a_cargo_de:r[3],fecha_informe:'2026-11-17',
   creado_en:'2026-11-17T12:00:00Z'
  }));
  let grabadas=0;
  const ctx=await browser.newContext({
    viewport:{width:ancho,height:900},serviceWorkers:'block',
    isMobile:ancho<650,hasTouch:ancho<650
  });
  await ctx.addInitScript(s=>localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(s)),session);
  await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    const responder=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path.includes('/auth/v1/user'))return responder(user);
    if(path.includes('/rest/v1/perfiles'))return responder(url.searchParams.has('id')?perfil:[perfil]);
    if(path.includes('/rest/v1/comunidades'))return responder(url.searchParams.has('id')?comunidad:[comunidad]);
    if(path.includes('/rest/v1/estado_avance_materias')){
      if(route.request().method()==='PATCH'){
        const payload=JSON.parse(route.request().postData()||'{}');
        const ident=url.searchParams.get('id')?.replace('eq.','');
        const fila=datos.find(x=>x.id===ident);
        assert.ok(fila,'Edición debe apuntar a una materia existente');
        Object.assign(fila,payload);
        grabadas++;
        return responder({id:fila.id});
      }
      return responder(datos);
    }
    if(path.includes('/rpc/'))return responder([]);
    if(path.includes('/functions/v1/'))return responder({});
    return responder([]);
  });
  const page=await ctx.newPage(),errores=[];
  page.on('pageerror',e=>errores.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Hola/}).first().waitFor({timeout:20000});
  await page.getByRole('button',{name:'Mostrar opciones de Operaciones de comunidades'}).click();
  await page.getByRole('button',{name:'Comunidades',exact:true}).click();
  await page.waitForURL(u=>u.pathname==='/comunidades',{timeout:20000});
  await page.getByRole('link',{name:/Reserva Santa Clara/}).first().click();
  await page.waitForURL(u=>u.pathname==='/comunidades/'+comunidadId,{timeout:20000});
  await page.getByRole('tab',{name:'Gestiones y avances'}).click();
  await page.getByText('Estado de avance de la puesta en marcha').waitFor();
  await page.getByText('Al 17 de noviembre de 2026.').waitFor();
  assert.equal(await page.locator('.estado-materias__seguimiento-anterior').count(),1);
  assert.equal(await page.locator('.estado-materias__seguimiento-anterior').getAttribute('open'),null);
  assert.equal(await page.locator('.estado-materias__tabla th').allTextContents().then(a=>a.join('|')),
    'Materia|Avance|Estado|A cargo de');
  if(ancho<=720){
    assert.equal(await page.locator('.estado-materias__movil-tarjeta').count(),12);
    assert.equal(await page.locator('.estado-materias__tabla-contenedor').evaluate(e=>getComputedStyle(e).display),'none');
  }else{
    assert.equal(await page.locator('.estado-materias__fila').count(),12);
    assert.equal(await page.locator('.estado-materias__movil').evaluate(e=>getComputedStyle(e).display),'none');
  }
  const scrollWidth=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth));
  assert.ok(scrollWidth<=ancho+2,'El estado por materia desborda horizontalmente: '+ancho+'/'+scrollWidth);
  await page.screenshot({path:'artifacts/ui/estado-materias-'+ancho+'.png',fullPage:false});
  await page.getByRole('button',{name:'Editar materia: Designación del primer administrador'}).click();
  await page.getByLabel('Estado (descripción de la gestión)').fill('Antecedentes verificados en QA');
  await page.getByLabel('Avance',{exact:true}).selectOption('en_curso');
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await page.getByText('Antecedentes verificados en QA').first().waitFor();
  assert.equal(grabadas,1,'La edición debe guardarse una vez sin duplicados');
  assert.equal(datos[0].avance,'en_curso');
  assert.equal(datos[0].estado_detalle,'Antecedentes verificados en QA');
  assert.deepEqual(errores,[],'Errores de JS en '+ancho+'px');
  await ctx.close();
  console.log('Estado por materia, edición y layout: OK '+ancho+'px');
 }
} finally {await browser.close();}
