import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = ruta => readFileSync(new URL('../src/'+ruta,import.meta.url),'utf8');
const css = read('estilos/modulos.css');
const tokens = read('estilos/tokens.css');
const main = read('main.jsx');

const principales = [
  'Inicio','Comunidades','Levantamientos','Proveedores','Contabilidad','SEO',
  'Pipeline','Mantenciones','Plantillas','Bitacora','Configuracion','Equipo',
  'Notificaciones','MiCuenta','Clientes','Ayuda','Programar',
  'ProveedoresRecepcion','ProveedoresComunicaciones'
];
const adicionales = [
  ['../paginas/propiedades/Propiedades.jsx','pantalla'],
  ['../paginas/cliente/PortalCliente.jsx','pantalla']
];

test('los estilos de módulos están conectados al punto de entrada de la PWA',()=>{
  assert.match(main,/import '\.\/estilos\/modulos\.css'/);
  assert.match(tokens,/--radio-control:\s*7px/);
  assert.match(tokens,/--radio-tarjeta:\s*10px/);
});

test('pantallas principales usan la misma identidad y encabezado',()=>{
  for(const modulo of principales){
    const src=read('paginas/panel/'+modulo+'.jsx');
    assert.match(src,/modulo-unificado/,modulo+' debe usar el sistema visual compartido');
    assert.match(src,/modulo-cabecera/,modulo+' debe tener encabezado homologado');
  }
});

test('portal cliente y propiedades usan el mismo marco visual',()=>{
  for(const [ruta] of adicionales) {
    const src=read(ruta.replace(/^\.\.\//,''));
    assert.match(src,/modulo-unificado/);
    assert.match(src,/modulo-cabecera/);
  }
});

test('el sistema tiene reglas comunes y conserva estados semánticos',()=>{
  for(const regla of ['.modulo-cabecera','.ui-pestanas','.ui-estado',
    '.tarjeta','focus-visible','prefers-reduced-motion']) {
    assert.ok(css.includes(regla),'Falta regla visual '+regla);
  }

  const rutas = [
    read('paginas/panel/SEO.jsx'),
    read('paginas/panel/Contabilidad.jsx'),
    read('componentes/ProveedoresNavegacion.jsx'),
    read('paginas/panel/WhatsApp.jsx')
  ];
  for(const modulo of rutas) {
    assert.match(modulo, /ui-pestanas/, 'Toda pestaña de módulo debe usar el patrón común');
  }
  for(const estado of ['--ok-fondo','--alerta-fondo','--critico-fondo']) {
    assert.ok(tokens.includes(estado),'No debe perderse '+estado);
  }
});

test('se respeta la barra inferior y ancho móvil sin alterar navegación',()=>{
  assert.match(css,/@media\s*\(max-width:\s*899px\)/);
  assert.match(css,/min-width:\s*0/);
  const panel=read('componentes/PanelEscritorio.jsx');
  assert.match(panel,/barra-inferior-movil/);
});


test('Clientes separa listado, ficha individual, permisos y actividad real',()=>{
  const clientes = read('paginas/panel/Clientes.jsx');
  const estilos = read('paginas/panel/Clientes.css');
  const panel = read('componentes/PanelEscritorio.jsx');
  assert.match(clientes,/Listado de clientes/);
  assert.match(clientes,/clientes-lista-item/);
  assert.match(clientes,/parametros\.get\('cliente'\)/);
  assert.match(clientes,/['"]permisos['"], ['"]actividad['"]/);
  assert.match(clientes,/Comunidades autorizadas/);
  assert.match(clientes,/Último acceso registrado/);
  assert.match(clientes,/Detalle de uso todavía no disponible/);
  assert.match(clientes,/setMostrarInactivos/);
  assert.match(clientes,/cargandoAcceso/);
  assert.doesNotMatch(clientes,/setSeleccionado/);
  assert.match(estilos,/@media\(max-width:899px\)/);
  assert.match(estilos,/clientes-ficha-tabs/);
  assert.match(panel,/barra-area-nombre/);
  assert.doesNotMatch(panel,/className="barra-area-cambiar"/);
});
