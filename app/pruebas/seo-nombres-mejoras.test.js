import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreMejoraSEO, ubicacionMejoraSEO } from '../src/lib/seoNombresMejoras.js';

const cambioPortada = {
  ruta: '/',
  consulta_principal: 'administracion de edificios',
  titulo_actual: 'Administración de Condominios en Santiago | Coproactiva',
  titulo_propuesto: 'Administración de Edificios y Condominios en Santiago | Coproactiva',
  descripcion_actual: 'Administración de condominios en Santiago',
  descripcion_propuesta: 'Administración de edificios y condominios en Santiago',
};

test('cambio real #1 usa título y descripción en Portada, no consulta Google',()=>{
  assert.equal(nombreMejoraSEO(cambioPortada),
    'Cambio de título y meta descripción: Portada');
  assert.ok(!nombreMejoraSEO(cambioPortada).includes(cambioPortada.consulta_principal));
});
test('modificación únicamente de título en un servicio',()=>{
  const mejora={ruta:'/servicios/administracion-de-condominios.html',
    titulo_actual:'A',titulo_propuesto:'B',descripcion_actual:'Igual',descripcion_propuesta:'Igual'};
  assert.equal(nombreMejoraSEO(mejora),
    'Cambio de título: Servicio: Administracion de condominios');
});
test('modificación únicamente de meta descripción en un blog',()=>{
  const mejora={ruta:'/blog/acuerdos-validos-asamblea.html',
    titulo_actual:'A',titulo_propuesto:'A',descripcion_actual:'A',descripcion_propuesta:'B'};
  assert.equal(nombreMejoraSEO(mejora),
    'Cambio de meta descripción: Artículo: Acuerdos validos asamblea');
});
test('rutas de páginas distinguen portada, servicios, blog y secciones',()=>{
  assert.equal(ubicacionMejoraSEO('/index.html'),'Portada');
  assert.equal(ubicacionMejoraSEO('/blog/'),'Blog');
  assert.equal(ubicacionMejoraSEO('/servicios/'),'Servicios');
  assert.equal(ubicacionMejoraSEO('/contacto.html'),'Contacto');
});
test('datos históricos incompletos no inventan campos modificados',()=>{
  assert.equal(nombreMejoraSEO({ruta:'/nosotros',consulta_principal:'xyz'}),
    'Mejora SEO: Nosotros');
  assert.equal(nombreMejoraSEO(null),'Mejora SEO');
});
test('diferencias solo de espacios no generan cambio espurio',()=>{
  const misma={ruta:'/',titulo_actual:'A  B',titulo_propuesto:' A B ',
    descripcion_actual:'Uno',descripcion_propuesta:'Uno'};
  assert.equal(nombreMejoraSEO(misma),'Mejora SEO: Portada');
});
