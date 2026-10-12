/**
 * Nombre de una mejora SEO basado en qué campos cambiaron y qué página afectó.
 * La consulta principal de Search Console NO es el nombre de la acción realizada.
 * Se calcula en la interfaz a partir del registro ya persistido (sin migraciones).
 */
const frase = valor => typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : null;

const humanizar = slug => {
  let visible=String(slug || '');
  try { visible=decodeURIComponent(visible); } catch { /* rutas legadas */ }
  const limpio=visible.replace(/\.html?$/i,'')
    .replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('es-CL');
  return limpio ? limpio[0].toLocaleUpperCase('es-CL')+limpio.slice(1) : '';
};

export function ubicacionMejoraSEO(ruta) {
  if(!ruta || ruta==='/' || ruta==='/index.html')return 'Portada';
  const sinQuery=String(ruta).split(/[?#]/)[0];
  const segmentos=sinQuery.split('/').filter(Boolean);
  const ultimo=segmentos.at(-1)||'';
  const titulo=humanizar(ultimo);
  const primera=segmentos[0]?.toLowerCase()||'';

  if(primera==='blog')return segmentos.length===1?'Blog':`Artículo (${titulo})`;
  if(primera==='servicios'||primera==='servicio')
    return segmentos.length===1?'Servicios':`Servicio (${titulo})`;
  if(primera==='propiedades'||primera==='propiedad')
    return segmentos.length===1?'Propiedades':`Propiedad (${titulo})`;
  if(primera==='contacto')return 'Contacto';
  if(primera==='nosotros'||primera==='quienes-somos')return 'Nosotros';
  if(titulo.toLowerCase()==='index')return humanizar(segmentos.at(-2)||'pagina');
  return titulo||'Página';
}

export function nombreMejoraSEO(propuesta) {
  if(!propuesta)return 'Mejora SEO';
  const tituloAntes=frase(propuesta.titulo_actual);
  const tituloDespues=frase(propuesta.titulo_propuesto);
  const descripcionAntes=frase(propuesta.descripcion_actual);
  const descripcionDespues=frase(propuesta.descripcion_propuesta);

  const cambiaTitulo=tituloAntes!==null && tituloDespues!==null && tituloAntes!==tituloDespues;
  const cambiaDescripcion=descripcionAntes!==null && descripcionDespues!==null &&
    descripcionAntes!==descripcionDespues;
  const tipo=cambiaTitulo&&cambiaDescripcion?'Cambio de título y meta descripción'
    :cambiaTitulo?'Cambio de título'
    :cambiaDescripcion?'Cambio de meta descripción'
    :'Mejora SEO';
  return `${tipo}: ${ubicacionMejoraSEO(propuesta.ruta)}`;
}
