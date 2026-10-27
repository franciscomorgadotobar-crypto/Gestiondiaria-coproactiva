import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completarCorreo,VARIABLES_CORREO} from '../src/lib/plantillasCorreo.js';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Home único sin selector intermedio y secciones operativas',()=>{
 const app=read('src/App.jsx'),home=read('src/paginas/panel/HomeGeneral.jsx');
 assert.match(app,/return <PanelEscritorio><HomeGeneral\s*\/><\/PanelEscritorio>/);
 assert.doesNotMatch(app,/<SeleccionArea/);
 for(const name of ['Comercial','Operaciones','Finanzas','Administración y ajustes','Dashboards por área'])
   assert.ok(home.includes(name),name);
 assert.match(home,/aria-expanded=\{abierto\}/);
 assert.match(home,/home-general-indicadores/);
 assert.doesNotMatch(home,/g\.enlaces\.map/);
 const datos=read('src/lib/homeIndicadores.js');
 assert.match(datos,/contar\('compromisos_administracion'\)/);
 assert.match(datos,/valor:error \? null/);
 assert.match(app,/path="\/compromisos"/);
 assert.match(app,/path="\/plantillas-correo"/);
});
test('Historial y rutas consecutivas',()=>{
 const hist=read('src/lib/historialSelector.js');
 const nav=read('src/lib/navegacion.jsx');
 const menu=read('src/componentes/PanelEscritorio.jsx');
 assert.match(hist,/return esCliente \? '\/portal' : '\/';/);
 assert.match(nav,/return navegar\('\/', \{ replace:true \}\);/);
 assert.match(menu,/navegar\('\/', \{ replace:true \}\);/);
});
test('Los compromisos registran etapas y fechas sin sobreescribirlas con checkbox',()=>{
 const c=read('src/paginas/cliente/Compromisos.jsx');
 const migration=read('../supabase/migrations/0102_compromisos_etapas_y_plantillas_correo.sql');
 assert.match(c,/supabase\.rpc\('compromisos_cambiar_etapa'/);
 assert.match(c,/fecha_inicio/);
 assert.match(c,/fecha_proxima_accion/);
 assert.match(c,/fecha_cierre/);
 assert.match(c,/<details key=\{item\.id\} className="tarjeta compromisos-item"/);
 assert.match(c,/<details className="compromisos-historial"/);
 assert.match(migration,/compromisos_transiciones/);
 assert.match(migration,/enable row level security/);
});
test('Plantillas de correo son separadas de inspecciones y personalizadas por contacto',()=>{
 const c=read('src/paginas/panel/PlantillasCorreo.jsx');
 const pipeline=read('src/paginas/panel/Pipeline.jsx');
 assert.match(c,/plantillas_correo_crm/);
 assert.match(pipeline,/plantillas_correo_crm/);
 assert.match(pipeline,/completarCorreo/);
 assert.ok(VARIABLES_CORREO.includes('{{comunidad}}'));
 const resultado=completarCorreo('Hola {{nombre}}, {{comunidad}} - {{responsable}}',
  {nombre_contacto:'María Rojas',nombre_condominio:'Santa Clara'},'Francisco');
 assert.equal(resultado,'Hola María, Santa Clara - Francisco');
});
test('Web pública continúa usando formulario seguro existente y registro en CRM',()=>{
 const endpoint=read('../supabase/functions/contacto-web-crm/index.ts');
 assert.match(endpoint,/registrar_formulario_web/);
 assert.match(endpoint,/body\.privacy!==true/);
 assert.match(endpoint,/contacto_hash/);
});
