/* Correos del formulario público de coproactiva.cl.
 *
 * Repiten los dos avisos que enviaba el Worker anterior: la confirmación a
 * quien escribe y el aviso interno de nuevo prospecto a contacto@. Todo dato
 * del formulario se escapa antes de entrar al HTML y se limpia de saltos de
 * línea antes de entrar al asunto.
 */

export const BUZON_COMERCIAL = 'contacto@coproactiva.cl';
export const URL_PIPELINE = 'https://app.coproactiva.cl/pipeline';

export type DatosFormulario = {
  nombre: string;
  condominio: string;
  email: string;
  telefono: string;
  servicio: string;
  mensaje: string;
  origen: string;
  prospectoId: string;
};

export function escapar(t: unknown) {
  return String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/* Una línea, sin caracteres de control y con largo acotado: evita inyectar
 * cabeceras en el asunto y que el formulario sirva para mandar textos largos
 * desde la casilla de Coproactiva. */
export function linea(t: unknown, max = 120) {
  const limpio = String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? limpio.slice(0, max - 1).trimEnd() + '…' : limpio;
}

/* Dirección apta para enviar: un solo destinatario, sin comas, espacios ni
 * signos que un cliente SMTP pueda leer como lista de direcciones. */
export function correoEnviable(email: string) {
  return email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email);
}

export function telefonoVisible(telefono: string) {
  const digitos = telefono.replace(/\D/g, '').replace(/^56/, '');
  return /^\d{9}$/.test(digitos) ? `+56${digitos}` : linea(telefono, 40);
}

export function codigoProspecto(id: string) {
  const hex = String(id ?? '').replace(/[^0-9a-f]/gi, '');
  return hex ? 'PROS_' + hex.slice(0, 12).toUpperCase() : '';
}

function marco(etiqueta: string, franja: string, cuerpo: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0ece4;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece4;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border-radius:10px;overflow:hidden;border:1px solid rgba(213,134,59,0.2)">
  <tr>
    <td style="background:#ffffff;padding:20px 32px;border-bottom:1px solid rgba(213,134,59,0.15)">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:20px;font-weight:800;color:#2f2f2f;letter-spacing:-0.5px;line-height:1">coproactiva</p>
            <p style="margin:2px 0 0;font-size:10px;color:#d5863b;font-weight:600;letter-spacing:0.3px">Comunidades que funcionan</p>
          </td>
          <td align="right">
            <span style="background:rgba(213,134,59,0.1);border:1px solid rgba(213,134,59,0.25);border-radius:99px;padding:5px 14px;font-size:9px;font-weight:700;color:#d5863b;letter-spacing:0.1em;text-transform:uppercase">${escapar(etiqueta)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="background:#d5863b;padding:13px 32px">
      <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">${escapar(franja)}</p>
    </td>
  </tr>
  <tr>
    <td style="background:#fffaf4;padding:32px 32px 28px">
${cuerpo}
    </td>
  </tr>
  <tr>
    <td style="background:#f0ece4;padding:16px 32px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:10px;color:#b7b1a6">Generado automáticamente · No responder</td>
          <td align="right" style="font-size:11px;font-weight:700;letter-spacing:0.2px"><a href="https://coproactiva.cl" style="color:#d5863b;text-decoration:none">coproactiva.cl</a></td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const SEPARADOR = '<div style="height:1px;background:rgba(48,70,96,0.08);margin:24px 0"></div>';

/* Confirmación para quien completó el formulario. No repite el mensaje ni los
 * datos de contacto: solo confirma la recepción. */
export function confirmacionContacto(d: DatosFormulario) {
  const nombre = linea(d.nombre, 80);
  const condominio = linea(d.condominio, 120);
  const asunto = linea(`Gracias por contactarnos — ${condominio}`, 160);
  const cuerpo = `
      <p style="margin:0;font-size:10px;font-weight:700;color:#d5863b;letter-spacing:0.14em;text-transform:uppercase">Hola</p>
      <p style="margin:6px 0 20px;font-size:26px;font-weight:800;color:#2f2f2f;letter-spacing:-0.5px;line-height:1.1">${escapar(nombre)}</p>
      ${SEPARADOR}
      <p style="margin:0 0 16px;font-size:14px;color:#2f2f2f;line-height:1.65">Gracias por escribirnos sobre <strong>${escapar(condominio)}</strong>.</p>
      <p style="margin:0;font-size:14px;color:#2f2f2f;line-height:1.65">Te contactamos en las próximas horas para conocer en detalle lo que necesita tu comunidad.</p>
      ${SEPARADOR}
      <p style="margin:0;font-size:12px;color:#b7b1a6;line-height:1.6">Si tienes alguna consulta escríbenos a
        <a href="mailto:${BUZON_COMERCIAL}" style="color:#d5863b;font-weight:600">${BUZON_COMERCIAL}</a></p>`;
  const texto = [
    `Hola ${nombre}:`,
    '',
    `Gracias por escribirnos sobre ${condominio}.`,
    'Te contactamos en las próximas horas para conocer en detalle lo que necesita tu comunidad.',
    '',
    `Si tienes alguna consulta escríbenos a ${BUZON_COMERCIAL}.`,
    '',
    'Coproactiva · coproactiva.cl',
    'Generado automáticamente · No responder'
  ].join('\n');
  return { asunto, html: marco('Confirmación', 'Recibimos tu solicitud', cuerpo), texto };
}

function celda(etiqueta: string, valorHtml: string) {
  return `
          <td width="50%" style="padding:10px 16px 10px 0;vertical-align:top">
            <p style="margin:0;font-size:9px;font-weight:700;color:#b7b1a6;text-transform:uppercase;letter-spacing:0.8px">${escapar(etiqueta)}</p>
            <p style="margin:5px 0 0;font-size:13px;font-weight:600;color:#2f2f2f;word-break:break-word">${valorHtml}</p>
          </td>`;
}

/* Aviso interno a contacto@ con los datos del prospecto ya creado en Pipeline. */
export function avisoNuevoProspecto(d: DatosFormulario) {
  const condominio = linea(d.condominio, 180);
  const nombre = linea(d.nombre, 180);
  const telefono = telefonoVisible(d.telefono);
  const servicio = linea(d.servicio, 150) || 'No indicado';
  const origen = linea(d.origen, 120) || 'web_coproactiva_cl';
  const codigo = codigoProspecto(d.prospectoId);
  const mensaje = String(d.mensaje ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 3500);
  const correo = correoEnviable(d.email)
    ? `<a href="mailto:${escapar(d.email)}" style="color:#304660">${escapar(d.email)}</a>`
    : escapar(d.email);
  const asunto = linea(`Nuevo prospecto web: ${condominio}`, 160);

  const cuerpo = `
      <p style="margin:0;font-size:10px;font-weight:700;color:#d5863b;letter-spacing:0.14em;text-transform:uppercase">Condominio</p>
      <p style="margin:6px 0 0;font-size:30px;font-weight:800;color:#2f2f2f;line-height:1.1;letter-spacing:-0.5px;word-break:break-word">${escapar(condominio)}</p>
      <table cellpadding="0" cellspacing="0" style="margin-top:6px;margin-bottom:20px">
        <tr>
          <td style="width:6px;height:6px;background:#d5863b;border-radius:3px;vertical-align:middle"></td>
          <td style="padding-left:7px;font-size:12px;color:#6f6f6f;font-weight:500">Primer contacto — responder en menos de 24 horas</td>
        </tr>
      </table>
      ${SEPARADOR}
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>${celda('Contacto', escapar(nombre))}${celda('Teléfono', escapar(telefono))}
        </tr>
        <tr>${celda('Correo electrónico', correo)}${celda('Servicio de interés', escapar(servicio))}
        </tr>
        <tr>${celda('Origen', escapar(origen))}${celda('ID prospecto', `<span style="font-family:monospace;font-size:11px;color:#b7b1a6">${escapar(codigo)}</span>`)}
        </tr>
      </table>
      ${mensaje ? `${SEPARADOR}
      <div style="padding:14px 18px;background:rgba(213,134,59,0.07);border-left:3px solid #d5863b;border-radius:0 6px 6px 0">
        <p style="margin:0;font-size:10px;font-weight:700;color:#d5863b;text-transform:uppercase;letter-spacing:0.8px">Mensaje</p>
        <p style="margin:6px 0 0;font-size:13px;color:#2f2f2f;line-height:1.65;word-break:break-word">${escapar(mensaje).replace(/\n/g, '<br>')}</p>
      </div>` : ''}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
        <tr>
          <td align="center">
            <a href="${URL_PIPELINE}" style="display:inline-block;background:#d5863b;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;padding:15px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.2px">Abrir Pipeline → gestionar prospecto</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;text-align:center;font-size:11px;color:#b7b1a6">Ingresa con tu cuenta de Gestión Diaria</p>`;

  const texto = [
    'Nuevo prospecto desde coproactiva.cl',
    'Primer contacto — responder en menos de 24 horas',
    '',
    `Condominio: ${condominio}`,
    `Contacto: ${nombre}`,
    `Teléfono: ${telefono}`,
    `Correo electrónico: ${linea(d.email, 254)}`,
    `Servicio de interés: ${servicio}`,
    `Origen: ${origen}`,
    `ID prospecto: ${codigo}`,
    ...(mensaje ? ['', 'Mensaje:', mensaje] : []),
    '',
    `Pipeline: ${URL_PIPELINE}`
  ].join('\n');

  return { asunto, html: marco('Nuevo prospecto', 'Solicitud recibida desde coproactiva.cl', cuerpo), texto };
}
