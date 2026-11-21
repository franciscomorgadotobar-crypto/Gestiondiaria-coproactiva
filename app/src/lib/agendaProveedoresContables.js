// Agenda y contabilidad comparten identificadores de proveedor.
// La empresa y cada contacto se habilitan de manera independiente.
export function esProveedorMarcado(registro) {
  if (!registro || registro.lista_negra) return false;
  if (registro.es_proveedor) return true;
  if (registro.tipo_registro === 'contacto') return false;
  return Boolean(registro.contacto_es_proveedor && registro.contacto_nombre?.trim())
    || (Array.isArray(registro.contactos) && registro.contactos.some(c=>c?.es_proveedor && c?.id));
}

export function opcionesProveedoresContables(registros=[]) {
  const opciones=[];
  for (const p of registros||[]) {
    if (!p || p.lista_negra) continue;
    const nombre=String(p.empresa||'').trim();
    if (!nombre) continue;
    if (p.es_proveedor) opciones.push({
      clave:'registro:'+p.id,
      proveedor_id:p.id,
      contacto_id:null,
      nombre:(p.tipo_registro==='contacto'?'Persona: ':'Empresa: ')+nombre
    });
    if (p.tipo_registro==='contacto') continue;
    if (p.contacto_es_proveedor && p.contacto_id && String(p.contacto_nombre||'').trim()) {
      opciones.push({
        clave:'contacto:'+p.id+':'+p.contacto_id,
        proveedor_id:p.id,contacto_id:p.contacto_id,
        nombre:'Contacto: '+p.contacto_nombre.trim()+' · '+nombre
      });
    }
    for(const c of Array.isArray(p.contactos)?p.contactos:[]){
      if(!c?.es_proveedor||!c?.id) continue;
      const quien=String(c.nombre||c.email||c.telefono||'').trim();
      if(!quien) continue;
      opciones.push({
        clave:'contacto:'+p.id+':'+c.id,
        proveedor_id:p.id,contacto_id:c.id,
        nombre:'Contacto: '+quien+' · '+nombre
      });
    }
  }
  return opciones.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
}

export function opcionAnteriorContable(asiento) {
  if(!asiento?.proveedor_id)return '';
  return asiento.proveedor_contacto_id
    ?'contacto:'+asiento.proveedor_id+':'+asiento.proveedor_contacto_id
    :'registro:'+asiento.proveedor_id;
}
