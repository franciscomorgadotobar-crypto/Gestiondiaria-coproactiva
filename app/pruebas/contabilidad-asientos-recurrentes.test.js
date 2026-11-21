import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {borradorDesdeAsientoRecurrente} from '../src/lib/asientosRecurrentes.js';

const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=leer('src/paginas/panel/Contabilidad.jsx');
const styles=leer('src/paginas/panel/Contabilidad.css');
const migration=leer('../supabase/migrations/202611200002_contabilidad_asientos_recurrentes.sql');
const cuentas=[
 {id:'banco',activa:true,imputable:true},
 {id:'gasto',activa:true,imputable:true},
 {id:'antigua',activa:false,imputable:true}
];
const centros=[{id:'centro1',activa:true}];
const asiento={
 id:'identificador-inicial',entidad_id:'empresa1',numero:10,fecha:'2026-11-01',
 estado:'contabilizado',recurrente:true,glosa:'Pago mensual',
 referencia:'Factura 100',proveedor_id:'proveedor1',
 contabilidad_asiento_lineas:[
 {cuenta_id:'gasto',debe:10000,haber:0,glosa:'Servicio',centro_costo_id:'centro1'},
 {cuenta_id:'banco',debe:0,haber:10000,glosa:'Pago',centro_costo_id:null}
 ]};
test('Marcador conserva concepto de asiento recurrente y no ejecuta pagos automáticamente',()=>{
 assert.match(ui,/Marcar como asiento recurrente/);
 assert.match(ui,/aria-pressed=\{recurrente\}/);
 assert.match(ui,/No se contabiliza automáticamente/);
 assert.match(ui,/p_recurrente: Boolean\(datos.recurrente\)/);
 assert.match(ui,/contabilidad_registrar_asiento_agenda/);
 assert.match(migration,/recurrente boolean NOT NULL DEFAULT false/);
 assert.match(migration,/contabilidad_registrar_asiento\(/);
 assert.match(migration,/UPDATE public.contabilidad_asientos/);
 assert.match(migration,/REVOKE ALL ON FUNCTION/);
 assert.match(styles,/contabilidad-recurrente-boton\.activo/);
});
test('Reutilización conserva cuentas y montos y excluye referencia fecha y número anterior',()=>{
 const d=borradorDesdeAsientoRecurrente(asiento,cuentas,centros);
 assert.ok(d);
 assert.equal(d.glosa,'Pago mensual');
 assert.equal(d.recurrente,true);
 assert.equal(d.proveedor_id,'proveedor1');
 assert.equal(d.lineas.length,2);
 assert.equal(d.lineas[0].cuenta_id,'gasto');
 assert.equal(d.lineas[0].debe,'10000');
 assert.equal(d.lineas[1].haber,'10000');
 assert.equal(d.lineas[0].centro_costo_id,'centro1');
 assert.ok(!('numero' in d));
 assert.ok(!('fecha' in d));
 assert.ok(!('referencia' in d));
});
test('Reutilizar asientos anulados o no recurrentes nunca ofrece borrador',()=>{
 assert.equal(borradorDesdeAsientoRecurrente({...asiento,recurrente:false},cuentas,centros),null);
 assert.equal(borradorDesdeAsientoRecurrente({...asiento,estado:'anulado'},cuentas,centros),null);
 assert.equal(borradorDesdeAsientoRecurrente(null,cuentas,centros),null);
});
test('Cuentas desactivadas o no imputables requieren nueva selección al reutilizar',()=>{
 const anterior={...asiento,contabilidad_asiento_lineas:[{...asiento.contabilidad_asiento_lineas[0],cuenta_id:'antigua'}]};
 const d=borradorDesdeAsientoRecurrente(anterior,cuentas,centros);
 assert.equal(d.lineas[0].cuenta_id,'');
 assert.equal(d.lineas[0].debe,'10000');
});
test('Lista separa asientos recurrentes y ofrece reutilizarlos manualmente',()=>{
 assert.match(ui,/Mostrar solo asientos recurrentes/);
 assert.match(ui,/setAsientoOrigen\(a\)/);
 assert.match(ui,/↻ Reutilizar/);
 assert.match(ui,/if \(soloRecurrentes && \(!a.recurrente \|\| a.estado === 'anulado'\)\)/);
 assert.match(ui,/setNumeroAsiento\] = useState\(''\)/);
 assert.match(ui,/setFecha\] = useState\(hoyChile\(\)\)/);
 assert.match(ui,/setReferencia\] = useState\(''\)/);
});
