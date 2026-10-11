import test from 'node:test';
import assert from 'node:assert/strict';
import { construirOportunidades, propuestaEditorial } from '../src/lib/seoOportunidades.js';

test('solo señala consultas que cumplen las 3 reglas y explica métricas', () => {
  const search = { disponible: true, consultas: [
    { clave: 'administracion de condominios', impresiones: 180, clicks: 2, ctr: 0.011, posicion: 9.3 },
    { clave: 'marca', impresiones: 220, clicks: 120, ctr: .54, posicion: 1.5 },
    { clave: 'otra', impresiones: 4, clicks: 0, ctr: 0, posicion: 12 }
  ] };
  const result = construirOportunidades(search, null, null);
  assert.equal(result.length, 1);
  assert.equal(result[0].consulta, 'administracion de condominios');
  assert.equal(result[0].prioridad, 'Alta');
  assert.equal(result[0].metricas.impresiones, 180);
  assert.match(result[0].porQue, /evidencia suficiente/);
});

test('no propone un título nuevo si la consulta ya está en el título actual', () => {
  const p = propuestaEditorial('administracion de condominios', {
    status: 200,
    titulo: 'Administración de Condominios en Santiago | Coproactiva',
    description: 'Administración profesional.',
    h1s: ['Administración de Condominios']
  });
  assert.equal(p.titulo.cambiar, false);
  assert.equal(p.description.cambiar, true);
  assert.match(p.description.propuesto, /Santiago/);
});

test('intención de listado no obliga a cambiar título comercial', () => {
  const p = propuestaEditorial('listado de administradores de edificios en santiago', {
    status: 200, titulo: 'Administración de condominios', description: 'Cuentas claras',
    h1s: ['Coproactiva']
  });
  assert.equal(p.titulo.cambiar, false);
  assert.equal(p.description.cambiar, false);
  assert.match(p.motivo, /directorio/);
});

test('no inventa cambios para páginas no comprobadas', () => {
  assert.match(propuestaEditorial('administracion de condominios', { status: 404 }).error, /HTTP 200/);
});

test('los problemas de auditoría se muestran y pueden abrirse', () => {
  const result = construirOportunidades(null, {
    url:'https://www.coproactiva.cl/servicios/auditoria-de-condominios/',
    problemas: [{nivel:'alto',texto:'Falta canonical.'}]
  }, null);
  assert.equal(result[0].ruta, '/servicios/auditoria-de-condominios/');
  assert.equal(result[0].prioridad, 'Alta');
  assert.equal(result[0].clase, 'tecnico');
});
