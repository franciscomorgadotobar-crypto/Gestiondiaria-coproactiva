/** Gestiones y avances: reglas de presentación compartidas con el motor. */
export const ESTADOS_GESTION={
 pendiente:'Pendiente',
 en_curso:'En proceso',
 en_espera:'En espera de tercero',
 en_pausa:'En pausa',
 bloqueado:'Bloqueada',
 completado:'Completada'
};
export const TIPOS_REGISTRO={
 avance:'Avance',observacion:'Observación',resultado:'Resultado'
};
export const PRIORIDADES={baja:'Baja',normal:'Normal',alta:'Alta',urgente:'Urgente'};
export const esCompletada=g=>g?.estado==='completado';
export const vistaGestiones=(gestiones=[],vista='activas')=>gestiones.filter(g=>{
 if(vista==='todas')return true;
 if(vista==='archivadas')return Boolean(g.archivado_en);
 if(g.archivado_en)return false;
 return vista==='completadas'?esCompletada(g):!esCompletada(g);
});
export function resumenGestiones(items=[]){
 return {
  pendientes:items.filter(g=>!g.archivado_en&&g.estado==='pendiente').length,
  enProceso:items.filter(g=>!g.archivado_en&&['en_curso','en_espera','en_pausa','bloqueado'].includes(g.estado)).length,
  completadas:items.filter(g=>!g.archivado_en&&esCompletada(g)).length,
  bloqueadas:items.filter(g=>!g.archivado_en&&['en_espera','en_pausa','bloqueado'].includes(g.estado)).length,
  archivadas:items.filter(g=>Boolean(g.archivado_en)).length
 };
}
export function normalizarTareasModelo(valor){
 return String(valor||'').split(/\r?\n/g).map(titulo=>titulo.trim()).filter(Boolean)
   .map(titulo=>({titulo:titulo.slice(0,180)}));
}
export function normalizarDocumentosModelo(valor){
 return String(valor||'').split(/\r?\n/g).map(x=>x.trim()).filter(Boolean).map(x=>x.slice(0,255));
}
export const ordenCronologico=(avances=[],transiciones=[])=>[
 ...avances.map(a=>({...a,tipoLinea:'registro',momento:a.registrado_en})),
 ...transiciones.map(t=>({...t,tipoLinea:'estado',momento:t.cambiado_en}))
].sort((a,b)=>new Date(b.momento).getTime()-new Date(a.momento).getTime());
const escapar=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
 .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function informeGestionHtml({gestion,subtareas=[],avances=[],transiciones=[],documentos=[]}){
 const estado=ESTADOS_GESTION[gestion.estado]||gestion.estado;
 const fecha=x=>x?new Date(x.length===10?x+'T12:00:00':x).toLocaleDateString('es-CL'):'-';
 const tareasHechas=subtareas.filter(t=>t.completada).length;
 const filas=ordenCronologico(avances,transiciones).map(a=>'<li><strong>'+escapar(fecha(a.momento))+'</strong> · '+
  (a.tipoLinea==='registro'?escapar(TIPOS_REGISTRO[a.tipo_registro]||'Avance')+': '+escapar(a.descripcion):
  'Estado: '+escapar(ESTADOS_GESTION[a.estado_anterior]||a.estado_anterior)+' → '+escapar(ESTADOS_GESTION[a.estado_nuevo]||a.estado_nuevo)
  +(a.observacion?' · '+escapar(a.observacion):''))+'</li>').join('');
 const tareas=subtareas.map(t=>'<li>'+escapar(t.titulo)+' · '+(t.completada?'Completada':Math.max(0,Number(t.avance)||0)+'%')+'</li>').join('');
 const docs=documentos.map(d=>'<li>'+escapar(d.nombre)+'</li>').join('');
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Informe de gestión</title>
 <style>body{font:15px/1.5 system-ui,sans-serif;color:#30343a;max-width:780px;margin:36px auto;padding:0 24px}h1{color:#a75b32}h2{border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:26px}dt{font-weight:bold}dd{margin:0 0 8px}li{margin:7px 0}footer{border-top:1px solid #ddd;margin-top:36px;padding-top:12px;color:#666;font-size:12px}@media print{body{margin:8mm auto}}</style></head>
 <body><header><h1>Coproactiva · Informe de gestión</h1><h2>${escapar(gestion.titulo)}</h2></header>
 <dl><dt>Estado</dt><dd>${escapar(estado)}</dd><dt>Responsable</dt><dd>${escapar(gestion.responsable||'Sin asignar')}</dd>
 <dt>Inicio</dt><dd>${escapar(fecha(gestion.fecha_inicio))}</dd><dt>Fecha límite</dt><dd>${escapar(fecha(gestion.fecha_limite))}</dd>
 <dt>Próxima acción</dt><dd>${escapar(gestion.proxima_accion_texto||'Sin próxima acción')}</dd>
 <dt>Resultado</dt><dd>${escapar(gestion.resultado||'Pendiente de resultado')}</dd>
 <dt>Avance</dt><dd>${escapar(gestion.avance)}% · ${tareasHechas} de ${subtareas.length} tareas completadas</dd></dl>
 <h2>Tareas</h2><ul>${tareas||'<li>Sin tareas registradas</li>'}</ul>
 <h2>Avances y trazabilidad</h2><ul>${filas||'<li>Sin movimientos registrados</li>'}</ul>
 <h2>Documentos asociados</h2><ul>${docs||'<li>Sin documentos asociados</li>'}</ul>
 <footer>Reporte generado a partir de los registros de Coproactiva el ${escapar(new Date().toLocaleString('es-CL'))}. Los documentos originales permanecen en Google Drive y su acceso requiere autorización.</footer>
 </body></html>`;
}
