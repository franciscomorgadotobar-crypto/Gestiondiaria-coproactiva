import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const codigo=readFileSync(new URL('../src/componentes/DriveEstado.jsx',import.meta.url),'utf8');

test('Drive no muestra Sin autorizar ni Pendiente de crear mientras consulta el servidor',()=>{
  assert.match(codigo,/const \[cargado, setCargado\] = useState\(false\)/);
  assert.match(codigo,/setCargado\(true\)/);
  assert.match(codigo,/if \(!cargado\) \{/);
  assert.match(codigo,/aria-busy="true"/);
  assert.match(codigo,/Consultando el estado de la conexión y de la carpeta/);
  assert.ok(codigo.indexOf('if (!cargado)')<codigo.indexOf('const c = oauth?.conexion;'));
});
