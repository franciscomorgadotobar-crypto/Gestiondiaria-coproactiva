/* Supabase simulado para probar la app sin red.
 *
 * Existe porque las fallas que importan en esta app no se ven compilando: una
 * FileList que se vacía antes de leerse, un blob que no llega a IndexedDB, una
 * miniatura que no aparece. Todo eso pasa el build sin una sola advertencia y
 * solo se detecta ejecutando la pantalla de verdad.
 *
 * No pretende imitar a Supabase: responde lo justo para que la pantalla se monte
 * con datos y las escrituras no revienten. Lo que se está probando es el camino
 * del teléfono —IndexedDB, la cola, la interfaz—, no el servidor.
 */

const PERFIL = {
  id: '6165f239-1805-4c68-a526-3577afc9912e',
  nombre: 'Francisco Morgado',
  email: 'prueba@coproactiva.cl',
  rol: 'superadmin',
  activo: true
};

const EQUIPO = [
  PERFIL,
  { id: 'u2', nombre: 'Marta Silva',  email: 'marta@coproactiva.cl',  rol: 'jefatura', activo: true },
  { id: 'u3', nombre: 'Luis Cárcamo', email: 'luis@coproactiva.cl',   rol: 'terreno',  activo: true },
  { id: 'u4', nombre: 'Ana Pinto',    email: 'ana@coproactiva.cl',    rol: 'terreno',  activo: false }
];

const COMUNIDAD_ID = 'c0000000-0000-4000-8000-000000000001';
const CONTROL_ID   = 'c0000000-0000-4000-8000-000000000002';

const PROSPECTO_ID = 'c0000000-0000-4000-8000-000000000003';

const CONTROL = {
  id: CONTROL_ID,
  comunidad_id: COMUNIDAD_ID,
  prospecto_id: null,
  destino_nombre: 'Edificio de prueba',
  destino_direccion: 'América 755',
  destino_comuna: 'San Bernardo',
  destino_tipo: 'comunidad',
  estado: 'en_curso',
  periodo: 'Septiembre 2026',
  checkin_en: '2026-09-06T13:14:00.000Z',
  checkin_precision: 12.4,
  programado_para: '2026-09-08T13:00:00.000Z',
  plantilla_nombre: 'Control mensual',
  creado_en: '2026-09-06T12:00:00.000Z',
  items_evaluados: 1,
  items_totales: 4,
  items_criticos: 0,
  secuencial: true,
  comunidades: { nombre: 'Edificio de prueba', direccion: 'América 755', comuna: 'San Bernardo' }
};

const ITEMS = [
  { id: 'i1', grupo: 'Acceso', texto: 'Conserje en turno', orden: 0,
    estado: 'cumple', nota: null, respuesta: null, tipo_ingreso: 'estado', config: {} },
  { id: 'i2', grupo: 'Acceso', texto: 'Cámaras grabando', orden: 1,
    estado: 'cumple', nota: null, respuesta: null, tipo_ingreso: 'estado', config: {},
    requiere_foto: true },
  { id: 'i3', grupo: 'Instalaciones', texto: 'Lectura del medidor', orden: 2,
    estado: 'sin_evaluar', nota: null, respuesta: null, tipo_ingreso: 'numero',
    config: { unidad: 'm³' }, requiere_foto: false },
  { id: 'i4', grupo: 'Instalaciones', texto: 'Estado de la fachada', orden: 3,
    estado: 'sin_evaluar', nota: null, respuesta: null, tipo_ingreso: 'escala',
    config: { min: 1, max: 10 }, requiere_foto: false },
  { id: 'i5', grupo: 'Azotea', texto: 'Estanque de agua', orden: 4,
    estado: 'sin_evaluar', nota: null, respuesta: null, tipo_ingreso: 'estado',
    config: {}, requiere_foto: false }
];

/* Check-ins repartidos por Santiago, con estados y fechas distintas para poder
 * ejercitar los filtros del mapa. */
const ahora = Date.now();
const hace = d => new Date(ahora - d * 86400000).toISOString();
const VISITAS = [
  { ...CONTROL, id: 'v1', comunidad_id: 'com-mirador', destino_nombre: 'Mirador del Parque', destino_comuna: 'Ñuñoa',
    responsable_id: 'u3', responsable_nombre: 'Luis Cárcamo',
    estado: 'enviado', checkin_en: hace(0), checkin_lat: -33.4569, checkin_lng: -70.5975,
    checkin_precision: 8, items_evaluados: 26, items_totales: 26, items_criticos: 0, fotos: 12 },
  { ...CONTROL, id: 'v2', comunidad_id: 'com-almendros', destino_nombre: 'Los Almendros', destino_comuna: 'La Florida',
    responsable_id: 'u3', responsable_nombre: 'Luis Cárcamo',
    estado: 'en_curso', checkin_en: hace(2), checkin_lat: -33.5226, checkin_lng: -70.5989,
    checkin_precision: 65, items_evaluados: 8, items_totales: 26, items_criticos: 1, fotos: 4 },
  { ...CONTROL, id: 'v3', comunidad_id: 'com-costanera', destino_nombre: 'Costanera Norte', destino_comuna: 'Providencia',
    responsable_id: 'u2', responsable_nombre: 'Marta Silva',
    estado: 'pausado', checkin_en: hace(9), checkin_lat: -33.4198, checkin_lng: -70.6062,
    checkin_precision: 22, items_evaluados: 11, items_totales: 26, items_criticos: 0, fotos: 7 },
  { ...CONTROL, id: 'v4', comunidad_id: null, prospecto_id: PROSPECTO_ID, destino_tipo: 'prospecto', destino_nombre: 'Las Palmeras', destino_comuna: 'Providencia',
    responsable_id: null, responsable_nombre: null,
    estado: 'enviado', checkin_en: hace(40), checkin_lat: -33.4372, checkin_lng: -70.6178,
    checkin_precision: 15, items_evaluados: 26, items_totales: 26, items_criticos: 3, fotos: 21 }
];
// Dos visitas más a Los Almendros: es el caso que la agrupación resuelve.
VISITAS.push({
  ...CONTROL, id: 'v6', comunidad_id: 'com-almendros', destino_nombre: 'Los Almendros',
  destino_comuna: 'La Florida', responsable_id: 'u3', responsable_nombre: 'Luis Cárcamo',
  estado: 'enviado', checkin_en: hace(6), checkin_lat: -33.5231, checkin_lng: -70.5981,
  checkin_precision: 11, items_evaluados: 26, items_totales: 26, items_criticos: 2, fotos: 9
});
VISITAS.push({
  ...CONTROL, id: 'v7', comunidad_id: 'com-almendros', destino_nombre: 'Los Almendros',
  destino_comuna: 'La Florida', responsable_id: 'u3', responsable_nombre: 'Luis Cárcamo',
  estado: 'enviado', checkin_en: hace(20), checkin_lat: -33.5220, checkin_lng: -70.5994,
  checkin_precision: 14, items_evaluados: 26, items_totales: 26, items_criticos: 0, fotos: 15
});
VISITAS.push({
  ...CONTROL, id: 'v5', comunidad_id: 'com-zen', destino_nombre: 'Edificio Zen', destino_comuna: 'Peñalolén',
  responsable_id: null, responsable_nombre: null,
  estado: 'pendiente', checkin_en: null, checkin_lat: null, checkin_lng: null,
  items_evaluados: 0, items_totales: 26, items_criticos: 0, fotos: 0
});

VISITAS.push({
  ...CONTROL, id: 'v8', destino_nombre: 'Torre Poniente', destino_comuna: 'Ñuñoa',
  responsable_id: 'u9', responsable_nombre: null,
  estado: 'pendiente', checkin_en: null, checkin_lat: null, checkin_lng: null,
  items_evaluados: 0, items_totales: 12, items_criticos: 0, fotos: 0
});
// Asignado a quien inicia sesión en la prueba (PERFIL), programado para hoy:
// es el caso que ejercita "para hoy" y "se te asignó" en la campana.
VISITAS.push({
  ...CONTROL, id: 'v9', destino_nombre: 'Bosque Nativo', destino_comuna: 'Vitacura',
  responsable_id: PERFIL.id, responsable_nombre: PERFIL.nombre,
  estado: 'pendiente', checkin_en: null, checkin_lat: null, checkin_lng: null,
  programado_para: new Date().toISOString(),
  creado_en: new Date().toISOString(),
  items_evaluados: 0, items_totales: 10, items_criticos: 0, fotos: 0
});

const TABLAS = {
  perfiles: EQUIPO,
  perfil_comunidades: [{ perfil_id: 'u2', comunidad_id: COMUNIDAD_ID }],
  // Las mismas comunidades que aparecen en VISITAS, para poder probar el
  // histórico agrupado por comunidad sin datos huérfanos.
  comunidades: [
    { id: COMUNIDAD_ID, nombre: 'Edificio de prueba', comuna: 'San Bernardo' },
    { id: 'com-mirador', nombre: 'Mirador del Parque', comuna: 'Ñuñoa' },
    { id: 'com-almendros', nombre: 'Los Almendros', comuna: 'La Florida' },
    { id: 'com-costanera', nombre: 'Costanera Norte', comuna: 'Providencia' },
    { id: 'com-zen', nombre: 'Edificio Zen', comuna: 'Peñalolén' }
  ],
  prospectos: [
    { id: PROSPECTO_ID, nombre_condominio: 'Las Palmeras', direccion: 'Av. Providencia 1234', comuna: 'Providencia',
      unidades: 64, nombre_contacto: 'Diego Barrios', cargo_contacto: 'Presidente del comité',
      telefono: '+56 9 8877 6655', email: 'diego.barrios@example.cl', tipo_servicio: 'administracion',
      fuente: 'Referido', etapa: 'diagnostico', responsable_id: 'u2', responsable_nombre: 'Marta Silva',
      proxima_accion: 'Agendar visita de diagnóstico', fecha_proxima_accion: hace(-2),
      fecha_primer_contacto: hace(20), fecha_ultima_interaccion: hace(3), motivo_perdida: null,
      observaciones: null, comunidad_id: null, creado_en: hace(20), editado_en: hace(3) },
    { id: 'pros-nuevo', nombre_condominio: 'Torres del Sol', direccion: 'Los Militares 5200', comuna: 'Las Condes',
      unidades: 120, nombre_contacto: 'Paula Vidal', cargo_contacto: 'Secretaria del comité',
      telefono: '+56 9 1122 3344', email: 'paula.vidal@example.cl', tipo_servicio: null,
      fuente: 'Formulario web', etapa: 'nuevo', responsable_id: null, responsable_nombre: null,
      proxima_accion: null, fecha_proxima_accion: null,
      fecha_primer_contacto: hace(1), fecha_ultima_interaccion: hace(1), motivo_perdida: null,
      observaciones: null, comunidad_id: null, creado_en: hace(1), editado_en: hace(1) },
    { id: 'pros-contacto', nombre_condominio: 'Edificio Mirasol', direccion: 'Vitacura 3400', comuna: 'Vitacura',
      unidades: 80, nombre_contacto: 'Rodrigo Ortiz', cargo_contacto: 'Tesorero',
      telefono: '+56 9 5566 7788', email: 'rodrigo.ortiz@example.cl', tipo_servicio: 'auditoria',
      fuente: 'Llamada', etapa: 'contacto', responsable_id: PERFIL.id, responsable_nombre: PERFIL.nombre,
      proxima_accion: 'Llamar para coordinar visita', fecha_proxima_accion: hace(1),
      fecha_primer_contacto: hace(8), fecha_ultima_interaccion: hace(2), motivo_perdida: null,
      observaciones: null, comunidad_id: null, creado_en: hace(8), editado_en: hace(2) },
    { id: 'pros-negociacion', nombre_condominio: 'Parque Alto', direccion: 'Manquehue 900', comuna: 'Vitacura',
      unidades: 45, nombre_contacto: 'Isidora Prat', cargo_contacto: 'Presidenta',
      telefono: '+56 9 3344 5566', email: 'isidora.prat@example.cl', tipo_servicio: 'administracion',
      fuente: 'Referido', etapa: 'negociacion', responsable_id: 'u2', responsable_nombre: 'Marta Silva',
      proxima_accion: 'Enviar contrato ajustado', fecha_proxima_accion: hace(-5),
      fecha_primer_contacto: hace(35), fecha_ultima_interaccion: hace(4), motivo_perdida: null,
      observaciones: 'Piden ajustar honorarios.', comunidad_id: null, creado_en: hace(35), editado_en: hace(4) },
    { id: 'pros-perdido', nombre_condominio: 'Bosques del Alba', direccion: 'Camino Real 220', comuna: 'Peñalolén',
      unidades: 30, nombre_contacto: 'Felipe Rojas', cargo_contacto: 'Presidente',
      telefono: '+56 9 7788 9900', email: 'felipe.rojas@example.cl', tipo_servicio: 'administracion',
      fuente: 'Web', etapa: 'perdido', responsable_id: 'u2', responsable_nombre: 'Marta Silva',
      proxima_accion: null, fecha_proxima_accion: null,
      fecha_primer_contacto: hace(50), fecha_ultima_interaccion: hace(30), motivo_perdida: 'Se quedaron con la administradora actual.',
      observaciones: null, comunidad_id: null, creado_en: hace(50), editado_en: hace(30) }
  ],
  controles: [CONTROL],
  // El propio CONTROL entra acá también: es el que abre la pantalla de
  // levantamiento en /control/:id, y esa pantalla consulta esta tabla, no
  // 'controles'.
  controles_con_avance: [CONTROL, ...VISITAS],
  control_items: ITEMS,
  control_pausas: [],
  plantillas_control: [{ id: 'pl1', nombre: 'Control mensual', activa: true, plantilla_items: [{ count: 4 }] }],
  plantilla_items: ITEMS.map((it, n) => ({
    id: 'p' + n, plantilla_id: 'pl1', grupo: it.grupo, texto: it.texto,
    orden: n, orden_grupo: 0, tipo_ingreso: it.tipo_ingreso, config: it.config, activo: true
  })),
  adjuntos: [],
  activos_comunidad: [
    { id: 'act1', comunidad_id: COMUNIDAD_ID, nombre: 'Ascensor principal', categoria: 'ascensor',
      ubicacion: 'Torre A', marca: 'Schindler', modelo: '3300', serie: 'SC-9021', estado: 'operativo',
      proveedor: 'Ascensores del Sur', documentos: null }
  ],
  // Una mantención ya creada, con fecha límite calculada a fin de período, para
  // poder probar la etiqueta "Fecha límite actual" sin depender de crear una
  // desde el formulario (el insert simulado no refleja el alta real).
  mantenimiento_actividades: [
    { id: 'mant1', comunidad_id: COMUNIDAD_ID, activo_id: 'act1', trabajo: 'Mantención preventiva',
      frecuencia_unidad: 'meses', frecuencia_valor: 1, fecha_inicio: '2026-08-01',
      limite_tipo: 'fin_periodo', dia_limite: null, proxima_exigible: '2026-08-31',
      responsable_id: null, proveedor: 'Ascensores del Sur', evidencias_requeridas: ['Foto', 'Informe'],
      activa: true, creado_en: '2026-08-01T12:00:00.000Z' }
  ],
  mantenimiento_agendamientos: [],
  ejecuciones_mantenimiento: [],
  mantenimiento_alertas_config: [],
  notificaciones_mantenimiento: []
};

/* Consulta encadenable. Cada método devuelve el mismo objeto y la promesa se
 * resuelve al final, igual que el cliente real. */
function consulta(tabla) {
  let filas = [...(TABLAS[tabla] ?? [])];
  let pedirConteo = false;
  let actualizacionPendiente = null;
  function aplicarActualizacionPendiente() {
    if (!actualizacionPendiente) return;
    filas.forEach(f => Object.assign(f, actualizacionPendiente));
    actualizacionPendiente = null;
  }
  const api = {
    select: (_campos, opciones) => {
      if (opciones?.count) pedirConteo = true;
      return api;
    },
    eq: (columna, valor) => {
      if (filas.length && columna in (filas[0] ?? {})) {
        filas = filas.filter(f => f[columna] === valor);
      }
      return api;
    },
    neq: (columna, valor) => {
      filas = filas.filter(f => f[columna] !== valor);
      return api;
    },
    not: () => api,
    order: () => api,
    limit: n => { filas = filas.slice(0, n); return api; },
    insert: d => {
      registrar('insert', tabla, d);
      const fila = Array.isArray(d) ? d[0] : d;
      // Se agrega también a TABLAS, no solo a la copia local: si no, una
      // consulta posterior (update, select) en otra llamada a `consulta()`
      // no la encuentra, porque cada llamada parte de una copia fresca.
      const nueva = { id: crypto.randomUUID(), ...fila };
      filas.unshift(nueva);
      if (TABLAS[tabla]) TABLAS[tabla].unshift(nueva);
      return api;
    },
    // El `update` no se aplica al llamarlo: en la cadena real (`.update(d).eq(...)`)
    // el WHERE se resuelve junto con la escritura recién al ejecutar la consulta,
    // no en el orden en que se escriben los métodos. Aplicarlo de inmediato
    // mutaría toda la tabla, porque `.eq()` todavía no alcanzó a filtrar `filas`.
    update: d => { registrar('update', tabla, d); actualizacionPendiente = d; return api; },
    upsert: d => { registrar('upsert', tabla, d); return api; },
    delete: () => api,
    single: () => { aplicarActualizacionPendiente(); return Promise.resolve({ data: filas[0] ?? null, error: null }); },
    maybeSingle: () => { aplicarActualizacionPendiente(); return Promise.resolve({ data: filas[0] ?? null, error: null }); },
    then: (resolver, rechazar) => {
      aplicarActualizacionPendiente();
      return Promise.resolve({ data: filas, count: pedirConteo ? filas.length : null, error: null })
        .then(resolver, rechazar);
    }
  };
  return api;
}

// Las escrituras quedan a la vista para que la prueba pueda comprobarlas.
window.__escrituras = [];
function registrar(operacion, tabla, datos) {
  window.__escrituras.push({ operacion, tabla, datos });
}

export const hayCredenciales = true;

// Respuestas mínimas para las RPC del portal cliente: alcanza para que la
// pantalla monte y se pueda navegar, no reproduce las reglas de negocio del
// servidor (eso ya se probó directo contra la base, no acá).
const RPC = {
  portal_cliente_dashboard: () => [{
    comunidad_id: COMUNIDAD_ID, nombre: 'Edificio de prueba', comuna: 'San Bernardo',
    direccion: 'América 755', latitud: -33.589, longitud: -70.699,
    por_agendar: 1, agendados: 1, pendientes: 1
  }],
  portal_cliente_levantamientos: () => VISITAS.map(v => ({
    id: v.id, comunidad_id: v.comunidad_id, plantilla_id: 'pl1', plantilla_nombre: v.plantilla_nombre,
    estado: v.estado, periodo: v.periodo, programado_para: v.programado_para,
    creado_en: v.creado_en, checkin_en: v.checkin_en, enviado_en: null
  })),
  portal_cliente_mantenciones: () => [
    { actividad_id: 'mant1', activo_nombre: 'Ascensor principal', activo_categoria: 'Ascensor',
      trabajo: 'Mantención preventiva', frecuencia_unidad: 'meses', frecuencia_valor: 1,
      vencimiento_original: hace(10), proxima_exigible: hace(10), programado_para: null,
      proveedor: 'Ascensores del Sur', ultima_ejecucion: null, ejecutor: null, observaciones: null },
    { actividad_id: 'mant2', activo_nombre: 'Grupo electrógeno', activo_categoria: 'Generador',
      trabajo: 'Prueba de partida', frecuencia_unidad: 'meses', frecuencia_valor: 3,
      vencimiento_original: hace(-25), proxima_exigible: hace(-25), programado_para: null,
      proveedor: null, ultima_ejecucion: hace(60), ejecutor: 'Luis Cárcamo', observaciones: 'Sin observaciones.' }
  ],
  portal_cliente_requerimientos: () => [
    { id: 'req1', nombre: null, plantilla_nombre: 'Control mensual', tiene_agendamiento: false, proxima_exigible: hace(-6) }
  ],
  portal_cliente_incidencias: () => [
    { id: 'inc1', titulo: 'Filtración en subterráneo', descripcion: 'Se detectó humedad en el muro del estacionamiento -2.',
      estado: 'pendiente', prioridad: 'Alta', creado_en: hace(5), programado_para: null, resuelto_en: null },
    { id: 'inc2', titulo: 'Portón de acceso vehicular con falla', descripcion: 'El portón no cierra completamente.',
      estado: 'programada', prioridad: 'Media', creado_en: hace(10), programado_para: hace(-4), resuelto_en: null },
    { id: 'inc3', titulo: 'Luminaria pasillo 3er piso', descripcion: 'Luz parpadeante reportada por un residente.',
      estado: 'pendiente', prioridad: 'Baja', creado_en: hace(15), programado_para: hace(2), resuelto_en: null },
    { id: 'inc4', titulo: 'Fuga menor en sala de bombas', descripcion: 'Se reparó la válvula con fuga.',
      estado: 'resuelta', prioridad: 'Media', creado_en: hace(20), programado_para: hace(18), resuelto_en: hace(17) }
  ],
  portal_cliente_documentos: () => [
    { id: 'doc1', referencia_id: null, titulo: 'Informe mensual Septiembre 2026', nombre_archivo: 'informe-septiembre-2026.pdf',
      tipo_mime: 'application/pdf', url: 'https://prueba/informes/informe-septiembre-2026.pdf', fecha: hace(3), origen: 'Levantamiento' },
    { id: 'doc2', referencia_id: 'v1', titulo: 'Levantamiento control mensual', nombre_archivo: 'control-mensual.pdf',
      tipo_mime: 'application/pdf', url: 'https://prueba/informes/control-mensual.pdf', fecha: hace(1), origen: 'Levantamiento' },
    { id: 'doc3', referencia_id: null, titulo: 'Respaldo fotográfico mantención ascensor', nombre_archivo: 'respaldo-ascensor.jpg',
      tipo_mime: 'image/jpeg', url: null, fecha: hace(8), origen: 'Mantención' }
  ],
  asignar_rol_cliente: (p) => { registrar('rpc', 'asignar_rol_cliente', p); return null; }
};

export const supabase = {
  from: consulta,
  rpc: (nombre, params) => {
    registrar('rpc', nombre, params);
    const f = RPC[nombre];
    return Promise.resolve({ data: f ? f(params) : [], error: f ? null : { message: `RPC no simulada: ${nombre}` } });
  },
  auth: {
    getSession: () => Promise.resolve({
      data: { session: { user: { id: PERFIL.id, email: PERFIL.email }, access_token: 'token-de-prueba' } }
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: () => Promise.resolve({ error: null }),
    // El token 'vencido' simula un enlace ya usado o caducado.
    verifyOtp: ({ token_hash }) => Promise.resolve(
      token_hash === 'vencido'
        ? { data: null, error: { message: 'Token has expired or is invalid' } }
        : { data: { session: {} }, error: null }
    ),
    updateUser: (datos) => { registrar('updateUser', 'auth', datos); return Promise.resolve({ error: null }); },
    signOut: () => Promise.resolve({ error: null })
  },
  // La función de acceso público responde siempre lo mismo, exista o no el
  // correo. El simulado copia esa respuesta para que la pantalla se pruebe
  // contra lo que de verdad va a recibir.
  functions: {
    invoke: (nombre, opciones) => {
      registrar('funcion', nombre, opciones?.body);
      return Promise.resolve({
        data: { ok: true, mensaje: 'Si esa dirección está registrada, le llegará un enlace en unos minutos.' },
        error: null
      });
    }
  },
  storage: {
    from: () => ({
      upload: (ruta) => {
        registrar('storage', 'evidencia', { ruta });
        return Promise.resolve({ error: null });
      },
      remove: (rutas) => {
        registrar('storage-borrado', 'evidencia', { rutas });
        return Promise.resolve({ error: null });
      },
      createSignedUrls: (rutas) => Promise.resolve({
        data: rutas.map(path => ({ path, signedUrl: 'https://prueba/' + path })),
        error: null
      })
    })
  }
};

export const IDS = { COMUNIDAD_ID, CONTROL_ID, PROSPECTO_ID, PERFIL };
