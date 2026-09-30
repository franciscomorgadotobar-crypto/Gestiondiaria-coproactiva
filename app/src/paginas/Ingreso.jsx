import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, hayCredenciales } from '../lib/supabase';

export default function Ingreso() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
    if (error) {
      // El mensaje de Supabase viene en inglés y es genérico a propósito: no
      // revela si el correo existe. Se traduce manteniendo esa discreción.
      setError(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message
      );
      setEnviando(false);
    }
    // Si entra, el cambio de sesión redirige solo desde App.
  }

  return (
    <div className="pantalla" style={{ justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
        {/* BASE_URL, no una ruta absoluta: si la app se publica bajo una
            subcarpeta, "/logo…" apuntaría fuera del proyecto. */}
        <img src={import.meta.env.BASE_URL + 'logo-coproactiva.svg'}
             alt="CoproActiva" style={{ height: 26, marginBottom: 28 }} />

        <h1 className="h2" style={{ marginBottom: 6 }}>Ingresar</h1>
        <p className="chico apagado" style={{ margin: '0 0 24px' }}>
          Administración de comunidades
        </p>

        {!hayCredenciales && (
          <div className="aviso" style={{ marginBottom: 18 }}>
            Falta configurar la conexión con Supabase. Revisa <code>app/.env</code>.
          </div>
        )}

        <form onSubmit={entrar}>
          <div className={'campo' + (error ? ' campo-error' : '')}>
            <label className="etiqueta-campo" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              required
            />
          </div>

          <div className={'campo' + (error ? ' campo-error' : '')}>
            <label className="etiqueta-campo" htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              type="password"
              value={clave}
              onChange={e => setClave(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="mensaje-error" role="alert">{error}</p>}

          <button
            className="boton boton-movil boton-ancho"
            style={{ marginTop: 16 }}
            disabled={enviando || !hayCredenciales}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="micro" style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/clave">¿Olvidaste tu contraseña?</Link>
        </p>

        <p className="micro" style={{ marginTop: 22 }}>
          ¿Problemas para entrar? Escribe a contacto@coproactiva.cl
        </p>
      </div>
    </div>
  );
}
