import {TIPOS_DOCUMENTO} from './plantillasDocumentales.js';

export function tituloDePlantilla(tipo) {
  return TIPOS_DOCUMENTO.find(plantilla=>plantilla.id===tipo)?.titulo || 'Documento';
}

// Es el título del modelo corporativo y el nombre del CLIENTE / COMUNIDAD.
// El destinatario personal se mantiene como información de la propuesta,
// no reemplaza el nombre del cliente.
export function nombreDocumentoDePlantilla(tipo,cliente) {
  const titulo=tituloDePlantilla(tipo);
  const nombre=String(cliente||'').replace(/[\\/\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim();
  return nombre?titulo+' - '+nombre:titulo;
}

export function nombreArchivoDePlantilla(tipo,cliente) {
  return nombreDocumentoDePlantilla(tipo,cliente)
    .replace(/[<>:"|?*]/g,' ').replace(/\s+/g,' ').trim().slice(0,150)+'.pdf';
}

// El nombre del archivo de Chrome "Imprimir / Guardar como PDF" procede de
// document.title, no del nombre de la propuesta guardada en la base de datos.
export function prepararTituloImpresion(tipo,cliente) {
  const anterior=document.title;
  document.title=nombreDocumentoDePlantilla(tipo,cliente);
  return ()=>{document.title=anterior;};
}
