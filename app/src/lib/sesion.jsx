import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fijarUsuarioArea } from './area';

const Contexto = createContext(null);

/* El perfil (nombre y rol) vive en la tabla `perfiles`, no en el token. Se carga
 * junto con la sesión porque casi toda la interfaz depende del rol: qué ve la
 * barra de navegación, si aparece el CRM, si un control es editable. */
export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    supabase.auth.getSession().then(({ data }) => {
      if (vigente) aplicar(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (vigente) aplicar(s);
    });

    async function aplicar(s) {
      setSesion(s);
      // Antes que el perfil: al dibujarse, las pantallas consultan el área
      // guardada de este usuario, no la de quien usó el equipo antes.
      fijarUsuarioArea(s?.user?.id);
      if (!s) {
        setPerfil(null);
        setCargando(false);
        return;
      }
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, email, rol, activo')
        .eq('id', s.user.id)
        .maybeSingle();
      if (!vigente) return;
      if (error) console.error('No se pudo cargar el perfil:', error.message);
      setPerfil(data ?? null);
      setCargando(false);
    }

    return () => {
      vigente = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const valor = {
    sesion,
    perfil,
    cargando,
    rol: perfil?.rol ?? null,
    esAdmin: perfil?.rol === 'superadmin' || perfil?.rol === 'admin',
    salir: () => supabase.auth.signOut()
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return v;
}
