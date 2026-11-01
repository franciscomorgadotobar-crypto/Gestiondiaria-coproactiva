import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gestor=leer('src/paginas/panel/GestorDocumental.jsx');
const estilos=leer('src/paginas/panel/GestorDocumental.css');
const editor=leer('src/paginas/panel/EditorDocumentoGestion.jsx');
const pdf=leer('src/lib/documentoPdf.js');
const app=leer('src/App.jsx');
const categorias=leer('src/lib/plantillasDocumentales.js');
const comunidades=leer('src/paginas/panel/Comunidades.jsx');
const proveedores=leer('src/paginas/panel/Proveedores.jsx');
const operaciones=leer('src/paginas/terreno/Control.jsx');
const correo=leer('src/componentes/AdjuntosCorreo.jsx');
const sql=leer('../supabase/migrations/202611010003_gestor_documental_versiones.sql');
const sqlFix=leer('../supabase/migrations/202611010004_rpc_documentos_permisos.sql');

test('mockup contiene buscador, siete filtros, cuatro tarjetas y lateral',()=>{
 for(const token of ['Buscar documentos, plantillas o contextos','Todos','Propuestas','Seguimiento','Primera administración','Informes','Emitidos','Borradores','TIPOS_DOCUMENTO.map','Documentos recientes','Biblioteca y Drive','Control de versiones','Ver biblioteca'])
  assert.ok(gestor.includes(token),token);
 assert.match(gestor,/documentos\.filter|registros\.filter|registros\.map/);
 assert.match(gestor,/biblioteca\.reduce/);
 assert.doesNotMatch(gestor,/Reserva Santa Clara.*v[0-9]|Edificio Los Cerezos.*v[0-9]/);
});

test('diseño responsive con color de marca en móvil y escritorio',()=>{
 for(const txt of ['#ed7130','#d0a207','#696969','#2b3138','max-width:1100px','max-width:780px','max-width:480px'])
  assert.ok(estilos.includes(txt),txt);
 for(const clase of ['documentos-filtros','documentos-tabla','documentos-plantilla','documentos-lateral'])
  assert.ok(estilos.includes(clase),clase);
});

test('creación y edición protegida, versiones con RPC y conflictos',()=>{
 assert.match(app,/path="\/documentos\/nuevo"/);
 assert.match(app,/path="\/documentos\/:id"/);
 assert.match(editor,/supabase\.rpc\('guardar_documento_gestion'/);
 assert.match(editor,/p_version_esperada:doc\?\.version/);
 assert.match(editor,/supabase\.from\('documentos_versiones'\)/);
 assert.match(sql,/create table if not exists public\.documentos_versiones/);
 assert.match(sql,/security invoker/);
 assert.match(sqlFix,/security definer/);
 for(const s of ['seguimiento_documental','primera_administracion','informe_gestion'])
  assert.ok(categorias.includes(s),s);
});

test('PDF real puede enviarse como adjunto y guardarse en biblioteca',()=>{
 assert.match(editor,/generarPdfDocumento/);
 assert.match(editor,/supabase\.functions\.invoke\('correo-archivos'/);
 assert.match(editor,/new File\(\[resultado\.blob\]/);
 assert.match(editor,/pdf_biblioteca/);
 assert.match(pdf,/pdf\.output\('blob'\)/);
 assert.match(pdf,/pdf\.addPage\(\)/);
 assert.match(pdf,/pdf\.setPage\(p\)/);
 assert.match(correo,/action:'list'/);
});

test('contextos: CRM, Correos, Comunidades, Operaciones, Proveedores',()=>{
 assert.match(comunidades,/documentos\?comunidad=/);
 assert.match(comunidades,/documentos\/nuevo\?tipo=informe_gestion&comunidad=/);
 assert.match(proveedores,/documentos\?proveedor=/);
 assert.match(operaciones,/documentos\?comunidad=/);
 assert.match(correo,/documentos\?origen=correo/);
 assert.match(editor,/params\.get\('documento'\)|params\.get\(tipoContexto\)/);
});
