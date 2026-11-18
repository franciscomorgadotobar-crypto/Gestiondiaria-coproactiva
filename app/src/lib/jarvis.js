/*
 * Jarvis: lectura de la agenda unificada que entrega public.jarvis_agenda().
 * Aquí solo se ordena y se describe; qué entra en la agenda lo decide la
 * base de datos, para que la campana y el análisis diario vean lo mismo.
 */
export const AMBITOS = [
  ['todos', 'Todos'],
  ['operacion', 'Operación'],
  ['comercial', 'Comercial'],
  ['legal', 'Ciclo legal'],
  ['proveedores', 'Proveedores y personal']
];

export const GRUPOS_AGENDA = [
  ['vencido', 'Con atraso'],
  ['hoy', 'Para hoy'],
  ['semana', 'Próximos 7 días'],
  ['proximo', 'Más adelante']
];

export const VISTAS = [
  ['agenda', 'Lo que viene'],
  ['brechas', 'Datos por completar'],
  ['ciclo', 'Ciclo legal'],
  ['asumidos', 'Compromisos asumidos']
];

export const TIPOS_ASUMIDO = [
  ['informe', 'Informe'], ['visita', 'Visita'], ['propuesta', 'Propuesta'],
  ['seguimiento', 'Seguimiento'], ['documento', 'Documento'],
  ['respuesta', 'Respuesta'], ['reunion', 'Reunión'], ['otro', 'Otro']
];

export function nombreAmbito(ambito) {
  return AMBITOS.find(([id]) => id === ambito)?.[1] ?? 'Gestión';
}

export function vistaValida(valor) {
  return VISTAS.some(([id]) => id === valor) ? valor : 'agenda';
}

/* "Atraso de 3 días", "Hoy", "Mañana", "En 12 días". */
export function textoPlazo(dias) {
  if (dias === null || dias === undefined) return 'Sin fecha';
  if (dias < -1) return 'Atraso de ' + Math.abs(dias) + ' días';
  if (dias === -1) return 'Atraso de 1 día';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  return 'En ' + dias + ' días';
}

export function fechaCorta(fecha) {
  if (!fecha) return '';
  const [a, m, d] = String(fecha).slice(0, 10).split('-');
  return d + '-' + m + '-' + a;
}

export function filtrar(items, { ambito = 'todos', comunidadId = '' } = {}) {
  return (items ?? []).filter(item =>
    (ambito === 'todos' || item.ambito === ambito) &&
    (!comunidadId || item.comunidad_id === comunidadId));
}

export function contar(items) {
  const total = { vencido: 0, hoy: 0, semana: 0, proximo: 0, brecha: 0 };
  for (const item of items ?? []) {
    if (item.urgencia in total) total[item.urgencia] += 1;
  }
  return total;
}

export function agruparAgenda(items) {
  return GRUPOS_AGENDA
    .map(([id, titulo]) => ({ id, titulo, items: (items ?? []).filter(i => i.urgencia === id) }))
    .filter(grupo => grupo.items.length);
}

/* Las brechas se leen por comunidad: es la ficha la que hay que completar. */
export function brechasPorComunidad(items) {
  const grupos = new Map();
  for (const item of (items ?? []).filter(i => i.urgencia === 'brecha')) {
    const clave = item.comunidad_id || 'general';
    if (!grupos.has(clave)) {
      grupos.set(clave, { id: clave, nombre: item.comunidad || 'Gestión general', items: [] });
    }
    grupos.get(clave).items.push(item);
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* Próxima fecha de una obligación: la registrada o, si no, la última más la
 * frecuencia de la regla. Devuelve 'AAAA-MM-DD' o null. */
export function proximaFechaCiclo(regla, fila) {
  if (fila?.proxima_fecha) return fila.proxima_fecha;
  if (!fila?.ultima_fecha || !regla?.frecuencia_meses) return null;
  const [a, m, d] = fila.ultima_fecha.split('-').map(Number);
  const mesDestino = m - 1 + regla.frecuencia_meses;
  const ultimoDia = new Date(Date.UTC(a, mesDestino + 1, 0)).getUTCDate();
  const fecha = new Date(Date.UTC(a, mesDestino, Math.min(d, ultimoDia)));
  return fecha.toISOString().slice(0, 10);
}

export function textoFrecuencia(meses) {
  if (!meses) return 'Según vencimiento';
  if (meses === 1) return 'Mensual';
  if (meses === 12) return 'Anual';
  return 'Cada ' + meses + ' meses';
}

/** Fecha del negocio; evita interpretar UTC como la fecha chilena. */
export function fechaHoyChile(ahora = new Date()) {
  const partes=new Intl.DateTimeFormat('es-CL',{
    timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(ahora);
  const campo=id=>partes.find(p=>p.type===id)?.value||'';
  return campo('year')+'-'+campo('month')+'-'+campo('day');
}

/** Lectura operativa factual. No suplanta el análisis editorial de fuentes
 * externas guardado en jarvis_analisis: usa solamente la agenda RLS actual. */
export function lecturaOperativa(agenda,ahora=new Date()) {
  if(!Array.isArray(agenda))return null;
  const fecha=fechaHoyChile(ahora);
  const n=contar(agenda);
  const resumen='Al '+fechaCorta(fecha)+': '+n.vencido+' gestiones con atraso, '
    +n.hoy+' para hoy, '+n.semana+' en los próximos siete días y '
    +n.brecha+' datos por completar. Los valores reflejan la agenda operativa '
    +'del sistema al momento de la consulta.';
  const urgentes=agenda.filter(a=>['vencido','hoy','semana'].includes(a.urgencia))
    .sort((a,b)=>{
      const orden={vencido:0,hoy:1,semana:2};
      return orden[a.urgencia]-orden[b.urgencia]
        || (a.dias??9999)-(b.dias??9999)
        || String(a.titulo||'').localeCompare(String(b.titulo||''),'es');
    })
    .slice(0,5).map(a=>({
      titulo:a.titulo,detalle:a.accion||a.detalle||'',
      ruta:a.ruta||'/jarvis',urgencia:a.urgencia
    }));
  return {fecha,resumen,urgentes,totales:n};
}
