// El generador de propuestas usa el mismo prospecto del Pipeline comercial.
// La asociación persistente se guarda por UUID, nunca por coincidencia de nombre.
export const OPCIONES_PROPUESTA = { portada: true, numeros: true, honorarios: true };

export function nombreProspecto(p) {
  return String(p?.nombre_condominio || p?.nombre_contacto || 'Prospecto sin nombre').trim();
}

export function etiquetaProspecto(p) {
  const nombre = nombreProspecto(p);
  const contacto = String(p?.nombre_contacto || '').trim();
  const etapa = String(p?.etapa || '').trim();
  const sufijo = [
    contacto && contacto.toLocaleLowerCase('es') !== nombre.toLocaleLowerCase('es') ? contacto : null,
    etapa ? etapa.charAt(0).toUpperCase() + etapa.slice(1).replaceAll('_',' ') : null
  ].filter(Boolean);
  return nombre + (sufijo.length ? ' · ' + sufijo.join(' · ') : '');
}

export function datosDesdeProspecto(p, vacio) {
  return {
    ...vacio,
    comunidad: p?.nombre_condominio || '',
    direccion: p?.direccion || '',
    comuna: p?.comuna || '',
    destinatario: p?.nombre_contacto || '',
    // El correo de contacto de la propuesta corresponde a Coproactiva,
    // no al correo personal del prospecto.
  };
}

export function propuestaDelProspecto(registros, id) {
  if (!id) return null;
  return Object.values(registros || {})
    .filter(r => r?.prospecto_id === id)
    .sort((a,b) => String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || '')))[0] || null;
}

export function conflictoAsociacion(registros, nombre, prospectoId) {
  const actual = registros?.[nombre];
  if (!actual) return false;
  return Boolean(actual.prospecto_id && actual.prospecto_id !== (prospectoId || null));
}
