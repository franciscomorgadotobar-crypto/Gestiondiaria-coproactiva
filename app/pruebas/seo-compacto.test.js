import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = x => readFileSync(new URL('../src/paginas/panel/'+x,import.meta.url),'utf8');
const impacto=read('SEOImpacto.jsx');
const oportunidades=read('SEOInventarioOportunidades.jsx');
const seo=read('SEO.jsx');

test('seguimiento presenta una sola fila por mejora con detalle plegable',()=>{
  assert.match(impacto,/aria-expanded=\{abierto\}/);
  assert.match(impacto,/\{abierto&&<div className="seo-impacto-mejora-detalle">/);
  assert.match(impacto,/<details className="seo-impacto-historial">/);
});

test('seguimiento no duplica estado de Netlify ni permisos en el reporte',()=>{
  assert.doesNotMatch(impacto,/Falta configurar NETLIFY_ACCESS_TOKEN/);
  assert.doesNotMatch(impacto,/API pendiente de autorización/);
  assert.doesNotMatch(impacto,/Sin referencia comparable/);
  assert.doesNotMatch(impacto,/}\s*\n\s*<div className="seo-impacto-buttons"/);
});

test('sin datos posteriores aparece una sola referencia base y no cuatro cuadros vacíos',()=>{
  assert.match(impacto,/!listo&&<div className="seo-impacto-espera"/);
  assert.match(impacto,/\{periodo&&listo&&<>/);
  assert.match(impacto,/Última referencia:/);
});

test('métricas consultan Search Console y permiten escoger 7, 28 y 90 días',()=>{
  for(const d of ['7','28','90'])assert.match(impacto,new RegExp('<option value="'+d+'">'));
  assert.match(impacto,/invocar\('seguimiento-seo'/);
  assert.match(impacto,/cambioCtrPuntos/);
  assert.match(impacto,/cambioPosicion/);
});

test('oportunidades y pie del módulo no repiten explicaciones',()=>{
  assert.doesNotMatch(oportunidades,/Aquí aparecen todas las oportunidades/);
  assert.doesNotMatch(oportunidades,/Fuentes: Search Console/);
  assert.doesNotMatch(seo,/<footer className="seo-pie">/);
});

test('al expandir una mejora se ven los textos Original y Cambio',()=>{
  assert.match(impacto,/function CambiosDeContenido/);
  assert.match(impacto,/<CambiosDeContenido item=\{item\}\/>/);
  assert.match(impacto,/>Original<\/span>/);
  assert.match(impacto,/>Cambio<\/span>/);
  assert.match(impacto,/camposModificadosSEO\(item\)/);
});
