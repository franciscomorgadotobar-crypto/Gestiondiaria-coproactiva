/**
 * Exportación COMPLETA de la tabla proveedores para perfiles administradores.
 *
 * La consulta se hace directamente a Supabase en páginas (sin filtros locales)
 * porque la carga normal de PostgREST está limitada por el máximo de filas de
 * cada respuesta. No se incluyen tablas ajenas ni credenciales de Gmail.
 * RLS de Supabase sigue aplicando a toda la exportación.
 */
export async function consultarBaseCompletaProveedores(supabase, { tamanoPagina = 500 } = {}) {
  const todos = [];
  for (let inicio = 0; ; inicio += tamanoPagina) {
    const respuesta = await supabase.from('proveedores')
      .select('*')
      .order('id', { ascending: true })
      .range(inicio, inicio + tamanoPagina - 1);
    if (respuesta.error) throw new Error(
      'No se pudo consultar la base completa: ' + respuesta.error.message
    );
    if (!Array.isArray(respuesta.data)) {
      throw new Error('La consulta no devolvió registros válidos.');
    }
    todos.push(...respuesta.data);
    if (respuesta.data.length < tamanoPagina) return todos;
  }
}

const COLUMNAS_PRIORITARIAS = [
  'empresa', 'rut', 'contacto_nombre', 'contacto_cargo',
  'email', 'telefono', 'sitio_web', 'rubro', 'servicios',
  'especialidades', 'comunas', 'regiones', 'direccion',
  'origen', 'estado', 'lista_negra', 'lista_negra_motivo',
  'lista_negra_detalle', 'notas', 'contactos',
  'creado_en', 'editado_en'
];

function valoresUnicos(valores) {
  return [...new Set(valores.map(v => String(v || '').trim()).filter(Boolean))];
}

function datosContacto(registro) {
  const contactos = Array.isArray(registro.contactos) ? registro.contactos : [];
  const correos = valoresUnicos([registro.email, ...contactos.map(c => c?.email)]);
  const telefonos = valoresUnicos([registro.telefono, ...contactos.map(c => c?.telefono)]);
  return { contactos, correos, telefonos };
}

export function prepararFilasProveedores(registros) {
  if (!Array.isArray(registros)) throw new TypeError('Registros inválidos.');
  const datos = registros.map(registro => ({
    registro,
    ...datosContacto(registro)
  }));
  const maxContactos = Math.max(0, ...datos.map(d => d.contactos.length));
  const maxCorreos = Math.max(0, ...datos.map(d => d.correos.length));
  const maxTelefonos = Math.max(0, ...datos.map(d => d.telefonos.length));
  const campos = new Set(registros.flatMap(registro => Object.keys(registro)));
  const comunes = COLUMNAS_PRIORITARIAS.filter(nombre => campos.has(nombre));
  const restantes = [...campos].filter(nombre => !comunes.includes(nombre)).sort();
  const extras = [];
  for (let numero = 2; numero <= maxCorreos; numero++) {
    const columna = 'correo_' + numero;
    if (!campos.has(columna)) extras.push(columna);
  }
  for (let numero = 2; numero <= maxTelefonos; numero++) {
    const columna = 'telefono_' + numero;
    if (!campos.has(columna)) extras.push(columna);
  }
  for (let numero = 1; numero <= maxContactos; numero++) {
    for (const campo of ['nombre', 'cargo', 'email', 'telefono']) {
      const columna = 'contacto_' + numero + '_' + campo;
      if (!campos.has(columna)) extras.push(columna);
    }
  }
  const columnas = [...comunes, ...restantes, ...extras];
  const filas = datos.map(({ registro, contactos, correos, telefonos }) => {
    const fila = { ...registro };
    for (let n = 2; n <= maxCorreos; n++) {
      const clave = 'correo_' + n;
      if (!campos.has(clave)) fila[clave] = correos[n - 1] || '';
    }
    for (let n = 2; n <= maxTelefonos; n++) {
      const clave = 'telefono_' + n;
      if (!campos.has(clave)) fila[clave] = telefonos[n - 1] || '';
    }
    for (let n = 1; n <= maxContactos; n++) {
      for (const campo of ['nombre', 'cargo', 'email', 'telefono']) {
        const clave = 'contacto_' + n + '_' + campo;
        if (!campos.has(clave)) fila[clave] = contactos[n - 1]?.[campo] || '';
      }
    }
    return fila;
  });
  return { columnas, filas };
}

function normalizarCelda(valor) {
  if (valor == null) return '';
  if (typeof valor === 'object') {
    // Preserva los valores completos de arrays y JSONB en el respaldo.
    return JSON.stringify(valor);
  }
  const cadena = String(valor);
  // Bloquea ejecución de fórmulas al abrir datos no confiables en Excel.
  return /^[\s]*[=+\-@]/.test(cadena) ? "'" + cadena : cadena;
}

function escaparCsv(valor) {
  const cadena = normalizarCelda(valor);
  return /[;"\r\n]/.test(cadena)
    ? '"' + cadena.replace(/"/g, '""') + '"'
    : cadena;
}

export function generarCsvProveedores(registros) {
  const { columnas, filas } = prepararFilasProveedores(registros);
  if (!columnas.length) throw new Error('No hay proveedores para exportar.');
  const lineas = [
    columnas.map(escaparCsv).join(';'),
    ...filas.map(fila => columnas.map(nombre => escaparCsv(fila[nombre])).join(';'))
  ];
  // UTF-8 BOM para tildes y ñ en Excel; delimitador de Excel Chile (;).
  return '\ufeff' + lineas.join('\r\n') + '\r\n';
}

export function nombreArchivoProveedores(fecha = new Date()) {
  const iso = fecha.toISOString().slice(0, 10);
  return 'coproactiva_proveedores_BD_' + iso + '.csv';
}
