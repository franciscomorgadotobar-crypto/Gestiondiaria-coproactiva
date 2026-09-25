import { createClient } from 'npm:@supabase/supabase-js@2';
import { invitacion, reposicion, enviar, hayCorreo } from '../_compartido/correo.ts';

/* Alta y mantención de usuarios del equipo.
 *
 * Existe porque crear una cuenta exige la clave `service_role`, que no puede
 * viajar al navegador: quien la tenga puede leer y escribir toda la base
 * saltándose las políticas. Acá vive en el servidor, y el navegador solo pide
 * la operación.
 *
 * La función no confía en quien la llama. Toma el token de la petición, resuelve
 * qué perfil es y comprueba sus permisos contra la base antes de tocar nada. Un
 * cliente puede mandar cualquier cosa en el cuerpo; lo que no puede es mentir
 * sobre quién es, porque eso sale del token firmado.
 *
 * Nadie escribe contraseñas ajenas. Al dar de alta a alguien se genera un enlace
 * de un solo uso y esa persona define la suya. Quien administra no llega a
 * conocerla, y no queda una clave viva en una bandeja de entrada.
 */

const URL_PROYECTO = Deno.env.get('SUPABASE_URL')!;
const CLAVE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_APP = Deno.env.get('URL_APP')
  ?? 'https://franciscomorgadotobar-crypto.github.io/cotizador-coproactiva/';

/* Tiene que coincidir con la expiración configurada en Supabase
 * (Authentication → Emails → Email OTP Expiration). Este número solo se
 * imprime en el correo: quien caduca el enlace es Supabase, no esta función.
 * Si los dos no dicen lo mismo, el correo promete una vigencia que el servidor
 * no respeta, y la persona ve "vencido" sin entender por qué. */
const HORAS_VIGENCIA = Number(Deno.env.get('HORAS_INVITACION') ?? '12');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

/* Una contraseña que nadie va a usar ni conocer. La cuenta necesita alguna
 * credencial para existir; la real la define su dueño con el enlace. */
function claveDeRelleno() {
  return crypto.randomUUID() + crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta la sesión' }, 401);

  const comoUsuario = createClient(URL_PROYECTO, CLAVE_ANON, {
    global: { headers: { Authorization: autorizacion } }
  });

  const { data: { user }, error: errorSesion } = await comoUsuario.auth.getUser();
  if (errorSesion || !user) return responder({ error: 'Sesión inválida' }, 401);

  const { data: quien } = await comoUsuario
    .from('perfiles').select('rol, activo').eq('id', user.id).maybeSingle();

  if (!quien || !quien.activo) return responder({ error: 'Perfil inactivo o inexistente' }, 403);
  if (quien.rol !== 'superadmin' && quien.rol !== 'admin') {
    return responder({ error: 'No tienes permiso para administrar usuarios' }, 403);
  }
  const esSuperadmin = quien.rol === 'superadmin';

  const admin = createClient(URL_PROYECTO, CLAVE_SERVICIO, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  const accion = String(cuerpo.accion ?? '');

  async function puedeTocar(perfilId: string) {
    if (esSuperadmin) return true;
    const { data } = await admin.from('perfiles').select('rol').eq('id', perfilId).maybeSingle();
    return data?.rol !== 'superadmin';
  }

  /* Genera el enlace de un solo uso.
   *
   * Se usa el `hashed_token` y no el `action_link` que arma Supabase: ese apunta
   * a /auth/v1/verify, que redirige dejando los tokens en el fragmento de la
   * URL. Con el token en mano, la app llama a verifyOtp directamente, sin
   * depender de cómo Supabase arme la redirección ni de que el fragmento
   * sobreviva al 404.html de GitHub Pages.
   */
  async function enlaceDeAcceso(email: string, tipo: 'recovery' | 'magiclink') {
    const { data, error } = await admin.auth.admin.generateLink({
      type: tipo,
      email,
      options: { redirectTo: `${URL_APP}clave` }
    });
    if (error || !data?.properties?.hashed_token) {
      throw new Error(error?.message ?? 'No se pudo generar el enlace');
    }
    return `${URL_APP}clave?t=${data.properties.hashed_token}&tipo=${tipo}`;
  }

  switch (accion) {
    // --------------------------------------------------------------- Crear
    case 'crear': {
      const nombre = String(cuerpo.nombre ?? '').trim();
      const email  = String(cuerpo.email ?? '').trim().toLowerCase();
      const rol    = String(cuerpo.rol ?? 'terreno');
      const comunidades = Array.isArray(cuerpo.comunidades) ? cuerpo.comunidades : [];

      if (!nombre) return responder({ error: 'Falta el nombre' }, 400);
      if (!email.includes('@')) return responder({ error: 'Correo inválido' }, 400);
      if (!['superadmin', 'admin', 'jefatura', 'terreno', 'cliente'].includes(rol)) {
        return responder({ error: 'Rol desconocido' }, 400);
      }
      if (rol === 'superadmin' && !esSuperadmin) {
        return responder({ error: 'Solo un superadmin puede crear otro superadmin' }, 403);
      }
      // Mismo permiso que asignar_rol_cliente: solo el superadmin decide
      // quién es cliente.
      if (rol === 'cliente' && !esSuperadmin) {
        return responder({ error: 'Solo un superadmin puede crear un cliente' }, 403);
      }
      if (!hayCorreo()) {
        return responder({
          error: 'El envío de correo no está configurado. Sin él no hay cómo entregar el enlace de acceso.'
        }, 400);
      }

      const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
        email,
        password: claveDeRelleno(),
        email_confirm: true,
        user_metadata: { nombre }
      });
      if (errorAlta) return responder({ error: errorAlta.message }, 400);

      const { error: errorPerfil } = await admin.from('perfiles').insert({
        id: creado.user.id, nombre, email, rol, activo: true
      });
      if (errorPerfil) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return responder({ error: errorPerfil.message }, 400);
      }

      // `perfil_comunidades` es la visibilidad de alguien del equipo, no la
      // de un cliente: la de un cliente vive en `portal_cliente_comunidades`
      // y se arma aparte, desde "Clientes y accesos".
      if (comunidades.length && rol !== 'cliente') {
        await admin.from('perfil_comunidades').insert(
          comunidades.map((c: string) => ({ perfil_id: creado.user.id, comunidad_id: c }))
        );
      }

      try {
        const enlace = await enlaceDeAcceso(email, 'recovery');
        const m = invitacion(nombre, rol, enlace, HORAS_VIGENCIA);
        const correo = await enviar(email, m.asunto, m.html, m.texto);
        return responder({ ok: true, id: creado.user.id, correo });
      } catch (e) {
        return responder({
          ok: true, id: creado.user.id,
          correo: { enviado: false, motivo: e instanceof Error ? e.message : String(e) }
        });
      }
    }

    // -------------------------------------------------------- Reenviar acceso
    case 'reenviar': {
      const perfilId = String(cuerpo.id ?? '');
      if (!await puedeTocar(perfilId)) {
        return responder({ error: 'No puedes reponer el acceso de un superadmin' }, 403);
      }

      const { data: p } = await admin.from('perfiles')
        .select('nombre, email, rol, activo').eq('id', perfilId).maybeSingle();
      if (!p) return responder({ error: 'Perfil no encontrado' }, 404);
      if (!p.activo) return responder({ error: 'Esta persona está dada de baja. Reactivala primero.' }, 400);

      try {
        const enlace = await enlaceDeAcceso(p.email, 'recovery');
        const nuevo = cuerpo.esInvitacion === true;
        const m = nuevo
          ? invitacion(p.nombre, p.rol, enlace, HORAS_VIGENCIA)
          : reposicion(p.nombre, enlace, HORAS_VIGENCIA);
        const correo = await enviar(p.email, m.asunto, m.html, m.texto);
        // El enlace vuelve también a la pantalla: si el correo no sale, todavía
        // se puede entregar por otro medio en vez de dejar a alguien sin acceso.
        return responder({ ok: true, correo, enlace: correo.enviado ? undefined : enlace });
      } catch (e) {
        return responder({ error: e instanceof Error ? e.message : String(e) }, 400);
      }
    }

    // ----------------------------------------------------------- Dar de baja
    case 'baja': {
      const perfilId = String(cuerpo.id ?? '');
      if (perfilId === user.id) {
        return responder({ error: 'No puedes darte de baja a ti mismo' }, 400);
      }
      if (!await puedeTocar(perfilId)) {
        return responder({ error: 'No puedes dar de baja a un superadmin' }, 403);
      }

      const { error } = await admin.from('perfiles').update({ activo: false }).eq('id', perfilId);
      if (error) return responder({ error: error.message }, 400);
      await admin.auth.admin.signOut(perfilId, 'global').catch(() => {});
      return responder({ ok: true });
    }

    case 'alta': {
      const perfilId = String(cuerpo.id ?? '');
      if (!await puedeTocar(perfilId)) return responder({ error: 'Sin permiso' }, 403);
      const { error } = await admin.from('perfiles').update({ activo: true }).eq('id', perfilId);
      if (error) return responder({ error: error.message }, 400);
      return responder({ ok: true });
    }

    /* Prueba de envío: manda un correo a quien lo pide, para verificar la
     * configuración sin tener que crear un usuario de mentira. */
    case 'probar': {
      const { data: yo } = await admin.from('perfiles')
        .select('nombre, email').eq('id', user.id).maybeSingle();
      if (!yo) return responder({ error: 'Perfil no encontrado' }, 404);
      const m = reposicion(yo.nombre, `${URL_APP}`, HORAS_VIGENCIA);
      const correo = await enviar(
        yo.email, 'Prueba de envío de CoproActiva',
        m.html.replace('Administración generó un enlace para que definas una contraseña nueva.',
                       'Este es un correo de prueba. Si te llegó, el envío está bien configurado.'),
        'Correo de prueba de CoproActiva. Si te llegó, el envío está bien configurado.'
      );
      return responder({ ok: true, correo });
    }

    case 'estado':
      return responder({ ok: true, correo: hayCorreo(), horas: HORAS_VIGENCIA });

    default:
      return responder({ error: 'Acción desconocida' }, 400);
  }
});
