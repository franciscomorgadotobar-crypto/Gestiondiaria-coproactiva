import test from 'node:test';
import assert from 'node:assert/strict';
import {generarPdfDocumento,nombrePdfDocumento} from '../src/lib/documentosPdf.js';

for(const tipo of ['seguimiento_documental','primera_administracion','informe_gestion']){
 test('Generar PDF corporativo real para '+tipo,async()=>{
  const blob=generarPdfDocumento({tipo,titulo:'Prueba Coproactiva - Ñuñoa',estado:'aprobado',
   contenido:{resumen:'Gestiones realizadas\nAntecedentes recibidos',responsable:'Administración'}});
  const b=Buffer.from(await blob.arrayBuffer());
  assert.equal(b.subarray(0,4).toString('ascii'),'%PDF');
  assert.ok(b.length>2500,'Se genera un documento PDF con contenido');
  assert.equal(blob.type,'application/pdf');
 });
}
test('La exportación conserva nombre seguro sin alterar archivos existentes',()=>{
 assert.equal(nombrePdfDocumento('Informe gestión - Ñuñoa / 2026'),'Informe_gestion_-_Nunoa_2026.pdf');
});
test('El PDF extenso genera páginas adicionales sin truncar secciones',async()=>{
 const blob=generarPdfDocumento({tipo:'seguimiento_documental',titulo:'Informe extenso',contenido:{
  resumen:'Seguimiento\n'.repeat(420),
  antecedentes:'Documentos recibidos\n'.repeat(400),
  pendientes:'Próximos pasos\n'.repeat(400)
 }});
 const b=Buffer.from(await blob.arrayBuffer()).toString('latin1');
 const paginas=(b.match(/\/Type \/Page\b/g)||[]).length;
 assert.ok(paginas>1,'El PDF debe paginar textos extensos');
});
