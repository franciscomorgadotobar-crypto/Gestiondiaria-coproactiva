/* Motor sencillo: las plantillas nunca ejecutan HTML ni instrucciones del contacto. */
const VARIABLES=['nombre','nombreCompleto','comunidad','correo','responsable'];
export const VARIABLES_CORREO=VARIABLES.map(x=>'{{'+x+'}}');
export function completarCorreo(texto, prospecto={}, responsable='Equipo Coproactiva'){
 const nombreCompleto=String(prospecto.nombre_contacto||'').trim();
 const mapa={
   nombre:nombreCompleto.split(/\s+/)[0]||'',
   nombreCompleto,
   comunidad:String(prospecto.nombre_condominio||''),
   correo:String(prospecto.email||''),
   responsable:String(responsable||'Equipo Coproactiva')
 };
 return String(texto||'').replace(/{{(nombreCompleto|nombre|comunidad|correo|responsable)}}/g,(x,key)=>mapa[key]??x);
}
