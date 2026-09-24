import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';

/* Administración del equipo: quién entra y qué ve.
 *
 * Los permisos son dos cosas distintas y las dos importan: el rol define qué
 * puede hacer, y las comunidades asignadas definen sobre qué. Alguien sin
 * comunidades asignadas entra y no ve nada; el rol solo no alcanza. Solo el
 * superadmin escapa de esto: ve todas las comunidades sin asignación, porque
 * es quien decide las del resto.
 *
 * Crear la cuenta pasa por una función en el servidor, porque dar de alta un
 * usuario exige una clave privilegiada que no puede estar en el navegador. Lo
 * demás —rol, asignaciones, nombre— se escribe directo contra la base, donde
 * las políticas ya limitan quién puede tocar a quién.
 */

const ROLES = [
  ['terreno',   'Terreno',    'Solo sus comunidades y sus propios levantamientos. Sin acceso al CRM.'],
  ['jefatura',  'Jefatura',   'Sus comunidades asignadas, el embudo comercial, y puede corregir levantamientos ajenos.'],
  ['admin',     'Administración', 'Sus comunidades asignadas, crear y dar de baja, administrar el equipo.'],
  ['superadmin', 'Superadmin', 'Todas las comunidades sin necesidad de asignación, y puede crear y modificar otros superadmin.']
];

export default function Equipo() {
  const navegar = useNavigate();
  const { perfil } = useSesion();

  const [gente, setGente] = useState(null);
  const [comunidades, setComunidades] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [creando, setCreando] = useState(false);
  // Quien ya no trabaja acá se da de baja, no se borra —queda la historia de
  // sus levantamientos—, pero no por eso tiene que seguir ocupando espacio en
  // esta lista cada vez que se busca a alguien del equipo actual.
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // null = todavía no se sabe. Se consulta al servidor porque la clave del
  // correo vive ahí; el navegador no tiene cómo saberlo por su cuenta.
  const [correoListo, setCorreoListo] = useState(null);
  const [horas, setHoras] = useState(24);
  // Cuando el correo falla, el enlace igual sirve: se muestra para poder
  // entregarlo por otro medio en vez de dejar a alguien sin acceso.
  const [enlace, setEnlace] = useState(null);

  const esSuperadmin = perfil?.rol === 'superadmin';

  useEffect(() => {
    cargar();
    servidor({ accion: 'estado' })
      .then(r => { setCorreoListo(Boolean(r.correo)); if (r.horas) setHoras(r.horas); })
      .catch(() => setCorreoListo(false));
  }, []);

  async function cargar() {
    const [p, c, a] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, email, rol, activo, ultimo_acceso').order('nombre'),
      supabase.from('comunidades').select('id, nombre').order('nombre'),
      supabase.from('perfil_comunidades').select('perfil_id, comunidad_id')
    ]);
    if (p.error) return setError(p.error.message);
    setGente(p.data ?? []);
    setComunidades(c.data ?? []);

    const mapa = {};
    for (const fila of a.data ?? []) {
      (mapa[fila.perfil_id] ??= []).push(fila.comunidad_id);
    }
    setAsignaciones(mapa);
  }

  /* Llama a la función del servidor con el token de la sesión actual. Ella
   * verifica el permiso contra la base: acá no se decide nada, solo se pide. */
  async function servidor(cuerpo) {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/equipo`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cuerpo)
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error ?? 'No se pudo completar la operación');
    return datos;
  }

  async function cambiarRol(persona, rol) {
    setOcupado(true);
    setError(null);
    const { error } = await supabase.from('perfiles').update({ rol }).eq('id', persona.id);
    setOcupado(false);
    if (error) return setError(error.message);
    setGente(xs => xs.map(x => (x.id === persona.id ? { ...x, rol } : x)));
  }

  async function cambiarComunidad(persona, comunidadId, asignar) {
    setError(null);
    const actuales = asignaciones[persona.id] ?? [];
    setAsignaciones(a => ({
      ...a,
      [persona.id]: asignar ? [...actuales, comunidadId] : actuales.filter(c => c !== comunidadId)
    }));

    const { error } = asignar
      ? await supabase.from('perfil_comunidades')
          .insert({ perfil_id: persona.id, comunidad_id: comunidadId })
      : await supabase.from('perfil_comunidades')
          .delete().eq('perfil_id', persona.id).eq('comunidad_id', comunidadId);

    if (error) { setError(error.message); cargar(); }
  }

  async function cambiarEstado(persona) {
    setOcupado(true);
    setError(null);
    try {
      await servidor({ accion: persona.activo ? 'baja' : 'alta', id: persona.id });
      setGente(xs => xs.map(x => (x.id === persona.id ? { ...x, activo: !x.activo } : x)));
      setAviso(persona.activo
        ? `${persona.nombre} quedó fuera. Su sesión se cerró en todos sus dispositivos.`
        : `${persona.nombre} puede volver a entrar.`);
    } catch (e) { setError(e.message); }
    setOcupado(false);
  }

  /* Ni acá ni en el servidor se escribe una contraseña ajena: se manda un enlace
   * de un solo uso y esa persona define la suya. Sirve igual para una invitación
   * que venció sin usarse y para alguien que perdió su clave. */
  async function reenviarAcceso(persona) {
    if (!confirm(
      `Se le enviará a ${persona.email} un enlace para crear una contraseña nueva. ` +
      'El enlace anterior, si lo había, deja de servir.'
    )) return;

    setOcupado(true);
    setError(null);
    try {
      const r = await servidor({ accion: 'reenviar', id: persona.id });
      if (r.correo?.enviado) {
        setEnlace(null);
        setAviso(`Enlace enviado a ${persona.email}. Vence en ${horas} horas.`);
      } else {
        setEnlace({ persona: persona.nombre, url: r.enlace });
        setAviso(`El correo no salió (${r.correo?.motivo ?? 'sin detalle'}).`);
      }
    } catch (e) { setError(e.message); }
    setOcupado(false);
  }

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/configuracion')}>
            ‹ Configuración
          </button>
          <span className="crece" />
          {ocupado && <span className="micro apagado">Guardando…</span>}
        </div>
        <h1 className="h3">Equipo</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Quién entra y qué ve
        </p>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}
        {aviso && (
          <div className="aviso" style={{ marginBottom: 12 }}>
            {aviso}
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={() => setAviso(null)}>Entendido</button>
          </div>
        )}

        {enlace?.url && (
          <div className="aviso" style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 6px' }}>
              Este es el enlace de acceso de {enlace.persona}. Sirve una sola vez y
              vence en {horas} horas: entrégaselo por WhatsApp o dictándoselo.
            </p>
            <p className="enlace-acceso">{enlace.url}</p>
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={() => { navigator.clipboard?.writeText(enlace.url); setEnlace(null); }}>
              Copiar y cerrar
            </button>
          </div>
        )}

        {correoListo && (
          <button className="boton boton-secundario boton-ancho" style={{ marginBottom: 12 }}
                  disabled={ocupado}
                  onClick={async () => {
                    setOcupado(true); setError(null);
                    try {
                      const r = await servidor({ accion: 'probar' });
                      setAviso(r.correo?.enviado
                        ? `Correo de prueba enviado a ${perfil.email}. Revisa tu bandeja.`
                        : `El envío falló: ${r.correo?.motivo ?? 'sin detalle'}`);
                    } catch (e) { setError(e.message); }
                    setOcupado(false);
                  }}>
            Probar el envío de correo
          </button>
        )}

        {correoListo === false && (
          <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>
            El envío de correo no está configurado. Sin él no hay cómo entregar el
            enlace de acceso, así que no se pueden dar de alta usuarios todavía.
          </div>
        )}

        {creando ? (
          <Alta
            comunidades={comunidades}
            esSuperadmin={esSuperadmin}
            correoListo={correoListo}
            onCancelar={() => setCreando(false)}
            onCrear={async datos => {
              setOcupado(true);
              setError(null);
              try {
                const r = await servidor({ accion: 'crear', ...datos });
                setCreando(false);
                // Se dice si el correo salió o no. Dar por hecho que llegó y que
                // no haya salido deja a la persona esperando un correo que no
                // existe y a nadie entregándole la clave.
                setAviso(r.correo?.enviado
                  ? `Invitación enviada a ${datos.email}. Tiene ${horas} horas para crear su contraseña.`
                  : `La cuenta quedó creada, pero el correo no salió (${r.correo?.motivo ?? 'sin detalle'}). Usa "Reenviar acceso" cuando esté resuelto.`);
                await cargar();
              } catch (e) { setError(e.message); }
              setOcupado(false);
            }}
          />
        ) : (
          <button className="boton boton-movil boton-ancho" style={{ marginBottom: 16 }}
                  onClick={() => setCreando(true)}>
            Agregar persona
          </button>
        )}

        {gente === null && !error && <p className="cargando">Cargando…</p>}

        {gente && gente.some(p => !p.activo) && (
          <label className="marca" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={mostrarInactivos}
                   onChange={e => setMostrarInactivos(e.target.checked)} />
            <span>Mostrar dados de baja ({gente.filter(p => !p.activo).length})</span>
          </label>
        )}

        {gente?.filter(p => mostrarInactivos || p.activo).map(persona => {
          const desplegada = abierto === persona.id;
          const mias = asignaciones[persona.id] ?? [];
          // Un admin no puede tocar a un superadmin, ni ascender a nadie a ese
          // rol. La base lo impide igual; acá se refleja para no ofrecer algo
          // que va a fallar.
          const bloqueada = persona.rol === 'superadmin' && !esSuperadmin;
          const yo = persona.id === perfil?.id;

          return (
            <article key={persona.id}
                     className={'tarjeta persona' + (persona.activo ? '' : ' inactiva')}>
              <button type="button" className="cabecera" aria-expanded={desplegada}
                      onClick={() => setAbierto(desplegada ? null : persona.id)}>
                <span className="crece">
                  {persona.nombre}{yo && <span className="tu"> · tú</span>}
                  <span className="correo">{persona.email}</span>
                </span>
                <span className={'chip ' + (persona.activo ? 'chip-cumple' : 'chip-pendiente')}>
                  {persona.activo ? ROLES.find(r => r[0] === persona.rol)?.[1] ?? persona.rol : 'Inactivo'}
                </span>
                <span className="flecha" aria-hidden="true">{desplegada ? '−' : '+'}</span>
              </button>

              {desplegada && (
                <div className="detalle">
                  {bloqueada && (
                    <p className="micro apagado" style={{ marginTop: 0 }}>
                      Solo un superadmin puede modificar este perfil.
                    </p>
                  )}

                  <div className="campo">
                    <label className="etiqueta-campo">Rol</label>
                    <select value={persona.rol} disabled={bloqueada || ocupado}
                            onChange={e => cambiarRol(persona, e.target.value)}>
                      {ROLES
                        // El rol superadmin solo lo ofrece otro superadmin.
                        .filter(([valor]) => valor !== 'superadmin' || esSuperadmin)
                        .map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>{etiqueta}</option>
                        ))}
                    </select>
                    <p className="micro apagado" style={{ margin: '5px 0 0' }}>
                      {ROLES.find(r => r[0] === persona.rol)?.[2]}
                    </p>
                  </div>

                  {/* Solo el superadmin ve todas las comunidades por su rol. El
                      resto —admin incluido— ve únicamente lo que se le asigna
                      acá: es lo que decide el superadmin, no el cargo. */}
                  {persona.rol !== 'superadmin' && (
                    <div className="campo">
                      <label className="etiqueta-campo">Comunidades que ve</label>
                      {comunidades.length === 0 && (
                        <p className="micro apagado">Todavía no hay comunidades.</p>
                      )}
                      <div className="lista-marcas">
                        {comunidades.map(c => (
                          <label key={c.id} className={'marca' + (mias.includes(c.id) ? ' activa' : '')}>
                            <input type="checkbox" checked={mias.includes(c.id)} disabled={bloqueada}
                                   onChange={e => cambiarComunidad(persona, c.id, e.target.checked)} />
                            <span>{c.nombre}</span>
                          </label>
                        ))}
                      </div>
                      {mias.length === 0 && (
                        <p className="micro" style={{ color: 'var(--alerta-texto)', margin: '5px 0 0' }}>
                          Sin comunidades asignadas esta persona entra y no ve nada.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="fila" style={{ gap: 8, marginTop: 12 }}>
                    <button className="boton boton-secundario crece"
                            disabled={bloqueada || ocupado || !persona.activo}
                            onClick={() => reenviarAcceso(persona)}>
                      Reenviar acceso
                    </button>
                    <button className="boton boton-secundario crece"
                            disabled={bloqueada || ocupado || yo}
                            title={yo ? 'No puedes darte de baja a ti mismo' : undefined}
                            onClick={() => cambiarEstado(persona)}>
                      {persona.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Alta({ comunidades, esSuperadmin, correoListo, onCrear, onCancelar }) {
  const [datos, setDatos] = useState({
    nombre: '', email: '', rol: 'terreno', comunidades: []
  });

  // Solo un superadmin no necesita asignación: ve todo por su rol.
  const necesitaComunidades = datos.rol !== 'superadmin';

  return (
    <div className="tarjeta" style={{ padding: 16, marginBottom: 16 }}>
      <h2 className="h4" style={{ margin: '0 0 14px' }}>Agregar persona</h2>

      <div className="campo">
        <label className="etiqueta-campo" htmlFor="nombre">Nombre</label>
        <input id="nombre" type="text" value={datos.nombre}
               onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
      </div>

      <div className="campo">
        <label className="etiqueta-campo" htmlFor="correo">Correo</label>
        <input id="correo" type="email" inputMode="email" value={datos.email}
               onChange={e => setDatos({ ...datos, email: e.target.value })} />
      </div>

      <div className="campo">
        <label className="etiqueta-campo" htmlFor="rol-nuevo">Rol</label>
        <select id="rol-nuevo" value={datos.rol}
                onChange={e => setDatos({ ...datos, rol: e.target.value })}>
          {ROLES
            .filter(([valor]) => valor !== 'superadmin' || esSuperadmin)
            .map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
        </select>
        <p className="micro apagado" style={{ margin: '5px 0 0' }}>
          {ROLES.find(r => r[0] === datos.rol)?.[2]}
        </p>
      </div>

      {necesitaComunidades && comunidades.length > 0 && (
        <div className="campo">
          <label className="etiqueta-campo">Comunidades que verá</label>
          <div className="lista-marcas">
            {comunidades.map(c => {
              const marcada = datos.comunidades.includes(c.id);
              return (
                <label key={c.id} className={'marca' + (marcada ? ' activa' : '')}>
                  <input type="checkbox" checked={marcada}
                         onChange={() => setDatos({
                           ...datos,
                           comunidades: marcada
                             ? datos.comunidades.filter(x => x !== c.id)
                             : [...datos.comunidades, c.id]
                         })} />
                  <span>{c.nombre}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <p className="micro apagado" style={{ margin: '0 0 14px' }}>
        No se define contraseña acá. Le llega un enlace de un solo uso para que
        cree la suya, y nadie más llega a conocerla.
      </p>

      <div className="fila" style={{ gap: 8, marginTop: 6 }}>
        <button className="boton boton-secundario crece" onClick={onCancelar}>Cancelar</button>
        <button className="boton crece"
                disabled={!datos.nombre || !datos.email.includes('@') || correoListo === false}
                onClick={() => onCrear(datos)}>
          Crear e invitar
        </button>
      </div>
    </div>
  );
}
