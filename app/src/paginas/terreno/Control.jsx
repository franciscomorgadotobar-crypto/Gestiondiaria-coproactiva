import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { AvisoConexion } from '../../lib/estado';
import CampoPunto from '../../componentes/CampoPunto';
import { informeHtml, imprimirInforme } from '../../lib/informe';
import { comprimir, hayConexion, sincronizar } from '../../lib/sincronizacion';
import {
  nuevoId, leerControl, guardarControl, leerItems, fusionarItems, guardarItem,
  leerFotosDeControl, guardarFoto, borrarFoto, encolar
} from '../../lib/local';

const ESTADOS = [
  ['cumple', 'Conforme'],
  ['observacion', 'Observa'],
  ['critico', 'Crítico']
];

/* Un punto está respondido según su tipo: los de estado por su estado, los de
 * foto por tener una fotografía adjunta, los demás por tener respuesta.
 *
 * El de foto es aparte porque no escribe en `respuesta` —la fotografía misma
 * es la respuesta—, y antes eso se leía como "siempre respondido" apenas
 * existía el punto, sin importar si alguien había sacado la foto o no: un
 * levantamiento podía marcarse completo con puntos de foto vacíos.
 *
 * Va fuera del componente a propósito: `categorias` la usa dentro de un useMemo,
 * que corre durante el render, así que una constante declarada más abajo estaría
 * en zona muerta y dejaría la pantalla en blanco. */
function respondido(i, tieneFoto) {
  if (i.tipo_ingreso === 'foto') return tieneFoto(i.id);
  if (!i.tipo_ingreso || i.tipo_ingreso === 'estado') return i.estado !== 'sin_evaluar';
  return i.respuesta != null;
}

export default function Levantamiento() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { perfil } = useSesion();

  const [control, setControl] = useState(null);
  const [items, setItems] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState(null);
  const [ubicando, setUbicando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [abierta, setAbierta] = useState(null);   // categoría desplegada
  const [paso, setPaso] = useState(0);            // punto en curso dentro de ella
  const [pausas, setPausas] = useState([]);

  /* Primero el teléfono, después el servidor. Al revés, entrar a un
   * levantamiento en un subterráneo mostraría una pantalla vacía mientras la
   * petición agoniza contra una red que no está. */
  useEffect(() => {
    let vigente = true;

    (async () => {
      const [c, i, f] = await Promise.all([
        leerControl(id), leerItems(id), leerFotosDeControl(id)
      ]);
      if (!vigente) return;
      if (c) setControl(c);
      if (i.length) setItems(i.sort(orden));
      setFotos(f);

      if (!hayConexion()) {
        if (!c) setError('Este levantamiento no está descargado y no hay señal.');
        return;
      }

      const [rc, ri, rp, ra] = await Promise.all([
        supabase
          .from('controles_con_avance')
          .select('id, comunidad_id, prospecto_id, estado, periodo, programado_para, checkin_en, checkin_precision, creado_en, reabierto_en, motivo_reapertura, destino_nombre, destino_direccion, destino_comuna, destino_tipo, secuencial, plantilla_nombre')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('control_items')
          .select('id, grupo, texto, orden, estado, nota, respuesta, tipo_ingreso, config, requiere_foto, es_critico, obligatorio, plantilla_item_id')
          .eq('control_id', id)
          .order('orden'),
        supabase
          .from('control_pausas')
          .select('*')
          .eq('control_id', id)
          .order('pausado_en', { ascending: false }),
        supabase
          .from('adjuntos')
          .select('id, control_item_id, clase, storage_path, firmante_nombre, firmante_rut, descripcion, orden, tomada_en')
          .eq('control_id', id)
      ]);
      if (!vigente) return;
      if (rp.data) setPausas(rp.data);

      if (rc.error) { if (!c) setError(rc.error.message); return; }
      if (!rc.data) { if (!c) setError('Este levantamiento no existe o no tienes acceso.'); return; }

      setControl(rc.data);
      await guardarControl(rc.data);

      if (ri.data) {
        await fusionarItems(id, ri.data);
        const frescos = await leerItems(id);
        if (vigente) setItems(frescos.sort(orden));
      }

      /* Las fotos que este teléfono no tomó no están en su IndexedDB: viven
       * solo en el bucket. Sin esto, revisar un levantamiento desde otro
       * teléfono —o el mismo, después de un tiempo— mostraba el punto
       * marcado como evaluado pero sin ninguna fotografía que mostrar, como
       * si se hubiera perdido evidencia que en realidad sí estaba subida. */
      const idsLocales = new Set(f.map(x => x.id));
      const remotas = (ra.data ?? []).filter(a => !idsLocales.has(a.id));
      if (remotas.length) {
        const { data: firmadas } = await supabase.storage
          .from('evidencia')
          .createSignedUrls(remotas.map(a => a.storage_path), 3600);

        const porRuta = new Map((firmadas ?? []).map(u => [u.path, u.signedUrl]));
        const reconstruidas = remotas
          .filter(a => porRuta.has(a.storage_path))
          .map(a => ({
            id: a.id,
            control_id: id,
            control_item_id: a.control_item_id,
            clase: a.clase,
            url: porRuta.get(a.storage_path),
            descripcion: a.descripcion,
            firmante_nombre: a.firmante_nombre,
            firmante_rut: a.firmante_rut,
            orden: a.orden ?? 0,
            tomada_en: a.tomada_en,
            pendiente: 0
          }));
        if (vigente && reconstruidas.length) {
          setFotos(xs => {
            const ids = new Set(xs.map(x => x.id));
            const nuevas = reconstruidas.filter(r => !ids.has(r.id));
            return nuevas.length ? [...xs, ...nuevas] : xs;
          });
        }
      }
    })().catch(e => vigente && setError(e.message));

    return () => { vigente = false; };
  }, [id]);

  const orden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);

  const fotosDe = itemId => fotos
    .filter(f => f.control_item_id === itemId && f.clase !== 'firma')
    .sort((a, b) => a.orden - b.orden);

  /* Si un punto de tipo foto está respondido: su respuesta no vive en
   * `respuesta` como los demás tipos, es la fotografía misma. Sin esto, un
   * punto foto se contaba como evaluado por el solo hecho de existir, aunque
   * nadie hubiera tomado la foto. */
  const tieneFoto = itemId => fotosDe(itemId).length > 0;

  /* El recorrido tiene una secuencia —se entra por el acceso y se termina en la
   * azotea— y el orden de las categorías la refleja.
   *
   * Depende también de `fotos`: un punto tipo foto cambia de evaluado a no
   * evaluado según haya o no una fotografía, y sin esa dependencia el avance
   * no se movía al sacar la foto hasta que algo más disparara el recálculo. */
  const categorias = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      if (!m.has(it.grupo)) m.set(it.grupo, []);
      m.get(it.grupo).push(it);
    }
    return [...m.entries()].map(([nombre, lista]) => ({
      nombre,
      items: lista,
      evaluados: lista.filter(i => respondido(i, tieneFoto)).length,
      criticos: lista.filter(i => i.estado === 'critico').length
    }));
  }, [items, fotos]);

  const evaluados = items.filter(i => respondido(i, tieneFoto)).length;
  const pct = items.length ? Math.round((evaluados / items.length) * 100) : 0;

  /* Con la plantilla en modo secuencial no basta con impedir saltar puntos
   * dentro de una categoría: hay que impedir abrir una categoría posterior
   * mientras quede algo pendiente en una anterior. Esta es esa primera
   * categoría con algo por responder —o -1 si ya está todo evaluado—. */
  const primeraCategoriaPendiente = useMemo(
    () => categorias.findIndex(cat => cat.evaluados < cat.items.length),
    [categorias]
  );

  // Al entrar a un levantamiento secuencial, partir directo en esa primera
  // categoría pendiente en vez de dejar todo plegado. Solo una vez: después
  // de eso el usuario manda sobre qué categoría (ya desbloqueada) mirar.
  const partioSecuencial = useRef(false);
  useEffect(() => {
    if (partioSecuencial.current) return;
    if (!control?.secuencial || categorias.length === 0) return;
    partioSecuencial.current = true;
    const i = primeraCategoriaPendiente === -1 ? 0 : primeraCategoriaPendiente;
    const cat = categorias[i];
    setAbierta(cat.nombre);
    const pendiente = cat.items.findIndex(it => !respondido(it, tieneFoto));
    setPaso(pendiente === -1 ? 0 : pendiente);
  }, [control, categorias, primeraCategoriaPendiente, fotos]);
  const faltantes = items.length - evaluados;

  /* Lo que de verdad impide enviar. `faltantes` cuenta todo —incluye lo
   * opcional— porque el avance de arriba tiene que mostrar cuánto se
   * contestó de verdad. Enviar es otra pregunta: solo lo obligatorio puede
   * trabar el botón; un punto marcado como opcional en la plantilla se puede
   * dejar en blanco y el levantamiento igual se manda. */
  const pendientesObligatorios = items.filter(
    i => i.obligatorio !== false && !respondido(i, tieneFoto)
  );

  /* La plantilla puede exigir fotografía en un punto. Esa exigencia se copió al
   * levantamiento, así que acá se puede hacer cumplir: sin la foto no se envía.
   * Una exigencia declarada que nadie aplica es peor que no tenerla. */
  const sinFoto = items.filter(i => i.requiere_foto && !tieneFoto(i.id));

  // ------------------------------------------------------------- Check-in

  function hacerCheckIn() {
    if (!navigator.geolocation) {
      setError('Este teléfono no permite obtener la ubicación.');
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const cambios = {
          estado: 'en_curso',
          checkin_en: new Date().toISOString(),
          checkin_lat: latitude,
          checkin_lng: longitude,
          checkin_precision: accuracy
        };
        const actualizado = { ...control, ...cambios };
        setControl(actualizado);
        setUbicando(false);
        await guardarControl(actualizado);
        await encolar({ tipo: 'control', id, cambios });
        sincronizar();
      },
      err => {
        setUbicando(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Falta permiso de ubicación. Actívalo para poder registrar el check-in.'
            : 'No se pudo obtener la ubicación. Inténtalo de nuevo.'
        );
      },
      // El GPS bajo losa demora. 25 segundos da margen sin que la espera se
      // vuelva eterna; una posición de red imprecisa sirve más que ninguna.
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  }

  // ----------------------------------------------------------- Pausar

  /* Pausar deja el levantamiento donde está y registra por qué. Lo evaluado no
   * se toca: al volver, el recorrido sigue desde donde iba. El motivo no es
   * burocracia — tres levantamientos pausados porque nadie tenía la llave del
   * subterráneo son un hallazgo de la administración. */
  async function pausar(motivo) {
    const pos = await posicionActual();
    const fila = {
      id: nuevoId(),
      control_id: id,
      pausado_en: new Date().toISOString(),
      pausado_por: perfil?.id ?? null,
      motivo: motivo?.trim() || null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      reanudado_en: null
    };

    const actualizado = { ...control, estado: 'pausado' };
    setControl(actualizado);
    setPausas(xs => [fila, ...xs]);
    await guardarControl(actualizado);
    await encolar({ tipo: 'pausa', fila });
    await encolar({ tipo: 'control', id, cambios: { estado: 'pausado' } });
    sincronizar();
    navegar('/inicio');
  }

  async function reanudar() {
    const abiertaAhora = pausas.find(p => !p.reanudado_en);
    const actualizado = { ...control, estado: 'en_curso' };
    setControl(actualizado);
    await guardarControl(actualizado);

    if (abiertaAhora) {
      const cerrada = { ...abiertaAhora, reanudado_en: new Date().toISOString() };
      setPausas(xs => xs.map(p => (p.id === cerrada.id ? cerrada : p)));
      await encolar({ tipo: 'pausa', fila: cerrada });
    }
    await encolar({ tipo: 'control', id, cambios: { estado: 'en_curso' } });
    sincronizar();
  }

  // ----------------------------------------------------- Evaluar y anotar

  async function marcar(item, estado) {
    const nuevo = item.estado === estado ? 'sin_evaluar' : estado;
    const cambios = {
      estado: nuevo,
      evaluado_en: nuevo === 'sin_evaluar' ? null : new Date().toISOString()
    };
    const actualizado = { ...item, ...cambios, pendiente: true };

    setItems(xs => xs.map(x => (x.id === item.id ? actualizado : x)));
    await guardarItem(actualizado);
    await encolar({ tipo: 'item', id: item.id, cambios });
    sincronizar();
  }

  async function guardarNota(item, nota) {
    const actualizado = { ...item, nota, pendiente: true };
    setItems(xs => xs.map(x => (x.id === item.id ? actualizado : x)));
    await guardarItem(actualizado);
    await encolar({ tipo: 'item', id: item.id, cambios: { nota } });
    sincronizar();
  }

  /* Las respuestas de los demás tipos viajan por el mismo camino que el estado:
   * al teléfono primero, a la cola después. La firma trae además un blob, que
   * se guarda como adjunto de clase 'firma'. */
  async function guardarRespuesta(item, respuesta) {
    if (respuesta?.blob) {
      const { blob, ...resto } = respuesta;
      // Si ya había una firma para este punto, se reemplaza en el mismo
      // registro en vez de crear uno nuevo. Con un id nuevo cada vez, firmar
      // de nuevo por un error de trazo dejaba la firma anterior huérfana,
      // subida igual y visible dos veces en el informe.
      const anterior = fotos.find(f => f.control_item_id === item.id && f.clase === 'firma');
      const firma = {
        id: anterior?.id ?? nuevoId(),
        control_id: id,
        control_item_id: item.id,
        comunidad_id: control.comunidad_id,
        clase: 'firma',
        blob,
        firmante_nombre: resto.firmante_nombre ?? null,
        firmante_rut: resto.firmante_rut ?? null,
        tomada_en: new Date().toISOString(),
        orden: 0,
        subida_por: perfil?.id ?? null,
        pendiente: 1
      };
      await guardarFoto(firma);
      setFotos(xs => [...xs.filter(f => !(f.control_item_id === item.id && f.clase === 'firma')), firma]);
      await encolar({ tipo: 'foto', id: firma.id, control_id: id });
      respuesta = resto;
    }

    const actualizado = { ...item, respuesta, pendiente: true };
    setItems(xs => xs.map(x => (x.id === item.id ? actualizado : x)));
    await guardarItem(actualizado);
    await encolar({ tipo: 'item', id: item.id, cambios: { respuesta } });
    sincronizar();
  }

  // ---------------------------------------------------------------- Fotos

  /* `archivos` llega ya copiado a un array por quien llama. La FileList de un
   * <input type=file> es una vista viva: al limpiar el input para poder volver
   * a fotografiar lo mismo, la lista se vacía, y cualquier lectura posterior no
   * encuentra nada. Copiarla antes de tocar el input es obligatorio.
   *
   * La foto se guarda de inmediato y las coordenadas se agregan después. Al
   * revés —esperando primero al GPS— la interfaz queda muda varios segundos
   * después de disparar la cámara, y da la impresión de que no guardó. */
  async function agregarFotos(item, archivos) {
    if (!archivos.length) return;
    const yaHay = fotosDe(item.id).length;
    const nuevas = [];

    for (const [n, archivo] of archivos.entries()) {
      let blob;
      try {
        ({ blob } = await comprimir(archivo));
      } catch (e) {
        /* Algunos teléfonos entregan HEIC, que el navegador no siempre sabe
         * decodificar. Antes que perder la foto, se guarda el original tal
         * cual: pesa más, pero es la evidencia y no puede perderse. */
        console.warn('No se pudo comprimir, se guarda el original', e);
        blob = archivo;
      }

      const foto = {
        id: nuevoId(),
        control_id: id,
        control_item_id: item.id,
        comunidad_id: control.comunidad_id,
        clase: 'foto',
        blob,
        nombre_original: archivo.name,
        lat: null,
        lng: null,
        // La hora de captura la pone el teléfono: los metadatos EXIF se
        // pierden al recomprimir, así que el dato se guarda aparte.
        tomada_en: new Date().toISOString(),
        descripcion: '',
        orden: yaHay + n,
        subida_por: perfil?.id ?? null,
        pendiente: 1
      };

      await guardarFoto(foto);
      nuevas.push(foto);
      setFotos(xs => [...xs, foto]);
      await encolar({ tipo: 'foto', id: foto.id, control_id: id });
    }

    sincronizar();

    // Las coordenadas llegan cuando lleguen y se agregan a lo ya guardado.
    const pos = await posicionActual();
    if (!pos) return;
    for (const foto of nuevas) {
      const conPos = { ...foto, lat: pos.lat, lng: pos.lng };
      await guardarFoto(conPos);
      setFotos(xs => xs.map(f => (f.id === foto.id ? conPos : f)));
    }
  }

  async function describirFoto(foto, descripcion) {
    const actualizada = { ...foto, descripcion, pendiente: 1 };
    setFotos(xs => xs.map(f => (f.id === foto.id ? actualizada : f)));
    await guardarFoto(actualizada);
    await encolar({ tipo: 'foto', id: foto.id, control_id: id });
  }

  async function quitarFoto(foto) {
    setFotos(xs => xs.filter(f => f.id !== foto.id));
    await borrarFoto(foto.id);
    // Solo se borra localmente: una foto ya subida es evidencia y su
    // eliminación en el servidor la decide administración.
  }

  function posicionActual() {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolver => {
      navigator.geolocation.getCurrentPosition(
        p => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolver(null),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    });
  }

  // -------------------------------------------------------------- Informe

  function verInforme() {
    const html = informeHtml({
      comunidad: {
        nombre: control.destino_nombre ?? 'Sin identificar',
        direccion: control.destino_direccion,
        comuna: control.destino_comuna
      },
      control: { ...control, responsable: perfil?.nombre },
      logo: import.meta.env.BASE_URL + 'logo-coproactiva.svg',
      categorias: categorias.map(c => ({
        nombre: c.nombre,
        items: c.items.map(i => ({
          texto: i.texto,
          estado: i.estado,
          nota: i.nota,
          tipo_ingreso: i.tipo_ingreso,
          config: i.config,
          respuesta: i.respuesta,
          fotos: fotosDe(i.id).map(f => ({
            url: f.blob ? URL.createObjectURL(f.blob) : f.url,
            descripcion: f.descripcion
          }))
        }))
      })),
      pausas: pausas.map(p => ({
        pausado_en: p.pausado_en,
        reanudado_en: p.reanudado_en,
        motivo: p.motivo
      })),
      firmas: fotos
        .filter(f => f.clase === 'firma')
        .map(f => ({
          url: f.blob ? URL.createObjectURL(f.blob) : f.url,
          nombre: f.firmante_nombre,
          rut: f.firmante_rut
        }))
    });
    if (!imprimirInforme(html)) {
      setError('El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para este sitio.');
    }
  }

  async function enviar() {
    setEnviando(true);
    const cambios = { estado: 'enviado', enviado_en: new Date().toISOString() };
    const actualizado = { ...control, ...cambios };
    await guardarControl(actualizado);
    await encolar({ tipo: 'control', id, cambios });
    await sincronizar();
    setEnviando(false);
    navegar('/inicio');
  }

  // --------------------------------------------------------------- Vistas

  if (error && !control) {
    return (
      <div className="cuerpo">
        <div className="aviso aviso-critico">{error}</div>
        <button className="boton boton-secundario boton-movil boton-ancho"
                style={{ marginTop: 14 }} onClick={() => navegar('/inicio')}>
          Volver
        </button>
      </div>
    );
  }
  if (!control) return <p className="cargando">Cargando…</p>;

  const cerrado = control.estado === 'enviado' || control.estado === 'anulado';

  return (
    <div className="pantalla">
      <AvisoConexion />

      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/inicio')} aria-label="Volver">
            ‹ Volver
          </button>
          <span className="crece" />
          {control.periodo && <span className="micro">{control.periodo}</span>}
        </div>

        <h1 className="h3">{control.destino_nombre ?? control.comunidades?.nombre}</h1>
        <p className="chico apagado" style={{ margin: '3px 0 6px' }}>
          {[control.destino_direccion, control.destino_comuna].filter(Boolean).join(', ')}
          {control.destino_tipo === 'prospecto' && ' · Diagnóstico comercial'}
        </p>

        {/* Qué tipo de levantamiento es y para cuándo estaba pensado: lo
            primero que hay que confirmar al entrar, antes de ponerse a
            responder puntos. */}
        {(control.plantilla_nombre || control.programado_para) && (
          <p className="chico apagado" style={{ margin: '0 0 10px' }}>
            {control.plantilla_nombre}
            {control.plantilla_nombre && control.programado_para && ' · '}
            {control.programado_para && new Date(control.programado_para).toLocaleDateString('es-CL', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}

        {control.checkin_en ? (
          <p className="micro" style={{ color: 'var(--ok-texto)', margin: '0 0 10px' }}>
            Check-in {new Date(control.checkin_en).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            {control.checkin_precision != null && ` · precisión ${Math.round(control.checkin_precision)} m`}
          </p>
        ) : (
          <button className="boton boton-movil boton-ancho" style={{ marginBottom: 10 }}
                  onClick={hacerCheckIn} disabled={ubicando || cerrado}>
            {ubicando ? 'Obteniendo ubicación…' : 'Hacer check-in'}
          </button>
        )}

        {control.estado === 'pausado' && (
          <div className="aviso" style={{ marginBottom: 10 }}>
            <p style={{ margin: 0 }}>
              Levantamiento en pausa
              {pausas[0]?.motivo ? `: ${pausas[0].motivo}` : '.'}
            </p>
            <button className="boton boton-texto" style={{ padding: '6px 0 0' }}
                    onClick={reanudar}>
              Reanudar
            </button>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="fila" style={{ marginBottom: 5 }}>
              <span className="etiqueta-campo crece" style={{ margin: 0 }}>Avance</span>
              <span className="etiqueta-campo" style={{ margin: 0, color: 'var(--texto-titulo)' }}>
                {evaluados} de {items.length}
              </span>
            </div>
            <div className="barra"><div style={{ width: pct + '%' }} /></div>
          </>
        )}
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

        {items.length === 0 && (
          <p className="vacio">Este levantamiento todavía no tiene puntos que revisar.</p>
        )}

        {/* Categorías plegadas: con veinte o treinta puntos, una lista corrida
            obliga a desplazarse a ciegas buscando dónde se quedó uno. */}
        {categorias.map((cat, indiceCategoria) => {
          const desplegada = abierta === cat.nombre;
          // Bloqueada: hay una categoría anterior sin terminar y la plantilla
          // exige orden. Volver a una ya vista para corregirla sigue libre.
          const bloqueada = control.secuencial
            && primeraCategoriaPendiente !== -1
            && indiceCategoria > primeraCategoriaPendiente;
          return (
            <section key={cat.nombre} className="categoria">
              <button
                type="button"
                className={'categoria-titulo' + (desplegada ? ' abierta' : '') + (bloqueada ? ' bloqueada' : '')}
                aria-expanded={desplegada}
                disabled={bloqueada}
                title={bloqueada ? 'Termina las categorías anteriores primero' : undefined}
                onClick={() => {
                  if (bloqueada) return;
                  if (desplegada) return setAbierta(null);
                  setAbierta(cat.nombre);
                  const pendiente = cat.items.findIndex(i => !respondido(i, tieneFoto));
                  setPaso(pendiente === -1 ? 0 : pendiente);
                }}
              >
                <span className="crece">{cat.nombre}</span>
                {cat.criticos > 0 && <span className="punto-critico" aria-label="Tiene críticos" />}
                <span className="micro">{cat.evaluados}/{cat.items.length}</span>
                <span className="flecha" aria-hidden="true">{bloqueada ? '🔒' : desplegada ? '−' : '+'}</span>
              </button>

              {/* Un punto a la vez. Con siete preguntas apiladas se pierde de
                  vista dónde va uno, y en una pantalla de teléfono la lista se
                  hace interminable. */}
              {desplegada && cat.items[paso] && (
                <>
                  <Punto
                    key={cat.items[paso].id}
                    item={cat.items[paso]}
                    fotos={fotosDe(cat.items[paso].id)}
                    cerrado={cerrado}
                    onMarcar={marcar}
                    onNota={guardarNota}
                    onRespuesta={guardarRespuesta}
                    onFotos={agregarFotos}
                    onDescribir={describirFoto}
                    onQuitar={quitarFoto}
                  />

                  <nav className="pasos" aria-label={`Punto ${paso + 1} de ${cat.items.length}`}>
                    <button type="button" className="boton boton-secundario"
                            disabled={paso === 0}
                            onClick={() => setPaso(p => p - 1)}>
                      ‹ Anterior
                    </button>

                    <div className="conteo">
                      <span>{paso + 1} de {cat.items.length}</span>
                      {/* Marcas del recorrido: se ve de un vistazo qué queda
                          pendiente dentro de la categoría y se salta ahí.
                          Con la plantilla en modo secuencial, no se puede
                          saltar a un punto más allá del primero sin responder
                          —volver atrás sí, siempre—. */}
                      <div className="marcadores">
                        {(() => {
                          const primerPendiente = cat.items.findIndex(it => !respondido(it, tieneFoto));
                          return cat.items.map((it, i) => {
                            const bloqueado = control.secuencial
                              && primerPendiente !== -1 && i > primerPendiente;
                            return (
                              <button key={it.id} type="button"
                                      className={
                                        'marcador'
                                        + (i === paso ? ' aqui' : '')
                                        + (respondido(it, tieneFoto) ? ' hecho' : '')
                                        + (it.estado === 'critico' ? ' critico' : '')
                                      }
                                      disabled={bloqueado}
                                      aria-label={`Ir al punto ${i + 1}`}
                                      onClick={() => setPaso(i)} />
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {paso < cat.items.length - 1 ? (
                      <button type="button" className="boton"
                              disabled={control.secuencial && !respondido(cat.items[paso], tieneFoto)}
                              onClick={() => setPaso(p => p + 1)}>
                        Siguiente ›
                      </button>
                    ) : (
                      /* En el último punto, avanzar salta a la categoría
                         siguiente: el recorrido continúa sin volver a la lista. */
                      <button type="button" className="boton"
                              disabled={control.secuencial && !respondido(cat.items[paso], tieneFoto)}
                              onClick={() => {
                                const i = categorias.findIndex(c => c.nombre === cat.nombre);
                                const siguiente = categorias[i + 1];
                                if (siguiente) {
                                  setAbierta(siguiente.nombre);
                                  const pend = siguiente.items.findIndex(x => !respondido(x, tieneFoto));
                                  setPaso(pend === -1 ? 0 : pend);
                                } else {
                                  setAbierta(null);
                                }
                              }}>
                        {categorias.findIndex(c => c.nombre === cat.nombre) < categorias.length - 1
                          ? 'Categoría siguiente ›'
                          : 'Terminar ›'}
                      </button>
                    )}
                  </nav>
                </>
              )}
            </section>
          );
        })}

        {items.length > 0 && (
          <button className="boton boton-secundario boton-movil boton-ancho"
                  style={{ marginTop: 8 }} onClick={verInforme}>
            Ver informe / Guardar PDF
          </button>
        )}
      </div>

      {!cerrado && items.length > 0 && (
        <footer className="pie-fijo">
          <button className="boton boton-secundario boton-movil crece"
                  onClick={() => {
                    const motivo = prompt(
                      'Motivo de la pausa (opcional)\n\nPor ejemplo: sin acceso a sala de máquinas, ' +
                      'fin de turno, conserje no disponible.'
                    );
                    // Cancelar el diálogo no pausa; dejarlo vacío sí.
                    if (motivo !== null) pausar(motivo);
                  }}>
            Pausar
          </button>
          <button className="boton boton-movil crece"
                  onClick={enviar}
                  disabled={enviando || pendientesObligatorios.length > 0 || sinFoto.length > 0 || !control.checkin_en}
                  title={
                    !control.checkin_en ? 'Falta el check-in'
                    : pendientesObligatorios.length > 0
                      ? (pendientesObligatorios.length === 1
                          ? 'Falta 1 punto obligatorio por responder'
                          : `Faltan ${pendientesObligatorios.length} puntos obligatorios por responder`)
                    : sinFoto.length > 0
                      ? `Faltan fotos en: ${sinFoto.map(i => i.texto).join(', ')}`
                      : undefined
                  }>
            {enviando ? 'Enviando…'
             : pendientesObligatorios.length > 0 ? `Faltan ${pendientesObligatorios.length}`
             : sinFoto.length > 0
               ? (sinFoto.length === 1 ? 'Falta 1 foto' : `Faltan ${sinFoto.length} fotos`)
             : 'Enviar levantamiento'}
          </button>
        </footer>
      )}
    </div>
  );
}

/* Un punto del levantamiento: estado, nota y fotos. */
function Punto({ item, fotos, cerrado, onMarcar, onNota, onRespuesta, onFotos, onDescribir, onQuitar }) {
  const entrada = useRef(null);
  const necesitaNota = item.estado === 'observacion' || item.estado === 'critico';

  return (
    <article className="tarjeta punto">
      <p style={{ margin: '0 0 12px' }}>{item.texto}</p>

      <CampoPunto
        item={item}
        cerrado={cerrado}
        onEstado={valor => onMarcar(item, valor)}
        onRespuesta={respuesta => onRespuesta(item, respuesta)}
      />

      {/* La nota aparece solo cuando hay algo que explicar: un "conforme" no
          necesita justificación, una observación sí. */}
      {item.tipo_ingreso === 'estado' && necesitaNota && (
        <div className="campo" style={{ marginTop: 12, marginBottom: 0 }}>
          <label className="etiqueta-campo" htmlFor={'nota-' + item.id}>Qué se observó</label>
          <textarea id={'nota-' + item.id} defaultValue={item.nota ?? ''}
                    placeholder="Describe el hallazgo y dónde está" disabled={cerrado}
                    onBlur={e => onNota(item, e.target.value)} />
        </div>
      )}

      {item.requiere_foto && fotos.length === 0 && !cerrado && (
        <p className="micro exige-foto">Este punto exige al menos una fotografía</p>
      )}

      {/* La plantilla puede decidir que este punto no lleva fotografía. Sin
          esto, el botón de agregar aparecía igual en todos los puntos, sin
          forma de quitarlo donde no correspondía. */}
      {item.config?.origen !== 'ninguna' && (
        <div className="fotos-punto">
          {fotos.map(f => (
            <figure key={f.id}>
              <img src={f.blob ? URL.createObjectURL(f.blob) : f.url} alt={f.descripcion || 'Fotografía'} />
              {!f.pendiente && <span className="subida" title="Subida" />}
              <input
                type="text" defaultValue={f.descripcion ?? ''} placeholder="Pie de foto"
                disabled={cerrado} onBlur={e => onDescribir(f, e.target.value)}
              />
              {!cerrado && (
                <button type="button" className="quitar" aria-label="Quitar foto"
                        onClick={() => onQuitar(f)}>×</button>
              )}
            </figure>
          ))}

          {!cerrado && (
            <>
              {/* `capture` abre la cámara directo y salta el selector de
                  archivos: corresponde solo cuando la plantilla pide
                  específicamente cámara. En cualquier otro caso —incluido el
                  valor por defecto— se deja que el teléfono ofrezca su
                  selector nativo, que ya trae cámara y galería juntas. */}
              <input ref={entrada} type="file" accept="image/*"
                     {...(item.config?.origen === 'camara' ? { capture: 'environment' } : {})}
                     multiple hidden
                     onChange={e => {
                       // Se copia antes de limpiar el input: la FileList es una
                       // vista viva y al vaciar el campo se pierde el contenido.
                       const archivos = Array.from(e.target.files);
                       e.target.value = '';
                       onFotos(item, archivos);
                     }} />
              <button type="button" className="agregar-foto" onClick={() => entrada.current?.click()}>
                <span aria-hidden="true">＋</span>
                Foto
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
