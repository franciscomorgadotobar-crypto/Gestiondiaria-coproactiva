import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const archivo = ruta => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const migracion = archivo('../../supabase/migrations/202610190001_bloquear_reactivacion_y_permisos_inactivos.sql');
const rollback = archivo('../../supabase/rollbacks/202610190001_bloquear_reactivacion_y_permisos_inactivos.sql');
const equipo = archivo('../src/paginas/panel/Equipo.jsx');
const servidorEquipo = archivo('../../supabase/functions/equipo/index.ts');
const cuenta = archivo('../src/paginas/panel/MiCuenta.jsx');

function bloqueFuncion(nombre) {
  const patron = new RegExp(
    'create or replace function public\\.' + nombre +
    '\\([\\s\\S]*?\\n\\$\\$;', 'i'
  );
  const encontrada = migracion.match(patron);
  assert.ok(encontrada, 'Falta la función ' + nombre);
  return encontrada[0];
}

test('los roles de cuentas inactivas dejan de otorgar permisos', () => {
  const rol = bloqueFuncion('mi_rol');
  assert.match(rol, /from public\.perfiles p/i);
  assert.match(rol, /p\.id\s*=\s*auth\.uid\(\)/i);
  assert.match(rol, /p\.activo\s+is\s+true/i);
});

test('una asignación antigua no da acceso a comunidad', () => {
  const comunidad = bloqueFuncion('ve_comunidad');
  assert.match(comunidad, /public\.mi_rol\(\)\s+is\s+not\s+null/i);
  assert.match(comunidad, /public\.perfil_comunidades/i);
});

test('la asignación de un control a un usuario inactivo no habilita acceso', () => {
  const control = bloqueFuncion('ve_control');
  const operar = bloqueFuncion('puede_operar_control');
  assert.match(control, /public\.mi_rol\(\)\s+is\s+not\s+null/i);
  assert.match(operar, /public\.mi_rol\(\)\s+is\s+not\s+null/i);
  assert.match(migracion, /on public\.controles as restrictive for all to authenticated/i);
  assert.match(migracion, /on public\.perfil_comunidades as restrictive for all to authenticated/i);
});

test('nadie puede reactivar su propio perfil vía API y solo admin activo cambia otros', () => {
  const fn = bloqueFuncion('proteger_estado_activo_perfil');
  assert.match(fn, /new\.activo\s+is\s+distinct\s+from\s+old\.activo/i);
  assert.match(fn, /auth\.uid\(\)\s*=\s*old\.id/i);
  assert.match(fn, /not coalesce\(public\.es_admin\(\),\s*false\)/i);
  assert.match(fn, /auth\.role\(\)\s+is\s+distinct\s+from\s+'service_role'/i);
  assert.match(migracion, /before update of activo on public\.perfiles/i);
  assert.match(migracion, /revoke execute on function public\.proteger_estado_activo_perfil\(\)/i);
});

test('el módulo Equipo mantiene el alta, la baja y el control de sesión', () => {
  assert.match(equipo, /persona\.activo\s*\?\s*'baja'\s*:\s*'alta'/);
  assert.match(equipo, /disabled=\{bloqueada \|\| ocupado \|\| yo\}/);
  assert.match(servidorEquipo, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(servidorEquipo, /!quien\.activo/);
  assert.match(cuenta, /perfil_actualizar_mi_cuenta/);
});

test('existe reversión para recuperar las reglas anteriores sin tocar datos', () => {
  assert.match(rollback, /drop trigger if exists trg_proteger_estado_activo_perfil/i);
  assert.match(rollback, /drop policy if exists controles_exigir_perfil_activo/i);
  for (const nombre of ['mi_rol', 've_comunidad', 've_control', 'puede_operar_control']) {
    assert.match(rollback, new RegExp('create or replace function public\\.' + nombre + '\\(', 'i'));
  }
  assert.doesNotMatch(migracion, /\bdelete\s+from\s+public\./i);
  assert.doesNotMatch(migracion, /\btruncate\b/i);
});
