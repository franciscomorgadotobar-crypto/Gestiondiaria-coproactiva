/**
 * Adaptador de correo compartido por los módulos.
 * El módulo determina permisos, destinatarios, historial y UX; el transporte
 * SMTP vive únicamente en supabase/functions/_compartido/correo.ts.
 * No hay una bandeja central ni un módulo "Motor único".
 */
export const MODULOS_CORREO = Object.freeze({ CRM: 'crm', PROVEEDORES: 'proveedores' });

export function enviarCorreoContextual(supabase, modulo, datos) {
  if (modulo === MODULOS_CORREO.CRM) {
    return supabase.functions.invoke('correo-prospecto', {
      body: {
        prospecto_id: datos.prospectoId,
        asunto: datos.asunto,
        mensaje: datos.mensaje,
        plantilla_id: datos.plantillaId || null,
        adjuntos: datos.adjuntos || []
      }
    });
  }
  if (modulo === MODULOS_CORREO.PROVEEDORES) {
    return supabase.functions.invoke('enviar-comunicacion-proveedores', { body: datos });
  }
  throw new Error('El módulo solicitado no tiene envío de correo habilitado.');
}
