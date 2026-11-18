import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {esInformePdfDrive,clasificarDocumentosDrivePortal,excluirDuplicadosLegacy}
  from '../src/lib/documentosPortal.js';

const leer=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');

const documentos=[
  {id:'1',nombre:'2026-10-26 - Propuesta F.O. Santa Clara.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'2',nombre:'2026-10-30 - Informe 1 - Gestion Reserva Santa Clara.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'3',nombre:'2026-11-17 - Proyeccion de gastos - Santa Clara.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'4',nombre:'2026-11-17 - Estado de avance - Reserva Santa Clara.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'5',nombre:'2026-10-26 - Informe modificacion reglamento Santa Clara - LEGAL.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'rut',nombre:'RUT SII Reserva Santa Clara.pdf',origen_tipo:'compromiso',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:null},
  {id:'borrador',nombre:'Informe no aprobado.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:false,eliminado_en:null},
  {id:'borrado',nombre:'Informe eliminado.pdf',origen_tipo:'informe',
    categoria:'seguimiento',mime:'application/pdf',visible_cliente:true,eliminado_en:'2026-11-01'}
];

test('Cinco informes publicados de Santa Clara aparecen en Informes PDF, no en compartidos',()=>{
  const {informes,compartidos}=clasificarDocumentosDrivePortal(documentos);
  assert.equal(informes.length,5);
  assert.equal(compartidos.length,1);
  assert.equal(compartidos[0].id,'rut');
  assert.ok(informes.every(x=>x.origen_tipo==='informe'));
});

test('PDF que no es Informe y documentos privados nunca se mezclan con los informes',()=>{
  assert.ok(esInformePdfDrive({origen_tipo:'informe',nombre:'estudio.PDF',mime:''}));
  assert.equal(esInformePdfDrive({origen_tipo:'administrativo',nombre:'reglamento.pdf',mime:'application/pdf'}),false);
  assert.deepEqual(clasificarDocumentosDrivePortal([documentos[6],documentos[7]]),
    {informes:[],compartidos:[]});
});

test('Registro histórico con mismo nombre que archivo Drive no se duplica',()=>{
  const {informes}=clasificarDocumentosDrivePortal(documentos);
  const legacy=[
    {id:'viejo',nombre_archivo:'2026-10-26 - Propuesta F.O. Santa Clara.pdf'},
    {id:'único',nombre_archivo:'informe antiguo.pdf'}
  ];
  assert.deepEqual(excluirDuplicadosLegacy(legacy,informes).map(x=>x.id),['único']);
});

test('Portal lee Drive, suma los informes visibles al contador y permite Ver/Descargar',()=>{
  assert.match(portal,/supabase\.rpc\('drive_listar_documentos'/);
  assert.match(portal,/p_origen_tipo:null,p_origen_id:null,p_incluir_eliminados:false/);
  assert.match(portal,/clasificarDocumentosDrivePortal\(drive\.archivos\)/);
  assert.match(portal,/totalInformes=informes\.length\+pdfsAnteriores\.length/);
  assert.match(portal,/<EncabezadoSeccion titulo="Informes PDF" cantidad=\{drive\.cargando\?null:totalInformes\}/);
  assert.match(portal,/informes\.map\(d=><ArchivoDriveCliente/);
  assert.match(portal,/ejecutar\(verEnDrive,'ver'\)/);
  assert.match(portal,/ejecutar\(descargarDeDrive,'descargar'\)/);
  assert.doesNotMatch(portal,/soloVistaCliente=\{vistaPrevia\}/);
});
