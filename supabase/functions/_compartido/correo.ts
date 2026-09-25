import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { LOGO_PNG } from '../_compartido/logo.ts';

/* Envío de correo desde contacto@coproactiva.cl.
 *
 * Va por el SMTP de Google Workspace, que es donde vive esa casilla. La clave
 * no es la del correo sino una contraseña de aplicación: Google no permite SMTP
 * con la clave normal cuando hay verificación en dos pasos, y una contraseña de
 * aplicación se revoca sola sin tocar la cuenta.
 *
 * Si falta la clave, `enviar` no falla: devuelve que no envió.
 */

const REMITENTE = Deno.env.get('SMTP_USUARIO') ?? 'contacto@coproactiva.cl';
const CLAVE     = Deno.env.get('SMTP_CLAVE') ?? '';
const SERVIDOR  = Deno.env.get('SMTP_SERVIDOR') ?? 'smtp.gmail.com';
const PUERTO    = Number(Deno.env.get('SMTP_PUERTO') ?? '465');

export const hayCorreo = () => CLAVE.length > 0;

export async function enviar(para: string, asunto: string, html: string, texto: string) {
  if (!hayCorreo()) return { enviado: false, motivo: 'SMTP sin configurar' };

  const cliente = new SMTPClient({
    connection: {
      hostname: SERVIDOR,
      port: PUERTO,
      tls: PUERTO === 465,
      // Google entrega la contraseña de aplicación en cuatro bloques separados
      // por espacios. Copiarla tal cual es lo natural y el servidor la rechaza,
      // así que se limpian acá en vez de exigir que se pegue perfecta.
      auth: { username: REMITENTE, password: CLAVE.replace(/\s+/g, '') }
    }
  });

  let resultado: { enviado: boolean; motivo?: string };
  try {
    await cliente.send({
      from: `CoproActiva <${REMITENTE}>`,
      to: para,
      subject: asunto,
      content: texto,
      html,
      /* El logotipo viaja dentro del correo y el HTML lo pide por cid. Marcado
       * como inline no aparece en la lista de adjuntos: es parte del diseño,
       * no un archivo que alguien deba descargar. */
      attachments: [{
        contentType: 'image/png',
        filename: 'coproactiva.png',
        encoding: 'base64',
        content: LOGO_PNG,
        contentID: 'logo'
      }]
    });
    resultado = { enviado: true };
  } catch (e) {
    resultado = { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }

  /* Cerrar la conexión va aparte y su fallo se ignora. Antes esto colgaba de un
   * `.catch()` encadenado, y como `close()` no siempre devuelve una promesa,
   * reventaba después de un envío exitoso: el correo salía y el sistema
   * informaba que no. Lo que se cierra mal no cambia lo que ya se envió. */
  try {
    await cliente.close();
  } catch { /* la conexión queda colgando y el runtime la recoge */ }

  return resultado;
}

const ALCANCE: Record<string, string> = {
  terreno: 'Verás los levantamientos que se te asignen en las comunidades donde trabajas.',
  jefatura: 'Verás las comunidades asignadas, el embudo comercial, y podrás corregir levantamientos del equipo.',
  admin: 'Tendrás acceso a todas las comunidades y a la administración del equipo.',
  superadmin: 'Tendrás acceso completo al sistema.',
  cliente: 'Podrás consultar el estado de tu comunidad: levantamientos, mantención y lo que administración decida compartir contigo.'
};

function escapar(t: string) {
  return String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/* La vigencia se dice en palabras y no en un número suelto: "vence en 1 horas"
 * se lee como un descuido, y este correo es el primer contacto de alguien con
 * el sistema. */
export function vigencia(horas: number) {
  if (horas < 1) return `${Math.round(horas * 60)} minutos`;
  if (horas === 1) return 'una hora';
  if (horas === 24) return 'un día';
  return `${horas} horas`;
}

/* El botón es la única salida, y con eso basta.
 *
 * Antes iba además la dirección completa al pie, por si el botón no se
 * pintaba. No hace falta: el botón es una celda de tabla con fondo y texto
 * dentro, que es lo que aguanta en todos los clientes de correo —no depende
 * de imágenes, ni de CSS que alguien bloquee, ni de fuentes que no lleguen—.
 * Y esa dirección al pie delataba dónde está alojado el sistema.
 *
 * Quien reciba el correo en texto plano igual recibe la dirección entera,
 * porque ahí no hay botón que valga.
 */
function plantilla(o: {
  titulo: string; saludo: string; parrafo: string; boton: string; enlace: string;
  aviso: string; cierre: string;
}) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f0;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border:1px solid #e9e6e2;">
        <tr><td style="padding:28px 28px 0;">
          <img src="cid:logo" alt="CoproActiva" width="150" height="30"
               style="display:block;width:150px;height:30px;border:0;outline:none;margin:0 0 22px;">
          <p style="margin:0 0 6px;font:600 9px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#4a5a68;">${escapar(o.titulo)}</p>
          <h1 style="margin:0 0 16px;font:700 21px/1.25 Helvetica,Arial,sans-serif;color:#2b3138;">${escapar(o.saludo)}</h1>
          <p style="margin:0 0 22px;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#2b3138;">${o.parrafo}</p>
        </td></tr>

        <tr><td style="padding:0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#2b3138;">
              <a href="${escapar(o.enlace)}" style="display:block;padding:14px 28px;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapar(o.boton)}</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 28px 0;">
          <p style="margin:0;padding:12px 14px;background:#fdf3e6;border:1px solid #f0dcbd;font:400 13px/1.55 Helvetica,Arial,sans-serif;color:#8a5f22;">${o.aviso}</p>
        </td></tr>

        <tr><td style="padding:20px 28px 0;">
          <p style="margin:0;font:400 13.5px/1.6 Helvetica,Arial,sans-serif;color:#2b3138;">${o.cierre}</p>
        </td></tr>

        <tr><td style="padding:24px 28px 28px;">
          <p style="margin:0;padding-top:16px;border-top:1px solid #e9e6e2;font:400 11.5px/1.6 Helvetica,Arial,sans-serif;color:#4a5a68;">
            CoproActiva · Administración de comunidades<br>
            <a href="mailto:contacto@coproactiva.cl" style="color:#4a5a68;">contacto@coproactiva.cl</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/* Invitación con enlace de un solo uso.
 *
 * No lleva contraseña porque no existe ninguna: la cuenta se crea sin
 * credencial y la persona define la suya al abrir el enlace. Nadie más la
 * conoce, ni siquiera quien la dio de alta, y no queda una clave viva en la
 * bandeja de entrada para siempre.
 */
export function invitacion(nombre: string, rol: string, enlace: string, horas: number) {
  const asunto = 'Tu acceso a CoproActiva';
  const dura = vigencia(horas);
  const esCliente = rol === 'cliente';

  // Instalar la PWA y trabajar sin señal es del recorrido en terreno: un
  // cliente solo consulta desde el portal, nunca lo necesita.
  const introduccion = esCliente
    ? 'Se te dio acceso al portal de CoproActiva, donde puedes consultar el estado de tu comunidad.'
    : 'Se te dio acceso a CoproActiva, el sistema con que registramos los levantamientos en terreno.';
  const instalacion = esCliente ? '' : [
    '',
    'La aplicación se instala en el teléfono desde el menú del navegador, con la opción',
    'Agregar a pantalla principal. Funciona sin señal: puedes recorrer un edificio',
    'completo sin datos y todo se sube al recuperar cobertura.'
  ].join('\n');
  const instalacionHtml = esCliente ? '' : '<br><br>Puedes instalarla en el teléfono desde el menú del navegador, con la opción ' +
    '<em>Agregar a pantalla principal</em>. Funciona sin señal: se recorre un edificio ' +
    'completo sin datos y todo se sube al recuperar cobertura.';

  const texto = [
    `Hola ${nombre.split(' ')[0]},`,
    '',
    introduccion,
    '',
    'Abre este enlace para crear tu contraseña:',
    enlace,
    '',
    `El enlace sirve una sola vez y vence en ${dura}. Si vence, la misma pantalla te deja pedir uno nuevo.`,
    '',
    ALCANCE[rol] ?? '',
    instalacion,
    '',
    'CoproActiva',
    'contacto@coproactiva.cl'
  ].join('\n');

  const html = plantilla({
    titulo: esCliente ? 'Acceso al portal' : 'Acceso al sistema',
    saludo: `Hola, ${nombre.split(' ')[0]}`,
    parrafo: `${introduccion} Para entrar, primero crea tu contraseña.`,
    boton: 'Crear mi contraseña',
    enlace,
    aviso: `<strong>El enlace sirve una sola vez y vence en ${dura}.</strong> Si alcanza a vencer, la misma pantalla te deja pedir uno nuevo.`,
    cierre: `${escapar(ALCANCE[rol] ?? '')}${instalacionHtml}`
  });

  return { asunto, html, texto };
}

/* Reposición de acceso: mismo mecanismo, otro motivo. */
export function reposicion(nombre: string, enlace: string, horas: number) {
  const asunto = 'Restablece tu contraseña de CoproActiva';
  const dura = vigencia(horas);

  const texto = [
    `Hola ${nombre.split(' ')[0]},`,
    '',
    'Administración generó un enlace para que definas una contraseña nueva:',
    enlace,
    '',
    `Sirve una sola vez y vence en ${dura}.`,
    '',
    'Si no esperabas este correo, avisa a contacto@coproactiva.cl.',
    '',
    'CoproActiva'
  ].join('\n');

  const html = plantilla({
    titulo: 'Restablecer acceso',
    saludo: `Hola, ${nombre.split(' ')[0]}`,
    parrafo: 'Administración generó un enlace para que definas una contraseña nueva.',
    boton: 'Crear contraseña nueva',
    enlace,
    aviso: `<strong>Sirve una sola vez y vence en ${dura}.</strong> Si no esperabas este correo, avisa a contacto@coproactiva.cl.`,
    cierre: 'Tu contraseña anterior deja de servir en cuanto uses este enlace.'
  });

  return { asunto, html, texto };
}

/* Enlace pedido por la propia persona desde la pantalla de acceso vencido.
 *
 * Se distingue de la reposición porque el motivo importa: acá nadie de
 * administración intervino. Si a alguien le llega este correo sin haberlo
 * pedido, es señal de que otro escribió su dirección, y el texto tiene que
 * decírselo con todas sus letras.
 */
export function renovacion(nombre: string, enlace: string, horas: number) {
  const asunto = 'Tu enlace de acceso a CoproActiva';
  const dura = vigencia(horas);

  const texto = [
    `Hola ${nombre.split(' ')[0]},`,
    '',
    'Pediste un enlace nuevo para entrar a CoproActiva. Acá está:',
    enlace,
    '',
    `Sirve una sola vez y vence en ${dura}.`,
    '',
    'Si no lo pediste tú, ignora este correo: tu cuenta sigue igual y nadie',
    'entró con ella. Si te llega varias veces, avisa a contacto@coproactiva.cl.',
    '',
    'CoproActiva'
  ].join('\n');

  const html = plantilla({
    titulo: 'Enlace de acceso',
    saludo: `Hola, ${nombre.split(' ')[0]}`,
    parrafo: 'Pediste un enlace nuevo para entrar a CoproActiva. Con él defines tu contraseña y entras.',
    boton: 'Entrar y crear mi contraseña',
    enlace,
    aviso: `<strong>Sirve una sola vez y vence en ${dura}.</strong>`,
    cierre: 'Si no lo pediste tú, ignora este correo: tu cuenta sigue igual y nadie ' +
      'entró con ella. Si te llega varias veces, avisa a contacto@coproactiva.cl.'
  });

  return { asunto, html, texto };
}
