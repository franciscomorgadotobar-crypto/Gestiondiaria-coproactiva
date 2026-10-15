import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  consultarBaseCompletaProveedores,
  prepararFilasProveedores,
  generarCsvProveedores,
  nombreArchivoProveedores
} from '../src/lib/exportarProveedores.js';

function fake(paginas, fallar = -1) {
  let indice = 0;
  const rangos = [];
  return {
    rangos,
    db: {
      from(nombre) {
        assert.equal(nombre, 'proveedores');
        return {
          select(columnas) {
            assert.equal(columnas, '*');
            return {
              order(orden, opts) {
                assert.equal(orden, 'id');
                assert.equal(opts.ascending, true);
                return {
                  async range(a, b) {
                    rangos.push([a, b]);
                    const actual = indice++;
                    if (actual === fallar) return { data:null, error:{message:'Error al consultar'} };
                    return { data: paginas[actual] || [], error:null };
                  }
                };
              }
            };
          }
        };
      }
    }
  };
}

test('descarga completa por páginas mayores que límite visual', async () => {
  const a = Array.from({length:500}, (_, i) => ({id:String(i)}));
  const db = fake([a,[{id:'501', lista_negra:true}]]);
  const proveedores = await consultarBaseCompletaProveedores(db.db);
  assert.equal(proveedores.length,501);
  assert.equal(proveedores[500].lista_negra,true);
  assert.deepEqual(db.rangos,[[0,499],[500,999]]);
});

test('si falla una página no retorna exportación parcial', async () => {
  const db = fake([[{id:'1'}, {id:'2'}]],1);
  await assert.rejects(
    consultarBaseCompletaProveedores(db.db,{tamanoPagina:2}),
    /No se pudo consultar la base completa/
  );
});

test('CSV Excel Chile respeta tildes, comillas y listas JSONB', () => {
  const csv = generarCsvProveedores([{
    empresa:'Ñuñoa; Servicios', notas:'Texto "citado"',
    especialidades:['Electricidad','Ascensores'], lista_negra:false
  }]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('\r\n'));
  assert.ok(csv.includes('"Ñuñoa; Servicios"'));
  assert.ok(csv.includes('"Texto ""citado"""'));
  assert.ok(csv.includes('Electricidad'));
  assert.ok(csv.includes('false'));
});

test('incluye información secundaria de correos, teléfonos y contactos', () => {
  const registro = {
    empresa:'Servicio Uno', email:'contacto@ejemplo.cl',telefono:'123',
    contactos:[
      {nombre:'Ana',email:'contacto@ejemplo.cl',telefono:'123'},
      {nombre:'Luis',cargo:'Comercial',email:'luis@ejemplo.cl',telefono:'456'}
    ]
  };
  const { columnas,filas } = prepararFilasProveedores([registro]);
  assert.ok(columnas.includes('contactos'));
  assert.ok(columnas.includes('correo_2'));
  assert.ok(columnas.includes('telefono_2'));
  assert.ok(columnas.includes('contacto_2_cargo'));
  assert.equal(filas[0].correo_2,'luis@ejemplo.cl');
  assert.equal(filas[0].telefono_2,'456');
  assert.equal(filas[0].contacto_2_cargo,'Comercial');
});

test('no ejecuta fórmulas en Excel al exportar datos ingresados por proveedores', () => {
  const csv = generarCsvProveedores([{empresa:'=SUM(1,2)'}]);
  assert.ok(csv.includes("'=SUM(1,2)"));
  assert.throws(()=>generarCsvProveedores([]),/No hay proveedores/);
});

test('nombre de archivo, perfil administrador y botón disponible en pantalla', () => {
  assert.equal(nombreArchivoProveedores(new Date('2026-10-15T10:00:00Z')),
    'coproactiva_proveedores_BD_2026-10-15.csv');
  const jsx = readFileSync(
    new URL('../src/paginas/panel/Proveedores.jsx',import.meta.url),'utf8');
  assert.match(jsx,/const puedeGestionar = \['superadmin', 'admin'\]/);
  assert.match(jsx,/if \(!puedeGestionar\) return <Navigate/);
  assert.match(jsx,/onClick=\{descargarBaseProveedores\}/);
  assert.match(jsx,/Descargar BD \(CSV\)/);
  assert.match(jsx,/consultarBaseCompletaProveedores\(supabase\)/);
});
