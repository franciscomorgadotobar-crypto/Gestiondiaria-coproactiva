import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const proveedor=readFileSync(new URL('../src/paginas/panel/Proveedores.jsx',import.meta.url),'utf8');
const crm=readFileSync(new URL('../src/paginas/panel/Pipeline.jsx',import.meta.url),'utf8');
const motor=readFileSync(new URL('../../supabase/functions/_compartido/motor-correo.ts',import.meta.url),'utf8');

test('la ficha del proveedor usa correo interno, no mailto del dispositivo', () => {
  assert.doesNotMatch(proveedor,/mailto:/);
  assert.match(proveedor,/abrirComunicacion\('seleccionados',\s*\[p\.id\],\s*true\)/);
  assert.match(proveedor,/seleccionIds=\{comunicacion\.destinatarios\}/);
});

test('el modal está disponible desde listado y ficha individual', () => {
  assert.equal((proveedor.match(/\{modalComunicacion\}/g)||[]).length,2);
  assert.match(proveedor,/if\s*\(soloDestinatario\)\s*return proveedores\.filter/);
  assert.match(proveedor,/!soloDestinatario\s*&&\s*<button/);
});

test('CRM y Proveedores consumen el mismo motor transaccional de servidor', () => {
  const fnCRM=readFileSync(new URL('../../supabase/functions/correo-prospecto/index.ts',import.meta.url),'utf8');
  const fnProv=readFileSync(new URL('../../supabase/functions/enviar-comunicacion-proveedores/index.ts',import.meta.url),'utf8');
  assert.match(crm,/correo-prospecto/);
  assert.match(fnCRM,/motor-correo\.ts/);
  assert.match(fnProv,/motor-correo\.ts/);
  assert.match(motor,/export async function enviarLoteMotor/);
});
