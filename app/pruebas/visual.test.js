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
  for(const regla of ['.modulo-cabecera','.seo-pestanas','.contabilidad-nav',
    '.wa-tabs','.tarjeta','focus-visible','prefers-reduced-motion']) {
    assert.ok(css.includes(regla),'Falta regla visual '+regla);
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
