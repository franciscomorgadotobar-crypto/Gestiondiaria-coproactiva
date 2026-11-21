import {CONTENIDO_BASE_DOCUMENTAL} from './contenidoBaseDocumental.js';
import {CAMPOS_POR_TIPO} from './plantillasDocumentales.js';

// Textos corporativos editables. Los valores se guardan por tipo en Supabase.
// Las propuestas conservan sus importes y campos de la ficha comercial.
export const PLANTILLA_PROPUESTA_BASE = {

// Cada texto de la propuesta debe existir aquí y estar disponible en el editor
// corporativo. Los valores vinculados al prospecto siguen siendo dinámicos.
 portadaEtiqueta:'Propuesta comercial',
 portadaTitulo:'Administración integral de condominios y comunidades',
 portadaEtiquetaComunidad:'Comunidad',
 portadaEtiquetaUbicacion:'Ubicación',
 portadaRegion:'Región Metropolitana',
 portadaEtiquetaDestinatario:'Preparada para',
 portadaEtiquetaFecha:'Fecha',
 portadaEtiquetaVigencia:'Vigencia de la oferta',
 portadaTextoVigencia:'{{vigencia}} días corridos desde la fecha de emisión',
 portadaPrefijoFecha:'Santiago, ',
 pieEmpresa:'CoproActiva Administración SpA',
 firmantePredeterminado:'Osmar André Meza Aguilar',
 cargoPredeterminado:'Contador Auditor · Administrador Inscrito · Representante Legal',
 pieDocumento:'Propuesta comercial · Confidencial',
 saludo:'A la atención de {{destinatario}}:',
 tituloPresentacion:'Presentación',
 tituloEnfoque:'Nuestro enfoque',
 tituloServicio:'Servicio: administración integral',
 tituloPlan:'Plan de trabajo',
 tituloEntregables:'Entregables comprometidos',
 tituloAtencion:'Atención y tiempos de respuesta',
 tituloHonorarios:'Honorarios y condiciones económicas',
 tituloNoIncluidas:'Prestaciones no incluidas',
 notaPlan:'Los plazos se cuentan desde la firma del contrato y se ajustan en función de los antecedentes efectivamente recibidos de la administración saliente.',
 tablaServicioArea:'Área de gestión',
 tablaServicioComprende:'Comprende',
 tablaPlanPlazo:'Plazo',
 tablaPlanHito:'Hito',
 tablaEntregable:'Entregable',
 tablaPeriodicidad:'Periodicidad',
 tablaAtencionCategoria:'Categoría',
 tablaAtencionDefinicion:'Definición',
 tablaAtencionAcuse:'Acuse',
 tablaAtencionPlan:'Plan de acción',
 tituloCanales:'Canales oficiales',
 notaCanales:'Los tiempos comprometidos miden la respuesta y gestión de Coproactiva, no el plazo de resolución definitiva cuando ésta depende de proveedores externos o de la aprobación del Comité.',
 conceptoBase:'Base de referencia mensual de gastos comunes ordinarios',
 conceptoPorcentaje:'Porcentaje de honorario aplicado',
 conceptoFijo:'Modalidad de honorarios',
 conceptoFijoValor:'Monto fijo mensual',
 conceptoNeto:'Honorario mensual neto',
 conceptoIVA:'IVA (19%)',
 conceptoTotal:'Total mensual',
 tituloReglas:'Reglas de aplicación',
 tituloCondiciones:'Condiciones y reajuste anual',
 introduccionNoIncluidas:'Las siguientes materias requieren presupuestación y acuerdo escrito por separado:',
 portadaSubtitulo:'Gestión profesional estructurada sobre la Ley N°21.442.',
 presentacion:'Agradecemos la oportunidad de presentar esta propuesta para la administración de {{comunidad}}. Coproactiva Administración SpA es una empresa de administración profesional de condominios, cuyo trabajo se estructura sobre la Ley N°21.442 de Copropiedad Inmobiliaria y su Reglamento.',
 compromiso:'Nuestro compromiso es una comunidad administrada con orden legal, información financiera verificable y respuesta oportuna. Entendemos la administración como la gestión responsable de un patrimonio común.',
 cierre:'Esta propuesta describe el servicio, los entregables comprometidos, los tiempos de respuesta y las condiciones económicas. Quedamos a disposición del Comité para presentarla en reunión y resolver sus consultas.',
 servicioIntro:'Modalidad aplicable a comunidades con historial y operación en marcha. Coproactiva desarrolla las funciones de administración que contempla la Ley N°21.442 y su Reglamento, organizadas en cuatro áreas:',
 enfoques:[
 ['Cumplimiento normativo','Cada decisión se funda en la Ley N°21.442, su Reglamento y el reglamento de copropiedad de la comunidad.'],
 ['Transparencia financiera','Los fondos comunitarios se administran en cuentas de titularidad de la comunidad, con rendición mensual documentada y respaldo de egresos.'],
 ['Tecnología aplicada a la comunidad','Incorporamos tecnología a la gestión, comunicación y control del condominio según las necesidades de cada comunidad.'],
 ['Respuesta oportuna','Compromisos de atención definidos por categoría, medibles y auditables por el Comité, con canal de urgencias 24/7.']
 ].map(f=>f.join(' | ')).join('\n'),
 areas:[
 ['Legal y normativa','Asambleas, actas, acuerdos, reglamento de copropiedad, representación y conservación de bienes comunes.'],
 ['Financiera y contable','Presupuesto anual, emisión y cobro de gastos comunes, gestión de morosidad, fondo de reserva, rendición mensual y balance anual.'],
 ['Operativa y técnica','Mantenciones, supervisión de proveedores, incidencias, certificaciones y conservación de bienes comunes.'],
 ['Laboral y previsional','Personal de la comunidad, remuneraciones, cotizaciones y cumplimiento de la normativa laboral.']
 ].map(f=>f.join(' | ')).join('\n'),
 plan:[
 ['Días 1 a 5','Recepción documental, accesos, contratos vigentes y antecedentes financieros de la administración saliente.'],
 ['Días 6 a 15','Informe de diagnóstico inicial de brechas legales, financieras, laborales, técnicas y de seguridad.'],
 ['Días 16 a 30','Plan de regularización con acciones, plazos y responsables, para presentación al Comité.'],
 ['Mensual','Informe de avance incorporado en la rendición mensual al Comité.']
 ].map(f=>f.join(' | ')).join('\n'),
 entregables:[
 ['Informe de diagnóstico inicial de brechas','Primeros 15 días'],
 ['Plan de regularización y acciones propuestas','Primeros 30 días'],
 ['Rendición documentada de gestión','Mensual, al Comité'],
 ['Informe de avance del proceso de regularización','Mensual'],
 ['Presupuesto estimativo anual','Anual'],
 ['Balance anual','Anual'],
 ['Informe de gestión al término del contrato','Al término']
 ].map(f=>f.join(' | ')).join('\n'),
 sla:[
 ['Urgente','Riesgo para personas o daño activo a bienes comunes sin alternativa disponible.','30 min','2 horas'],
 ['Normal','Falla operativa con alternativa disponible o sin riesgo inmediato.','2 horas','24 horas hábiles'],
 ['Programado','Mantención preventiva o solicitud administrativa no urgente.','24 horas hábiles','72 horas hábiles']
 ].map(f=>f.join(' | ')).join('\n'),
 canales:'Incidencias normales y programadas: {{email}} · lunes a viernes, 09:00 a 18:00 hrs.\nUrgencias: WhatsApp 24/7. El plazo corre desde el acuse de recibo.\nAtención mixta presencial y telemática según la programación convenida.',
 reglasPorcentaje:'La base de referencia corresponde a los gastos comunes ordinarios mensuales, antes de incorporar los honorarios de administración.\nEl porcentaje indicado se aplica sobre dicha base para obtener el honorario neto; se agrega IVA del 19%.\nLos valores quedan sujetos a confirmación tras el diagnóstico de la comunidad.',
 reglasFijo:'El honorario propuesto corresponde a un monto fijo mensual y no depende del valor de los gastos comunes.\nSe presenta el valor neto, el IVA del 19% y el total mensual.\nLos valores quedan sujetos a confirmación tras el diagnóstico de la comunidad.',
 condiciones:'Pago dentro de los primeros {{diasPago}} días corridos de cada mes, mediante transferencia electrónica.\nContrato de {{mesesContrato}} meses; las condiciones de renovación se formalizarán en el contrato.\nReajuste anual de los honorarios netos conforme a la variación acumulada del IPC publicada por el INE, correspondiente a los 12 meses anteriores al aniversario del inicio del contrato.',
 noIncluidas:'Servicios jurídicos especializados, elaboración o modificación del reglamento y patrocinio en procedimientos que requieran abogado habilitado.\nEjecución directa de obras, remodelaciones y reparaciones mayores; Coproactiva puede coordinar y supervisar proveedores.\nPeritajes, informes estructurales y certificaciones a cargo de profesionales habilitados.\nReconstrucción documental sin archivos, actas o registros históricos.\nRegularización de deudas laborales, previsionales o tributarias previas al inicio del contrato.'
};

export const CAMPOS_PROPUESTA_PLANTILLA=[
 ['portadaEtiqueta',"Etiqueta de la portada","Portada y encabezados"],
 ['portadaTitulo',"Título principal","Portada y encabezados"],
 ['portadaSubtitulo',"Subtítulo de la portada","Portada y encabezados"],
 ['portadaEtiquetaComunidad',"Etiqueta: comunidad","Portada y encabezados"],
 ['portadaEtiquetaUbicacion',"Etiqueta: ubicación","Portada y encabezados"],
 ['portadaRegion',"Región en la ubicación","Portada y encabezados"],
 ['portadaEtiquetaDestinatario',"Etiqueta: destinatario","Portada y encabezados"],
 ['portadaEtiquetaFecha',"Etiqueta: fecha","Portada y encabezados"],
 ['portadaEtiquetaVigencia',"Etiqueta: vigencia","Portada y encabezados"],
 ['portadaTextoVigencia',"Texto de vigencia ({{vigencia}} días)","Portada y encabezados"],
 ['portadaPrefijoFecha',"Prefijo de lugar/fecha","Portada y encabezados"],
 ['pieEmpresa',"Nombre de empresa en pie","Portada y encabezados"],
 ['firmantePredeterminado',"Firmante predeterminado (se puede cambiar en cada propuesta)","Portada y encabezados"],
 ['cargoPredeterminado',"Cargo predeterminado (se puede cambiar en cada propuesta)","Portada y encabezados"],
 ['pieDocumento',"Leyenda de pie de página","Portada y encabezados"],
 ['tituloPresentacion',"Título de sección","Presentación"],
 ['saludo',"Saludo o destinatario ({{destinatario}} es la persona o comité)","Presentación"],
 ['presentacion',"Primer párrafo ({{comunidad}})","Presentación"],
 ['compromiso',"Compromiso de servicio","Presentación"],
 ['cierre',"Cierre de la presentación","Presentación"],
 ['tituloEnfoque',"Título: nuestro enfoque","Enfoque y servicios"],
 ['enfoques',"Enfoques (nombre | descripción)","Enfoque y servicios"],
 ['tituloServicio',"Título: servicio","Enfoque y servicios"],
 ['servicioIntro',"Introducción al servicio","Enfoque y servicios"],
 ['tablaServicioArea',"Cabecera de tabla: área","Enfoque y servicios"],
 ['tablaServicioComprende',"Cabecera de tabla: comprende","Enfoque y servicios"],
 ['areas',"Áreas de gestión (nombre | descripción)","Enfoque y servicios"],
 ['tituloPlan',"Título: plan de trabajo","Plan de trabajo y entregables"],
 ['tablaPlanPlazo',"Cabecera de tabla: plazo","Plan de trabajo y entregables"],
 ['tablaPlanHito',"Cabecera de tabla: hito","Plan de trabajo y entregables"],
 ['plan',"Plan de trabajo (plazo | hito)","Plan de trabajo y entregables"],
 ['notaPlan',"Nota del plan","Plan de trabajo y entregables"],
 ['tituloEntregables',"Título: entregables","Plan de trabajo y entregables"],
 ['tablaEntregable',"Cabecera: entregable","Plan de trabajo y entregables"],
 ['tablaPeriodicidad',"Cabecera: periodicidad","Plan de trabajo y entregables"],
 ['entregables',"Entregables (nombre | periodicidad)","Plan de trabajo y entregables"],
 ['tituloAtencion',"Título: atención y tiempos","Atención y comunicaciones"],
 ['tablaAtencionCategoria',"Cabecera: categoría","Atención y comunicaciones"],
 ['tablaAtencionDefinicion',"Cabecera: definición","Atención y comunicaciones"],
 ['tablaAtencionAcuse',"Cabecera: acuse","Atención y comunicaciones"],
 ['tablaAtencionPlan',"Cabecera: plan de acción","Atención y comunicaciones"],
 ['sla',"Tiempos de respuesta (categoría | definición | acuse | plan)","Atención y comunicaciones"],
 ['tituloCanales',"Título: canales oficiales","Atención y comunicaciones"],
 ['canales',"Canales oficiales (uno por línea)","Atención y comunicaciones"],
 ['notaCanales',"Nota de atención","Atención y comunicaciones"],
 ['tituloHonorarios',"Título: honorarios","Honorarios y condiciones"],
 ['conceptoBase',"Etiqueta: base de gastos comunes","Honorarios y condiciones"],
 ['conceptoPorcentaje',"Etiqueta: porcentaje","Honorarios y condiciones"],
 ['conceptoFijo',"Etiqueta: modalidad fija","Honorarios y condiciones"],
 ['conceptoFijoValor',"Etiqueta: monto fijo","Honorarios y condiciones"],
 ['conceptoNeto',"Etiqueta: honorario neto","Honorarios y condiciones"],
 ['conceptoIVA',"Etiqueta: IVA","Honorarios y condiciones"],
 ['conceptoTotal',"Etiqueta: total mensual","Honorarios y condiciones"],
 ['tituloReglas',"Título: reglas de aplicación","Honorarios y condiciones"],
 ['reglasPorcentaje',"Reglas de honorarios porcentuales (una línea por punto)","Honorarios y condiciones"],
 ['reglasFijo',"Reglas de honorarios fijos (una línea por punto)","Honorarios y condiciones"],
 ['tituloCondiciones',"Título: condiciones","Honorarios y condiciones"],
 ['condiciones',"Condiciones económicas ({{diasPago}}, {{mesesContrato}})","Honorarios y condiciones"],
 ['tituloNoIncluidas',"Título: prestaciones no incluidas","Exclusiones"],
 ['introduccionNoIncluidas',"Introducción a las exclusiones","Exclusiones"],
 ['noIncluidas',"Prestaciones no incluidas (una línea por punto)","Exclusiones"]
];

export const modeloEditable=tipo => tipo==='propuesta_comercial'
 ? {...PLANTILLA_PROPUESTA_BASE}
 : Object.fromEntries((CAMPOS_POR_TIPO[tipo]||[]).map(([clave])=>[clave,CONTENIDO_BASE_DOCUMENTAL[tipo]?.[clave]||'']));

export const contenidoEditable=(tipo,guardado)=>({...modeloEditable(tipo),...(guardado&&typeof guardado==='object'&&!Array.isArray(guardado)?guardado:{})});
export const puntos=(texto)=>String(texto||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
export const filas=(texto,columnas=2)=>puntos(texto).map(l=>l.split('|').map(c=>c.trim())).filter(f=>f.length===columnas&&f.every(Boolean));
export const interpolar=(texto,vars={})=>String(texto||'').replace(/\{\{([a-zA-Z]+)\}\}/g,(_,key)=>Object.hasOwn(vars,key)?String(vars[key]??''):'{{'+key+'}}');
