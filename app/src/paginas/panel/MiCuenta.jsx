import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import './MiCuenta.css';

const DEFAULT_NAV = ['inicio', 'comunidades', 'levantamientos', 'notificaciones'];

const ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'comunidades', label: 'Comunidades' },
  { id: 'levantamientos', label: 'Levantamientos' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'plantillas', label: 'Plantillas', roles: ['superadmin', 'admin', 'jefatura'] },
  { id: 'bitacora', label: 'Bitácora' },
  { id: 'mantenciones', label: 'Mantenciones' },
  { id: 'mapa', label: 'Mapa' }
];

function etiquetaRol(rol) {
  const nombres = {
    superadmin: 'Superadministrador',
    admin: 'Administrador',
    jefatura: 'Jefatura',
    terreno: 'Terreno',
    cliente: 'Cliente'
  };
  return nombres[rol] || rol || '—';
}

export default function MiCuenta() {
  const navegar = useNavigate();
  const { perfil, recargarPerfil } = useSesion();
  useVolverGlobal(() => navegar('/inicio'));

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [barra, setBarra] = useState(DEFAULT_NAV);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const disponibles = useMemo(() => ITEMS.filter(item =>
    !item.roles || item.roles.includes(perfil?.rol)
  ), [perfil?.rol]);

  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.nombre || '');
    setTelefono(perfil.telefono || '');
    const preferida = Array.isArray(perfil.bottom_nav) && perfil.bottom_nav.length === 4
      ? perfil.bottom_nav
      : DEFAULT_NAV;
    const permitidos = new Set(disponibles.map(x => x.id));
    const validos = preferida.filter(id => permitidos.has(id));
    for (const item of disponibles) {
      if (validos.length >= 4) break;
      if (!validos.includes(item.id)) validos.push(item.id);
    }
    setBarra(validos.slice(0, 4));
  }, [perfil, disponibles]);

  function cambiarAcceso(pos, valor) {
    setBarra(xs => xs.map((x, i) => i === pos ? valor : x));
    setError(null);
    setAviso(null);
  }

  function restaurar() {
    const permitidos = new Set(disponibles.map(x => x.id));
    const base = DEFAULT_NAV.filter(id => permitidos.has(id));
    for (const item of disponibles) {
      if (base.length >= 4) break;
      if (!base.includes(item.id)) base.push(item.id);
    }
    setBarra(base.slice(0, 4));
    setError(null);
    setAviso(null);
  }

  async function guardar() {
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (barra.length !== 4 || barra.some(x => !x)) {
      return setError('Selecciona cuatro accesos para la barra inferior.');
    }
    if (new Set(barra).size !== barra.length) {
      return setError('No repitas accesos en la barra inferior.');
    }

    setGuardando(true);
    setError(null);
    setAviso(null);

    const { error } = await supabase.rpc('perfil_actualizar_mi_cuenta', {
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim() || null,
      p_bottom_nav: barra
    });

    if (error) {
      setGuardando(false);
      return setError(error.message);
    }

    await recargarPerfil?.();
    setGuardando(false);
    setAviso('Tus datos y preferencias se guardaron.');
  }

  return (
    <div className="pantalla mi-cuenta-pantalla">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
        </div>
        <h1 className="h3">Mi cuenta</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Revisa tus datos y personaliza los accesos de la aplicación.
        </p>
      </header>

      <div className="cuerpo mi-cuenta-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {aviso && <div className="aviso aviso-ok">{aviso}</div>}

        <section className="tarjeta mi-cuenta-seccion">
          <div className="mi-cuenta-seccion-cabecera">
            <div>
              <h2>Datos personales</h2>
              <p>Estos datos identifican tu cuenta dentro de CoproActiva.</p>
            </div>
          </div>

          <div className="mi-cuenta-form-grid">
            <label className="campo">
              <span className="etiqueta-campo">Nombre *</span>
              <input value={nombre} onChange={e => setNombre(e.target.value)} />
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Teléfono</span>
              <input value={telefono} onChange={e => setTelefono(e.target.value)}
                     inputMode="tel" placeholder="+56 9 1234 5678" />
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Correo</span>
              <input value={perfil?.email || ''} readOnly disabled />
              <span className="micro apagado">
                El correo de acceso lo define el superadministrador y no se puede modificar desde Mi cuenta.
              </span>
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Perfil</span>
              <input value={etiquetaRol(perfil?.rol)} readOnly disabled />
            </label>
          </div>
        </section>

        <section className="tarjeta mi-cuenta-seccion">
          <div className="mi-cuenta-seccion-cabecera">
            <div>
              <h2>Barra inferior</h2>
              <p>
                Elige cuatro accesos rápidos. <b>Más</b> siempre ocupa la quinta posición
                y muestra las opciones que no dejaste fijas.
              </p>
            </div>
            <button type="button" className="boton boton-texto" onClick={restaurar}>
              Restaurar
            </button>
          </div>

          <div className="mi-cuenta-nav-selectores">
            {barra.map((valor, i) => (
              <label className="campo" key={i}>
                <span className="etiqueta-campo">Acceso {i + 1}</span>
                <select value={valor} onChange={e => cambiarAcceso(i, e.target.value)}>
                  {disponibles.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mi-cuenta-preview">
            {barra.map(id => (
              <div key={id}>
                <span className="mi-cuenta-preview-icono">•</span>
                <small>{ITEMS.find(x => x.id === id)?.label || id}</small>
              </div>
            ))}
            <div>
              <span className="mi-cuenta-preview-icono">☰</span>
              <small>Más</small>
            </div>
          </div>
        </section>

        <button type="button" className="boton boton-movil mi-cuenta-guardar"
                disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
