import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer=ruta=>readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const app=leer('src/App.jsx');
const panel=leer('src/componentes/PanelEscritorio.jsx');
const avisos=leer('src/componentes/BaseConocimientos.jsx');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const biblioteca=leer('src/paginas/panel/Conocimientos.jsx');
const datos=JSON.parse(leer('src/datos/ley21442.contenidos.json'));

test('El cliente accede a la misma biblioteca completa de Ley 21.442 sin acceso interno',()=>{
  assert.equal(datos.contenidos.length,202);
  assert.equal(datos.contenidos.filter(item=>item.automatico).length,160);
  assert.match(app, /<Route path="\/portal\/conocimientos" element=\{[\s\S]*?<Cliente>[\s\S]*?<Conocimientos \/>/);
  assert.match(app, /<Route path="\/conocimientos" element=\{<Interna>/);
  assert.match(biblioteca,/import biblioteca from '\.\.\/\.\.\/datos\/ley21442\.contenidos\.json'/);
  assert.match(biblioteca,/const contenidos = biblioteca\.contenidos/);
  assert.doesNotMatch(biblioteca,/comunidad_id|comunidadId/);
});

test('Los avisos ¿Sabías que…? también aparecen en portal, nunca dentro de biblioteca',()=>{
  assert.match(avisos,/const activo = Boolean\(usuarioId && !cargando && perfil\?\.activo\)/);
  assert.doesNotMatch(avisos,/perfil\?\.rol !== 'cliente'/);
  assert.match(avisos,/pathname === '\/portal\/conocimientos'/);
  assert.match(avisos,/navegar\(\(perfil\?\.rol === 'cliente' \? '\/portal\/conocimientos' : '\/conocimientos'\)/);
  assert.match(avisos,/elegirCapsula\(biblioteca\.contenidos, recientes\.current\)/);
});

test('La biblioteca figura en el menú Más y en la navegación cliente',()=>{
  assert.match(panel,/id: 'cliente-conocimientos', ruta: '\/portal\/conocimientos'/);
  assert.match(panel,/etiqueta: 'Base de conocimientos'/);
  assert.match(panel,/enlacePortal\('documentos', 'Documentos'\),\s*accesoBibliotecaCliente/);
  assert.match(panel,/\['cliente-comunidades', 'cliente-conocimientos'\]/);
  assert.match(panel,/cliente-conocimientos.*IconoNavegacion/);
  assert.match(panel,/if \(esCliente && pathname === '\/portal\/conocimientos'\)/);
  assert.match(panel,/navegar\('\/portal'\)/);
  assert.match(portal,/<Link to="\/portal\/conocimientos" className="portal-acceso portal-acceso-ley"/);
});
