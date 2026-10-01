/* Cómo se responde un punto y de dónde salen sus fotos.
 *
 * Lo usan el editor de plantillas y la importación desde Excel: los nombres
 * que se ven en el editor son los mismos que se eligen en el formato. */

export const TIPOS = [
  ['estado',    'Conforme / Observa / Crítico'],
  ['opciones',  'Opciones con evidencia'],
  ['texto',     'Texto libre'],
  ['numero',    'Número o lectura'],
  ['escala',    'Escala del 1 al 10'],
  ['seleccion', 'Una opción de varias'],
  ['checklist', 'Varias opciones'],
  ['foto',      'Solo fotografía'],
  ['firma',     'Firma de quien recibe']
];

export const ORIGENES_FOTO = [
  ['ambas',   'Cámara o galería'],
  ['camara',  'Solo cámara, en el momento'],
  ['galeria', 'Solo galería'],
  ['ninguna', 'Sin foto']
];
