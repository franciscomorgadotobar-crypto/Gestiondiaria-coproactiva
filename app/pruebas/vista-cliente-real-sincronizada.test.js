import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer = ruta => readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const selector=leer('src/paginas/panel/VistaCliente.jsx');
const visor=leer('src/paginas/panel/VistaClienteReal.jsx');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const app=leer('src/App.jsx');
const capsulas=leer('src/componentes/BaseConocimientos.jsx');

test('Vista de cliente ya no incrusta una maqueta con navegación administrativa',()=>{
  assert.doesNotMatch(selector,/<PortalCliente/);
  assert.doesNotMatch(selector,/vista-cliente-simulacion/);
  assert.match(selector,/Abrir portal como cliente/);
  assert.match(selector,/\/vista-cliente\/portal\?comunidad=/);
  assert.match(visor,/<PanelEscritorio vistaCliente=/);
  assert.match(visor,/<PortalCliente vistaPrevia=\{\{comunidadId,clienteId,real:true\}\}/);
  assert.doesNotMatch(portal,/portal-pestanas-vista-previa/);
});

test('El visor solo acepta cuentas vinculadas y no suplanta autenticación',()=>{
  assert.match(visor,/\['superadmin','admin','jefatura'\]/);
  assert.match(visor,/supabase\.rpc\('vista_cliente_cuentas',\{p_comunidad_id:comunidadId\}\)/);
  assert.match(visor,/\.find\(c=>c\.cliente_id===clienteId\)/);
  assert.match(visor,/La cuenta no tiene acceso vigente a esta comunidad/);
  assert.match(app,/Route key=\{ruta\} path=\{ruta\} element=\{/);
  assert.match(app,/<Privada><SoloInterno><Suspense/);
  assert.match(portal,/cargarDetalleComunidad\(id,clienteId\)/);
  assert.match(portal,/vista_cliente_'/);
});

test('El menú compartido conserva rutas y permite volver de cada pestaña',()=>{
  assert.match(panel,/const esCliente = perfil\?\.rol === 'cliente' \|\| Boolean\(vistaCliente\)/);
  assert.match(panel,/vistaCliente\.comunidadId/);
  assert.match(panel,/vistaCliente\.clienteId/);
  assert.match(panel,/pathname === '\/vista-cliente\/portal'/);
  assert.match(panel,/rutaBibliotecaCliente/);
  assert.match(panel,/if \(vistaCliente\) \{\s*navegar\('\/vista-cliente\?comunidad='/);
  assert.match(panel,/!vistaCliente&&<div className="menu-mas-grupo menu-mas-grupo-cuenta"/);
  assert.match(panel,/esCliente && !vistaCliente &&/);
});

test('Portal real y visor consultan los datos actualizados y la misma biblioteca',()=>{
  assert.match(portal,/setRevision\(v=>v\+1\)/);
  assert.match(portal,/setInterval\(alVolver,30000\)/);
  assert.match(portal,/visibilitychange/);
  assert.match(portal,/coproactiva:portal:actualizar/);
  assert.match(portal,/key=\{id\+':'\+revision\} comunidadId=\{id\}/);
  assert.match(visor,/coproactiva:portal:actualizar/);
  assert.match(visor,/<Conocimientos\/>/);
  assert.match(capsulas,/\/vista-cliente\/conocimientos\?comunidad=/);
});
