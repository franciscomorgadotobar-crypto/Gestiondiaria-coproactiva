import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const api = leer('../supabase/functions/drive-comunidad/index.ts');
const ui = leer('src/componentes/DriveArchivos.jsx');
const compromisos = leer('src/paginas/cliente/Compromisos.jsx');

test('Subir un documento de compromiso lo publica solamente en portal autenticado', () => {
  assert.match(api,/visible_cliente: tipo === 'compromiso'/);
  assert.match(api,/if \(tipo === 'compromiso'\) \{/);
  assert.match(api,/\.update\(\{ publicado: true \}\)/);
  assert.match(api,/accion: 'publicado_cliente'/);
  assert.match(api,/visibilidad_por: tipo === 'compromiso' \? user\.id : null/);
  // Un archivo marcado visible_cliente NO se comparte por enlace abierto.
  assert.match(api,/if \(p\.rol === 'cliente'\) return Boolean\(doc\.visible_cliente\) && await veComunidad/);
  assert.match(api,/\.eq\('usuario_id', p\.id\)\.eq\('comunidad_id', cid\)\.eq\('activa', true\)/);
  assert.match(api,/if \(!\(await puedeLeerDocumento\(db, perfil, doc\)\)\)/);
});
test('El usuario cliente ve sólo los documentos de su comunidad no eliminados', () => {
  assert.match(ui,/d\.visible_cliente===true && !d\.eliminado_en/);
  assert.match(ui,/d\.detalle_id === String\(detalleId\)/);
  assert.match(compromisos,/soloVistaCliente \? \(data\|\|\[\]\)\.filter\(c=>c\.publicado===true\)/);
});
test('Los archivos de otros módulos mantienen publicación manual', () => {
  assert.match(api,/visible_cliente: tipo === 'compromiso'/);
  assert.doesNotMatch(api,/registrado_por: user\.id, visible_cliente: true/);
});
