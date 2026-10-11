/**
 * SEO CoproActiva. API privada para GA4, Search Console, SEO técnico y PageSpeed.
 * Mantener verify_jwt=true. Nunca exponer claves Google en VITE_* ni el navegador.
 *
 * Secretos opcionales:
 * GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 * GA4_PROPERTY_ID, GSC_SITE_URL (ej. sc-domain:coproactiva.cl),
 * PAGESPEED_API_KEY.
 */
import { withSupabase } from 'npm:@supabase/server@1';

const ORIGIN = 'https://www.coproactiva.cl';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const gtmPath = Deno.env.get('GTM_CONTAINER_PATH') || '';
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly' +
  (gtmPath ? ' https://www.googleapis.com/auth/tagmanager.readonly' : '');
const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') || '';
const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') || '';
const gaProperty = (Deno.env.get('GA4_PROPERTY_ID') || '').replace(/^properties\//, '');
const gscSite = Deno.env.get('GSC_SITE_URL') || 'sc-domain:coproactiva.cl';
let tokenCache: { token: string; until: number } | null = null;

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
function b64url(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function googleToken() {
  if (!email || !privateKey) throw new Error('Falta configurar la cuenta de servicio de Google.');
  if (tokenCache && tokenCache.until > Date.now() + 120000) return tokenCache.token;
  const pem = privateKey.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), 
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    b64url(JSON.stringify({ iss: email, scope: SCOPES, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3500 }));
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const assertion = unsigned + '.' + b64url(signature);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('No se pudo autenticar la cuenta Google (' + response.status + ').');
  tokenCache = { token: result.access_token, until: Date.now() + (Number(result.expires_in) || 3500) * 1000 };
  return result.access_token;
}
async function googlePost(url: string, body: unknown, token: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = String(data?.error?.message || response.statusText).slice(0, 240);
    throw new Error('Google API (' + response.status + '): ' + reason);
  }
  return response.json();
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function daysBefore(n: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return isoDate(d); }
const strRows = (report: any) => (report?.rows || []).map((r: any) => ({
  clave: r.keys?.[0] || '',
  clicks: Number(r.clicks || 0),
  impresiones: Number(r.impressions || 0),
  ctr: Number(r.ctr || 0),
  posicion: Number(r.position || 0)
}));
const gaRows = (report: any) => (report?.rows || []).map((r: any) => ({
  clave: r.dimensionValues?.[0]?.value || '',
  valores: (r.metricValues || []).map((m: any) => Number(m.value || 0))
}));
async function searchConsole(token: string, dias: number) {
  const end = daysBefore(3);
  const start = daysBefore(dias + 2);
  const previousEnd = daysBefore(dias + 3);
  const previousStart = daysBefore(dias * 2 + 2);
  const url = 'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(gscSite) + '/searchAnalytics/query';
  const query = (dimensions: string[], startDate = start, endDate = end, rowLimit = 100) =>
    googlePost(url, { startDate, endDate, dimensions, rowLimit, dataState: 'final' }, token);
  const [total, anterior, tendencia, consultas, paginas, dispositivos, paises] = await Promise.all([
    query([]), query([], previousStart, previousEnd), query(['date']), query(['query'], start, end, 100),
    query(['page'], start, end, 100), query(['device']), query(['country'])
  ]);
  const t = (total.rows || [])[0] || {};
  const p = (anterior.rows || [])[0] || {};
  const summary = (r: any) => ({
    clics: Number(r.clicks || 0), impresiones: Number(r.impressions || 0),
    ctr: Number(r.ctr || 0), posicion: Number(r.position || 0)
  });
  return {
    disponible: true, desde: start, hasta: end,
    totales: summary(t), anterior: summary(p),
    tendencia: strRows(tendencia),
    consultas: strRows(consultas), paginas: strRows(paginas),
    dispositivos: strRows(dispositivos), paises: strRows(paises),
    nota: 'Search Console entrega principales resultados; los totales pueden ser mayores que la suma de filas.'
  };
}
async function analytics(token: string, dias: number) {
  if (!gaProperty) throw new Error('Falta GA4_PROPERTY_ID.');
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + gaProperty + ':runReport';
  const rango = [{ startDate: String(dias) + 'daysAgo', endDate: 'yesterday' }];
  const metrics = (names: string[]) => names.map(name => ({ name }));
  const dimensions = (names: string[]) => names.map(name => ({ name }));
  const query = (d: string[], m: string[], limit = 100) =>
    googlePost(url, { dateRanges: rango, dimensions: dimensions(d), metrics: metrics(m), limit }, token);
  const [totales, tendencias, canales, paginas, eventos] = await Promise.all([
    query([], ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate', 'keyEvents']),
    query(['date'], ['sessions', 'totalUsers'], 100),
    query(['sessionDefaultChannelGroup'], ['sessions', 'totalUsers'], 20),
    query(['pagePath'], ['screenPageViews', 'totalUsers'], 75),
    query(['eventName'], ['eventCount'], 35)
  ]);
  const m = (totales.rows || [])[0]?.metricValues || [];
  return {
    disponible: true,
    totales: {
      usuarios: Number(m[0]?.value || 0), sesiones: Number(m[1]?.value || 0),
      vistas: Number(m[2]?.value || 0), engagement: Number(m[3]?.value || 0),
      eventosClave: Number(m[4]?.value || 0)
    },
    tendencia: gaRows(tendencias),
    canales: gaRows(canales), paginas: gaRows(paginas), eventos: gaRows(eventos)
  };
}
async function obtenerResumen(dias: number) {
  const googleConfigurado = Boolean(email && privateKey);
  if (!googleConfigurado) return {
    searchConsole: { disponible: false, error: 'Conecta la cuenta de servicio Google.' },
    analytics: { disponible: false, error: 'Conecta la cuenta de servicio Google.' }
  };
  const token = await googleToken();
  const [sc, ga] = await Promise.allSettled([
    searchConsole(token, dias),
    gaProperty ? analytics(token, dias) : Promise.reject(new Error('Configura GA4_PROPERTY_ID.'))
  ]);
  return {
    searchConsole: sc.status === 'fulfilled' ? sc.value : { disponible: false, error: sc.reason?.message || 'Sin acceso a Search Console.' },
    analytics: ga.status === 'fulfilled' ? ga.value : { disponible: false, error: ga.reason?.message || 'Sin acceso a Analytics.' }
  };
}
function rutaSegura(ruta: unknown) {
  if (typeof ruta !== 'string' || ruta.length > 200 || !/^\/[a-zA-Z0-9/_.-]*$/.test(ruta) ||
      ruta.includes('..') || ruta.includes('//')) return null;
  return ruta;
}
async function siteFetch(ruta: string) {
  const r = await fetch(ORIGIN + ruta, {
    headers: { 'User-Agent': 'CoproactivaSEOAudit/1.0' },
    redirect: 'manual', signal: AbortSignal.timeout(12000)
  });
  const tipo = r.headers.get('content-type') || '';
  return { status: r.status, tipo, content: (await r.text()).slice(0, 300000) };
}
function attr(tag: string, name: string) {
  const pattern = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\\x27])([^]*?)\\1', 'i');
  return (tag.match(pattern) || [])[2] || '';
}
function firstMeta(html: string, key: string, value: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return attr(tags.find(t => attr(t, key).toLowerCase() === value) || '', 'content');
}
function firstLink(html: string, rel: string) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  return attr(tags.find(t => attr(t, 'rel').toLowerCase().split(/\s+/).includes(rel)) || '', 'href');
}
function cleanText(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
async function auditoriaTecnica(ruta: string) {
  const [pagina, robots, sitemap] = await Promise.all([
    siteFetch(ruta), siteFetch('/robots.txt'), siteFetch('/sitemap.xml')
  ]);
  const html = pagina.tipo.includes('text/html') ? pagina.content : '';
  const titulo = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => cleanText(m[1])).slice(0, 8);
  const canonical = firstLink(html, 'canonical');
  const description = firstMeta(html, 'name', 'description');
  const robotsMeta = firstMeta(html, 'name', 'robots');
  const og = firstMeta(html, 'property', 'og:title');
  const enlaces = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const itemsSitemap = [...sitemap.content.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map(m => m[1].replace(/&amp;/g, '&')).filter(url => url.startsWith(ORIGIN)).slice(0, 150);
  const url = ORIGIN + ruta;
  const problemas: { nivel: string; texto: string }[] = [];
  if (pagina.status !== 200) problemas.push({ nivel: 'alto', texto: 'La URL devuelve HTTP ' + pagina.status + '.' });
  if (!titulo) problemas.push({ nivel: 'alto', texto: 'Falta el título SEO.' });
  if (titulo.length > 65) problemas.push({ nivel: 'medio', texto: 'Título extenso (' + titulo.length + ' caracteres).' });
  if (!description) problemas.push({ nivel: 'medio', texto: 'Falta meta description.' });
  if (h1s.length !== 1) problemas.push({ nivel: 'medio', texto: 'Se detectaron ' + h1s.length + ' encabezados H1.' });
  if (!canonical) problemas.push({ nivel: 'alto', texto: 'Falta canonical.' });
  if (canonical && canonical !== url && !(ruta === '/' && canonical === ORIGIN + '/'))
    problemas.push({ nivel: 'medio', texto: 'Canonical apunta a otra URL: revisa si es intencional.' });
  if (/\bnoindex\b/i.test(robotsMeta)) problemas.push({ nivel: 'alto', texto: 'La página incluye noindex.' });
  if (sitemap.status !== 200) problemas.push({ nivel: 'medio', texto: 'Sitemap no responde HTTP 200.' });
  if (robots.status !== 200) problemas.push({ nivel: 'medio', texto: 'robots.txt no responde HTTP 200.' });
  if (itemsSitemap.length > 0 && !itemsSitemap.includes(url))
    problemas.push({ nivel: 'bajo', texto: 'Esta URL no aparece en el sitemap (verifica variantes canónicas).' });
  return {
    url, status: pagina.status, titulo, description, canonical, robotsMeta, og,
    h1s, enlaces: enlaces.length, jsonLd: (html.match(/<script\b[^>]*type=["']application\/ld\+json["']/gi) || []).length,
    sitemap: { status: sitemap.status, urls: itemsSitemap },
    robots: { status: robots.status, sitemapDeclarado: /sitemap\s*:/i.test(robots.content) },
    problemas, fecha: new Date().toISOString()
  };
}
async function inspeccionar(urlPath: string) {
  if (!email || !privateKey) throw new Error('Configura la cuenta Google para inspeccionar la indexación.');
  const token = await googleToken();
  const data = await googlePost('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    inspectionUrl: ORIGIN + urlPath, siteUrl: gscSite, languageCode: 'es'
  }, token);
  const r = data.inspectionResult || {};
  return { url: ORIGIN + urlPath, indexacion: r.indexStatusResult || null,
    experiencia: r.mobileUsabilityResult || null,
    resultadosEnriquecidos: r.richResultsResult || null,
    enlace: r.inspectionResultLink || '' };
}
async function pagespeed(ruta: string, device: string) {
  const params = new URLSearchParams({ url: ORIGIN + ruta, strategy: device, locale: 'es' });
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach(c => params.append('category', c));
  const key = Deno.env.get('PAGESPEED_API_KEY');
  if (key) params.set('key', key);
  const response = await fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + params.toString(), {
    signal: AbortSignal.timeout(40000)
  });
  if (!response.ok) throw new Error('PageSpeed no respondió (' + response.status + '). Revisa su cuota y configuración.');
  const result = await response.json();
  const lighthouse = result.lighthouseResult || {};
  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};
  const score = (key: string) => Math.round(Number(categories[key]?.score || 0) * 100);
  const suggestions = Object.values(audits as Record<string, any>)
    .filter((x: any) => x.details?.type === 'opportunity' && Number(x.numericValue || 0) > 0)
    .sort((a: any, b: any) => Number(b.numericValue || 0) - Number(a.numericValue || 0))
    .slice(0, 8).map((x: any) => ({ titulo: x.title, ahorroMs: Math.round(x.numericValue || 0) }));
  return { dispositivo: device, url: ORIGIN + ruta, fecha: result.analysisUTCTimestamp,
    puntajes: { rendimiento: score('performance'), seo: score('seo'),
      accesibilidad: score('accessibility'), buenasPracticas: score('best-practices') },
    lcp: audits['largest-contentful-paint']?.displayValue || '—',
    cls: audits['cumulative-layout-shift']?.displayValue || '—',
    inp: result.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    fcp: audits['first-contentful-paint']?.displayValue || '—',
    sugerencias: suggestions
  };
}


/* Opcional: leer la última versión PUBLICADA del contenedor mediante Tag Manager
 * API, una integración separada de la detección de su snippet público. */
async function versionPublicadaGtm() {
  if (!gtmPath) return { conectado: false, detalle: 'Configura GTM_CONTAINER_PATH para validar etiquetas publicadas mediante Tag Manager API.' };
  if (!/^accounts\/\d+\/containers\/\d+$/.test(gtmPath))
    return { conectado: false, detalle: 'GTM_CONTAINER_PATH debe ser accounts/ID/containers/ID.' };
  if (!email || !privateKey) return { conectado: false, detalle: 'Faltan las credenciales Google de solo lectura.' };
  try {
    const token = await googleToken();
    const r = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/' + gtmPath + '/versions:live', {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) return { conectado: false, detalle: 'Tag Manager API respondió ' + r.status + '. Revisa acceso al contenedor.' };
    const data = await r.json();
    return {
      conectado: true,
      versionPublicada: String(data.containerVersionId || 'Sin versión'),
      nombreVersion: String(data.name || 'Sin nombre').slice(0, 100),
      cantidadEtiquetas: (data.tag || []).length,
      cantidadActivadores: (data.trigger || []).length,
      etiquetas: (data.tag || []).map((x: any) => ({
        nombre: String(x.name || 'Sin nombre').slice(0, 100),
        tipo: String(x.type || '').slice(0, 30)
      })).slice(0, 70),
      nota: 'Información de la versión publicada. No confirma disparos ni recepción real de cada etiqueta.'
    };
  } catch {
    return { conectado: false, detalle: 'No fue posible consultar el contenedor publicado con la cuenta autorizada.' };
  }
}
/* Señales técnicas visibles del sitio, no confundir con etiquetas publicadas o
 * eventos recibidos por Google Analytics (requieren Preview / DebugView). */
async function auditoriaTagManager() {
  const [home, js, formularios, version] = await Promise.all([
    siteFetch('/'), siteFetch('/assets/site-common.20260831.js'), siteFetch('/assets/lead-form.js'),
    versionPublicadaGtm()
  ]);
  const html = home.tipo.includes('text/html') ? home.content : '';
  const ids = [...new Set([...html.matchAll(/\bGTM-[A-Z0-9]{5,}\b/g)].map(x => x[0]))];
  const jsContent = js.status === 200 ? js.content : '';
  const formContent = formularios.status === 200 ? formularios.content : '';
  return {
    fecha: new Date().toISOString(),
    version, sitioHttp: home.status, codigoGtm: ids.length > 0, contenedores: ids,
    dataLayer: /(?:window\.)?dataLayer/.test(html + jsContent),
    consentimiento: /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(html),
    eventoLeadEnCodigo: /generate_lead/.test(jsContent) && /coproactivaTrackLead/.test(formContent),
    eventoLeadRecibidoEnGA4: null,
    notas: [
      'Código instalado no significa que las etiquetas estén publicadas ni disparen correctamente.',
      'Confirma el contenedor en Tag Assistant Preview y el evento generate_lead en GA4 DebugView.'
    ]
  };
}
async function paginasDeConsulta(consulta: string, dias: number) {
  if (!consulta || consulta.length > 150) throw new Error('Consulta no válida.');
  if (!email || !privateKey) throw new Error('La cuenta Google no está configurada.');
  const token = await googleToken();
  const siteUrl = 'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(gscSite) + '/searchAnalytics/query';
  const r = await googlePost(siteUrl, {
    startDate: daysBefore(dias + 2), endDate: daysBefore(3),
    dimensions: ['page'], rowLimit: 25, dataState: 'final',
    dimensionFilterGroups: [{ filters: [{
      dimension: 'query', operator: 'equals', expression: consulta
    }] }]
  }, token);
  const paginas = (r.rows || []).map((x: any) => {
    try {
      const u = new URL(String(x.keys?.[0] || ''));
      if (!['www.coproactiva.cl', 'coproactiva.cl'].includes(u.hostname) ||
          u.protocol !== 'https:') return null;
      const ruta = rutaSegura(u.pathname);
      if (!ruta) return null;
      return {
        ruta, url: ORIGIN + ruta,
        clics: Number(x.clicks || 0), impresiones: Number(x.impressions || 0),
        ctr: Number(x.ctr || 0), posicion: Number(x.position || 0)
      };
    } catch { return null; }
  }).filter(Boolean);
  return {
    consulta, paginas,
    explicacion: paginas.length
      ? 'Páginas asociadas a esta consulta según Search Console, ordenadas según la respuesta de Google.'
      : 'Search Console no entregó páginas para esta consulta. Elige una página del sitio y valida su pertinencia antes de redactar cambios.'
  };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method !== 'POST') return fail('Usa POST.', 405);
      const { data: perfil, error } = await ctx.supabase.from('perfiles')
        .select('rol,activo').eq('id', ctx.userClaims?.id || '').maybeSingle();
      if (error || !perfil?.activo || !['admin', 'superadmin'].includes(perfil.rol))
        return fail('Acceso reservado a administradores.', 403);
      const body = await req.json().catch(() => ({}));
      const accion = body.accion;
      if (accion === 'estado') {
        const { data, error: metricsError } = await (ctx.supabaseAdmin || ctx.supabase)
          .from('jarvis_metricas_web').select('fuente,metrica,periodo_inicio,periodo_fin,valor,valor_texto')
          .order('periodo_fin', { ascending: false }).limit(60);
        return Response.json({ site: ORIGIN, google: Boolean(email && privateKey),
          ga4: Boolean(gaProperty), gsc: Boolean(gscSite),
          pagespeed: true, historico: metricsError ? [] : data || [] });
      }
      const dias = [7, 28, 90].includes(Number(body.dias)) ? Number(body.dias) : 28;
      if (accion === 'resumen') return Response.json(await obtenerResumen(dias));
      if (accion === 'tag-manager') return Response.json(await auditoriaTagManager());
      if (accion === 'consulta-paginas') {
        const consulta = String(body.consulta || '').trim();
        if (!consulta || consulta.length > 150) return fail('Consulta no válida.', 400);
        return Response.json(await paginasDeConsulta(consulta, dias));
      }
      const ruta = rutaSegura(body.ruta || '/');
      if (!ruta) return fail('Selecciona una ruta válida del sitio.', 400);
      if (accion === 'auditoria') return Response.json(await auditoriaTecnica(ruta));
      if (accion === 'indexacion') return Response.json(await inspeccionar(ruta));
      if (accion === 'velocidad') {
        const device = body.dispositivo === 'desktop' ? 'desktop' : 'mobile';
        return Response.json(await pagespeed(ruta, device));
      }
      return fail('Acción desconocida.');
    } catch (err) {
      console.error('seo-analitica:', err instanceof Error ? err.message : 'error');
      return fail(err instanceof Error ? err.message : 'Error procesando solicitud.', 502);
    }
  })
};
