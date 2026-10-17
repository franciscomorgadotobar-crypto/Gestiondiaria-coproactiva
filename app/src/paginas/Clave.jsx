import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* Definir la contraseña propia desde un enlace de un solo uso.
 *
 * El enlace trae un token que se canjea por una sesión momentánea, y con esa
 * sesión la persona escribe su clave. Nadie más la conoce: ni quien la dio de
 * alta ni quien administra el sistema.
 *
 * Se usa el token directamente con verifyOtp en vez del enlace que arma
 * Supabase, que redirige dejando los tokens en el fragmento de la URL. El
 * fragmento no siempre sobrevive al 404.html con que GitHub Pages resuelve las
 * rutas, y depender de eso haría que el acceso fallara sin explicación.
 *
 * Vencer es lo normal, no la excepción: el correo llega mientras la persona
 * está en terreno y lo abre horas después. Por eso la pantalla de vencido no es
 * un callejón sin salida —pídeselo a administración— sino el lugar donde pide
 * otro enlace y sigue.
 */
const MARCA = 'coproactiva:enlace-canjeado';

export default function Clave() {
  const [params] = useSearchParams();
  const navegar = useNavigate();

  const [estado, setEstado] = useState('validando');  // validando | listo | vencido | guardado
  const [error, setError] = useState(null);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Petición de un enlace nuevo desde la pantalla de vencido.
  const [correo, setCorreo] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [pedido, setPedido] = useState(null);

  const token = params.get('t');

  useEffect(() => {
    if (!token) { setEstado('vencido'); return; }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: params.get('tipo') === 'magiclink' ? 'magiclink' : 'recovery'
      });
      if (!error) {
        // Queda anotado en la pestaña qué token se canjeó, para sobrevivir a
        // una recarga sin tener que aceptar cualquier sesión abierta.
        try { sessionStorage.setItem(MARCA, token); } catch { /* modo privado */ }
        return setEstado('listo');
      }

      /* El token sirve una sola vez, así que una recarga de la página lo
       * encuentra gastado. Si la primera vez funcionó, la sesión sigue abierta
       * y con ella se puede definir la clave igual; mostrar "vencido" ahí sería
       * mentir y obligar a empezar de nuevo sin motivo.
       *
       * Pero no basta con que exista una sesión: en un teléfono compartido bien
       * puede ser la de otra persona, y entonces esta pantalla le cambiaría la
       * contraseña a ella. Solo vale si esta misma pestaña canjeó este mismo
       * token. */
      let canjeado = null;
      try { canjeado = sessionStorage.getItem(MARCA); } catch { /* modo privado */ }
      if (canjeado !== token) return setEstado('vencido');

      const { data } = await supabase.auth.getSession();
      setEstado(data?.session ? 'listo' : 'vencido');
    })();
  }, [token]);

  async function guardar(e) {
    e.preventDefault();
    if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (clave !== repetida) return setError('Las dos contraseñas no coinciden.');

    setGuardando(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) return setError(error.message);

    setEstado('guardado');
    // Se queda la sesión abierta: acaba de demostrar que controla el correo y
    // que sabe su clave. Pedirle iniciar sesión de nuevo no agrega seguridad.
    setTimeout(() => navegar('/', { replace: true }), 1600);
  }

  /* La respuesta del servidor es siempre la misma, exista o no la dirección: si
   * variara, esta pantalla serviría para averiguar quién trabaja acá. Acá se
   * repite tal cual, sin adornarla con un "listo" que insinúe que sí existe. */
  async function pedirEnlace(e) {
    e.preventDefault();
    setPidiendo(true);
    const { data, error } = await supabase.functions.invoke('acceso', {
      body: { email: correo.trim().toLowerCase() }
    });
    setPidiendo(false);
    setPedido(error
      ? { ok: false, texto: 'No se pudo pedir el enlace. Revisa tu conexión e inténtalo de nuevo.' }
      : { ok: true, texto: data?.mensaje ?? 'Si esa dirección está registrada, le llegará un enlace.' });
  }

  return (
    <div className="pantalla acceso-pantalla" style={{ justifyContent: 'center', padding: '24px 20px' }}>
      <div className="acceso-panel" style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <img src={import.meta.env.BASE_URL + 'brand/imagologo-horizontal-naranja.svg'}
             alt="CoproActiva" style={{ height: 26, marginBottom: 28 }} />

        {estado === 'validando' && <p className="cargando">Comprobando el enlace…</p>}

        {estado === 'vencido' && (
          <>
            {token ? (
              <>
                <h1 className="h2" style={{ marginBottom: 6 }}>Este enlace ya no sirve</h1>
                <p className="chico apagado" style={{ margin: '0 0 20px' }}>
                  Los enlaces de acceso valen una sola vez y caducan a las pocas horas.
                  Escribe tu correo y te mandamos uno nuevo.
                </p>
              </>
            ) : (
              <>
                <h1 className="h2" style={{ marginBottom: 6 }}>¿Olvidaste tu contraseña?</h1>
                <p className="chico apagado" style={{ margin: '0 0 20px' }}>
                  Escribe tu correo y te mandamos un enlace de un solo uso para crear una
                  contraseña nueva.
                </p>
              </>
            )}

            {pedido?.ok ? (
              <div className="aviso" role="status">
                <p style={{ margin: 0 }}>{pedido.texto}</p>
                <p className="micro apagado" style={{ margin: '8px 0 0' }}>
                  Revisa también la carpeta de correo no deseado. Llega desde
                  contacto@coproactiva.cl.
                </p>
              </div>
            ) : (
              <form onSubmit={pedirEnlace}>
                <div className="campo">
                  <label className="etiqueta-campo" htmlFor="correo">Tu correo</label>
                  <input id="correo" type="email" value={correo} required
                         autoComplete="email" inputMode="email"
                         placeholder="nombre@coproactiva.cl"
                         onChange={e => setCorreo(e.target.value)} />
                </div>

                {pedido && !pedido.ok && (
                  <p className="mensaje-error" role="alert">{pedido.texto}</p>
                )}

                <button className="boton boton-movil boton-ancho" style={{ marginTop: 4 }}
                        disabled={pidiendo}>
                  {pidiendo ? 'Enviando…' : 'Enviarme un enlace nuevo'}
                </button>
              </form>
            )}

            <button className="boton boton-texto boton-ancho" style={{ marginTop: 14 }}
                    onClick={() => navegar('/ingreso', { replace: true })}>
              Ya tengo contraseña, quiero entrar
            </button>
          </>
        )}

        {estado === 'guardado' && (
          <>
            <h1 className="h2" style={{ marginBottom: 6 }}>Listo</h1>
            <p className="chico apagado" style={{ margin: 0 }}>
              Tu contraseña quedó guardada. Entrando…
            </p>
          </>
        )}

        {estado === 'listo' && (
          <>
            <h1 className="h2" style={{ marginBottom: 6 }}>Crea tu contraseña</h1>
            <p className="chico apagado" style={{ margin: '0 0 24px' }}>
              La eliges tú y nadie más la conoce.
            </p>

            <form onSubmit={guardar}>
              <div className={'campo' + (error ? ' campo-error' : '')}>
                <label className="etiqueta-campo" htmlFor="clave">Contraseña</label>
                <input id="clave" type="password" value={clave} autoComplete="new-password"
                       required minLength={8}
                       onChange={e => setClave(e.target.value)} />
                <p className="micro apagado" style={{ margin: '5px 0 0' }}>Mínimo 8 caracteres</p>
              </div>

              <div className={'campo' + (error ? ' campo-error' : '')}>
                <label className="etiqueta-campo" htmlFor="repetida">Repítela</label>
                <input id="repetida" type="password" value={repetida} autoComplete="new-password"
                       required onChange={e => setRepetida(e.target.value)} />
              </div>

              {error && <p className="mensaje-error" role="alert">{error}</p>}

              <button className="boton boton-movil boton-ancho" style={{ marginTop: 16 }}
                      disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar y entrar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
