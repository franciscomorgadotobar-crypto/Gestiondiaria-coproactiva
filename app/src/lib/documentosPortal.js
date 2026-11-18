/* El portal cliente agrupa documentos publicados en Drive sin duplicar
 * archivos ni depender de que exista un PDF en los registros del levantamiento.
 * "Informe" es el origen que selecciona la administración al subir el archivo.
 */
export function esInformePdfDrive(archivo) {
  const tipo=String(archivo?.origen_tipo||'').trim().toLowerCase();
  const mime=String(archivo?.mime||'').trim().toLowerCase();
  const nombre=String(archivo?.nombre||'').trim().toLowerCase();
  return tipo==='informe' && (mime==='application/pdf'||nombre.endsWith('.pdf'));
}

export function clasificarDocumentosDrivePortal(archivos) {
  // La consulta backend también aplica permisos. Este filtro evita que una
  // vista administrativa muestre al cliente documentos todavía no publicados.
  const visibles=(archivos||[]).filter(a=>a.visible_cliente===true&&!a.eliminado_en);
  return {
    informes:visibles.filter(esInformePdfDrive),
    compartidos:visibles.filter(a=>!esInformePdfDrive(a))
  };
}

export function excluirDuplicadosLegacy(anteriores, documentosDrive) {
  // Si el mismo informe está guardado en Drive y en un registro histórico,
  // preferimos Drive; los duplicados entre diferentes archivos de Drive se
  // conservan porque pueden representar versiones distintas.
  const enDrive=new Set(documentosDrive.map(a=>String(a.nombre||'').trim().toLowerCase()));
  return (anteriores||[]).filter(a=>!enDrive.has(String(a.nombre_archivo||a.titulo||'').trim().toLowerCase()));
}
