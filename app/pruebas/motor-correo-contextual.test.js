import test from 'node:test';
import assert from 'node:assert/strict';
import { enviarCorreoContextual, MODULOS_CORREO } from '../src/lib/motorCorreo.js';

function clienteSimulado() {
  const invocaciones = [];
  return {
    invocaciones,
    supabase: {
      functions: {
        invoke(nombre, opciones) {
          invocaciones.push({ nombre, opciones });
          return Promise.resolve({ data: { ok: true, enviado: true }, error: null });
        }
      }
    }
  };
}

test('CRM conserva la ficha y el destinatario en la función autorizada', async () => {
  const s = clienteSimulado();
  await enviarCorreoContextual(s.supabase, MODULOS_CORREO.CRM, {
    prospectoId: 'p-123', asunto: 'Propuesta', mensaje: 'Hola',
    plantillaId: 'tpl-1', adjuntos: ['b:archivo']
  });
  assert.deepEqual(s.invocaciones, [{
    nombre: 'correo-prospecto',
    opciones: { body: {
      prospecto_id: 'p-123', asunto: 'Propuesta', mensaje: 'Hola',
      plantilla_id: 'tpl-1', adjuntos: ['b:archivo']
    }}
  }]);
});

test('Proveedores usa su función de control y envíos, sin salir del módulo', async () => {
  const s = clienteSimulado();
  const datos = { proveedor_ids: ['p1'], alcance: 'seleccionados', asunto: 'Cotización', mensaje: 'Hola' };
  await enviarCorreoContextual(s.supabase, MODULOS_CORREO.PROVEEDORES, datos);
  assert.deepEqual(s.invocaciones, [{
    nombre: 'enviar-comunicacion-proveedores', opciones: { body: datos }
  }]);
});

test('no se envía correo desde un módulo no habilitado', () => {
  const s = clienteSimulado();
  assert.throws(() => enviarCorreoContextual(s.supabase, 'pantalla-desconocida', {}), /no tiene envío/);
  assert.equal(s.invocaciones.length, 0);
});
