/**
 * QA con navegador de la vista cliente real y simulada:
 * estado por materia y PDF, sin mostrar check-in administrativo.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.UI_QA_URL||'http://127.0.0.1:5173';
const usuarioId='aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clienteId='ddddddd0-dddd-4ddd-8ddd-dddddddddddd';
const comunidadId='bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const controlId='eeeeeee0-eeee-4eee-8eee-eeeeeeeeeeee';
const comunidad={id:comunidadId,comunidad_id:comunidadId,nombre:'Reserva Santa Clara',
 direccion:'Avda. Waldo Alcalde #1855',comuna:'Coquimbo',latitud:null,longitud:null,
 estado:'activo',por_agendar:0,agendados:0,pendientes:0};
const materia={id:'ccccccc0-cccc-4ccc-8ccc-cccccccccccc',comunidad_id:comunidadId,
 orden:1,materia:'Designación del primer administrador',avance:'completado',
 estado_detalle:'Escritura pública del 13 de octubre de 2026',
 a_cargo_de:'Coproactiva',fecha_informe:'2026-11-17',creado_en:'2026-11-17T10:00:00Z'};
const levantamiento={id:controlId,comunidad_id:comunidadId,
 plantilla_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',
 plantilla_nombre:'Primera visita de administración',estado:'enviado',periodo:'noviembre 2026',
 programado_para:'2026-11-15T12:00:00Z',creado_en:'2026-11-14T09:00:00Z',
 enviado_en:'2026-11-15T16:00:00Z',checkin_en:null};
const levantamientoDetalle={
 levantamiento:{id:controlId,plantilla_nombre:'Primera visita de administración',
   estado:'enviado',creado_en:'2026-11-14T09:00:00Z',enviado_en:'2026-11-15T16:00:00Z'},
 items:[{id:'01234567-89ab-4cde-8f01-234567890abc',grupo:'Accesos',
   texto:'Puerta principal',estado:'cumple',nota:'Revisada',respuesta:'Conforme'}],
 adjuntos:[]
};

const navegador=await chromium.launch({headless:true});
try {
 for(const rol of ['cliente','superadmin'])for(const ancho of [390,1280]){
   const ahora=Math.floor(Date.now()/1000);
   const jwt=[
     Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
     Buffer.from(JSON.stringify({sub:usuarioId,role:'authenticated',exp:ahora+7200})).toString('base64url'),
     'firma-prueba-local'
   ].join('.');
   const user={id:usuarioId,aud:'authenticated',role:'authenticated',
     email:'qa@coproactiva.test',app_metadata:{provider:'email',providers:['email']},
     user_metadata:{},created_at:new Date().toISOString()};
   const session={access_token:jwt,token_type:'bearer',expires_at:ahora+7200,expires_in:7200,
     refresh_token:'token-local',user};
   const ctx=await navegador.newContext({viewport:{width:ancho,height:900},
     serviceWorkers:'block',isMobile:ancho<650,hasTouch:ancho<650});
   // Inyectar una sola vez. Tras cerrar sesión, el contexto no debe reponer
   // automáticamente la credencial cuando se compruebe la ruta protegida.
   await ctx.addInitScript(s=>{
     if(!sessionStorage.getItem('qa-sesion-cargada')){
       localStorage.setItem('sb-sin-configurar-auth-token',JSON.stringify(s));
       sessionStorage.setItem('qa-sesion-cargada','1');
     }
   },session);
   const llamadas=[];
   let cierres=0;
   await ctx.route('https://sin-configurar.supabase.co/**',async route=>{
     const url=new URL(route.request().url()),path=url.pathname;
     const resp=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
     if(path.includes('/auth/v1/user'))return resp(user);
     if(path.includes('/auth/v1/logout')){
       cierres++;
       return route.fulfill({status:204,body:''});
     }
     if(path.includes('/rest/v1/perfiles'))return resp({
       id:usuarioId,nombre:'QA Coproactiva',rol,activo:true,email:user.email,bottom_nav:[]
     });
     if(path.includes('/rest/v1/comunidades')){
       return resp(url.searchParams.has('id')?comunidad:[comunidad]);
     }
     if(path.includes('/rest/v1/estado_avance_materias'))return resp([materia]);
     if(path.includes('/rpc/')){
       const name=path.split('/').pop();
       llamadas.push(name);
       if(name==='portal_cliente_dashboard')return resp([comunidad]);
       if(name==='vista_cliente_cuentas')return resp([{
         cliente_id:clienteId,cliente_nombre:'Equipazo',cliente_email:'cliente@coproactiva.test'
       }]);
       if(name==='portal_levantamiento_detalle'){
         const p=JSON.parse(route.request().postData()||'{}');
         assert.equal(p.p_control_id,controlId);
         assert.equal(p.p_usuario_cliente,rol==='superadmin'?clienteId:null);
         return resp(levantamientoDetalle);
       }
       if(name.endsWith('_levantamientos'))return resp([levantamiento]);
       return resp([]);
     }
     if(path.includes('/functions/v1/'))return resp({});
     return resp([]);
   });
   const page=await ctx.newPage(),errores=[];
   page.on('pageerror',e=>errores.push(e.message));
   const url=rol==='cliente'
     ?base+'/portal/comunidades/'+comunidadId
     :base+'/vista-cliente?comunidad='+comunidadId+'&cliente='+clienteId+'&seccion=compromisos';
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Estado de avances y compromisos - Reserva Santa Clara'}).waitFor({timeout:25000});
   assert.equal(await page.getByText('Estado de avance de la puesta en marcha').count(),0);
   assert.equal(await page.getByRole('button',{name:'Editar materia: Designación del primer administrador'}).count(),0);
   assert.ok(llamadas.some(x=>x.endsWith('_levantamientos')));
   const pestañas=page.locator('.portal-pestanas-movil');
   async function abrirSeccion(seccion){
     const boton=pestañas.getByRole('button',{name:seccion,exact:true});
     if(await boton.isVisible())await boton.click();
     else await page.getByRole('link',{name:seccion,exact:true}).click();
   }
   await abrirSeccion('Levantamientos');
   assert.equal(await page.getByText('Check-in administrativo (sin GPS)').count(),0);
   assert.equal(await page.locator('.portal-checkin-administrativo').count(),0);
   assert.equal(await page.getByText('No se pudo registrar GPS').count(),0);
   const botonPdf=page.getByRole('button',{name:'Abrir informe PDF del levantamiento'});
   await botonPdf.waitFor({timeout:15000});
   await botonPdf.click();
   await page.waitForFunction(()=>document.querySelector('.portal-boton-pdf')?.textContent?.includes('Abrir informe PDF'),{timeout:25000});
   assert.ok(llamadas.includes('portal_levantamiento_detalle'));
   assert.ok(!llamadas.includes('checkins_administrativos_visibles'));
   assert.equal(await page.locator('.portal-visor-levantamiento').count(),0);
   await abrirSeccion('Resumen');
   assert.equal(await page.locator('.portal-checkin-resumen').count(),0);
   assert.deepEqual(errores,[]);
   // El cliente con una sola comunidad no llega a ver el dashboard.
   if(rol==='cliente'){
     if(ancho<900){
       const boton=page.getByRole('button',{name:'Cerrar sesión',exact:true});
       assert.equal(await boton.isVisible(),true,'Botón de salida visible en móvil');
       await boton.click();
     }else{
       const boton=page.locator('.usuario-lateral-salir');
       assert.equal(await boton.isVisible(),true,'Salida disponible en sidebar');
       await boton.click();
     }
     await page.waitForURL(u=>u.pathname==='/ingreso',{timeout:15000});
     assert.equal(cierres,1,'Se solicita una única salida');
     await page.goto(base+'/portal/comunidades/'+comunidadId,{waitUntil:'domcontentloaded'});
     await page.waitForURL(u=>u.pathname==='/ingreso',{timeout:15000});
   }else if(ancho<900){
     assert.equal(await page.getByRole('button',{name:'Cerrar sesión',exact:true}).count(),0,
       'En la simulación administrativa no debe aparecer el botón de cliente');
   }
   await ctx.close();
   console.log('Portal PDF sin check-in administrativo: OK '+rol+' '+ancho+'px');
 }
} finally {await navegador.close();}
