import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {construirOportunidades,rutasParaAuditoriaSEO} from '../src/lib/seoOportunidades.js';

const sc={
  disponible:true,
  paginas:[
    {clave:'https://www.coproactiva.cl/',impresiones:300},
    {clave:'https://www.coproactiva.cl/blog-ley-valentin-mallas-condominios/',impresiones:150},
    {clave:'https://www.coproactiva.cl/blog-acuerdos-validos-asamblea-copropietarios/',impresiones:100},
    {clave:'https://www.coproactiva.cl/blog-ley-valentin-mallas-condominios/?utm=1',impresiones:40},
    {clave:'https://otrodominio.cl/oferta',impresiones:90},
    {clave:'https://www.coproactiva.cl/blog/',impresiones:60}
  ]
};
test('seleccionar páginas reales, solo dominio Coproactiva, sin portada ni duplicados',()=>{
  const rutas=rutasParaAuditoriaSEO(sc,[],5);
  assert.deepEqual(rutas,[
    '/blog-ley-valentin-mallas-condominios/',
    '/blog-acuerdos-validos-asamblea-copropietarios/',
    '/blog/'
  ]);
  assert.deepEqual(rutasParaAuditoriaSEO(sc,[rutas[0]],5),rutas.slice(1));
  assert.deepEqual(rutasParaAuditoriaSEO({disponible:false,paginas:sc.paginas}),[]);
});
test('una auditoría por cada URL genera oportunidades técnicas distintas',()=>{
  const a=construirOportunidades(null,{url:'https://www.coproactiva.cl/blog/',problemas:[{nivel:'alto',texto:'Falta canonical.'}]},null);
  const b=construirOportunidades(null,{url:'https://www.coproactiva.cl/servicios/',problemas:[{nivel:'alto',texto:'Falta canonical.'}]},null);
  assert.notEqual(a[0].id,b[0].id);
  assert.equal(a[0].ruta,'/blog/');
  assert.equal(b[0].ruta,'/servicios/');
});
test('90 búsquedas adicionales no equivalen a 90 mejoras sugeridas',()=>{
  const consultas=Array.from({length:90},(_,i)=>({
    clave:'consulta '+i,impresiones:3,clicks:0,ctr:0,posicion:28
  }));
  assert.equal(construirOportunidades({disponible:true,consultas},null,null).length,0);
});
test('Home informa estado acotado y ofrece ampliar auditoría',()=>{
  const s=readFileSync(new URL('../src/paginas/panel/SEODashboard.jsx',import.meta.url),'utf8');
  assert.match(s,/Sin sugerencias SEO prioritarias/);
  assert.match(s,/SEO al día en/);
  assert.match(s,/aún pueden existir otras mejoras/);
  assert.match(s,/Analizar más páginas y ver sugerencias/);
});
test('Oportunidades distingue sugerencias de búsquedas y muestra alcance de auditoría',()=>{
  const s=readFileSync(new URL('../src/paginas/panel/SEOInventarioOportunidades.jsx',import.meta.url),'utf8');
  assert.match(s,/titulo:'Sugerencias'/);
  assert.match(s,/Analizar otras páginas/);
  assert.match(s,/no mejoras pendientes/);
  assert.doesNotMatch(s,/Bajo observación/);
});
test('auditorías nuevas se agregan por URL sin borrar análisis original',()=>{
  const s=readFileSync(new URL('../src/paginas/panel/SEO.jsx',import.meta.url),'utf8');
  assert.match(s,/Object.values\(auditoriasExtras\)/);
  assert.match(s,/construirOportunidades\(null, resultado, null\)/);
  assert.match(s,/onRevisarPaginas=\{analizarMasPaginas\}/);
});
