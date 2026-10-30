import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completarCorreo,VARIABLES_CORREO,pendientesCorreo,validarBorradorCorreo} from '../src/lib/plantillasCorreo.js';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Home modular restaurado y Cambiar vista disponible',()=>{
 const app=read('src/App.jsx');
 const selector=read('src/paginas/SeleccionArea.jsx');
 const catalogo=read('src/lib/selectorModulos.js');
 assert.match(app,/return <SeleccionArea \/>/);
 assert.match(selector,/modulosDisponibles\(perfil\)/);
 assert.match(selector,/Cambiar vista/);
 assert.match(selector,/Por módulos/);
 assert.match(selector,/Por áreas/);
 assert.match(selector,/Lista/);
 assert.match(selector,/Cuadrícula/);
 assert.match(catalogo,/return 'modulos'/);
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

test('El catálogo fuente incorpora 33 plantillas, siete áreas y dos variantes de reunión',()=>{
 const sql=read('../supabase/migrations/0103_catalogo_plantillas_correo_coproactiva.sql');
 const json=sql.match(/jsonb_to_recordset\('([\s\S]*?)'::jsonb\)/)?.[1];
 assert.ok(json,'La migración conserva todos los textos originales');
 const entradas=JSON.parse(json.replace(/''/g,"'"));
 assert.equal(entradas.length,33);
 assert.equal(new Set(entradas.map(p=>p.codigo)).size,33);
 assert.equal(new Set(entradas.map(p=>p.categoria)).size,7);
 assert.deepEqual(entradas.filter(p=>p.sugerida).map(p=>p.codigo),['24','25','26','33']);
 assert.equal(entradas.find(p=>p.codigo==='08').variantes.length,1);
 assert.match(entradas.find(p=>p.codigo==='01').cuerpo,/MINVU/);
 assert.match(entradas.find(p=>p.codigo==='33').cuerpo,/Por el momento no tenemos vacantes/);
 assert.match(sql,/on conflict \(codigo\) do nothing/);
 assert.match(sql,/codigo is null and creada_por is null/);
});
test('Plantillas mantienen variables sin inventar datos y exigen quitar instrucciones',()=>{
 const caso={nombre_contacto:'María Rojas',nombre_condominio:'Santa Clara',comuna:'San Bernardo',
  direccion:'Los Olivos 234',unidades:109};
 assert.match(completarCorreo('{{nombre}} en {{comunidad}}, {{comuna}}; {{remitente}}; {{saludo}}',caso,'Francisco'),
  /^María en Santa Clara, San Bernardo; Francisco; (Buenos días|Buenas tardes|Buenas noches)$/);
 assert.deepEqual(pendientesCorreo('Re: [asunto original]','{{fecha}}: [Opcional]'),{
  variables:['fecha'],instrucciones:['asunto original','Opcional']});
 assert.equal(validarBorradorCorreo('Hola {{comuna}}','Le solicito [completar] su respuesta').length,2);
 assert.deepEqual(validarBorradorCorreo('Confirmación','Buenas tardes.'),[]);
 const pantalla=read('src/paginas/panel/PlantillasCorreo.jsx');
 const pipeline=read('src/paginas/panel/Pipeline.jsx');
 const sender=read('../supabase/functions/correo-prospecto/index.ts');
 assert.match(pantalla,/categoriasVisibles\.map/);
 assert.match(pantalla,/adjunto_sugerido/);
 assert.match(pipeline,/supabase\.functions\.invoke\('correo-prospecto'/);
 assert.match(sender,/bcc:CCO/);
 assert.doesNotMatch(sender,/const saludo=prospecto\.nombre_contacto/);
});
