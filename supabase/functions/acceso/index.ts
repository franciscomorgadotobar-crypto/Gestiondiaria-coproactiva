import { createClient } from 'npm:@supabase/supabase-js@2';
import { renovacion, enviar, hayCorreo } from '../_compartido/correo.ts';

/* Pedir un enlace de acceso sin tener sesión.
 *
 * Los enlaces vencen, y hasta ahora vencer significaba escribirle a
 * administración y esperar. Para alguien que está parado en la entrada de un
 * edificio a punto de empezar un levantamiento, eso es quedarse fuera.
 *
 * Es la única función que se abre sin sesión, así que asume que quien llama es
 * hostil y se defiende de tres cosas:
 *
 *  1. Averiguar quién trabaja acá. La respuesta es siempre la misma —exista el
 *     correo o no, esté activo o no— y el envío sale en segundo plano, para que
 *     tampoco el tiempo de respuesta delate la diferencia.
 *
 *  2. Usarla para llenarle la bandeja a alguien, o para quemar la cuota diaria
 *     de la casilla contacto@coproactiva.cl. De ahí el límite por dirección y
 *     por origen.
 *
 *  3. Entrar. No puede: el enlace no vuelve en la respuesta, se va al correo de
 *     la persona. Quien no controle esa casilla no obtiene nada.
 */

const URL_PROYECTO   = Deno.env.get('SUPABASE_URL')!;
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_APP = Deno.env.get('URL_APP')
  ?? 'https://app.coproactiva.cl/';

const HORAS_VIGENCIA = Number(Deno.env.get('HORAS_INVITACION') ?? '12');

// Tres seguidos alcanzan para el que se equivoca de correo o no ve el primero;
// más que eso ya no es alguien intentando entrar a su cuenta.
const TOPE_POR_CORREO = 3;
const TOPE_POR_ORIGEN = 12;
const VENTANA_MINUTOS = 15;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/* Una sola respuesta para todos los caminos. Cualquier variación —un texto
 * distinto, un código distinto— convierte a esta función en un buscador de
 * correos registrados. */
function recibido() {
  return new Response(
    JSON.stringify({
      ok: true,
      mensaje: 'Si esa dirección está registrada, le llegará un enlace en unos minutos.'
    }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let email = '';
  try {
    const cuerpo = await req.json();
    email = String(cuerpo.email ?? '').trim().toLowerCase();
  } catch { /* cuerpo ilegible: se responde lo mismo que a todo lo demás */ }

  if (!email.includes('@') || email.length > 254) return recibido();

  const admin = createClient(URL_PROYECTO, CLAVE_SERVICIO, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // El primero de la lista es el cliente; el resto lo agregan los proxies.
  const origen = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-origen';
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();

  /* Se anota antes de decidir. Anotar solo lo que se envía dejaría ver, por el
   * conteo, cuáles direcciones existen. */
  await admin.from('solicitudes_de_acceso').insert({ email, origen });

  const [porCorreo, porOrigen] = await Promise.all([
    admin.from('solicitudes_de_acceso').select('id', { count: 'exact', head: true })
      .eq('email', email).gte('creado_en', desde),
    admin.from('solicitudes_de_acceso').select('id', { count: 'exact', head: true })
      .eq('origen', origen).gte('creado_en', desde)
  ]);

  if ((porCorreo.count ?? 0) > TOPE_POR_CORREO || (porOrigen.count ?? 0) > TOPE_POR_ORIGEN) {
    return recibido();
  }

  /* El trabajo de verdad va en segundo plano: buscar el perfil, generar el
   * enlace y enviarlo tarda distinto según si la dirección existe, y esa
   * diferencia de tiempo es en sí una respuesta. waitUntil deja que termine
   * después de contestar. */
  const tarea = (async () => {
    try {
      if (!hayCorreo()) return;

      const { data: p } = await admin.from('perfiles')
        .select('nombre, email, activo').eq('email', email).maybeSingle();

      // A quien está dado de baja no se le manda nada: el enlace le serviría
      // para entrar y toparse con el aviso de cuenta desactivada.
      if (!p || !p.activo) return;

      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery', email: p.email, options: { redirectTo: `${URL_APP}clave` }
      });
      if (error || !data?.properties?.hashed_token) return;

      const enlace = `${URL_APP}clave?t=${data.properties.hashed_token}&tipo=recovery`;
      const m = renovacion(p.nombre, enlace, HORAS_VIGENCIA);
      await enviar(p.email, m.asunto, m.html, m.texto);
    } catch { /* nada que informar: quien pidió ya recibió su respuesta */ }

    // Limpieza oportunista: la tabla solo sirve para contar los últimos
    // minutos, y sin esto crecería para siempre.
    await admin.from('solicitudes_de_acceso')
      .delete().lt('creado_en', new Date(Date.now() - 86_400_000).toISOString());
  })();

  // @ts-ignore: EdgeRuntime lo entrega el entorno de Supabase, no Deno.
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(tarea);
  else await tarea;

  return recibido();
});
