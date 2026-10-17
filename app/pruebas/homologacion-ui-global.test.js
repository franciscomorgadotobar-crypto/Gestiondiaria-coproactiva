import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL('../src/' + ruta, import.meta.url), 'utf8');
const capa = leer('estilos/identidad-app.css');
const modulo = leer('estilos/modulos.css');
const main = leer('main.jsx');
const panel = leer('componentes/PanelEscritorio.jsx');
const iconos = leer('componentes/IconoNavegacion.jsx');
const area = leer('paginas/SeleccionArea.jsx');

test('carga la capa corporativa al final de los estilos, sin modificar Home', () => {
  const imports = [
    "import './estilos/tokens.css'",
    "import './estilos/base.css'",
    "import './estilos/modulos.css'",
    "import './estilos/identidad-app.css'"
  ].map(x=>main.indexOf(x));
  assert.ok(imports.every(i=>i>=0), 'Falta una hoja de estilo');
  assert.deepEqual(imports,imports.slice().sort((a,b)=>a-b),'Orden de cascada CSS');
  assert.match(capa,/NO modificar ni sustituir el selector de áreas/);
  assert.doesNotMatch(capa,/\.seleccion-area-grid\s*[{,]/);
  assert.match(area,/guardarArea\(area\)/,'Home mantiene su navegación');
  assert.match(area,/seleccion-area-grid/,'Home conserva ambas vistas');
});

test('tipografía, tarjetas, botones, colores y responsive comparten tokens', () => {
  for (const name of ['--ca-cobre','--ca-fondo','--ca-blanco','--ca-borde',
    '--ca-radio','--ca-radio-control']) assert.ok(capa.includes(name), name);
  for (const selector of ['.modulo-cabecera','.seo-exec-superficie',
    '.pipeline-tarjeta','.comunidad-card','.propiedad-card','.proveedor-tarjeta',
    '.portal-kpi','.criterio-inspeccion','.tablero','.barra-inferior-movil',
    '.acceso-panel','.modulo-unificado']) assert.ok(capa.includes(selector),selector);
  assert.match(capa,/@media\(max-width:899px\)/);
  assert.match(capa,/@media\(max-width:390px\)/);
  assert.match(capa,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(capa,/outline:2px solid var\(--ca-cobre\)/);
  assert.match(modulo,/\.ui-pestanas/);
});

test('los módulos operativos están incluidos en la identidad común', () => {
  const paginas = [
    'panel/Inicio.jsx','panel/Comunidades.jsx','panel/Proveedores.jsx',
    'panel/Contabilidad.jsx','panel/SEO.jsx','panel/WhatsApp.jsx',
    'panel/Pipeline.jsx','panel/Mantenciones.jsx','panel/Bitacora.jsx',
    'panel/Plantillas.jsx','panel/Plantilla.jsx','panel/Levantamientos.jsx',
    'panel/Programar.jsx','panel/Mapa.jsx','panel/Configuracion.jsx',
    'panel/Equipo.jsx','panel/Clientes.jsx','panel/MiCuenta.jsx',
    'panel/Notificaciones.jsx','panel/Ayuda.jsx',
    'terreno/Control.jsx','terreno/Inicio.jsx',
    'comercial/DiagnosticoComercial.jsx',
    'propiedades/Propiedades.jsx','cliente/PortalCliente.jsx'
  ];
  for(const ruta of paginas) {
    const s=leer('paginas/'+ruta);
    assert.match(s,/modulo-unificado/,'Módulo sin identidad '+ruta);
  }
  assert.match(leer('paginas/panel/Mapa.jsx'),/encabezado modulo-cabecera/);
  assert.match(leer('paginas/terreno/Control.jsx'),
    /encabezado-levantamiento modulo-cabecera/);
  assert.match(leer('paginas/comercial/DiagnosticoComercial.jsx'),
    /encabezado modulo-cabecera/);
});

test('ingreso y recuperación tienen un único estilo y acceso conservado', () => {
  for(const ruta of ['Ingreso.jsx','Clave.jsx']) {
    const fuente=leer('paginas/'+ruta);
    assert.match(fuente,/pantalla acceso-pantalla/);
    assert.match(fuente,/className="acceso-panel"/);
    assert.match(fuente,/logo-coproactiva\.svg/);
    assert.match(fuente,/onSubmit=/);
  }
  assert.match(leer('paginas/Ingreso.jsx'),/signInWithPassword/);
  assert.match(leer('paginas/Clave.jsx'),/verifyOtp/);
});

test('barra lateral usa iconos para cada área con rutas y permisos intactos', () => {
  assert.match(panel,/IconoNavegacion, \{ iconoRutaCoproactiva \}/);
  assert.match(panel,/iconoRutaCoproactiva\(a.ruta\)/);
  assert.match(panel,/accesos\.filter\(a => a.mostrar\)/);
  assert.match(panel,/className=\{'enlace-lateral'/);
  for(const ruta of ['/pipeline','/propiedades','/proveedores','/whatsapp',
    '/seo','/contabilidad','/configuracion','/comunidades','/mantenciones',
    '/bitacora','/mapa']) assert.ok(iconos.includes(ruta),'Sin ruta '+ruta);
  assert.match(iconos,/aria-hidden':true/);
  assert.match(panel,/onClick=\{volverGlobal\}/);
  assert.match(panel,/onClick=\{cambiarArea\}/);
});
