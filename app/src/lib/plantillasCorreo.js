/* Las plantillas son texto plano: no ejecutan HTML ni expresiones.
 * Solo se sustituyen datos que realmente existen en la ficha.
 * Datos ausentes o campos libres conservan {{variable}} para revisión. */
const VARIABLES=['saludo','nombre','nombreCompleto','comunidad','correo','remitente',
  'responsable','direccion','comuna','unidades','empresa','fecha','hora',
  'modalidad','jefe_zonal','honorario'];
export const VARIABLES_CORREO=VARIABLES.map(x=>'{{'+x+'}}');

export function completarCorreo(texto, prospecto={}, responsable='Equipo Coproactiva'){
 const nombreCompleto=String(prospecto.nombre_contacto||'').trim();
 const val=v=>v===null||v===undefined||String(v).trim()===''?null:String(v);
 const horaChile=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',hour:'2-digit',hour12:false}).format(new Date()));
 const saludo=horaChile>=20?'Buenas noches':horaChile>=12?'Buenas tardes':'Buenos días';
 const mapa={
  saludo,
  nombre:val(nombreCompleto.split(/\s+/)[0]),
  nombreCompleto:val(nombreCompleto),
  comunidad:val(prospecto.nombre_condominio),
  correo:val(prospecto.email),
  remitente:val(responsable),
  responsable:val(responsable),
  direccion:val(prospecto.direccion),
  comuna:val(prospecto.comuna),
  unidades:val(prospecto.unidades)
 };
 return String(texto||'').replace(/{{([a-zA-Z_]+)}}/g,(full,key)=>mapa[key]??full);
}

export function pendientesCorreo(asunto='',mensaje=''){
 const texto=String(asunto)+'\n'+String(mensaje);
 const variables=[...new Set([...texto.matchAll(/{{([\w]+)}}/g)].map(m=>m[1]))];
 const instrucciones=[...new Set([...texto.matchAll(/\[([^\]\n]+)\]/g)].map(m=>m[1]))];
 return {variables,instrucciones};
}

/* El archivo usa [corchetes] como instrucciones para el redactor.
 * No se deben transmitir al destinatario ni inventar campos faltantes. */
export function validarBorradorCorreo(asunto='',mensaje=''){
 const {variables,instrucciones}=pendientesCorreo(asunto,mensaje);
 const errores=[];
 if(!String(asunto).trim()||!String(mensaje).trim())
  errores.push('Completa el asunto y el mensaje.');
 if(variables.length)
  errores.push('Faltan datos por completar: '+variables.map(v=>'{{'+v+'}}').join(', ')+'.');
 if(instrucciones.length)
  errores.push('Elimina o reemplaza las instrucciones entre [corchetes] antes del envío.');
 return errores;
}
