import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = ruta => readFileSync(new URL('../src/'+ruta, import.meta.url), 'utf8');
const global = read('estilos/modulos.css');
const comunidades = read('paginas/panel/Comunidades.jsx');
const proveedores = read('paginas/panel/Proveedores.jsx');
const postulantes = read('paginas/panel/ProveedoresRecepcion.jsx');
const comunicaciones = read('paginas/panel/ProveedoresComunicaciones.jsx');
const contabilidad = read('paginas/panel/Contabilidad.jsx');
const levantamientos = read('paginas/panel/Levantamientos.jsx');
const plantilla = read('paginas/panel/Plantilla.jsx');
const importar = read('paginas/panel/ImportarPlantillas.jsx');
const practica = read('paginas/panel/PracticaLevantamiento.jsx');
const contabilidadCss = read('paginas/panel/Contabilidad.css');

test('Comunidades usa pestañas estándar y conserva el estado seleccionado',()=>{
  assert.match(comunidades,/className="pestanas ui-pestanas"/);
  assert.match(comunidades,/role="tablist" aria-label="Secciones de la comunidad"/);
  assert.match(comunidades,/aria-selected=\{seccion === clave\}/);
  assert.match(comunidades,/onClick=\{\(\) => cambiarSeccion\(clave\)\}/);
  assert.match(comunidades,/comunidades-herramientas ui-toolbar/);
  assert.match(comunidades,/comunidad-form ui-panel/);
  assert.match(comunidades,/formulario-grid ui-formulario/);
});
test('Proveedores comparte filtros y formularios sin perder selección múltiple',()=>{
  assert.match(proveedores,/proveedores-busqueda-fila ui-toolbar/);
  assert.match(proveedores,/proveedores-filtros ui-panel/);
  assert.match(proveedores,/proveedores-tabla-wrap ui-tabla-scroll/);
  assert.match(proveedores,/aria-label="Seleccionar proveedores filtrados"/);
  assert.match(proveedores,/formulario-grid ui-formulario/);
  assert.match(postulantes,/formulario-grid ui-formulario/);
  assert.match(postulantes,/proveedores-recepcion-toolbar ui-toolbar/);
  assert.match(comunicaciones,/tabla-responsive ui-tabla-scroll/);
});
test('Contabilidad preserva formatos y cálculos y permite consultar reportes enteros',()=>{
  assert.match(contabilidad,/contabilidad-cuerpo modulo-contenido/);
  assert.match(contabilidad,/contabilidad-toolbar ui-toolbar/);
  assert.equal((contabilidad.match(/tabla-responsive ui-tabla-scroll/g)||[]).length,4);
  assert.equal((contabilidad.match(/aria-label="Tabla contable, desplazamiento horizontal"/g)||[]).length,4);
  assert.match(contabilidad,/contabilidad-acciones-principales"/);
  assert.doesNotMatch(contabilidad,/contabilidad-acciones-principales ui-acciones/);
  assert.match(contabilidadCss, /\.contabilidad-pantalla \.ui-tabla-scroll > table/);
  assert.match(contabilidadCss, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});
test('El flujo de plantillas, importación y práctica hereda el sistema visual',()=>{
  for(const codigo of [plantilla,importar,practica,levantamientos]){
    assert.match(codigo,/modulo-unificado/);
    assert.match(codigo,/modulo-cabecera/);
    assert.match(codigo,/modulo-contenido/);
  }
  assert.match(levantamientos,/className="levantamientos-opciones"/);
  assert.doesNotMatch(levantamientos,/levantamientos-opciones ui-acciones/);
});
test('Reglas de formularios y scroll mantienen diseños especiales en móvil',()=>{
  for(const regla of ['.ui-panel','.ui-toolbar','.ui-formulario','.ui-tabla-scroll',
    '.ui-tabla-scroll:focus-visible','max-width: 760px']) {
      assert.ok(global.includes(regla),'Falta '+regla);
  }
  assert.match(global,/\.ui-formulario > \.ancho-total/);
  assert.match(global,/\.ui-formulario \{ grid-template-columns: minmax\(0,1fr\); \}/);
  assert.match(global,/focus-visible/);
});

test('Fase 3 mantiene campos táctiles y reportes legibles sin ocultar columnas',()=>{
  const css = read('estilos/modulos.css');
  const reportes = read('paginas/panel/Contabilidad.css');
  assert.match(css,/\.ui-formulario :is\(input,select,textarea\) \{\s*font-size: 16px;/);
  assert.match(css,/\.ui-tabla-scroll \{\s*scrollbar-gutter: stable;/);
  assert.match(reportes,/\.ui-tabla-scroll > table th,/);
  assert.match(reportes,/font-variant-numeric: tabular-nums/);
  assert.match(reportes,/overscroll-behavior-x: contain/);
});
