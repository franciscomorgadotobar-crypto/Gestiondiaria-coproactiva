import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=leer('src/main.jsx');
const css=leer('src/estilos/comercial-homologado.css');
const pipeline=leer('src/paginas/panel/Pipeline.jsx');
const documentos=leer('src/paginas/panel/GestorDocumental.jsx');
const propiedades=leer('src/paginas/propiedades/Propiedades.jsx');
const seo=leer('src/paginas/panel/SEO.jsx');
const cssDocumentos=leer('src/paginas/panel/GestorDocumental.css');

test('El diseño compartido se carga después de identidad, acotado a Comercial',()=>{
  assert.ok(main.indexOf("import './estilos/comercial-homologado.css';")>
    main.indexOf("import './estilos/identidad-app.css';"));
  for(const componente of [pipeline,documentos,propiedades,seo]){
    assert.match(componente,/comercial-ui/);
    assert.match(componente,/comercial-eyebrow/);
  }
  assert.match(css,/\.comercial-pipeline/);
  assert.match(css,/\.comercial-seo/);
  assert.match(css,/\.comercial-propiedades/);
  assert.match(css,/\.comercial-documentos/);
  assert.doesNotMatch(css,/\.barra-inferior-movil/);
});

test('Encabezados homologados: misma jerarquía, márgenes y botones',()=>{
 assert.match(css,/\.pantalla\.modulo-unificado\.comercial-ui>\.encabezado\.modulo-cabecera/);
 assert.match(css,/\.comercial-ui :is\(\.modulo-cabecera h1\.h3,\.documentos-gestor-cabecera h1\)/);
 assert.match(css,/\.comercial-documentos>\.documentos-gestor-cabecera/);
 assert.match(css,/var\(--comercial-gutter\)/);
 assert.match(propiedades,/className="boton propiedades-nueva"/);
 assert.match(pipeline,/>Nuevo lead<\/button>/);
 assert.match(documentos,/\+ Crear documento/);
 assert.match(seo,/seo-actualizar/);
});

test('Pipeline tiene dos columnas de KPIs en móvil, sin cambiar los filtros',()=>{
 const mobile=css.slice(css.indexOf('@media(max-width:700px)'));
 assert.match(mobile,/\.comercial-pipeline \.tablero\.pipeline-indicadores\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(pipeline,/onClick=\{\(\)=>activarResumen\(clave\)\}/);
 assert.match(pipeline,/aria-pressed=\{filtroResumen===clave\}/);
 assert.match(pipeline,/onClick=\{\(\) => elegirEtapa\(clave\)\}/);
});

test('Gestor conserva tarjetas originales en una columna, y biblioteca debajo',()=>{
 assert.match(cssDocumentos,/\.documentos-plantilla\{min-height:0;display:grid;grid-template-columns:36px minmax\(0,1fr\) auto/);
 const mobile=css.slice(css.indexOf('@media(max-width:700px)'));
 assert.match(mobile,/\.comercial-documentos \.documentos-plantilla\{grid-template-columns:36px minmax\(0,1fr\) auto\}/);
 assert.match(mobile,/\.comercial-documentos \.documentos-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(mobile,/\.comercial-documentos \.documentos-lateral\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(documentos,/Ver biblioteca completa/);
 assert.match(documentos,/onClick=\{\(\)=>alternarBiblioteca\(!verBiblioteca\)\}/);
});

test('Propiedades y SEO conservan interacciones y formularios',()=>{
 assert.match(propiedades,/onClick=\{\(\) => cambiarOperacion\(valor\)\}/);
 assert.match(propiedades,/onChange=\{e => setBuscar\(e.target.value\)\}/);
 assert.match(propiedades,/onClick=\{\(\) => setConfirmando\(true\)\}/);
 assert.match(seo,/onClick=\{\(\) => recargar\(true\)\}/);
 assert.match(seo,/onChange=\{e => setDias\(Number\(e.target.value\)\)\}/);
 assert.match(css,/\.comercial-seo \.seo-exec-grid-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
