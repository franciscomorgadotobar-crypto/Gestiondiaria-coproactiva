// Catálogo de familias de documentos. Las fuentes de diseño están definidas
// en docs/gestor-documental-arquitectura-20261101.md.
export const TIPOS_DOCUMENTO = Object.freeze([
  {
    id:'propuesta_comercial',titulo:'Propuesta comercial',
    descripcion:'Alcance, beneficios, honorarios y condiciones del servicio.',
    referencias:'Las Palmeras / Arturo Prat 407',
    disponible:true,ruta:'/propuestas',area:'comercial'
  },
  {
    id:'seguimiento_documental',titulo:'Seguimiento documental',
    descripcion:'Antecedentes recibidos, pendientes, observaciones y próximos pasos.',
    referencias:'Condominio Plaza Nos',disponible:true,ruta:'/documentos/nuevo?tipo=seguimiento_documental',area:'comercial'
  },
  {
    id:'primera_administracion',titulo:'Primera administración',
    descripcion:'Secuencia legal, documentación necesaria, entregables y responsables.',
    referencias:'Puesta en marcha - Etapa 1',disponible:true,ruta:'/documentos/nuevo?tipo=primera_administracion',area:'operacion'
  },
  {
    id:'informe_gestion',titulo:'Informe de gestión',
    descripcion:'Gestiones realizadas, resultados, próximos pasos e hitos.',
    referencias:'Reserva Santa Clara',disponible:true,ruta:'/documentos/nuevo?tipo=informe_gestion',area:'operacion'
  }
]);
export const ESTADOS_DOCUMENTO=['borrador','en_revision','aprobado','emitido','archivado'];
export const ESTILO_DOCUMENTO_COPROACTIVA={
  naranja:'#ed7130',naranjaEditorial:'#c9792a',dorado:'#d0a207',
  gris:'#696969',grafito:'#2b3138',fondoTabla:'#f7f4f0'
};

export const CAMPOS_POR_TIPO={
 seguimiento_documental:[
  ['resumen','Objetivo y contexto'],
  ['antecedentes','Antecedentes recibidos'],
  ['pendientes','Documentación pendiente'],
  ['observaciones','Observaciones y revisión preliminar'],
  ['coordinaciones','Coordinaciones y responsables'],
  ['proximos_pasos','Próximos pasos']
 ],
 primera_administracion:[
  ['resumen','Alcance de la puesta en marcha'],
  ['hitos','Hitos legales y administrativos'],
  ['documentacion','Antecedentes por recabar'],
  ['entregables','Entregables comprometidos'],
  ['responsables','Responsables y coordinaciones'],
  ['observaciones','Observaciones']
 ],
 informe_gestion:[
  ['resumen','Resumen ejecutivo'],
  ['gestiones','Gestiones realizadas'],
  ['resultados','Resultados y avances'],
  ['compromisos','Compromisos y responsables'],
  ['proximos_pasos','Próximos pasos'],
  ['hitos','Hitos del periodo']
 ]
};
export const ETIQUETAS_ESTADO={
 borrador:'Borrador',en_revision:'En revisión',aprobado:'Aprobado',
 emitido:'Emitido',archivado:'Archivado'
};

/* Contenido contextual de cada formulario: nunca reutilizar el ejemplo
   de 'Informe de gestión' en otras familias documentales. */
export const EJEMPLOS_TITULO_DOCUMENTO=Object.freeze({
 seguimiento_documental:'Ej.: Seguimiento documental - Plaza Nos',
 primera_administracion:'Ej.: Puesta en marcha - Reserva Santa Clara',
 informe_gestion:'Ej.: Informe de gestión - Reserva Santa Clara'
});

/* Fecha LOCAL del usuario para campos tipo date.
   toISOString() convertía a UTC y adelantaba un día en Chile por la noche. */
export function fechaLocalInput(fecha=new Date()){
 const ano=fecha.getFullYear();
 const mes=String(fecha.getMonth()+1).padStart(2,'0');
 const dia=String(fecha.getDate()).padStart(2,'0');
 return ano+'-'+mes+'-'+dia;
}
