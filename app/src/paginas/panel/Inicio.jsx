import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { AvisoConexion } from '../../lib/estado';
import Campana from '../../componentes/Campana';
import MapaPrevio from '../../componentes/MapaPrevio';
import { hayConexion } from '../../lib/sincronizacion';
import { leerControles, guardarControl, borrarControlLocal } from '../../lib/local';
import Confirmar from '../../componentes/Confirmar';

const CHIP = {
  pendiente: ['chip-pendiente', 'Pendiente'],
  en_curso: ['chip-alerta', 'En curso'],
  pausado: ['chip-pausado', 'En pausa'],
  enviado: ['chip-cumple', 'Enviado'],
  anulado: ['chip-pendiente', 'Anulado']
};

export default function Inicio() {
  const { perfil, salir } = useSesion();
  const [controles, setControles] = useState(null);
  const [error, setError] = useState(null);
  const [ajustes, setAjustes] = useState(false);
  // Qué grupos están abiertos, por sección. Se abre el propio en lo pendiente:
  // lo primero que uno mira al entrar es su propio día. Lo realizado arranca
  // cerrado, porque es consulta y no trabajo.
  const [abiertos, setAbiertos] = useState(null);
  const [abiertosHechos, setAbiertosHechos] = useState(() => new Set());

  const puedeConfigurar = perfil && ['superadmin', 'admin', 'jefatura'].includes(perfil.rol);
  // Jefatura arma plantillas y programa visitas, pero no da de alta usuarios.
  const esAdministracion = perfil && ['superadmin', 'admin'].includes(perfil.rol);
  // Borrar un levantamiento se lleva su historia completa —fotos, respuestas,
  // firma—: un alcance mayor que editarlo, reservado al superadmin.
  const puedeBorrar = perfil?.rol === 'superadmin';
  const [porBorrar, setPorBorrar] = useState(null);

  useEffect(() => {
    let vigente = true;

    // Sin señal se muestra lo descargado: llegar a un edificio y ver una lista
    // vacía porque no hay red haría la app inútil justo cuando se necesita.
    if (!hayConexion()) {
      leerControles().then(l => vigente && setControles(l));
      return () => { vigente = false; };
    }

    supabase
      .from('controles_con_avance')
      .select('id, comunidad_id, prospecto_id, estado, periodo, programado_para, enviado_en, creado_en, checkin_en, checkin_lat, checkin_lng, responsable_id, responsable_nombre, items_evaluados, items_totales, items_criticos, fotos, destino_nombre, destino_direccion, destino_comuna, destino_tipo, plantilla_nombre')
      .order('programado_para', { ascending: true })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          setError(error.message);
          leerControles().then(l => vigente && setControles(l));
        } else {
          setControles(data ?? []);
          for (const c of data ?? []) guardarControl(c);
        }
      });

    return () => { vigente = false; };
  }, []);

  /* El resumen mira los últimos 30 días. Un acumulado histórico deja de decir
   * nada al tercer mes: lo que importa es si el trabajo de este mes va al día. */
  const resumen = useMemo(() => {
    if (!controles) return null;
    const desde = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recientes = controles.filter(c => {
      const f = c.enviado_en ?? c.programado_para ?? c.creado_en;
      return f && new Date(f).getTime() >= desde;
    });

    return {
      pendientes: controles.filter(c => c.estado === 'pendiente').length,
      // Los pausados cuentan como trabajo abierto: quedaron a medias y alguien
      // tiene que volver.
      enCurso:    controles.filter(c => c.estado === 'en_curso' || c.estado === 'pausado').length,
      enviados:   recientes.filter(c => c.estado === 'enviado').length,
      criticos:   controles.reduce((n, c) => n + (c.items_criticos ?? 0), 0)
    };
  }, [controles]);

  const pendientes = controles?.filter(c => c.estado !== 'enviado' && c.estado !== 'anulado') ?? [];
  const cerrados = controles?.filter(c => c.estado === 'enviado') ?? [];

  // La campana es del usuario, no del panel: alguien en terreno ve en esta
  // pantalla el trabajo de toda su comunidad —para poder cubrir a un
  // colega—, pero las novedades que le avisan son solo lo suyo, lo que se le
  // asignó a él.
  const misPendientes = useMemo(
    () => pendientes.filter(c => c.responsable_id === perfil?.id),
    [pendientes, perfil]
  );

  /* El trabajo se agrupa por persona. Una lista plana no responde la pregunta
   * que importa al mirar el día: quién va sobrecargado y quién tiene hueco. Sin
   * asignar va al final, porque es lo que hay que repartir. */
  const porTrabajador = useMemo(() => agrupar(pendientes), [controles]);
  const realizadosPorTrabajador = useMemo(() => agrupar(cerrados), [controles]);

  useEffect(() => {
    if (abiertos !== null || !porTrabajador.length) return;
    // El grupo propio si existe; si no, el primero. Dejarlos todos cerrados
    // haría que al entrar no se vea trabajo alguno.
    const mio = porTrabajador.find(g => g.id === perfil?.id);
    setAbiertos(new Set([(mio ?? porTrabajador[0]).id]));
  }, [porTrabajador, perfil]);

  function alternar(id, hechos = false) {
    const set = hechos ? setAbiertosHechos : setAbiertos;
    set(prev => {
      const s = new Set(prev ?? []);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  const hoy = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  /* Las fotos y la firma viven en el bucket, no en la fila: borrar el
   * levantamiento sin esto dejaría los archivos huérfanos, ocupando espacio
   * sin que nada los referencie. El resto —ítems, pausas, adjuntos— se va
   * solo, en cascada, al borrar la fila. */
  async function borrarLevantamiento() {
    const c = porBorrar;
    setPorBorrar(null);

    const { data: adjuntos } = await supabase
      .from('adjuntos').select('storage_path').eq('control_id', c.id);
    if (adjuntos?.length) {
      await supabase.storage.from('evidencia').remove(adjuntos.map(a => a.storage_path));
    }

    const { error } = await supabase.from('controles').delete().eq('id', c.id);
    if (error) return setError(error.message);

    setControles(xs => xs.filter(x => x.id !== c.id));
    borrarControlLocal(c.id);
  }

  return (
    <div className="pantalla">
      <AvisoConexion />

      {porBorrar && (
        <Confirmar
          titulo="Eliminar levantamiento"
          mensaje={`"${porBorrar.destino_nombre ?? 'Este levantamiento'}" se va a borrar junto con sus respuestas, fotos y firma. Esto no se puede deshacer.`}
          textoConfirmar="Eliminar"
          textoCancelar="Cancelar"
          onConfirmar={borrarLevantamiento}
          onCancelar={() => setPorBorrar(null)}
        />
      )}

      <header className="encabezado">
        <div className="fila">
          <div className="crece">
            <h1 className="h3">Hola, {perfil?.nombre?.split(' ')[0] ?? ''}</h1>
            <p className="chico apagado" style={{ margin: '2px 0 0' }}>
              {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
            </p>
          </div>
          <Campana pendientes={misPendientes} miId={perfil?.id} />
          <button className="boton boton-texto" onClick={salir}>Salir</button>
        </div>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}

        {/* El mapa primero: antes de saber cuánto falta, importa dónde está. */}
        {controles?.some(c => c.checkin_lat != null) && (
          <MapaPrevio controles={controles} />
        )}

        {/* Resumen de los últimos 30 días */}
        {resumen && (
          <div className="tablero">
            <div>
              <p className="n">{resumen.pendientes}</p>
              <p className="r">Pendientes</p>
            </div>
            <div className={resumen.enCurso ? 'alerta' : ''}>
              <p className="n">{resumen.enCurso}</p>
              <p className="r">En curso</p>
            </div>
            <div className="ok">
              <p className="n">{resumen.enviados}</p>
              <p className="r">Enviados 30 d</p>
            </div>
            <div className={resumen.criticos ? 'critico' : ''}>
              <p className="n">{resumen.criticos}</p>
              <p className="r">Críticos</p>
            </div>
          </div>
        )}

        {puedeConfigurar && (
          // En escritorio esto se oculta: son los mismos accesos que ya
          // están en la barra lateral, y repetirlos como botones acá arriba
          // solo le resta espacio a lo que importa —el trabajo del día—.
          <div className="accesos-inicio">
            <Link to="/nuevo" className="acceso acceso-principal">
              <span>Nuevo levantamiento</span>
              <span aria-hidden="true">+</span>
            </Link>

            {/* Plantillas y equipo se tocan poco y no son trabajo del día:
                agrupadas ocupan una línea en vez de tres. */}
            <div className={'configuracion' + (ajustes ? ' abierta' : '')}>
              <button type="button" className="acceso" aria-expanded={ajustes}
                      onClick={() => setAjustes(v => !v)}>
                <span>Configuración</span>
                <span aria-hidden="true">{ajustes ? '−' : '+'}</span>
              </button>
              {ajustes && (
                <div className="dentro">
                  <Link to="/plantillas">Plantillas de levantamiento</Link>
                  {esAdministracion && <Link to="/equipo">Equipo y permisos</Link>}
                  {perfil?.rol === 'superadmin' && <Link to="/clientes">Clientes y accesos</Link>}
                </div>
              )}
            </div>

            {/* Página aparte y no una sección más: consultar el historial de
                una comunidad es una pregunta distinta a la del día a día que
                resuelve el resto del inicio. */}
            <Link to="/comunidades" className="acceso">
              <span>Comunidades</span>
              <span aria-hidden="true">›</span>
            </Link>
          </div>
        )}

        <div className="grupo-titulo" id="por-hacer">
          <span className="etiqueta-grupo">Por hacer</span>
        </div>

        {controles === null && !error && <p className="cargando">Cargando…</p>}
        {controles && pendientes.length === 0 && (
          <p className="vacio">No hay levantamientos pendientes.</p>
        )}

        {porTrabajador.map(grupo => (
          <GrupoTrabajador
            key={grupo.id}
            grupo={grupo}
            abierto={abiertos?.has(grupo.id) ?? false}
            onAlternar={() => alternar(grupo.id)}
            puedeEditar={puedeConfigurar}
            puedeBorrar={puedeBorrar}
            onBorrar={setPorBorrar}
          />
        ))}

        {cerrados.length > 0 && (
          <>
            <div className="grupo-titulo" style={{ marginTop: 20 }}>
              <span className="etiqueta-grupo">Realizados</span>
            </div>
            {realizadosPorTrabajador.map(grupo => (
              <GrupoTrabajador
                key={grupo.id}
                grupo={grupo}
                abierto={abiertosHechos.has(grupo.id)}
                onAlternar={() => alternar(grupo.id, true)}
                puedeEditar={puedeConfigurar}
                puedeBorrar={puedeBorrar}
                onBorrar={setPorBorrar}
                hechos
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* Sin asignar va al final: es lo que falta repartir, no el trabajo de alguien.
 *
 * "Sin asignar" se dice solo cuando de verdad no hay nadie asignado. Que no
 * llegue el nombre es otra cosa —un permiso, un perfil borrado— y decir
 * entonces "sin asignar" es afirmar algo falso sobre un levantamiento que sí
 * tiene dueño. */
function agrupar(lista) {
  const m = new Map();
  for (const c of lista) {
    const clave = c.responsable_id ?? 'sin-asignar';
    if (!m.has(clave)) {
      const nombre = c.responsable_id
        ? (c.responsable_nombre ?? 'Otra persona del equipo')
        : 'Sin asignar';
      m.set(clave, { id: clave, nombre, items: [] });
    }
    m.get(clave).items.push(c);
  }
  return [...m.values()].sort((a, b) =>
    a.id === 'sin-asignar' ? 1 : b.id === 'sin-asignar' ? -1
      : a.nombre.localeCompare(b.nombre, 'es'));
}

function GrupoTrabajador({ grupo, abierto, onAlternar, puedeEditar, puedeBorrar, onBorrar, hechos }) {
  const criticos = grupo.items.reduce((n, c) => n + (c.items_criticos ?? 0), 0);
  const cuantos = grupo.items.length;

  return (
    <div className="grupo-trabajador">
      <button type="button"
              className={'cabecera-trabajador' + (abierto ? ' abierta' : '')}
              aria-expanded={abierto}
              onClick={onAlternar}>
        <span className="crece">{grupo.nombre}</span>
        {criticos > 0 && <span className="punto-critico" aria-label="Tiene críticos" />}
        <span className="micro">
          {cuantos} {hechos ? (cuantos > 1 ? 'realizados' : 'realizado') : 'por hacer'}
        </span>
        <span className="flecha" aria-hidden="true">{abierto ? '−' : '+'}</span>
      </button>

      {abierto && grupo.items.map(c => (
        <Tarjeta key={c.id} c={c} puedeEditar={puedeEditar}
                 puedeBorrar={puedeBorrar} onBorrar={onBorrar} />
      ))}
    </div>
  );
}

function Tarjeta({ c, puedeEditar, puedeBorrar, onBorrar }) {
  const [clase, texto] = CHIP[c.estado] ?? CHIP.pendiente;
  const pct = c.items_totales ? Math.round((c.items_evaluados / c.items_totales) * 100) : 0;

  return (
    <article className="tarjeta" style={{ padding: 16, marginBottom: 12 }}>
      {/* El estado va aparte, a la derecha, en una posición fija: si
          compartiera fila con el resto de los chips, el que hubiera más o
          menos de ellos —según el estado— lo haría saltar de lugar o quedar
          pegado al conteo de avance de más abajo. */}
      <div className="fila" style={{ marginBottom: 8, alignItems: 'flex-start', gap: 8 }}>
        <div className="crece" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span className="etiqueta-campo" style={{ margin: 0 }}>
            {c.periodo ?? ''}
          </span>
          {/* El nombre de la plantilla usada ya distingue el tipo de
              levantamiento —incidencia, control mensual, registro— sin
              necesidad de un campo aparte. */}
          {c.plantilla_nombre && (
            <span className="chip chip-tipo">{c.plantilla_nombre}</span>
          )}
          {c.destino_tipo === 'prospecto' && (
            <span className="chip chip-diagnostico">Diagnóstico</span>
          )}
          {/* Un conteo de críticos mientras el recorrido sigue abierto es una
              cifra a medio hacer, todavía puede cambiar. Solo informa una vez
              enviado, cuando ya es el resultado final. */}
          {c.estado === 'enviado' && c.items_criticos > 0 && (
            <span className="chip chip-critico">{c.items_criticos} crítico{c.items_criticos > 1 ? 's' : ''}</span>
          )}
          {/* Lo no iniciado no tiene avance que mostrar; lo que importa ahí es
              cuándo corresponde hacerlo. */}
          {c.estado === 'pendiente' && c.programado_para && (
            <span className="chip chip-tipo">
              {new Date(c.programado_para).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
              {' · '}
              {new Date(c.programado_para).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span className={'chip ' + clase} style={{ flex: 'none' }}>{texto}</span>
      </div>

      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <Link to={`/control/${c.id}`} className="crece" style={{ color: 'inherit' }}>
          <p className="dato-chico" style={{ margin: 0 }}>
            {c.destino_nombre ?? c.comunidades?.nombre}
          </p>
          <p className="micro" style={{ margin: '3px 0 0' }}>
            {[c.destino_direccion, c.destino_comuna].filter(Boolean).join(', ')}
          </p>
        </Link>
        {puedeEditar && (
          <Link to={`/control/${c.id}/editar`} className="editar" aria-label="Editar levantamiento">
            Editar
          </Link>
        )}
        {puedeBorrar && (
          <button type="button" className="editar peligro" style={{ marginLeft: 6 }}
                  aria-label="Eliminar levantamiento" onClick={() => onBorrar(c)}>
            Eliminar
          </button>
        )}
      </div>

      {c.items_totales > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="fila" style={{ marginBottom: 5 }}>
            <span className="micro crece">
              {c.checkin_en
                ? `Check-in ${new Date(c.checkin_en).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                : 'Sin check-in'}
            </span>
            <span className="micro">{c.items_evaluados} de {c.items_totales}</span>
          </div>
          <div className="barra"><div style={{ width: pct + '%' }} /></div>
        </div>
      )}
    </article>
  );
}
