// Deterministic, versioned flows. Only text and attachment metadata enter here.
export const FLOW_VERSION = '1.0';
export const FILE_REPLY = 'Por favor, envía los archivos a contacto@coproactiva.cl para que podamos revisarlos.';
export const APPLICANT_REPLY = 'Para postular, envía tu currículum a contacto@coproactiva.cl.';
export const PROVIDER_REPLY = 'Envía tu presentación de servicios a contacto@coproactiva.cl. Quedarás registrado en nuestra base de proveedores y te contactaremos.';
export const HANDOFF_REPLY = 'Recibimos tu mensaje. Lo derivaremos a una persona de Coproactiva.';
export function phone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 9 ? '56' + digits : digits;
}
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const text = body => ({ text: body });
const menu = (body, choices) => ({ text: body, choices: choices.map(([id, title]) => ({ id, title })) });
const INITIAL = menu('Hola 👋 Bienvenido a Coproactiva.\nSelecciona el motivo de tu contacto:', [['residente','Residente/copropietario'],['cotizacion','Cotizar administración'],['postulacion','Trabajar en Coproactiva'],['proveedor','Proveedor'],['otro','Otro motivo']]);
const RESIDENT = menu('¿Qué necesitas?', [['problema','Informar un problema'],['gestion','Solicitar una gestión'],['reclamo','Presentar un reclamo'],['humano','Hablar con admin.'],['finalizar','Finalizar']]);
const GROUPS = menu('¿Dónde está el problema?', [['accesos','Accesos y seguridad'],['comunes','Aseo y espacios comunes'],['servicios','Agua y electricidad'],['otro','Otro asunto']]);
const GROUP = {
  accesos: [['acceso_porteria','Portón o acceso'],['seguridad','Seguridad'],['otro','Otro']],
  comunes: [['aseo','Aseo o basura'],['jardines_exterior','Jardines y áreas verdes'],['areas_comunes','Equipamiento común'],['otro','Otro']],
  servicios: [['infraestructura','Fuga o filtración'],['electricidad','Iluminación'],['otro','Otro']]
};
const SERVICES = [['primera_administracion','Primera administración'],['administracion','Cambio de administración'],['auditoria','Auditoría'],['asesoria','Asesoría'],['otro','Otro']];
const AREAS = ['Administración','Conserjería','Aseo','Mantención','Contabilidad','Operaciones','Otra'].map((v,i)=>['area_'+i,v]);
const choice = (value, choices) => {
  const n = norm(value);
  const hit = choices.find((c,i) => n === norm(c[0]) || n === norm(c[1]) || n === String(i+1));
  return hit?.[0] ?? null;
};
function contextMenu(data) {
  const offset = data.offset ?? 0, contexts = data.contexts ?? [];
  const choices = contexts.slice(offset,offset+8).map((c,i)=>['context_'+(offset+i), ('Casa '+c.numero).slice(0,24)]);
  if (contexts.length > offset+8) choices.push(['mas','Ver más']);
  if (offset > 0) choices.push(['inicio','Primeras opciones']);
  return { text:'Selecciona tu comunidad y casa:', choices:choices.map(([id,title])=>({id,title,description:id.startsWith('context_') ? contexts[Number(id.split('_')[1])].comunidad_nombre.slice(0,72) : ''})) };
}
function summary(d, motive) {
  if (motive === 'cotizacion') return `Revisa tu cotización:\n${d.nombre}\n${d.comunidad}, ${d.comuna}\nUnidades: ${d.unidades ?? 'Por confirmar'}\nServicio: ${d.servicio_nombre}\nCorreo: ${d.email || 'Sin correo'}\n${d.comentario || ''}`;
  const where = d.context ? `${d.context.comunidad_nombre} · Casa ${d.context.numero}` : `${d.comunidad} · Casa ${d.unidad}`;
  return `Revisa tu solicitud:\n${where}\n${d.categoria_nombre || d.tipo}\nLugar: ${d.lugar}\n${d.descripcion}\nDesde: ${d.desde || 'Por confirmar'}\nRiesgo: ${d.riesgo || 'No indicado'}`;
}
const confirmation = (d,m) => menu(summary(d,m), [['confirmar','Confirmar'],['corregir','Corregir'],['cancelar','Cancelar']]);
export function flow(conversation, incoming, contexts = []) {
  let d = structuredClone(conversation.datos ?? {}), step = conversation.paso_actual ?? 'inicio', motive = conversation.motivo ?? null;
  const result = { step, data:d, motive, state:'esperando_usuario', replies:[], action:null };
  const reply = r => { result.replies.push(r); return result; };
  const go = (next,r) => { result.step=next;d.last_prompt=r; return reply(r); };
  const handoff = () => { result.state='derivada'; result.step='humano'; return reply(text(HANDOFF_REPLY)); };
  if (['derivada','atencion_humana','cerrada'].includes(conversation.estado)) return {...result,state:conversation.estado};
  if (incoming.tipo !== 'texto' && incoming.tipo !== 'interaccion') return reply(text(FILE_REPLY));
  const v = String(incoming.contenido ?? '').trim().slice(0,3500);
  if (!v) return reply(text('Escribe tu respuesta o selecciona una opción.'));
  if (step !== 'inicio' && norm(v) === 'menu') return {...result,step:'motivo',data:{},motive:null,replies:[INITIAL]};
  if (step !== 'inicio' && step !== 'retomar' && ['hola','buenos dias','buenas tardes','buenas noches'].includes(norm(v))) {
    d.resume_step=step;return go('retomar',menu('Tienes una atención en curso.',[['continuar','Continuar'],['menu','Menú inicial']]));
  }
  if(step==='retomar') {
    if(['continuar','1'].includes(norm(v))) {result.step=d.resume_step;return reply(text('Responde la pregunta anterior para continuar, o escribe “Menú”.'));}
    return {...result,step:'motivo',data:{},motive:null,replies:[INITIAL]};
  }
  if (step === 'inicio') return go('motivo',INITIAL);
  if (step === 'motivo') {
    motive = choice(v, INITIAL.choices.map(x=>[x.id,x.title])); result.motive=motive;
    if (!motive) return reply(INITIAL);
    if (motive === 'proveedor') { result.state='cerrada'; return go('fin',text(PROVIDER_REPLY)); }
    if (motive === 'cotizacion') return go('cot_servicio',menu('¿Qué servicio necesitas?',SERVICES));
    if (motive === 'postulacion') return go('post_nombre',text('¿Cuál es tu nombre?'));
    if (motive === 'otro') return go('otro_nombre',text('¿Cuál es tu nombre?'));
    // Phone recognition happens only after the user chooses resident.
    d.contexts=contexts; d.offset=0;
    if (contexts.length === 1) { d.context=contexts[0]; return go('res_menu',RESIDENT); }
    if (contexts.length > 1) return go('res_contexto',contextMenu(d));
    d.validacion='pendiente'; return go('res_nombre',text('¿Cuál es tu nombre?'));
  }
  if (step === 'res_contexto') {
    const options=contextMenu(d).choices.map(x=>[x.id,x.title]); const pick=choice(v,options);
    if (pick==='mas') {d.offset+=8; return reply(contextMenu(d));}
    if (pick==='inicio') {d.offset=0; return reply(contextMenu(d));}
    if (!pick) return reply(contextMenu(d));
    d.context=d.contexts[Number(pick.split('_')[1])]; return go('res_menu',RESIDENT);
  }
  const residentIdentity = {res_nombre:['nombre','res_comunidad','¿En qué comunidad vives?'],res_comunidad:['comunidad','res_unidad','¿Cuál es el número de tu casa?'],res_unidad:['unidad','res_relacion','¿Eres residente o copropietario?']};
  if (residentIdentity[step]) {const [field,next,prompt]=residentIdentity[step]; d[field]=v; return go(next,text(prompt));}
  if (step==='res_relacion') {d.relacion=v; result.replies.push(text('Recibiremos tu solicitud. Administración revisará tus datos.')); return go('res_menu',RESIDENT);}
  if (step==='res_menu') {
    const pick=choice(v,RESIDENT.choices.map(x=>[x.id,x.title]));
    if (!pick) return reply(RESIDENT);
    if (pick==='finalizar') {result.state='cerrada';return go('fin',text('Gracias por contactar a Coproactiva.'));}
    if (pick==='humano') return handoff();
    d.tipo=pick;
    if (pick==='problema') return go('res_grupo',GROUPS);
    d.categoria='administracion';d.categoria_nombre=pick==='reclamo'?'Reclamo':'Solicitud de gestión';
    return go('res_descripcion',text(pick==='reclamo'?'Describe brevemente tu reclamo.':'Describe brevemente qué necesitas gestionar.'));
  }
  if(step==='res_grupo') {
    const pick=choice(v,GROUPS.choices.map(x=>[x.id,x.title]));if(!pick)return reply(GROUPS);
    d.grupo=pick;
    if(pick==='otro'){d.categoria='otro';d.categoria_nombre='Otro asunto';return go('res_otro',text('Cuéntanos brevemente qué sucede.'));}
    return go('res_categoria',menu('Selecciona una opción:',GROUP[pick]));
  }
  if(step==='res_categoria') {
    const pick=choice(v,GROUP[d.grupo]);if(!pick)return reply(menu('Selecciona una opción:',GROUP[d.grupo]));
    d.categoria=pick;d.categoria_nombre=GROUP[d.grupo].find(x=>x[0]===pick)[1];
    return go('res_lugar',menu('¿Dónde sucede?', [['casa','Mi casa'],['comun','Espacio común']]));
  }
  if(step==='res_lugar') {
    const pick=choice(v,[['casa','Mi casa'],['comun','Espacio común']]);
    if(!pick)return reply(menu('¿Dónde sucede?', [['casa','Mi casa'],['comun','Espacio común']]));
    if(pick==='comun')return go('res_lugar_texto',text('Indica el lugar dentro de la comunidad.'));
    d.lugar='Casa '+(d.context?.numero??d.unidad);return go('res_descripcion',text('Describe brevemente qué sucede.'));
  }
  if(step==='res_lugar_texto'){d.lugar=v;return go('res_descripcion',text('Describe brevemente qué sucede.'));}
  if(step==='res_otro'){d.descripcion=v;d.lugar='Por precisar';return handoff();}
  if(step==='res_descripcion') {
    d.descripcion=v;d.lugar ||= 'Por precisar';
    if(d.tipo!=='problema')return go('res_confirmar',confirmation(d,motive));
    return go('res_desde',text('¿Desde cuándo ocurre?'));
  }
  if(step==='res_desde'){d.desde=v;return go('res_riesgo',menu('¿Hay peligro inmediato para personas?', [['si','Sí'],['no','No'],['duda','No estoy seguro']]));}
  if(step==='res_riesgo') {
    const pick=choice(v,[['si','Sí'],['no','No'],['duda','No estoy seguro']]);
    if(!pick)return reply(menu('¿Hay peligro inmediato para personas?', [['si','Sí'],['no','No'],['duda','No estoy seguro']]));
    d.riesgo=pick;d.urgente=pick!=='no';
    if(d.urgente){result.replies.push(text('Si hay peligro inmediato, contacta a los servicios de emergencia. Este WhatsApp no es un canal de emergencias.'));return handoff();}
    return go('res_confirmar',confirmation(d,motive));
  }
  if(step==='res_confirmar'||step==='cot_confirmar') {
    const pick=choice(v,[['confirmar','Confirmar'],['corregir','Corregir'],['cancelar','Cancelar']]);
    if(!pick)return reply(confirmation(d,motive));
    if(pick==='cancelar'){result.state='cerrada';return go('fin',text('Cancelado. Puedes escribirnos cuando lo necesites.'));}
    if(pick==='corregir') {
      if(motive==='cotizacion') { result.data={}; return go('cot_servicio',menu('¿Qué servicio necesitas?',SERVICES)); }
      const keep={context:d.context,contexts:d.contexts,nombre:d.nombre,comunidad:d.comunidad,unidad:d.unidad,relacion:d.relacion,validacion:d.validacion};result.data=keep;return go('res_menu',RESIDENT);
    }
    d.confirmado=true;result.state='derivada';result.step='registrada';
    result.action=motive==='cotizacion'?'prospecto':d.context?'bitacora':'revision';
    return result; // A success response is produced only by the committed DB operation.
  }
  if(step==='cot_servicio') {
    const pick=choice(v,SERVICES);if(!pick)return reply(menu('¿Qué servicio necesitas?',SERVICES));
    d.servicio=pick;d.servicio_nombre=SERVICES.find(x=>x[0]===pick)[1];return go('cot_nombre',text('¿Cuál es tu nombre?'));
  }
  const quoteFields={cot_nombre:['nombre','cot_comunidad','¿Cómo se llama la comunidad o condominio?'],cot_comunidad:['comunidad','cot_comuna','¿En qué comuna está?'],cot_comuna:['comuna','cot_unidades','¿Cuántas unidades tiene aproximadamente? Puedes responder “No sé”.'],cot_email:['email','cot_comentario','¿Quieres agregar algún comentario? Puedes responder “No”.']};
  if(quoteFields[step]) {
    const [field,next,prompt]=quoteFields[step];
    if(field==='email'&&!['no','omitir'].includes(norm(v))&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return reply(text('Indica un correo válido o responde “No”.'));
    d[field]=field==='email'&&['no','omitir'].includes(norm(v))?null:v;return go(next,text(prompt));
  }
  if(step==='cot_unidades') {
    const n=Number(v);if(!['no se','no sé','omitir'].includes(norm(v))&&(!Number.isInteger(n)||n<1||n>100000))return reply(text('Indica la cantidad aproximada o responde “No sé”.'));
    d.unidades=Number.isInteger(n)&&n>0?n:null;return go('cot_email',text('¿Quieres dejar un correo de contacto? Puedes responder “No”.'));
  }
  if(step==='cot_comentario'){d.comentario=norm(v)==='no'?'':v;return go('cot_confirmar',confirmation(d,motive));}
  if(step==='post_nombre'){d.nombre=v;return go('post_comuna',text('¿En qué comuna vives?'));}
  if(step==='post_comuna'){d.comuna=v;return go('post_area',menu('¿En qué área te interesa trabajar?',AREAS));}
  if(step==='post_area') {
    const pick=choice(v,AREAS);if(!pick)return reply(menu('¿En qué área te interesa trabajar?',AREAS));
    d.area=AREAS.find(x=>x[0]===pick)[1];result.state='cerrada';return go('fin',text(APPLICANT_REPLY));
  }
  if(step==='otro_nombre'){d.nombre=v;return go('otro_descripcion',text('Cuéntanos brevemente el motivo de tu contacto.'));}
  if(step==='otro_descripcion'){d.descripcion=v;return handoff();}
  return handoff();
}
export function withinWindow(lastIncoming, now = Date.now()) {
  const time=new Date(lastIncoming).getTime();return Number.isFinite(time)&&now>=time&&now-time<24*60*60*1000;
}
export function metaPayload(to, reply) {
  if(reply.choices?.length) return {messaging_product:'whatsapp',to,type:'interactive',interactive:{type:'list',body:{text:reply.text},action:{button:'Ver opciones',sections:[{title:'Opciones',rows:reply.choices.map(x=>({id:x.id,title:x.title,...(x.description?{description:x.description}:{})}))}]}}};
  return {messaging_product:'whatsapp',to,type:'text',text:{body:reply.text}};
}
