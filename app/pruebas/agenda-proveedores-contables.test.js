import {modulosDisponibles,areasDisponibles} from '../src/lib/selectorModulos.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {esProveedorMarcado,opcionesProveedoresContables,opcionAnteriorContable}
  from '../src/lib/agendaProveedoresContables.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const agenda=read('src/paginas/panel/Proveedores.jsx');
const accounting=read('src/paginas/panel/Contabilidad.jsx');
const nav=read('src/componentes/ProveedoresNavegacion.jsx');
const home=read('src/paginas/panel/Inicio.jsx');
const sidebar=read('src/componentes/PanelEscritorio.jsx');
const migrations=read('../supabase/migrations/202611200003_agenda_empresas_contactos_contabilidad.sql');

const empresa={
  id:'empresa-1',empresa:'Aseguradora del Norte',tipo_registro:'empresa',lista_negra:false,
  es_proveedor:false,contacto_id:'primario-1',contacto_nombre:'Lucía Pérez',contacto_es_proveedor:false,
  contactos:[{id:'adicional-1',nombre:'Matías Ruiz',es_proveedor:false,email:'matias@example.com'}]
};
test('Por defecto, estar en Agenda no implica ser proveedor contable',()=>{
 assert.equal(esProveedorMarcado(empresa),false);
 assert.deepEqual(opcionesProveedoresContables([empresa]),[]);
});
test('Empresa y contactos son marcas independientes',()=>{
 const habilitada={...empresa,contacto_es_proveedor:true};
 assert.deepEqual(opcionesProveedoresContables([habilitada]).map(x=>x.clave),['contacto:empresa-1:primario-1']);
 const conAdicional={...habilitada,contactos:[{...empresa.contactos[0],es_proveedor:true}]};
 assert.equal(opcionesProveedoresContables([conAdicional]).length,2);
 const todos={...conAdicional,es_proveedor:true};
 const opciones=opcionesProveedoresContables([todos]);
 assert.equal(opciones.length,3);
 assert.ok(opciones.some(o=>o.clave==='registro:empresa-1' && !o.contacto_id));
 assert.ok(opciones.some(o=>o.nombre.includes('Lucía Pérez')));
 assert.ok(opciones.some(o=>o.nombre.includes('Matías Ruiz')));
});
test('Persona independiente puede ser proveedor; blacklist siempre excluida',()=>{
 const persona={...empresa,tipo_registro:'contacto',empresa:'Juan Martínez',es_proveedor:true};
 assert.equal(opcionesProveedoresContables([persona]).length,1);
 assert.match(opcionesProveedoresContables([persona])[0].nombre,/Persona: Juan Martínez/);
 assert.equal(opcionesProveedoresContables([{...persona,lista_negra:true}]).length,0);
 assert.equal(esProveedorMarcado({...persona,lista_negra:true}),false);
});
test('Asientos anteriores conservan su referencia de entidad/contacto',()=>{
 assert.equal(opcionAnteriorContable({proveedor_id:'123'}),'registro:123');
 assert.equal(opcionAnteriorContable({proveedor_id:'123',proveedor_contacto_id:'456'}),'contacto:123:456');
 assert.equal(opcionAnteriorContable({}), '');
});
test('Agenda se presenta en navegación y permite marcar empresa/contactos',()=>{
 assert.match(home,/titulo: 'Agenda'/);
 assert.match(sidebar,/etiqueta: 'Agenda'/);
 assert.match(nav,/'Agenda'/);
 assert.match(agenda,/<h1 className="h3">Agenda<\/h1>/);
 assert.match(agenda,/Esta empresa es proveedora/);
 assert.match(agenda,/Proveedor individual/);
 assert.match(agenda,/Solo proveedores habilitados/);
 assert.match(agenda,/agenda_marcar_proveedor/);
 assert.match(agenda,/Contactos adicionales/);
});
test('Asiento selecciona solo los marcados y registra contacto independiente',()=>{
 assert.match(accounting,/opcionesProveedoresContables\(proveedores\)/);
 assert.match(accounting,/proveedor_contacto_id: proveedorSeleccionado\?\.contacto_id/);
 assert.match(accounting,/contabilidad_registrar_asiento_agenda/);
 assert.match(accounting,/p_contacto_id: datos.proveedor_contacto_id/);
 assert.match(accounting,/proveedor_etiqueta/);
 assert.match(migrations,/contabilidad_registrar_asiento_agenda/);
 assert.match(migrations,/agenda_marcar_proveedor/);
 assert.match(migrations,/es_proveedor boolean NOT NULL DEFAULT false/);
});

test('Todos los accesos al antiguo directorio se muestran como Agenda',()=>{
 const perfil={id:'admin-test',rol:'admin',activo:true};
 const modulos=modulosDisponibles(perfil);
 const registro=modulos.find(m=>m.ruta==='/proveedores');
 assert.ok(registro,'El catálogo modular debe conservar la ruta anterior');
 assert.equal(registro.titulo,'Agenda');
 assert.equal(registro.etiqueta,'AGENDA');
 const areas=areasDisponibles(perfil);
 const operaciones=areas.find(a=>a.id==='operacion');
 assert.equal(operaciones.enlaces.find(a=>a.ruta==='/proveedores')?.etiqueta,'Agenda');
 const home=read('src/paginas/panel/HomeGeneral.jsx');
 const selector=read('src/lib/selectorModulos.js');
 assert.doesNotMatch(home,/Red de proveedores/i);
 assert.doesNotMatch(selector,/Red de proveedores/i);
 assert.match(home,/\['Agenda','\/proveedores'/);
 assert.match(selector,/titulo:'Agenda', etiqueta:'AGENDA'/);
});
