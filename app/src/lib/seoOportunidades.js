/**
 * Reglas explicables de oportunidad. No predicen el tráfico ni inventan la URL.
 * El vínculo consulta -> página lo entrega Search Console bajo demanda.
 */
export function construirOportunidades(search, audit, analytics) {
  const result = [];
  for (const q of search?.consultas || []) {
    if (q.impresiones >= 30 && q.posicion >= 4 && q.posicion <= 20 && q.ctr < 0.04) {
      const prioridad = q.impresiones >= 100 ? 'Alta' : 'Media';
      result.push({
        id: 'consulta:' + q.clave, clase: 'consulta', consulta: q.clave,
        prioridad, tipo: 'Consulta orgánica', titulo: 'Revisar: ' + q.clave,
        metricas: { clicks: q.clicks, impresiones: q.impresiones, ctr: q.ctr, posicion: q.posicion },
        detalle: 'Se muestra por tener al menos 30 impresiones, posición media entre 4 y 20 y CTR inferior al 4%.',
        porQue: 'Es una señal de oportunidad, no evidencia suficiente para cambiar el título. Primero se identifica la página real que posiciona y se contrasta su contenido con la intención de búsqueda.',
        fuente: 'Google Search Console', reglas: 'Impresiones ≥ 30 · Posición 4-20 · CTR < 4%',
      });
    }
  }
  for (const [i, item] of (audit?.problemas || []).entries()) {
    result.push({
      id: 'tecnico:' + (audit?.url || '') + ':' + item.texto, clase: 'tecnico',
      prioridad: item.nivel === 'alto' ? 'Alta' : 'Media',
      tipo: 'Auditoría técnica', titulo: item.texto,
      detalle: 'Comprobación directa del HTML y archivos de ' + (audit?.url || 'www.coproactiva.cl'),
      fuente: 'Auditoría del sitio', ruta: new URL(audit.url).pathname,
      porQue: 'El analizador detectó un posible problema técnico. Comprueba la página antes de publicar cambios.',
    });
  }
  const organic = analytics?.canales?.find(c => c.clave?.toLowerCase() === 'organic search');
  if (analytics?.disponible && !organic?.valores?.[0]) {
    result.push({
      id: 'ga4:organico', clase: 'analytics', prioridad: 'Media', tipo: 'Analítica',
      titulo: 'Revisar el canal Organic Search en Analytics',
      detalle: 'GA4 reporta cero sesiones atribuidas al canal orgánico en el período.',
      porQue: 'Puede deberse a ausencia de visitas, etiquetado, consentimiento o configuración. No presupone una falla de medición.',
      fuente: 'Google Analytics 4',
    });
  }
  if (!result.length && !search?.disponible && !audit) {
    result.push({
      id: 'conexiones', clase: 'conexiones', prioridad: 'Pendiente', tipo: 'Fuentes',
      titulo: 'Conectar Google y ejecutar auditoría',
      detalle: 'Aún no existen datos suficientes para priorizar mejoras con evidencia.',
      fuente: 'Estado de las conexiones',
    });
  }
  const order = { Alta: 0, Media: 1, Pendiente: 2 };
  return result.sort((a,b) => order[a.prioridad] - order[b.prioridad] ||
    (Number(b.metricas?.impresiones || 0) - Number(a.metricas?.impresiones || 0))).slice(0, 30);
}
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();

function propuestaDescription(consulta, actual) {
  const q = norm(consulta);
  if (/auditor/.test(q)) {
    return 'Auditoría de condominios en Santiago: revisa cuentas, respaldos, mantenciones y obligaciones de tu comunidad con Coproactiva. Solicita información.';
  }
  if (/primera administracion/.test(q)) {
    return 'Primera administración de condominios: organización inicial, mantenciones y seguimiento para la comunidad en Santiago. Conoce los servicios de Coproactiva.';
  }
  if (/administrad|condominio|edificio/.test(q)) {
    return 'Administración de edificios y condominios en Santiago con cuentas claras, mantenciones y seguimiento para la comunidad. Conoce Coproactiva y solicita una propuesta.';
  }
  return actual;
}
function tituloSugerido(consulta, actual) {
  const q = norm(consulta);
  if (q.startsWith('listado ') || q.includes('registro de administradores')) return actual;
  if (norm(actual).includes(q)) return actual;
  if (q.includes('administracion de edificios')) return 'Administración de Edificios en Santiago | Coproactiva';
  if (q.includes('administrador de condominios')) return 'Administrador de Condominios en Santiago | Coproactiva';
  return actual;
}
export function propuestaEditorial(consulta, auditoria) {
  if (!auditoria || auditoria.status !== 200) {
    return { error: 'No se puede proponer un cambio sin comprobar el HTML real de la página (HTTP 200).' };
  }
  const actualTitulo = auditoria.titulo || '';
  const actualDescription = auditoria.description || '';
  const q = norm(consulta);
  const informativa = /^listado\b|registro de administradores|ranking\b|directorio\b/.test(q);
  if (informativa) {
    return {
      requiereValidacion: true, diagnostico: 'Intención de búsqueda posiblemente informativa o comparativa.',
      motivo: 'La persona busca un listado o directorio. Convertir la página comercial de Coproactiva en un supuesto listado podría no satisfacer esa intención. Primero evalúa una guía específica y evita prometer un directorio inexistente.',
      titulo: { actual: actualTitulo, propuesto: actualTitulo, cambiar: false },
      description: { actual: actualDescription, propuesto: actualDescription, cambiar: false },
      h1: { actual: auditoria.h1s?.[0] || '', propuesto: auditoria.h1s?.[0] || '', cambiar: false },
    };
  }
  const propuestoTitulo = tituloSugerido(consulta, actualTitulo);
  const propuestaMeta = propuestaDescription(consulta, actualDescription);
  const similar = norm(actualTitulo).includes(q);
  return {
    requiereValidacion: true,
    diagnostico: similar
      ? 'El título actual ya incluye la consulta: no conviene cambiarlo automáticamente.'
      : 'El título actual no incluye la consulta exacta. Confirmar que la página es la URL adecuada antes de editarlo.',
    motivo: 'La revisión combina una señal de Search Console con el texto extraído de la página real. La redacción busca aclarar el servicio y presentar una llamada a la acción. Una mejora de CTR no está garantizada; mide el resultado después de publicar.',
    titulo: { actual: actualTitulo, propuesto: propuestoTitulo, cambiar: propuestoTitulo !== actualTitulo },
    description: { actual: actualDescription, propuesto: propuestaMeta, cambiar: propuestaMeta !== actualDescription },
    h1: { actual: auditoria.h1s?.[0] || '', propuesto: auditoria.h1s?.[0] || '', cambiar: false }
  };
}

/**
 * Las consultas comerciales requieren diagnóstico editorial; las alertas de
 * HTML y GA4 tienen pantallas propias. Nunca enviar un hallazgo técnico a la
 * primera propuesta editorial por no tener consulta asociada.
 */
export function destinoOportunidadSEO(item) {
  switch (item?.clase) {
    case 'tecnico': return 'tecnico';
    case 'analytics': return 'analytics';
    case 'conexiones': return 'conexiones';
    case 'velocidad': return 'velocidad';
    case 'consulta': return 'oportunidades';
    default: return 'tecnico';
  }
}

/** Selecciona páginas reales presentes en Search Console para ampliar la auditoría.
 * No inventa páginas: utiliza URLs observadas del dominio público.
 */
export function rutasParaAuditoriaSEO(search, rutasRevisadas = [], limite = 5) {
  if (!search?.disponible) return [];
  const revisadas = new Set(['/', ...rutasRevisadas]);
  const encontradas = [];
  for (const pagina of search.paginas || []) {
    let url;
    try { url = new URL(pagina.clave); } catch { continue; }
    if (!['www.coproactiva.cl','coproactiva.cl'].includes(url.hostname) ||
      url.protocol !== 'https:') continue;
    const ruta = url.pathname;
    if (!/^\/[a-zA-Z0-9/_.-]*$/.test(ruta) ||
      ruta.includes('..') || ruta.includes('//') ||
      revisadas.has(ruta)) continue;
    revisadas.add(ruta);
    encontradas.push(ruta);
    if (encontradas.length >= Math.max(1, Math.min(8, limite))) break;
  }
  return encontradas;
}
