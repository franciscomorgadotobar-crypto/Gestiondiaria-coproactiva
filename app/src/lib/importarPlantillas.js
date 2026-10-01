/* Importación de plantillas desde Excel: qué columnas tiene el formato y cómo
 * se convierte cada fila en un punto de plantilla.
 *
 * Una fila es un punto. Las filas con el mismo nombre en "Plantilla" forman
 * una plantilla, así que un mismo archivo puede crear varias. El orden de las
 * filas es el orden del levantamiento: las categorías quedan en el orden en
 * que aparecen por primera vez y los puntos, en el orden de sus filas.
 *
 * Acá no se lee el archivo (eso es excelPlantillas.js): esto recibe las filas
 * ya convertidas a texto y devuelve las plantillas, los errores que impiden
 * importar y los avisos que no. Sin dependencias del navegador, para poder
 * probarlo aparte. */

import { TIPOS, ORIGENES_FOTO } from './tiposDePunto.js';
import { nivelPosible } from './opciones.js';

export const MAX_FILAS = 2000;

/* Las columnas del formato, en orden. `alias` son otros encabezados que se
 * aceptan al leer, por si alguien los renombra un poco. */
export const COLUMNAS = [
  { clave: 'plantilla',   titulo: 'Plantilla',        ancho: 22, obligatoria: true },
  { clave: 'categoria',   titulo: 'Categoría',        ancho: 24, obligatoria: true },
  { clave: 'pregunta',    titulo: 'Pregunta',         ancho: 42, obligatoria: true, alias: ['que se pregunta'] },
  { clave: 'descripcion', titulo: 'Descripción',      ancho: 48 },
  { clave: 'tipo',        titulo: 'Cómo se responde', ancho: 30, alias: ['tipo', 'tipo de respuesta'] },
  { clave: 'opciones',    titulo: 'Opciones',         ancho: 48 },
  { clave: 'unidad',      titulo: 'Unidad',           ancho: 10 },
  { clave: 'fotos',       titulo: 'Fotografías',      ancho: 28, alias: ['fotos'] },
  { clave: 'exigir_foto', titulo: 'Exigir foto',      ancho: 12, alias: ['exige foto', 'exigir al menos una foto'] },
  { clave: 'obligatorio', titulo: 'Obligatorio',      ancho: 13, alias: ['responder es obligatorio'] },
  { clave: 'critico',     titulo: 'Crítico',          ancho: 10, alias: ['es critico', 'punto critico'] }
];

const LARGO_MAXIMO = { plantilla: 120, categoria: 80, pregunta: 300, descripcion: 1000, opcion: 150, unidad: 20 };

/* Sin tildes, en minúsculas y con un solo espacio: "Crítico " y "critico"
 * valen lo mismo. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/* La columna a la que corresponde un encabezado, o null. Se ignora el
 * asterisco de las obligatorias y cualquier aclaración entre paréntesis. */
export function columnaDeEncabezado(texto) {
  const t = normalizar(String(texto ?? '').replace(/\*/g, '').replace(/\([^)]*\)/g, ''));
  if (!t) return null;
  const col = COLUMNAS.find(c => [c.titulo, ...(c.alias ?? [])].some(n => normalizar(n) === t));
  return col?.clave ?? null;
}

const una = texto => String(texto ?? '').replace(/\s+/g, ' ').trim();
const etiquetaDe = (lista, valor) => lista.find(([v]) => v === valor)?.[1] ?? valor;

const ALIAS_TIPOS = {
  estado: ['conforme', 'conforme / observa / critico', 'conforme/observa/critico', 'estado'],
  opciones: ['opciones', 'opciones con evidencia'],
  texto: ['texto', 'texto libre'],
  numero: ['numero', 'lectura', 'numero o lectura'],
  escala: ['escala', 'escala del 1 al 10'],
  seleccion: ['una opcion', 'una opcion de varias', 'seleccion'],
  checklist: ['varias opciones', 'checklist'],
  foto: ['foto', 'fotografia', 'solo fotografia', 'solo foto'],
  firma: ['firma', 'firma de quien recibe']
};

const ALIAS_FOTOS = {
  ambas: ['camara o galeria', 'ambas'],
  camara: ['solo camara', 'solo camara, en el momento', 'camara'],
  galeria: ['solo galeria', 'galeria'],
  ninguna: ['sin foto', 'sin fotos', 'ninguna']
};

const EVIDENCIAS = {
  'sin evidencia': 'ninguna',
  'ninguna': 'ninguna',
  'comentario': 'comentario',
  'solo comentario': 'comentario',
  'comentario y foto': 'comentario_foto',
  'comentario y fotografia': 'comentario_foto',
  'comentario + foto': 'comentario_foto'
};

function buscar(alias, texto) {
  const t = normalizar(texto);
  return Object.keys(alias).find(clave => alias[clave].includes(t)) ?? null;
}

function siNo(texto, porDefecto) {
  const t = normalizar(texto);
  if (!t) return porDefecto;
  if (['si', 's', 'x', 'true', 'verdadero', '1'].includes(t)) return true;
  if (['no', 'n', 'false', 'falso', '0'].includes(t)) return false;
  return undefined;
}

/* Opciones separadas por punto y coma o en líneas distintas de la celda. No
 * por coma: hay opciones que la llevan ("Corrientes débiles (citofonía, CCTV)"). */
export function separarOpciones(texto) {
  return String(texto ?? '').split(/[;\n]/).map(una).filter(Boolean);
}

/* "No cumple (comentario y foto)" → { texto: 'No cumple', evidencia: 'comentario_foto' }.
 * Solo cuenta como evidencia un paréntesis final con uno de los niveles; si
 * no, el paréntesis es parte del texto de la opción. */
export function opcionConEvidencia(texto) {
  const m = texto.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const evidencia = m ? EVIDENCIAS[normalizar(m[2])] : undefined;
  if (evidencia && m[1].trim()) return { texto: m[1].trim(), evidencia };
  return { texto, evidencia: 'ninguna' };
}

function primeraRepetida(textos) {
  const vistas = new Set();
  for (const t of textos) {
    const clave = normalizar(t);
    if (vistas.has(clave)) return t;
    vistas.add(clave);
  }
  return null;
}

/* Convierte las filas leídas del Excel en plantillas.
 *
 * `filas`: [{ fila, plantilla, categoria, pregunta, descripcion, tipo, opciones,
 *            unidad, fotos, exigir_foto, obligatorio, critico }], todo en texto.
 * `nombresExistentes`: nombres de las plantillas que ya hay, para avisar si se
 * repite uno.
 *
 * Devuelve { plantillas: [{ nombre, categorias: [{ nombre, puntos }], items }],
 * errores: [{ fila, mensaje }], avisos: [{ fila, mensaje }] }. Con un solo
 * error no se importa nada: el Excel se corrige y se vuelve a subir. */
export function interpretarFilas(filas, { nombresExistentes = [] } = {}) {
  const errores = [];
  const avisos = [];
  const plantillas = new Map();

  if (filas.length > MAX_FILAS) {
    errores.push({ fila: null, mensaje: `El archivo tiene ${filas.length} filas con datos; el máximo es ${MAX_FILAS}.` });
    return { plantillas: [], errores, avisos };
  }

  for (const f of filas) {
    const error = mensaje => errores.push({ fila: f.fila, mensaje });
    const aviso = mensaje => avisos.push({ fila: f.fila, mensaje });
    let valida = true;
    const invalida = mensaje => { error(mensaje); valida = false; };

    const nombre = una(f.plantilla);
    const categoria = una(f.categoria);
    const pregunta = una(f.pregunta);
    const descripcion = String(f.descripcion ?? '').trim();
    const unidad = una(f.unidad);

    if (!nombre) invalida('Falta el nombre de la plantilla.');
    if (!categoria) invalida('Falta la categoría.');
    if (!pregunta) invalida('Falta la pregunta.');
    if (nombre.length > LARGO_MAXIMO.plantilla) invalida(`El nombre de la plantilla supera los ${LARGO_MAXIMO.plantilla} caracteres.`);
    if (categoria.length > LARGO_MAXIMO.categoria) invalida(`La categoría supera los ${LARGO_MAXIMO.categoria} caracteres.`);
    if (pregunta.length > LARGO_MAXIMO.pregunta) invalida(`La pregunta supera los ${LARGO_MAXIMO.pregunta} caracteres.`);
    if (descripcion.length > LARGO_MAXIMO.descripcion) invalida(`La descripción supera los ${LARGO_MAXIMO.descripcion} caracteres.`);

    const tipo = una(f.tipo) ? buscar(ALIAS_TIPOS, f.tipo) : 'estado';
    if (!tipo) invalida(`"${una(f.tipo)}" no es una forma de responder de la lista.`);

    const origen = una(f.fotos) ? buscar(ALIAS_FOTOS, f.fotos) : 'ambas';
    if (!origen) invalida(`"${una(f.fotos)}" no es una opción de Fotografías de la lista.`);
    if (tipo === 'foto' && origen === 'ninguna') invalida('Un punto "Solo fotografía" no puede ir "Sin foto".');

    const exigirFoto = siNo(f.exigir_foto, false);
    const obligatorio = siNo(f.obligatorio, true);
    const critico = siNo(f.critico, false);
    if (exigirFoto === undefined) invalida(`En "Exigir foto" va Sí o No, no "${una(f.exigir_foto)}".`);
    if (obligatorio === undefined) invalida(`En "Obligatorio" va Sí o No, no "${una(f.obligatorio)}".`);
    if (critico === undefined) invalida(`En "Crítico" va Sí o No, no "${una(f.critico)}".`);

    const admiteFotos = origen !== 'ninguna';
    const config = {};
    if (origen && origen !== 'ambas') config.origen = origen;

    const conOpciones = ['opciones', 'seleccion', 'checklist'].includes(tipo);
    const lista = separarOpciones(f.opciones);
    if (conOpciones) {
      if (!lista.length) {
        invalida(`"${etiquetaDe(TIPOS, tipo)}" necesita opciones, separadas por punto y coma.`);
      } else {
        const opciones = tipo === 'opciones'
          ? lista.map(opcionConEvidencia).map(o => {
              const evidencia = nivelPosible(o.evidencia, admiteFotos);
              if (evidencia !== o.evidencia) {
                aviso(`"${o.texto}" pide comentario y foto, pero el punto va sin foto: queda con comentario.`);
              }
              return { texto: o.texto, evidencia };
            })
          : lista;
        const textos = opciones.map(o => (typeof o === 'string' ? o : o.texto));
        const larga = textos.find(t => t.length > LARGO_MAXIMO.opcion);
        const repetida = primeraRepetida(textos);
        if (larga) invalida(`La opción "${larga.slice(0, 40)}…" supera los ${LARGO_MAXIMO.opcion} caracteres.`);
        if (repetida) invalida(`La opción "${repetida}" está repetida.`);
        config.opciones = opciones;
      }
    } else if (lista.length && tipo) {
      aviso(`Las opciones no se usan en "${etiquetaDe(TIPOS, tipo)}": se ignoran.`);
    }

    if (unidad) {
      if (tipo === 'numero') {
        if (unidad.length > LARGO_MAXIMO.unidad) invalida(`La unidad supera los ${LARGO_MAXIMO.unidad} caracteres.`);
        config.unidad = unidad;
      } else if (tipo) {
        aviso('La unidad solo se usa en "Número o lectura": se ignora.');
      }
    }

    let requiereFoto = exigirFoto;
    if (requiereFoto && origen === 'ninguna') {
      aviso('El punto va "Sin foto": no se puede exigir foto, se deja sin exigir.');
      requiereFoto = false;
    }

    if (!valida) continue;

    const clave = normalizar(nombre);
    if (!plantillas.has(clave)) plantillas.set(clave, { nombre, categorias: new Map(), items: [] });
    const p = plantillas.get(clave);
    const claveCategoria = normalizar(categoria);
    if (!p.categorias.has(claveCategoria)) {
      p.categorias.set(claveCategoria, { nombre: categoria, orden: p.categorias.size, puntos: 0 });
    }
    const cat = p.categorias.get(claveCategoria);
    p.items.push({
      fila: f.fila,
      grupo: cat.nombre,
      orden_grupo: cat.orden,
      orden: cat.puntos++,
      texto: pregunta,
      ayuda: descripcion || null,
      tipo_ingreso: tipo,
      config,
      requiere_foto: requiereFoto,
      obligatorio,
      es_critico: critico
    });
  }

  if (!filas.length) {
    errores.push({ fila: null, mensaje: 'No hay filas con puntos. Completa una fila por punto debajo de los encabezados.' });
  }

  const existentes = new Set(nombresExistentes.map(normalizar));
  const resultado = [...plantillas.values()].map(p => {
    if (existentes.has(normalizar(p.nombre))) {
      avisos.push({ fila: null, mensaje: `Ya existe una plantilla llamada "${p.nombre}": se creará otra con el mismo nombre.` });
    }
    return {
      nombre: p.nombre,
      categorias: [...p.categorias.values()].map(c => ({ nombre: c.nombre, puntos: c.puntos })),
      items: p.items
    };
  });

  return { plantillas: resultado, errores, avisos };
}

/* Lo que se manda a la base: sin el número de fila. */
export function cargaParaImportar(plantillas) {
  return plantillas.map(p => ({
    nombre: p.nombre,
    items: p.items.map(({ fila, ...punto }) => punto)
  }));
}

/* Etiquetas para el formato y las instrucciones. */
export const ETIQUETAS_TIPO = TIPOS.map(([, etiqueta]) => etiqueta);
export const ETIQUETAS_FOTOS = ORIGENES_FOTO.map(([, etiqueta]) => etiqueta);
