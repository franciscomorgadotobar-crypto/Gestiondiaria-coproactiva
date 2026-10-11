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
const gbpLocation = Deno.env.get('GBP_LOCATION_ID') || '';
const gbpClientId = Deno.env.get('GBP_OAUTH_CLIENT_ID') || '';
const gbpClientSecret = Deno.env.get('GBP_OAUTH_CLIENT_SECRET') || '';
const gbpRefreshToken = Deno.env.get('GBP_OAUTH_REFRESH_TOKEN') || '';
let gbpCache: { token: string; until: number } | null = null;
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/tagmanager.readonly';
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
    query(['eventName'], ['eventCount', 'keyEvents'], 35)
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



/** GA4 Realtime Data API: lecturas verdaderamente recientes, hasta últimos 30 minutos. */
async function analyticsEnTiempoReal() {
  if (!gaProperty || !email || !privateKey) return {
    disponible: false, error: 'Autoriza la propiedad GA4 y las credenciales Google para consultar el tiempo real.'
  };
  try {
    const token = await googleToken();
    const endpoint = 'https://analyticsdata.googleapis.com/v1beta/properties/' + gaProperty + ':runRealtimeReport';
    const [summary, events] = await Promise.all([
      googlePost(endpoint, { metrics: [{name:'activeUsers'}, {name:'eventCount'}], minuteRanges: [{startMinutesAgo:29,endMinutesAgo:0}] }, token),
      googlePost(endpoint, { dimensions:[{name:'eventName'}], metrics:[{name:'eventCount'}],
        minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}], limit:30 }, token)
    ]);
    return {
      disponible:true, ventanaMinutos:30, consultadoEn:new Date().toISOString(),
      usuariosActivos: Number(summary.rows?.[0]?.metricValues?.[0]?.value || 0),
      eventos: Number(summary.rows?.[0]?.metricValues?.[1]?.value || 0),
      eventosPorNombre:(events.rows || []).map((row: any)=>({
        nombre: String(row.dimensionValues?.[0]?.value || ''),
        cantidad:Number(row.metricValues?.[0]?.value || 0)
      }))
    };
  } catch (error) {
    return { disponible:false, error: error instanceof Error ? error.message : 'GA4 tiempo real no disponible.' };
  }
}

/** Google Business Profile sólo admite OAuth autorizado por el propietario de la ficha.
 * No usar como sustituto un service account de GA4/Search Console. */
async function tokenPerfilGoogle() {
  if (!gbpClientId || !gbpClientSecret || !gbpRefreshToken || !gbpLocation)
    throw new Error('Falta autorizar Google Business Profile: OAuth y GBP_LOCATION_ID.');
  if (!/^(?:locations\/)?[0-9]+$/.test(gbpLocation)) throw new Error('GBP_LOCATION_ID no es un ID válido.');
  if (gbpCache && gbpCache.until > Date.now() + 120000) return gbpCache.token;
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({ client_id:gbpClientId, client_secret:gbpClientSecret,
      refresh_token:gbpRefreshToken, grant_type:'refresh_token' }),
    signal:AbortSignal.timeout(12000)
  });
  const json = await r.json().catch(()=>({}));
  if(!r.ok || !json.access_token) throw new Error('La autorización de Business Profile fue rechazada (' + r.status + '). Reautoriza el acceso OAuth.');
  gbpCache={token:json.access_token,until:Date.now()+(Number(json.expires_in)||3500)*1000};
  return json.access_token;
}
async function googleRead(url:string, token:string) {
  const response=await fetch(url,{
    headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)
  });
  if(!response.ok) {
    const content=await response.json().catch(()=>({}));
    const msg=String(content?.error?.message || response.statusText).slice(0,220);
    throw new Error('Google Business Profile API ('+response.status+'): '+msg);
  }
  return response.json();
}
async function perfilEmpresa(dias:number) {
  if(!gbpClientId || !gbpClientSecret || !gbpRefreshToken || !gbpLocation)
    return { disponible:false, error:'Google Business Profile no está autorizado. Configura OAuth de la cuenta propietaria y el ID de la ubicación.' };
  try {
    const token=await tokenPerfilGoogle();
    const location='locations/'+gbpLocation.replace(/^locations\//,'');
    const start=daysBefore(dias), end=daysBefore(1);
    const [yy,mm,dd]=start.split('-').map(Number),[y2,m2,d2]=end.split('-').map(Number);
    const params=new URLSearchParams();
    const METRICS=[
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'WEBSITE_CLICKS','CALL_CLICKS','BUSINESS_DIRECTION_REQUESTS'
    ];
    for(const metric of METRICS)params.append('dailyMetrics',metric);
    const setDate=(prefix:string,y:number,m:number,d:number)=>{
      params.set('dailyRange.'+prefix+'.year',String(y));
      params.set('dailyRange.'+prefix+'.month',String(m));
      params.set('dailyRange.'+prefix+'.day',String(d));
    };
    setDate('start_date',yy,mm,dd);setDate('end_date',y2,m2,d2);
    const base='https://businessprofileperformance.googleapis.com/v1/'+location;
    const monthParams=new URLSearchParams({
      'monthlyRange.start_month.year':String(yy),
      'monthlyRange.start_month.month':String(mm),
      'monthlyRange.end_month.year':String(y2),
      'monthlyRange.end_month.month':String(m2),
      pageSize:'100'
    });
    const [daily,keywords]=await Promise.allSettled([
      googleRead(base+':fetchMultiDailyMetricsTimeSeries?'+params,token),
      googleRead(base+'/searchkeywords/impressions/monthly?'+monthParams,token)
    ]);
    if(daily.status==='rejected')throw daily.reason;
    const byMetric:Record<string,{total:number;serie:Array<{fecha:string;valor:number}>}>={};
    for(const series of daily.value.multiDailyMetricTimeSeries||[]) {
      for(const metric of series.dailyMetricTimeSeries||[]) {
        const name=String(metric.dailyMetric || '');
        const serie=(metric.timeSeries?.datedValues || []).map((x:any)=>({
          fecha: [x.date?.year, String(x.date?.month || 1).padStart(2,'0'),String(x.date?.day || 1).padStart(2,'0')].join('-'),
          valor:Number(x.value || 0)
        }));
        byMetric[name]={total:serie.reduce((acc,row)=>acc+row.valor,0),serie};
      }
    }
    const suma=(...keys:string[])=>keys.reduce((total,key)=>total+(byMetric[key]?.total||0),0);
    return {
      disponible:true, consultadoEn:new Date().toISOString(), inicio:start, fin:end,
      ubicacion:location, metricas:byMetric,
      resumen:{
        impresionesBusqueda:suma('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH'),
        impresionesMaps:suma('BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS'),
        clicsWeb:suma('WEBSITE_CLICKS'),clicsTelefono:suma('CALL_CLICKS'),
        indicaciones:suma('BUSINESS_DIRECTION_REQUESTS')
      },
      palabras: keywords.status==='fulfilled'
        ? (keywords.value.searchKeywordsCounts||[]).map((p:any)=>({
            nombre:String(p.searchKeyword||''), impresiones: p.insightsValue?.value == null ? null : Number(p.insightsValue.value),
            umbral: p.insightsValue?.threshold == null ? null : Number(p.insightsValue.threshold)
          }))
        : [],
      errorPalabras:keywords.status==='rejected'?'Google no entregó palabras clave mensuales en esta consulta.':null,
      nota:'Lectura directa de Business Profile Performance API. Google procesa estas métricas por día y búsquedas por mes; no son eventos segundo a segundo.'
    };
  } catch(error) {
    return {disponible:false,error:error instanceof Error?error.message:'Sin acceso a Business Profile.'};
  }
}


/** Seguimiento verificable por URL, comparando ventanas iguales de Search Console.
 * Siempre usa datos finalizados de Google y nunca afirma comparativa si faltan días. */
async function seguimientoPorPagina(ruta:string, fechaPublicacion:string) {
  if(!email || !privateKey) return {disponible:false,error:'Search Console no está autorizado.'};
  const fecha=fechaPublicacion.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha+'T00:00:00Z')))
    throw Error('Fecha de publicación no válida.');
  const base=Date.parse(fecha+'T00:00:00Z');
  if(base > Date.now()+86400000 || base < Date.parse('2025-01-01T00:00:00Z'))
    throw Error('Fecha de publicación fuera del período admitido.');
  const iso=(ms:number) => new Date(ms).toISOString().slice(0,10);
  const token=await googleToken();
  const endpoint='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(gscSite)+'/searchAnalytics/query';
  const maxDate=daysBefore(3);
  const reporte=async(inicio:string,fin:string) => {
    if(fin<inicio)return {clicks:0,impresiones:0,ctr:0,posicion:0};
    const data=await googlePost(endpoint,{
      startDate:inicio,endDate:fin,dataState:'final',dimensions:[],rowLimit:1,
      dimensionFilterGroups:[{filters:[{
        dimension:'page',operator:'equals',expression:ORIGIN+ruta
      }]}]
    },token);
    const r=data.rows?.[0]||{};
    return {clicks:Number(r.clicks||0),impresiones:Number(r.impressions||0),
      ctr:Number(r.ctr||0),posicion:Number(r.position||0)};
  };
  const periodos=await Promise.all([7,28,90].map(async dias=>{
    const start=iso(base), finProgramado=iso(base+(dias-1)*86400000);
    const fin=finProgramado<maxDate?finProgramado:maxDate;
    const inicioPrevio=iso(base-dias*86400000),finPrevio=iso(base-86400000);
    const previo=await reporte(inicioPrevio,finPrevio);
    const posterior=await reporte(start,fin);
    const diasFinalizados=fin>=start?Math.min(dias,Math.round((Date.parse(fin+'T00:00:00Z')-base)/86400000)+1):0;
    const completo=diasFinalizados===dias;
    return {dias,completo,diasFinalizados,desde:inicioPrevio,hastaPrevio:finPrevio,
      inicioPosterior:start,finPosterior:fin>=start?fin:null,
      anterior:previo,posterior:posterior,
      cambioClics:completo && previo.clicks>0?100*(posterior.clicks-previo.clicks)/previo.clicks:null,
      cambioImpresiones:completo && previo.impresiones>0?
        100*(posterior.impresiones-previo.impresiones)/previo.impresiones:null
    };
  }));
  return {disponible:true,url:ORIGIN+ruta,publicadoEn:fecha,consultadoEn:new Date().toISOString(),
    periodos,nota:'Comparación URL por URL en Search Console, intervalos iguales antes y después de publicar. Los datos se finalizan con retraso. No prueba causalidad.'};
}

/* Opcional: leer la última versión PUBLICADA del contenedor mediante Tag Manager
 * API, una integración separada de la detección de su snippet público. */
async function versionPublicadaGtm() {
  if (gtmPath && !/^accounts\/\d+\/containers\/\d+$/.test(gtmPath))
    return { conectado: false, detalle: 'GTM_CONTAINER_PATH debe ser accounts/ID/containers/ID.' };
  if (!email || !privateKey) return { conectado: false, detalle: 'Faltan las credenciales Google de solo lectura.' };
  try {
    const token = await googleToken();
    let containerPath = gtmPath;
    if (!containerPath) {
      const lookup = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts/containers:lookup?tagId=GTM-MB2RCFR5', {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(12000)
      });
      if (!lookup.ok) return { conectado: false, detalle: 'La cuenta de servicio aún no tiene permiso de lectura del contenedor GTM-MB2RCFR5 (' + lookup.status + ').' };
      const found = await lookup.json();
      containerPath = String(found.path || '');
      if (!/^accounts\/\d+\/containers\/\d+$/.test(containerPath))
        return { conectado: false, detalle: 'Google no devolvió un contenedor GTM válido.' };
    }
    const r = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/' + containerPath + '/versions:live', {
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
        return Response.json({ site: ORIGIN, google: Boolean(email && privateKey),
          ga4: Boolean(gaProperty), gsc: Boolean(gscSite),
          pagespeed: true, gtmApiConfigurada: Boolean(email && privateKey),
          businessProfileConfigurado: Boolean(gbpClientId && gbpClientSecret && gbpRefreshToken && gbpLocation),
          consultadoEn: new Date().toISOString() });
      }
      const dias = [7, 28, 90].includes(Number(body.dias)) ? Number(body.dias) : 28;
      if (accion === 'resumen') return Response.json(await obtenerResumen(dias));
      if (accion === 'tag-manager') return Response.json(await auditoriaTagManager());
      if (accion === 'ga4-tiempo-real') return Response.json(await analyticsEnTiempoReal());
      if (accion === 'seguimiento-seo') {
        const ruta=rutaSegura(body.ruta || '/');
        const fecha=String(body.publicadaEn || '');
        if(!ruta || fecha.length>40)return fail('Ruta o fecha no válida.',400);
        return Response.json(await seguimientoPorPagina(ruta,fecha));
      }
      if (accion === 'business-profile') return Response.json(await perfilEmpresa(dias));
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
