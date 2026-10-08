import test from 'node:test';
import assert from 'node:assert/strict';
import { criteriosDe, evidenciaDeCriterio, pendienteCriterio, OPCIONES_CRITERIO } from '../src/lib/criterios.js';

const config = {
  criterios: [
    { id: 'sensor', texto: 'Los sensores funcionan.' },
    { id: 'manual', texto: 'Existe apertura manual.' },
    { id: 'motor', texto: 'Rieles y motor sin daño.' }
  ],
  opciones: [
    { texto: 'Cumple', evidencia: 'ninguna' },
    { texto: 'No cumple', evidencia: 'comentario_foto' },
    { texto: 'Cumple con observaciones', evidencia: 'comentario_foto' },
    { texto: 'No aplica', evidencia: 'ninguna' }
  ]
};

test('Un punto puede definir varios criterios estables con cuatro estados', () => {
  assert.equal(criteriosDe(config).length, 3);
  assert.equal(criteriosDe(config)[1].id, 'manual');
  assert.equal(OPCIONES_CRITERIO.length, 4);
  assert.deepEqual(criteriosDe({}), []);
});

test('Un criterio pendiente bloquea el cierre hasta estar evaluado', () => {
  assert.equal(pendienteCriterio({ config, respuesta: { criterios: {
    sensor: { opcion: 'Cumple' }
  } } }), true);
});

test('Observación requiere comentario y fotografía ligada al criterio exacto', () => {
  const item = { config, respuesta: { criterios: {
    sensor: { opcion: 'Cumple' },
    manual: { opcion: 'Cumple con observaciones', comentario: 'Llave desgastada' },
    motor: { opcion: 'No aplica' }
  } } };
  assert.equal(evidenciaDeCriterio(config, 'Cumple con observaciones'), 'comentario_foto');
  assert.equal(pendienteCriterio(item, id => id === 'sensor'), true);
  assert.equal(pendienteCriterio(item, id => id === 'manual'), false);
});

test('La evidencia incompleta conserva pendiente la inspección', () => {
  const item = { config, respuesta: { criterios: {
    sensor: { opcion: 'Cumple' },
    manual: { opcion: 'No cumple', comentario: '' },
    motor: { opcion: 'Cumple' }
  } } };
  assert.equal(pendienteCriterio(item, () => true), true);
});

test('Respuestas históricas generales no se reinterpretan como criterios inventados', () => {
  const item = { config, respuesta: { opcion: 'Cumple' } };
  assert.equal(pendienteCriterio(item, () => false), false);
});
