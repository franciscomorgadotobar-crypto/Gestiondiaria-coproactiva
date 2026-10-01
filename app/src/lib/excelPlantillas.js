/* El formato Excel de plantillas: armarlo para descargar y leer el que se sube.
 *
 * ExcelJS pesa cerca de 1 MB, así que se carga recién al usarlo (y queda fuera
 * del precache de la app: en terreno no se necesita). */

import { COLUMNAS, ETIQUETAS_TIPO, ETIQUETAS_FOTOS, columnaDeEncabezado, normalizar } from './importarPlantillas.js';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const NOMBRE_FORMATO = 'formato-plantillas-coproactiva.xlsx';
const FILAS_CON_LISTAS = 1000;
const MAX_BYTES = 5 * 1024 * 1024;

export async function cargarExcelJS() {
  try {
    const modulo = await import('exceljs');
    return modulo.default ?? modulo;
  } catch {
    throw new Error('No se pudo cargar el lector de Excel. Revisa la conexión e intenta de nuevo.');
  }
}

const EJEMPLO = [
  ['Primera visita', 'Accesos y seguridad', 'Portón / acceso vehicular',
    'Abre y cierra completo, sensores de seguridad y respaldo manual.',
    'Opciones con evidencia', 'Cumple; No cumple (comentario y foto); Cumple con observaciones (comentario); No aplica',
    '', 'Cámara o galería', 'No', 'Sí', 'No'],
  ['Primera visita', 'Accesos y seguridad', 'Citófono operativo', '',
    'Conforme / Observa / Crítico', '', '', 'Cámara o galería', 'No', 'Sí', 'No'],
  ['Primera visita', 'Instalaciones sanitarias', 'Lectura del medidor general de agua',
    'Anotar la lectura que marca el medidor.', 'Número o lectura', '', 'm³', 'Solo cámara, en el momento', 'Sí', 'Sí', 'No'],
  ['Primera visita', 'Instalaciones sanitarias', 'Estado de las bombas de agua', '',
    'Una opción de varias', 'Bueno; Regular; Malo; No existe', '', 'Cámara o galería', 'No', 'Sí', 'No'],
  ['Primera visita', 'Áreas comunes', 'Mantenciones con contrato vigente', '',
    'Varias opciones', 'Ascensores; Bombas; Grupo electrógeno; Portones', '', 'Sin foto', 'No', 'No', 'No'],
  ['Primera visita', 'Áreas comunes', 'Foto horizontal del frontis', '',
    'Solo fotografía', '', '', 'Cámara o galería', 'Sí', 'Sí', 'No'],
  ['Primera visita', 'Áreas comunes', 'Observaciones generales', '',
    'Texto libre', '', '', 'Cámara o galería', 'No', 'No', 'No'],
  ['Primera visita', 'Cierre', 'Firma de quien recibe la visita', '',
    'Firma de quien recibe', '', '', 'Sin foto', 'No', 'Sí', 'No']
];

const INSTRUCCIONES = [
  ['Plantilla *', 'Nombre de la plantilla. Las filas con el mismo nombre forman una plantilla; un archivo puede crear varias.', 'Primera visita'],
  ['Categoría *', 'Grupo dentro de la plantilla. Las categorías quedan en el orden en que aparecen por primera vez.', 'Accesos y seguridad'],
  ['Pregunta *', 'Lo que se revisa o se pregunta en el punto.', 'Portón / acceso vehicular'],
  ['Descripción', 'Opcional. Aparece bajo la pregunta en el levantamiento: qué revisar o cómo responder.', 'Abre y cierra completo…'],
  ['Cómo se responde', 'Elegir de la lista. Vacío = Conforme / Observa / Crítico.', 'Opciones con evidencia'],
  ['Opciones', 'Para "Opciones con evidencia", "Una opción de varias" y "Varias opciones". Separadas por punto y coma (;) o en líneas distintas de la celda. En "Opciones con evidencia", lo que pide cada opción va entre paréntesis al final: (comentario) o (comentario y foto). Sin paréntesis no pide evidencia.', 'Cumple; No cumple (comentario y foto); No aplica'],
  ['Unidad', 'Solo para "Número o lectura".', 'm³'],
  ['Fotografías', 'Elegir de la lista. Vacío = Cámara o galería.', 'Solo cámara, en el momento'],
  ['Exigir foto', 'Sí o No: pide al menos una foto, responda lo que responda. Vacío = No.', 'No'],
  ['Obligatorio', 'Sí o No: hay que responderlo para enviar el levantamiento. Vacío = Sí.', 'Sí'],
  ['Crítico', 'Sí o No: marca el punto como crítico. Vacío = No.', 'No']
];

function estiloEncabezado(fila) {
  fila.height = 30;
  fila.eachCell(celda => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3138' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
  });
}

function prepararHojaDePuntos(hoja) {
  hoja.columns = COLUMNAS.map(c => ({
    header: c.titulo + (c.obligatoria ? ' *' : ''),
    key: c.clave,
    width: c.ancho,
    style: { alignment: { vertical: 'top', wrapText: ['descripcion', 'opciones', 'pregunta'].includes(c.clave) } }
  }));
  estiloEncabezado(hoja.getRow(1));
}

/* El libro del formato: "Plantilla" (vacía, con listas desplegables), "Ejemplo",
 * "Instrucciones" y "Listas" (oculta, de donde salen los desplegables). */
export function construirFormato(ExcelJS) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'CoproActiva';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Plantilla', { views: [{ state: 'frozen', ySplit: 1 }] });
  const ejemplo = libro.addWorksheet('Ejemplo', { views: [{ state: 'frozen', ySplit: 1 }] });
  const instrucciones = libro.addWorksheet('Instrucciones');
  const listas = libro.addWorksheet('Listas', { state: 'hidden' });

  ETIQUETAS_TIPO.forEach((t, i) => { listas.getCell(i + 1, 1).value = t; });
  ETIQUETAS_FOTOS.forEach((t, i) => { listas.getCell(i + 1, 2).value = t; });
  ['Sí', 'No'].forEach((t, i) => { listas.getCell(i + 1, 3).value = t; });

  prepararHojaDePuntos(hoja);
  prepararHojaDePuntos(ejemplo);
  EJEMPLO.forEach(fila => ejemplo.addRow(fila));

  const lista = (rango, titulo) => ({
    type: 'list', allowBlank: true, formulae: [rango],
    showErrorMessage: true, errorTitle: titulo, error: 'Elige un valor de la lista.'
  });
  const columna = clave => COLUMNAS.findIndex(c => c.clave === clave) + 1;
  const validaciones = [
    ['tipo', lista(`Listas!$A$1:$A$${ETIQUETAS_TIPO.length}`, 'Cómo se responde')],
    ['fotos', lista(`Listas!$B$1:$B$${ETIQUETAS_FOTOS.length}`, 'Fotografías')],
    ['exigir_foto', lista('Listas!$C$1:$C$2', 'Exigir foto')],
    ['obligatorio', lista('Listas!$C$1:$C$2', 'Obligatorio')],
    ['critico', lista('Listas!$C$1:$C$2', 'Crítico')]
  ];
  /* Una validación por rango, no celda por celda: ExcelJS junta las celdas
   * ordenando las direcciones como texto (E10 antes que E2) y termina
   * escribiendo rangos superpuestos, que Excel ofrece "reparar" al abrir. */
  for (const h of [hoja, ejemplo]) {
    for (const [clave, validacion] of validaciones) {
      const letra = h.getColumn(columna(clave)).letter;
      h.dataValidations.add(`${letra}2:${letra}${FILAS_CON_LISTAS}`, validacion);
    }
  }

  hoja.getCell(1, columna('opciones')).note =
    'Separadas por punto y coma (;). En "Opciones con evidencia": No cumple (comentario y foto); Cumple con observaciones (comentario).';
  hoja.getCell(1, columna('tipo')).note = 'Elige de la lista. Vacío = Conforme / Observa / Crítico.';

  instrucciones.columns = [{ width: 20 }, { width: 90 }, { width: 44 }];
  instrucciones.addRow(['Cómo llenar el formato']).font = { bold: true, size: 14 };
  instrucciones.addRow(['Una fila por punto, en la hoja "Plantilla". El orden de las filas es el orden del levantamiento.']);
  instrucciones.addRow(['La hoja "Ejemplo" muestra una plantilla completa: puedes copiar sus filas y cambiarlas.']);
  instrucciones.addRow(['Lo que no está en el formato (responder en orden, el rango de la escala, el ejemplo de "Texto libre") se ajusta después en el editor de la plantilla.']);
  instrucciones.addRow([]);
  const titulos = instrucciones.addRow(['Columna', 'Qué va', 'Ejemplo']);
  estiloEncabezado(titulos);
  INSTRUCCIONES.forEach(f => {
    const fila = instrucciones.addRow(f);
    fila.alignment = { vertical: 'top', wrapText: true };
    fila.getCell(1).font = { bold: true };
  });

  return libro;
}

/* Descarga el formato en el navegador. */
export async function descargarFormato() {
  const ExcelJS = await cargarExcelJS();
  const datos = await construirFormato(ExcelJS).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([datos], { type: TIPO_XLSX }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = NOMBRE_FORMATO;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* El texto que se ve en una celda, sea cual sea su tipo: texto con formato,
 * fórmulas (su resultado), enlaces, números, Sí/No de Excel o fechas. */
export function textoDeCelda(valor) {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (Array.isArray(valor.richText)) return valor.richText.map(t => t.text ?? '').join('');
  if ('result' in valor) return textoDeCelda(valor.result);
  if ('text' in valor) return textoDeCelda(valor.text);
  return '';
}

/* Lee un .xlsx (ArrayBuffer) y devuelve las filas en texto, listas para
 * interpretarFilas. Lanza un Error con un mensaje para mostrar si el archivo
 * no se puede leer o no tiene la estructura del formato. */
export async function leerFilas(ExcelJS, datos) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(datos);
  } catch {
    throw new Error('No se pudo leer el archivo. Revisa que sea un Excel (.xlsx) y que no tenga contraseña.');
  }

  /* Se lee la hoja "Plantilla". Solo si no existe se busca otra con los
   * encabezados del formato, pero nunca "Ejemplo": importaría el ejemplo. */
  const hojas = libro.worksheets.filter(h => h.state !== 'hidden' && h.state !== 'veryHidden');
  let hoja = hojas.find(h => normalizar(h.name) === 'plantilla');
  let encabezado = hoja ? buscarEncabezado(hoja) : null;
  if (!hoja) {
    for (const h of hojas.filter(h => normalizar(h.name) !== 'ejemplo')) {
      encabezado = buscarEncabezado(h);
      if (encabezado) { hoja = h; break; }
    }
  }
  if (!hoja || !encabezado) {
    throw new Error('No encontré los encabezados del formato (Plantilla, Categoría, Pregunta…). Descarga el formato y completa la hoja "Plantilla".');
  }

  const filas = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero <= encabezado.fila) return;
    const datosFila = { fila: numero };
    let vacia = true;
    for (const [columna, clave] of encabezado.columnas) {
      const texto = textoDeCelda(fila.getCell(columna).value);
      datosFila[clave] = texto;
      if (texto.trim()) vacia = false;
    }
    if (!vacia) filas.push(datosFila);
  });
  return filas;
}

/* La fila de encabezados (en las primeras 10) y qué columna es cada dato. */
function buscarEncabezado(hoja) {
  for (let f = 1; f <= Math.min(10, hoja.rowCount); f++) {
    const columnas = new Map();
    hoja.getRow(f).eachCell((celda, columna) => {
      const clave = columnaDeEncabezado(textoDeCelda(celda.value));
      if (clave && ![...columnas.values()].includes(clave)) columnas.set(columna, clave);
    });
    const claves = new Set(columnas.values());
    if (claves.has('plantilla') && claves.has('categoria') && claves.has('pregunta')) {
      return { fila: f, columnas };
    }
  }
  return null;
}

/* Valida el archivo elegido y lo lee. */
export async function leerArchivo(archivo) {
  if (!/\.xlsx$/i.test(archivo.name)) {
    throw new Error('El archivo tiene que ser .xlsx. Si está en otro formato, ábrelo en Excel y guárdalo como "Libro de Excel (.xlsx)".');
  }
  if (archivo.size > MAX_BYTES) {
    throw new Error('El archivo pesa más de 5 MB. El formato completo pesa mucho menos: revisa que no tenga imágenes u hojas de más.');
  }
  const ExcelJS = await cargarExcelJS();
  return leerFilas(ExcelJS, await archivo.arrayBuffer());
}
