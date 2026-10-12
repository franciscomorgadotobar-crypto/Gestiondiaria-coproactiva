/**
 * Flujo SEO: diagnóstico aprobado -> PR privada de revisión -> confirmación final -> merge.
 * NO publica al aprobar. Con token GitHub ausente conserva aprobación pendiente de preparación.
 * Requiere secret COPROACTIVA_GITHUB_TOKEN (fine-grained: Contents R/W y Pull Requests R/W).
 * GitHub repo fijo por seguridad. verify_jwt=true, permisos en public.perfiles y RLS de tabla.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OWNER = 'franciscomorgadotobar-crypto';
const REPO = 'web-coproactiva';
const DEFAULT_BRANCH = 'main';
const GITHUB_API = '/repos/' + OWNER + '/' + REPO;
const gitToken = Deno.env.get('COPROACTIVA_GITHUB_TOKEN') || '';
const SITE = 'https://www.coproactiva.cl';
const NETLIFY_TOKEN = Deno.env.get('NETLIFY_ACCESS_TOKEN') || '';
const NETLIFY_SITE_ID = Deno.env.get('NETLIFY_SITE_ID') || 'www.coproactiva.cl';

const json = (x: unknown, status=200) => Response.json(x,{status});
const mensaje = (s:string,status=400) => json({error:s},status);
const safePath = (s:unknown) => typeof s === 'string' && /^\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]*$/i.test(s) &&
  s.length <= 180 && !s.includes('..') && !s.includes('//');
const clean = (s:unknown,max=300) => typeof s === 'string' && s.trim().length > 0 &&
  s.length <= max && !/[\u0000-\u001f]/.test(s);
const validNumber = (value:unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const rutaArchivo = (ruta:string) => {
  if(!safePath(ruta) || ruta.includes('.html') && !ruta.startsWith('/blog')) throw Error('URL de Coproactiva no admitida.');
  // En el sitio estático se permiten portada, servicios y blog. No editar recursos de terceros.
  if(ruta === '/') return 'index.html';
  if(!/^\/(?:servicios\/[a-z0-9-]+\/|blog\/|blog-[a-z0-9-]+\.html|administracion-condominios-san-bernardo\/|diagnostico-condominio\/)$/i.test(ruta))
    throw Error('La página no pertenece al conjunto editable del sitio.');
  if(ruta.endsWith('.html')) return ruta.slice(1);
  return ruta.slice(1)+'index.html';
};
function githubPath(path:string) {
  return path.split('/').map(encodeURIComponent).join('/');
}
async function gh(path:string, method='GET', body:unknown=undefined) {
  if(!gitToken) throw Error('Falta habilitar la integración de publicación GitHub. Configura COPROACTIVA_GITHUB_TOKEN en Supabase.');
  const response=await fetch('https://api.github.com'+path,{
    method,headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+gitToken,
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body === undefined ? {} : {'Content-Type':'application/json'})
    },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    signal: AbortSignal.timeout(22000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error('GitHub ('+response.status+'): '+String(data?.message||'Respuesta no válida').slice(0,140));
  return data;
}
function base64FromUtf8(value:string) {
  const bytes = new TextEncoder().encode(value);
  let raw = '';
  for(let i=0;i<bytes.length;i+=8192)
    raw+=String.fromCharCode(...bytes.slice(i,i+8192));
  return btoa(raw);
}
function utf8FromBase64(value:string) {
  const bytes=Uint8Array.from(atob(value.replace(/\s+/g,'')),c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
const unescapeHtml=(s:string)=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const escapeHtml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function metaDescription(html:string) {
  const found=(html.match(/<meta\b[^>]*>/gi)||[]).find(x=>/\bname\s*=\s*(['"])description\1/i.test(x));
  if(!found)throw Error('El archivo no contiene meta description editable.');
  const match=found.match(/\bcontent\s*=\s*(['"])([\s\S]*?)\1/i);
  if(!match)throw Error('Falta el atributo content de meta description.');
  return {tag:found, actual:unescapeHtml(match[2])};
}
function tituloHtml(html:string) {
  const match=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if(!match)throw Error('La página no contiene etiqueta title.');
  return {full:match[0],actual:unescapeHtml(match[1].trim())};
}
function revisarArchivo(html:string,p:any) {
  const original=tituloHtml(html), meta=metaDescription(html);
  const comprobar=(a:string,b:string)=>a.trim() === b.trim();
  if(!comprobar(original.actual,p.titulo_actual) || !comprobar(meta.actual,p.descripcion_actual))
    throw Error('El contenido de GitHub cambió desde el diagnóstico. Se requiere volver a comprobar la página.');
  if (p.titulo_propuesto.length > 80 || p.descripcion_propuesta.length > 200)
    throw Error('Los textos propuestos exceden el límite de seguridad para revisión.');
  const tituloNuevo=p.titulo_propuesto.trim(), descriptionNueva=p.descripcion_propuesta.trim();
  if(tituloNuevo===original.actual && descriptionNueva===meta.actual)
    throw Error('La propuesta no cambia el título ni la descripción del sitio.');
  let out=html.replace(original.full,original.full.replace(/(<title\b[^>]*>)[\s\S]*?(<\/title>)/i,
    '$1'+escapeHtml(tituloNuevo)+'$2'));
  const metadata=metaDescription(out);
  const changedTag=metadata.tag.replace(/(\bcontent\s*=\s*)(['"])([\s\S]*?)\2/i,
    (_m:string,prefix:string,quote:string)=>prefix+quote+escapeHtml(descriptionNueva)+quote);
  out=out.replace(metadata.tag,changedTag);
  return out;
}
/** La fusion de GitHub NO es publicación. Esta función verifica el HTML actual de hosting,
 * siempre desde origen fijo y sin cache. \`verificada_en\` registra primera comprobación,
 * no una fecha de despliegue supuesta. */
/** Netlify API en servidor. La instalación NO publica nada al consultar.
 * Netlify acepta ID de sitio o dominio verificado en /sites/{site_id}.
 */
async function obtenerEstadoNetlify(p:any) {
  if(!NETLIFY_TOKEN) return {conectado:false,
    motivo:'Falta configurar NETLIFY_ACCESS_TOKEN en Supabase. No se puede consultar el historial de despliegues.',
    consultadoEn:new Date().toISOString()};
  if(!/^[a-z0-9.-]{4,120}$/i.test(NETLIFY_SITE_ID))
    return {conectado:false,motivo:'NETLIFY_SITE_ID no tiene formato permitido.',
      consultadoEn:new Date().toISOString()};
  const base='https://api.netlify.com/api/v1/sites/'+encodeURIComponent(NETLIFY_SITE_ID);
  const headers={'Authorization':'Bearer '+NETLIFY_TOKEN,'Accept':'application/json'};
  try {
    const get=async(url:string) => {
      const response=await fetch(url,{headers,signal:AbortSignal.timeout(13000)});
      if(!response.ok)throw Error('Netlify API HTTP '+response.status+
        (response.status===401?' (token no autorizado)':response.status===404?' (sitio no encontrado)':''));
      return response.json();
    };
    const [site,deploys]=await Promise.all([
      get(base),
      get(base+'/deploys?production=true&per_page=8')
    ]);
    const production=Array.isArray(deploys)
      ? deploys.filter((d:any)=>!d.context||d.context==='production')
      : [];
    const ultimo=production[0]||null;
    const settings=site?.build_settings||{};
    const repoPath=String(settings.repo_path||settings.repo_url||site?.repo?.repo_path||'').slice(0,250);
    const repoCorrecto=repoPath?
      repoPath.toLowerCase().includes((OWNER+'/'+REPO).toLowerCase()):null;
    const branch=String(settings.repo_branch||site?.repo?.branch||'').slice(0,100);
    const ramaCorrecta=branch?branch===DEFAULT_BRANCH:null;
    const sha=String(ultimo?.commit_ref||'');
    const shaPropuesta=String(p.publicacion_sha||'');
    return {
      conectado:true, consultadoEn:new Date().toISOString(),
      sitio:String(site?.name||'').slice(0,120),
      dominio:String(site?.custom_domain||site?.url||'').slice(0,180),
      repo:repoPath, rama:branch, repoCorrecto,ramaCorrecta,
      deploy:{
        id:String(ultimo?.id||'').slice(0,100),
        estado:String(ultimo?.state||'sin registros').slice(0,80),
        contexto:String(ultimo?.context||'production').slice(0,60),
        sha:sha.slice(0,40),
        coincideMerge:sha && shaPropuesta?sha===shaPropuesta:null,
        iniciadoEn:ultimo?.created_at||null,
        publicadoEn:ultimo?.published_at||null,
        url:String(ultimo?.deploy_ssl_url||'').slice(0,250)
      },
      motivo:repoCorrecto===false?'Netlify está conectado a OTRO repositorio. Revisa su configuración de Git.':
        ramaCorrecta===false?'Netlify despliega otra rama, no main.':
        ultimo?.state==='error'?'Último despliegue falló en Netlify.':
        ultimo?.state!=='ready'?'Netlify aún no confirma un deploy listo.':
        sha && shaPropuesta && sha!==shaPropuesta?
        'La última versión Netlify tiene otro commit. El HTML público decidirá si contiene la mejora.':
        'Netlify respondió correctamente. Confirmar también contenido en el dominio público.'
    };
  } catch(err) {
    return {conectado:false,consultadoEn:new Date().toISOString(),
      motivo:err instanceof Error?err.message:'Error consultando Netlify.'};
  }
}

async function verificarPublicacion(admin:any,p:any) {
  if(!['integrada','publicada'].includes(p.estado))return {propuesta:p,comprobacion:null};
  const ruta=String(p.ruta||'/');
  const ahora=new Date().toISOString();
  try {
    if(!safePath(ruta)) throw Error('Ruta no permitida.');
    const url=SITE+ruta+(ruta.includes('?')?'&':'?')+'_seo_rev='+Date.now();
    const r=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},
      signal:AbortSignal.timeout(14000),redirect:'follow'});
    if(!['www.coproactiva.cl','coproactiva.cl'].includes(new URL(r.url).hostname))
      throw Error('La URL del hosting redirige a otro dominio.');
    if(!r.ok)throw Error('El hosting respondió HTTP '+r.status+'.');
    if(!(r.headers.get('content-type')||'').includes('text/html'))
      throw Error('El hosting no entregó HTML.');
    const html=(await r.text()).slice(0,500000);
    const title=tituloHtml(html).actual;
    const description=metaDescription(html).actual;
    const coinciden=title.trim()===String(p.titulo_propuesto||'').trim() &&
      description.trim()===String(p.descripcion_propuesta||'').trim();
    const detalle=coinciden
      ? 'Título SEO y meta descripción confirmados en la web pública (primera verificación).'
      : 'La web pública aún no coincide con la propuesta de GitHub. Verificar hosting y caché.';
    const netlify=await obtenerEstadoNetlify(p);
    const updates:any={ultima_verificacion_en:ahora,verificacion_detalle:detalle,
      netlify_detalle:netlify,netlify_consultado_en:netlify.consultadoEn,editada_en:ahora};
    if(coinciden&&p.estado==='integrada'){
      updates.estado='publicada';updates.verificada_en=ahora;
      updates.publicada_en=ahora; // momento de verificación: no implica hora exacta del despliegue.
    }
    const {data,error}=await admin.from('seo_propuestas').update(updates).eq('id',p.id)
      .eq('estado',p.estado).select('*').maybeSingle();
    if(error)throw Error('No fue posible actualizar la comprobación de publicación.');
    return {propuesta:data||p,comprobacion:{coinciden,title,description,fecha:ahora,detalle}};
  }catch(err){
    const detail='No se pudo comprobar el hosting: '+(err instanceof Error?err.message:'Error de red');
    const netlify=await obtenerEstadoNetlify(p);
    await admin.from('seo_propuestas').update({ultima_verificacion_en:ahora,
      verificacion_detalle:detail.slice(0,600),
      netlify_detalle:netlify,netlify_consultado_en:netlify.consultadoEn
    }).eq('id',p.id).eq('estado',p.estado);
    return {propuesta:{...p,ultima_verificacion_en:ahora,verificacion_detalle:detail,
      netlify_detalle:netlify,netlify_consultado_en:netlify.consultadoEn},
      comprobacion:{coinciden:false,error:detail}};
  }
}
async function sincronizarGitHub(admin:any,p:any) {
  if(!p.pr_numero||!gitToken||!['preparada','integrada'].includes(p.estado))return p;
  const pr=await gh(GITHUB_API+'/pulls/'+Number(p.pr_numero));
  if(pr.head?.ref!==p.rama_git || pr.base?.ref!==DEFAULT_BRANCH)
    throw Error('El PR no coincide con la rama registrada.');
  if(pr.merged_at && p.estado==='preparada') {
    const {data,error}=await admin.from('seo_propuestas').update({
      estado:'integrada',fusionada_en:pr.merged_at,publicacion_sha:pr.merge_commit_sha,
      verificacion_detalle:'PR fusionado en GitHub. Falta verificar publicación web.',editada_en:new Date().toISOString()
    }).eq('id',p.id).eq('estado','preparada').select('*').maybeSingle();
    if(error)throw Error('No se pudo sincronizar el merge de GitHub.');
    return data||p;
  }
  return p;
}


export default {
  fetch:withSupabase({auth:'user'},async(req,ctx)=>{
    if(req.method!=='POST') return mensaje('Utiliza POST.',405);
    try {
      const idUsuario=ctx.userClaims?.id;
      const {data:perfil,error:perfilError}=await ctx.supabase.from('perfiles').select('rol,activo')
        .eq('id',idUsuario||'').maybeSingle();
      if(perfilError || !perfil?.activo || !['admin','superadmin'].includes(perfil.rol))
        return mensaje('Solo administradores activos pueden acceder a propuestas SEO.',403);
      const admin=ctx.supabaseAdmin || (
        Deno.env.get('SUPABASE_URL') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
          ? createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
              auth:{persistSession:false,autoRefreshToken:false}
            })
          : null
      );
      if(!admin)return mensaje('No se pudo abrir el almacenamiento protegido de propuestas.',503);
      const body=await req.json().catch(()=>({}));
      const accion=String(body.accion||'');
      if(accion==='listar') {
        const {data,error}=await admin.from('seo_propuestas')
          .select('*').order('creada_en',{ascending:false}).limit(80);
        if(error)throw Error('No fue posible recuperar las propuestas.');
        // Reconciliación en cada apertura de la lista, sin publicar contenidos.
        const pendientes=(data||[]).filter((p:any)=>['integrada','preparada'].includes(p.estado)).slice(0,6);
        const resultados=await Promise.allSettled(pendientes.map(async(p:any)=>{
          let actual=p;
          if(gitToken&&p.pr_numero)actual=await sincronizarGitHub(admin,actual);
          if(actual.estado==='integrada')actual=(await verificarPublicacion(admin,actual)).propuesta;
          return actual;
        }));
        const cambios=new Map<string,any>();
        resultados.forEach((r,i)=>{if(r.status==='fulfilled')cambios.set(pendientes[i].id,r.value);});
        return json({propuestas:(data||[]).map((p:any)=>cambios.get(p.id)||p),
          integracionGithubHabilitada:Boolean(gitToken),
          integracionNetlifyHabilitada:Boolean(NETLIFY_TOKEN),
          puedePublicar:perfil.rol==='superadmin',
          ultimaSincronizacion:new Date().toISOString(),
          observaciones:resultados.filter(r=>r.status==='rejected').length
            ? 'Algunas verificaciones remotas no finalizaron. Puedes reintentarlas individualmente.':null});
      }
      if(accion==='registrar_decision') {
        const p=body.propuesta||{}, decision=String(body.decision||'');
        if(!['descartada','ajustes_solicitados'].includes(decision))
          return mensaje('Decisión no válida.');
        if(!safePath(p.ruta)||!clean(p.consulta_principal,140))
          return mensaje('Es necesario indicar una URL y consulta verificables.');
        const archivo=rutaArchivo(p.ruta);
        const {data,error}=await admin.from('seo_propuestas').insert({
          ruta:p.ruta,repo_ruta:archivo,consulta_principal:p.consulta_principal,
          consultas:Array.isArray(p.consultas)?p.consultas.slice(0,12):[p.consulta_principal],
          metricas:p.metricas||{},metricas_basales:p.metricas||{},
          titulo_actual:String(p.titulo_actual||'').slice(0,120),
          titulo_propuesto:String(p.titulo_propuesto||'').slice(0,120),
          descripcion_actual:String(p.descripcion_actual||'').slice(0,400),
          descripcion_propuesta:String(p.descripcion_propuesta||'').slice(0,400),
          h1_actual:String(p.h1_actual||'').slice(0,250),
          diagnostico:String(p.diagnostico||'').slice(0,1800),
          motivo:String(p.motivo||'').slice(0,1800),
          observaciones:String(body.observaciones||'').slice(0,1200),
          estado:decision,autor_id:idUsuario,revisor_id:idUsuario
        }).select('*').single();
        if(error)throw Error('No se pudo registrar la decisión.');
        return json({propuesta:data});
      }
      if(accion==='aprobar') {
        const p=body.propuesta||{};
        if(!safePath(p.ruta)) return mensaje('La ruta elegida no corresponde a una página válida.',400);
        const archivo=rutaArchivo(p.ruta);
        if(!clean(p.consulta_principal,140)||!clean(p.titulo_actual,120)||
           !clean(p.descripcion_actual,400)||!clean(p.titulo_propuesto,80)||
           !clean(p.descripcion_propuesta,200))
          return mensaje('Faltan campos originales o propuestos verificables.',400);
        if(p.titulo_actual===p.titulo_propuesto && p.descripcion_actual===p.descripcion_propuesta)
          return mensaje('Esta recomendación conserva los campos originales: no hay cambios que aprobar.',400);
        const {data:previos}=await admin.from('seo_propuestas').select('id,estado,pr_url')
          .eq('ruta',p.ruta).in('estado',['aprobada','preparada']).limit(1);
        if(previos?.length)
          return mensaje('Esta página ya tiene una propuesta pendiente de preparación o publicación. Revisa el historial.',409);
        const consultas=Array.isArray(p.consultas)?p.consultas
          .filter((q:any)=>typeof q==='string'&&q.length<=140).slice(0,12):[p.consulta_principal];
        const datos={
          ruta:p.ruta,consulta_principal:p.consulta_principal,consultas,
          titulo_actual:p.titulo_actual,descripcion_actual:p.descripcion_actual,
          titulo_propuesto:p.titulo_propuesto,descripcion_propuesta:p.descripcion_propuesta,
          h1_actual:typeof p.h1_actual==='string'?p.h1_actual.slice(0,250):'',
          diagnostico:typeof p.diagnostico==='string'?p.diagnostico.slice(0,1800):'',
          motivo:typeof p.motivo==='string'?p.motivo.slice(0,1800):'',
          metricas:p.metricas&&typeof p.metricas==='object'?p.metricas:{},
          metricas_basales:p.metricas&&typeof p.metricas==='object'?p.metricas:{},
          repo_ruta:archivo, estado:'aprobada',autor_id:idUsuario
        };
        const {data:creada,error}=await admin.from('seo_propuestas').insert(datos).select('*').single();
        if(error)throw Error('No se pudo registrar la aprobación SEO: '+error.message.slice(0,120));
        const resultado=await preparar(admin,creada);
        return json(resultado);
      }
      if(accion==='sincronizar') {
        const id=String(body.id||'');
        if(!/^[a-f0-9-]{36}$/i.test(id))return mensaje('Identificador inválido.',400);
        const {data:p,error}=await admin.from('seo_propuestas').select('*').eq('id',id).maybeSingle();
        if(error||!p)return mensaje('No se encontró la propuesta.',404);
        let actual=p;
        if(gitToken&&p.pr_numero)actual=await sincronizarGitHub(admin,actual);
        const result=await verificarPublicacion(admin,actual);
        return json({...result,propuesta:result.propuesta,integracionGithubHabilitada:Boolean(gitToken)});
      }
      if(accion==='reintentar_despliegue') {
        if(perfil.rol!=='superadmin')return mensaje('Solo superadministradores pueden ordenar un despliegue.',403);
        if(body.confirmacion!=='DESPLEGAR')return mensaje('Escribe DESPLEGAR para confirmar.',400);
        if(!NETLIFY_TOKEN)return mensaje('Netlify aún no está autorizado en Supabase.',409);
        const id=String(body.id||'');
        if(!/^[a-f0-9-]{36}$/i.test(id))return mensaje('ID de propuesta inválido.',400);
        const {data:p,error}=await admin.from('seo_propuestas').select('*').eq('id',id).maybeSingle();
        if(error||!p)return mensaje('Propuesta no encontrada.',404);
        if(p.estado!=='integrada'||!p.fusionada_en)
          return mensaje('Sólo se puede relanzar un despliegue de un PR ya fusionado y no confirmado en web.',409);
        const comprobada=await verificarPublicacion(admin,p);
        if(comprobada.propuesta.estado==='publicada')
          return json({propuesta:comprobada.propuesta,aviso:'El contenido ya está publicado. No se inició un despliegue.'});
        const info=comprobada.propuesta.netlify_detalle||{};
        if(!info.conectado||info.repoCorrecto!==true||info.ramaCorrecta!==true)
          return mensaje('Netlify no confirmó que este sitio esté conectado a web-coproactiva en main. Revisa la integración antes de desplegar.',409);
        const endpoint='https://api.netlify.com/api/v1/sites/'+encodeURIComponent(NETLIFY_SITE_ID)+'/builds';
        const response=await fetch(endpoint,{
          method:'POST',headers:{Authorization:'Bearer '+NETLIFY_TOKEN,
            Accept:'application/json','Content-Type':'application/json'},
          body:'{}',signal:AbortSignal.timeout(15000)
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw Error('Netlify no inició la compilación ('+response.status+').');
        await admin.from('seo_propuestas').update({
          verificacion_detalle:'Reconstrucción de producción solicitada a Netlify. Aún no confirmada en el dominio.',
          editada_en:new Date().toISOString()
        }).eq('id',id).eq('estado','integrada');
        return json({propuesta:{...comprobada.propuesta,
          verificacion_detalle:'Reconstrucción solicitada a Netlify; aún no publicada.'},
          buildId:String(result.id||'').slice(0,120),
          aviso:'Netlify recibió la solicitud de compilación. Verifica el deploy y el HTML antes de iniciar seguimiento.'});
      }
      if(accion==='preparar') {
        if(!clean(body.id,100))return mensaje('ID de propuesta requerido.');
        const {data:propuesta}=await admin.from('seo_propuestas').select('*')
          .eq('id',body.id).maybeSingle();
        if(!propuesta)return mensaje('Propuesta no encontrada.',404);
        if(!['aprobada','error_preparacion'].includes(propuesta.estado))
          return mensaje('La propuesta ya fue procesada.',409);
        return json(await preparar(admin,propuesta));
      }
      if(['solicitar_ajustes','descartar'].includes(accion)) {
        if(!clean(body.id,100)) return mensaje('ID requerido.');
        const {data:p}=await admin.from('seo_propuestas').select('*').eq('id',body.id).maybeSingle();
        if(!p)return mensaje('Propuesta no encontrada.',404);
        if(p.estado==='publicada')return mensaje('Una publicación ya realizada no puede descartarse.',409);
        if(p.estado==='preparada')return mensaje('La propuesta tiene un PR abierto: revisa y cierra el PR en GitHub antes de descartarla.',409);
        const nuevo=accion==='descartar'?'descartada':'ajustes_solicitados';
        const {data,error}=await admin.from('seo_propuestas').update({
          estado:nuevo,revisor_id:idUsuario,observaciones:String(body.observaciones||'').slice(0,1200),
          editada_en:new Date().toISOString()
        }).eq('id',p.id).eq('estado',p.estado).select('*').single();
        if(error)throw Error('No fue posible guardar la decisión.');
        return json({propuesta:data});
      }
      if(accion==='publicar') {
        if(perfil.rol!=='superadmin')return mensaje('Solo superadministradores pueden confirmar una publicación.',403);
        if(body.confirmacion!=='PUBLICAR')return mensaje('Debes confirmar expresamente la publicación.',400);
        const {data:p}=await admin.from('seo_propuestas').select('*')
          .eq('id',String(body.id||'')).maybeSingle();
        if(!p||p.estado!=='preparada'||!p.pr_numero||!p.rama_git)
          return mensaje('No existe una propuesta preparada para publicar.',409);
        const pr=await gh(GITHUB_API+'/pulls/'+p.pr_numero);
        if(pr.state!=='open'||pr.head?.ref!==p.rama_git||pr.base?.ref!==DEFAULT_BRANCH)
          return mensaje('La solicitud de GitHub no coincide o dejó de estar abierta.',409);
        if(pr.mergeable!==true||pr.draft)return mensaje('GitHub no permite integrar todavía este PR. Revisa sus validaciones.',409);
        const checks=await gh(GITHUB_API+'/commits/'+pr.head.sha+'/check-runs');
        if((checks.check_runs||[]).some((x:any)=>x.status!=='completed'||!['success','skipped','neutral'].includes(x.conclusion)))
          return mensaje('Hay verificaciones pendientes o fallidas en GitHub.',409);
        const merged=await gh(GITHUB_API+'/pulls/'+p.pr_numero+'/merge','PUT',{
          sha:pr.head.sha,merge_method:'merge',commit_title:'SEO: '+p.consulta_principal
        });
        if(!merged.merged)return mensaje('GitHub no confirmó la integración.',502);
        const {data,error}=await admin.from('seo_propuestas').update({
          estado:'integrada',publicacion_sha:String(merged.sha||''),
          revisor_id:idUsuario,fusionada_en:new Date().toISOString(),
          verificacion_detalle:'GitHub integrado. Esperando comprobar contenido servido por hosting.',
          editada_en:new Date().toISOString()
        }).eq('id',p.id).eq('estado','preparada').select('*').single();
        if(error) return json({integradaEnGitHub:true,
          advertencia:'Fusionada en GitHub, pero el registro interno requiere revisión. La web NO está verificada.'});
        return json({propuesta:data,integradaEnGitHub:true,
          aviso:'GitHub fusionó el cambio. Aún NO está confirmada la publicación web; se verificará el HTML antes de iniciar las mediciones.'});
      }
      return mensaje('Acción SEO no implementada.',400);
    }catch(err) {
      const e=err instanceof Error?err.message:'Error interno.';
      console.error('seo-propuestas',e);
      return mensaje(e.slice(0,260),502);
    }
  })
};

async function preparar(admin:any,p:any) {
  if(!gitToken)return {propuesta:p,preparacionPendiente:true,
    aviso:'Aprobación guardada. Falta configurar COPROACTIVA_GITHUB_TOKEN para generar la rama y el PR sin tocar la web pública.'};
  try {
    const archivo=rutaArchivo(p.ruta);
    const base=await gh(GITHUB_API+'/git/ref/heads/'+DEFAULT_BRANCH);
    const head=base.object?.sha;
    if(!head)throw Error('GitHub no devolvió la revisión actual de main.');
    const origen=await gh(GITHUB_API+'/contents/'+githubPath(archivo)+'?ref='+encodeURIComponent(DEFAULT_BRANCH));
    if(!origen.sha||origen.encoding!=='base64'||typeof origen.content!=='string')
      throw Error('No fue posible leer el archivo real del sitio.');
    const original=utf8FromBase64(origen.content);
    const nuevo=revisarArchivo(original,p);
    const rama='seo/propuesta-'+p.id.slice(0,12);
    await gh(GITHUB_API+'/git/refs','POST',{ref:'refs/heads/'+rama,sha:head});
    await gh(GITHUB_API+'/contents/'+githubPath(archivo),'PUT',{
      branch:rama,message:'SEO: preparar '+p.consulta_principal,
      sha:origen.sha,content:base64FromUtf8(nuevo)
    });
    const req=await gh(GITHUB_API+'/pulls','POST',{
      title:'SEO: mejorar '+p.consulta_principal,
      head:rama,base:DEFAULT_BRANCH,draft:false,
      body:'Propuesta preparada desde Coproactiva App Diaria. NO PUBLICAR sin confirmación final de superadministrador en Coproactiva.\n\nURL: '+SITE+p.ruta+
        '\nConsultas: '+(p.consultas||[]).join(', ')+
        '\n\nDiagnóstico: '+p.diagnostico+
        '\n\nCambio previsto: título HTML y meta description. No se modifican H1, diseño ni scripts.\n\nSe requiere revisar el diff, el contenido comercial, los tests y luego autorizar publicación.'
    });
    const {data,error}=await admin.from('seo_propuestas').update({
      estado:'preparada',rama_git:rama,pr_numero:req.number,pr_url:req.html_url,
      base_sha:head,repo_ruta:archivo,editada_en:new Date().toISOString()
    }).eq('id',p.id).in('estado',['aprobada','error_preparacion']).select('*').single();
    if(error)throw Error('PR creado, pero no se pudo registrar su preparación: '+req.html_url);
    return {propuesta:data,aviso:'Cambios preparados en un pull request sin integrar. El sitio público no ha sido modificado.'};
  }catch(error) {
    const info=error instanceof Error?error.message:'No se pudo crear la propuesta GitHub.';
    // Si se creó un PR pero no pudo registrarse, queda visible el error;
    // NO modificar estado publicada ni hacer merge desde aquí.
    await admin.from('seo_propuestas').update({
      estado:'error_preparacion',observaciones:info.slice(0,1200),editada_en:new Date().toISOString()
    }).eq('id',p.id).in('estado',['aprobada','error_preparacion']);
    return {propuesta:{...p,estado:'error_preparacion',observaciones:info},
      preparacionPendiente:true,aviso:'Aprobación registrada, pero la preparación no se completó: '+info};
  }
}
