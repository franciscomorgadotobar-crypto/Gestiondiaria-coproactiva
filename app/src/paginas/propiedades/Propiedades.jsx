import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { comprimir } from '../../lib/sincronizacion';
import Confirmar from '../../componentes/Confirmar';
import { useVolverGlobal } from '../../lib/navegacion';
import './Propiedades.css';

/* Propiedades en arriendo y venta que publica www.coproactiva.cl/propiedades.
 *
 * El sitio no tiene servidor ni base propia: lee la tabla `propiedades` directo
 * con la clave pública, y RLS le deja ver solo las publicadas y solo sus datos
 * públicos. Por eso guardar acá ya es publicar: no hay que volver a subir el
 * sitio. Los datos del propietario y la dirección exacta nunca llegan allá. */

const SITIO = 'https://www.coproactiva.cl/propiedades/';
const BUCKET = 'propiedades';

const OPERACIONES = [['arriendo', 'Arriendos'], ['venta', 'Ventas']];

const TIPOS = [
  ['departamento', 'Departamento'],
  ['casa', 'Casa'],
  ['oficina', 'Oficina'],
  ['local', 'Local comercial'],
  ['bodega', 'Bodega'],
  ['estacionamiento', 'Estacionamiento'],
  ['terreno', 'Terreno'],
  ['parcela', 'Parcela'],
  ['otro', 'Otro']
];

const ESTADOS = {
  disponible: ['chip-cumple', 'Disponible'],
  reservada: ['chip-alerta', 'Reservada'],
  arrendada: ['chip-pendiente', 'Arrendada'],
  vendida: ['chip-pendiente', 'Vendida']
};

const CARACTERISTICAS_SUGERIDAS = [
  'Ascensor', 'Conserjería 24 h', 'Piscina', 'Gimnasio', 'Quincho', 'Terraza', 'Logia',
  'Áreas verdes', 'Sala multiuso', 'Lavandería', 'Bicicletero', 'Estacionamiento de visitas',
  'Calefacción', 'Cocina americana', 'Walk-in closet'
];

const numeroCL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const pesosCL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

function formatoNumero(valor) {
  return valor === null || valor === undefined || valor === '' ? '' : numeroCL.format(Number(valor));
}

export function formatoPrecio(precio, moneda) {
  if (precio === null || precio === undefined) return 'Precio a consultar';
  return moneda === 'UF' ? `UF ${numeroCL.format(Number(precio))}` : `$${pesosCL.format(Number(precio))}`;
}

/* Montos y superficies se escriben como en Chile: "450.000", "3.200,5",
 * "65,5". Un <input type="number"> leería "4.500" como cuatro y medio, así que
 * se reciben como texto y se interpretan acá. Sin coma, un punto seguido de
 * grupos de tres dígitos es separador de miles; si no, es decimal ("4.5"). */
export function parsearNumero(texto) {
  let t = String(texto ?? '').trim().replace(/\s|\$|UF/gi, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function normalizar(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function etiquetaTipo(tipo) {
  return TIPOS.find(([v]) => v === tipo)?.[1] ?? tipo;
}

function urlFoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'string') {
    return foto.startsWith('http://') || foto.startsWith('https://')
      ? foto
      : supabase.storage.from(BUCKET).getPublicUrl(foto).data.publicUrl;
  }
  if (foto.url) return foto.url;
  const ruta = foto.mini || foto.ruta;
  return ruta ? supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl : null;
}

function urlSitio(codigo) {
  return `${SITIO}ficha/?codigo=${encodeURIComponent(codigo)}`;
}

export default function Propiedades() {
  const { id } = useParams();
  const { perfil } = useSesion();
  // Mismos roles que la base (usuario_puede_gestionar_operacion): terreno no
  // tiene nada que hacer acá. Va a /inicio y no a inicioSegunArea(), que con
  // un área 'propiedades' guardada lo devolvería aquí mismo.
  if (perfil && !['superadmin', 'admin', 'jefatura'].includes(perfil.rol)) {
    return <Navigate to="/inicio" replace />;
  }
  if (id === 'nueva') return <FichaPropiedad key="nueva" />;
  return id ? <FichaPropiedad key={id} id={id} /> : <ListadoPropiedades />;
}

/* ------------------------------------------------ Sección encendida en el sitio */

/* Si la sección Propiedades se muestra en el sitio (tabla secciones_sitio).
 * Apagada, el sitio no la muestra en el menú y la base no entrega propiedades
 * a la clave pública, aunque estén publicadas. null mientras carga, o si la
 * lectura falla: en ese caso no se muestra nada en vez de un estado inventado. */
function useSeccionSitio() {
  const [seccion, setSeccion] = useState(null);
  useEffect(() => {
    let vigente = true;
    supabase.from('secciones_sitio').select('visible, editado_en').eq('seccion', 'propiedades').maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) console.error('No se pudo leer si la sección está visible en el sitio:', error.message);
        setSeccion(data ?? null);
      });
    return () => { vigente = false; };
  }, []);
  return [seccion, setSeccion];
}

function SeccionEnSitio({ seccion, setSeccion, puedeCambiar }) {
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  if (!seccion) return null;
  const visible = seccion.visible;

  async function alternar() {
    setConfirmando(false);
    setCambiando(true);
    setError(null);
    const { data, error: e } = await supabase.from('secciones_sitio')
      .update({ visible: !visible }).eq('seccion', 'propiedades')
      .select('visible, editado_en').maybeSingle();
    setCambiando(false);
    if (e || !data) return setError(e?.message || 'No se pudo cambiar: solo administración puede hacerlo.');
    setSeccion(data);
  }

  return (
    <>
      {confirmando && (
        <Confirmar
          titulo={visible ? 'Ocultar Propiedades del sitio' : 'Mostrar Propiedades en el sitio'}
          mensaje={visible
            ? 'La sección saldrá del menú de coproactiva.cl y las propiedades dejarán de mostrarse públicamente.'
            : 'La sección aparecerá en coproactiva.cl y se mostrarán las propiedades marcadas como publicadas.'}
          textoConfirmar={visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
          textoCancelar="Cancelar"
          onConfirmar={alternar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
      <section className={'tarjeta propiedades-sitio' + (visible ? ' visible' : '')} aria-live="polite">
      <div className="crece">
        <strong className="dato-chico">{visible ? 'Visible en el sitio' : 'Oculta en el sitio'}</strong>
        <p className="micro" style={{ margin: '3px 0 0' }}>
          {visible
            ? 'Las propiedades publicadas están visibles en coproactiva.cl.'
            : 'Las propiedades publicadas están guardadas, pero la sección no se muestra en coproactiva.cl.'}
        </p>
        {error && <p className="mensaje-error" role="alert">{error}</p>}
      </div>
      {puedeCambiar
        ? (
          <button type="button" className={'boton' + (visible ? ' boton-secundario' : '')}
                  onClick={() => setConfirmando(true)} disabled={cambiando}>
            {cambiando ? 'Guardando…' : visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
          </button>
        )
        : <span className="micro">Solo administración puede cambiarlo.</span>}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ Listado */

const FILTROS = [['todas', 'Todas'], ['publicadas', 'Publicadas'], ['sin_publicar', 'Sin publicar']];

function ListadoPropiedades() {
  const [parametros, setParametros] = useSearchParams();
  const operacion = parametros.get('operacion') === 'venta' ? 'venta' : 'arriendo';
  const { perfil } = useSesion();
  const [seccion, setSeccion] = useSeccionSitio();
  const [propiedades, setPropiedades] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    supabase.from('propiedades')
      .select('id, codigo, operacion, tipo, estado, publicada, destacada, titulo, comuna, sector, precio, moneda, fotos, editado_en')
      .order('editado_en', { ascending: false })
      .then(({ data, error: e }) => {
        if (!vigente) return;
        if (e) setError(e.message);
        else setPropiedades(data ?? []);
      });
    return () => { vigente = false; };
  }, []);

  const cantidad = useMemo(() => {
    const c = { arriendo: 0, venta: 0 };
    for (const p of propiedades ?? []) c[p.operacion] += 1;
    return c;
  }, [propiedades]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar);
    return (propiedades ?? []).filter(p =>
      p.operacion === operacion
      && (filtro === 'todas' || (filtro === 'publicadas') === p.publicada)
      && (!q || [p.codigo, p.titulo, p.comuna, p.sector].some(v => normalizar(v).includes(q)))
    );
  }, [propiedades, operacion, filtro, buscar]);

  function cambiarOperacion(valor) {
    setParametros(valor === 'arriendo' ? {} : { operacion: valor }, { replace: true });
  }

  return (
    <div className="pantalla">
      <header className="encabezado propiedades-encabezado">
        <div className="propiedades-encabezado-contenido">
          <div className="crece">
            <h1 className="h3">Propiedades</h1>
            <p className="chico apagado propiedades-descripcion">
              Gestiona arriendos y ventas publicados en{' '}
              <a href={SITIO} target="_blank" rel="noopener noreferrer">coproactiva.cl/propiedades</a>.
            </p>
          </div>
        </div>
      </header>

      <div className="cuerpo">
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 12 }}>{error}</div>}

        <SeccionEnSitio seccion={seccion} setSeccion={setSeccion}
                        puedeCambiar={['superadmin', 'admin'].includes(perfil?.rol)} />

        <div className="pestanas" role="tablist" aria-label="Operación">
          {OPERACIONES.map(([valor, texto]) => (
            <button key={valor} type="button" role="tab" aria-selected={operacion === valor}
                    className={operacion === valor ? 'activo' : ''}
                    onClick={() => cambiarOperacion(valor)}>
              {texto}
              {propiedades && <span className="contador">{cantidad[valor]}</span>}
            </button>
          ))}
        </div>

        <div className="propiedades-filtros">
          <div className="campo propiedades-buscar">
            <label className="etiqueta-campo" htmlFor="buscar-propiedad">Buscar</label>
            <input id="buscar-propiedad" type="search" placeholder="Código, título, comuna o sector"
                   value={buscar} onChange={e => setBuscar(e.target.value)} />
          </div>
          <div className="campo propiedades-estado">
            <label className="etiqueta-campo" htmlFor="filtro-propiedad">Estado</label>
            <select id="filtro-propiedad" value={filtro} onChange={e => setFiltro(e.target.value)}>
              {FILTROS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </div>
        </div>

        {propiedades === null && !error && <p className="cargando">Cargando…</p>}
        {propiedades && cantidad[operacion] === 0 && (
          <div className="propiedades-vacio">
            <strong>
              Todavía no hay propiedades en {operacion === 'venta' ? 'venta' : 'arriendo'}.
            </strong>
            <p className="chico apagado">
              Cuando agregues una propiedad aparecerá aquí.
            </p>
            <Link
              to={`/propiedades/nueva${operacion === 'venta' ? '?operacion=venta' : ''}`}
              className="boton"
            >
              + Nueva propiedad
            </Link>
          </div>
        )}
        {propiedades && cantidad[operacion] > 0 && visibles.length === 0 && (
          <p className="vacio">No hay propiedades que coincidan con la búsqueda.</p>
        )}

        <div className="propiedades-lista">
          {visibles.map(p => <TarjetaPropiedad key={p.id} propiedad={p} />)}
        </div>
      </div>
    </div>
  );
}

function TarjetaPropiedad({ propiedad: p }) {
  const portada = p.fotos?.[0];
  const [claseEstado, textoEstado] = ESTADOS[p.estado] ?? ESTADOS.disponible;
  return (
    <Link to={`/propiedades/${p.id}`} className="tarjeta propiedad-card">
      <div className="propiedad-card-foto">
        {portada
          ? <img src={urlFoto(portada)} alt="" loading="lazy" />
          : <span className="micro">Sin fotos</span>}
      </div>
      <div className="propiedad-card-cuerpo">
        <div className="propiedad-chips">
          <span className="chip chip-tipo">{p.codigo}</span>
          <span className={'chip ' + (p.publicada ? 'chip-cumple' : 'chip-pausado')}>
            {p.publicada ? 'Publicada' : 'Sin publicar'}
          </span>
          {p.estado !== 'disponible' && <span className={'chip ' + claseEstado}>{textoEstado}</span>}
          {p.destacada && <span className="chip chip-alerta">Destacada</span>}
        </div>
        <strong className="dato-chico">{p.titulo}</strong>
        <span className="micro">{[etiquetaTipo(p.tipo), p.sector, p.comuna].filter(Boolean).join(' · ')}</span>
        <span className="propiedad-precio">{formatoPrecio(p.precio, p.moneda)}</span>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------- Ficha */

const VACIA = {
  operacion: 'arriendo', tipo: 'departamento', estado: 'disponible', publicada: false, destacada: false,
  titulo: '', descripcion: '', comuna: '', sector: '', direccion: '',
  precio: '', moneda: 'CLP', gastos_comunes: '',
  dormitorios: '', banos: '', superficie_util: '', superficie_total: '', estacionamientos: '', bodegas: '',
  amoblada: false, mascotas: '', caracteristicas: '',
  propietario_nombre: '', propietario_telefono: '', propietario_email: '', notas_internas: ''
};

const TEXTOS = ['titulo', 'descripcion', 'comuna', 'sector', 'direccion',
  'propietario_nombre', 'propietario_telefono', 'propietario_email', 'notas_internas'];
const ENTEROS = ['dormitorios', 'banos', 'estacionamientos', 'bodegas'];

function aFormulario(p) {
  const f = { ...VACIA };
  for (const k of ['operacion', 'tipo', 'estado', 'publicada', 'destacada', 'moneda', 'amoblada']) f[k] = p[k];
  for (const k of TEXTOS) f[k] = p[k] ?? '';
  // Como texto, igual que lo que entrega el campo: si no, "2" y 2 contarían
  // como un cambio sin guardar.
  for (const k of ENTEROS) f[k] = String(p[k] ?? '');
  for (const k of ['precio', 'gastos_comunes', 'superficie_util', 'superficie_total']) f[k] = formatoNumero(p[k]);
  f.mascotas = p.mascotas === null || p.mascotas === undefined ? '' : p.mascotas ? 'si' : 'no';
  f.caracteristicas = (p.caracteristicas ?? []).join(', ');
  return f;
}

function listaCaracteristicas(texto) {
  const vistas = new Set();
  return texto.split(',').map(c => c.trim()).filter(c => {
    const clave = normalizar(c);
    if (!c || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/* Del formulario (todo texto) a la fila. Devuelve el primer problema que
 * encuentra en vez de dejar que la base lo rechace con un mensaje en inglés. */
function aRegistro(f) {
  const r = {
    operacion: f.operacion, tipo: f.tipo, estado: f.estado, moneda: f.moneda,
    publicada: f.publicada, destacada: f.destacada, amoblada: f.amoblada,
    mascotas: f.mascotas === '' ? null : f.mascotas === 'si',
    caracteristicas: listaCaracteristicas(f.caracteristicas)
  };
  for (const k of TEXTOS) r[k] = f[k].trim() || null;
  if (!r.titulo || r.titulo.length < 3) return { problema: 'La propiedad necesita un título (mínimo 3 letras).' };
  if (r.titulo.length > 120) return { problema: 'El título no puede pasar de 120 caracteres.' };

  const montos = { precio: 'el precio', gastos_comunes: 'los gastos comunes',
    superficie_util: 'la superficie útil', superficie_total: 'la superficie total' };
  for (const [k, nombre] of Object.entries(montos)) {
    const n = parsearNumero(f[k]);
    if (Number.isNaN(n)) return { problema: `Revisa ${nombre}: escribe solo el número, por ejemplo 450.000.` };
    r[k] = n;
  }
  // El peso no tiene decimales; la UF sí.
  if (r.precio !== null && r.moneda === 'CLP') r.precio = Math.round(r.precio);
  if (r.gastos_comunes !== null) r.gastos_comunes = Math.round(r.gastos_comunes);

  for (const k of ENTEROS) {
    const v = String(f[k]).trim();
    if (v === '') { r[k] = null; continue; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 50) return { problema: 'Dormitorios, baños, estacionamientos y bodegas van como número entero.' };
    r[k] = n;
  }
  return { registro: r };
}

function FichaPropiedad({ id = null }) {
  const navegar = useNavigate();
  const { state } = useLocation();
  const [parametros] = useSearchParams();
  const { perfil } = useSesion();
  const esAdministracion = ['superadmin', 'admin'].includes(perfil?.rol);
  const [seccion] = useSeccionSitio();
  const seccionOculta = seccion?.visible === false;

  // Una propiedad nueva parte en la operación de la pestaña desde la que se
  // llegó; una existente espera a cargarse (null).
  const [form, setForm] = useState(() => (id ? null : {
    ...VACIA, operacion: parametros.get('operacion') === 'venta' ? 'venta' : 'arriendo'
  }));
  const [original, setOriginal] = useState(form);
  const [registro, setRegistro] = useState(null);    // la fila tal como está guardada
  const [fotos, setFotos] = useState([]);
  const [noExiste, setNoExiste] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(null);    // { hechas, total }
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(state?.aviso ?? null);
  const [salida, setSalida] = useState(null);        // a dónde se quería ir con cambios sin guardar

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    supabase.from('propiedades').select('*').eq('id', id).maybeSingle()
      .then(({ data, error: e }) => {
        if (!vigente) return;
        if (e) return setError(e.message);
        if (!data) return setNoExiste(true);
        const f = aFormulario(data);
        setRegistro(data);
        setForm(f);
        setOriginal(f);
        setFotos(data.fotos ?? []);
      });
    return () => { vigente = false; };
  }, [id]);

  const volverA = `/propiedades${(registro?.operacion ?? form?.operacion) === 'venta' ? '?operacion=venta' : ''}`;
  const hayCambios = Boolean(form && original) && JSON.stringify(form) !== JSON.stringify(original);

  function cambiar(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    setAviso(null);
  }

  function salir(destino) {
    if (hayCambios) setSalida(destino);
    else navegar(destino);
  }
  useVolverGlobal(() => salir(volverA));

  async function guardar(e) {
    e.preventDefault();
    const { registro: fila, problema } = aRegistro(form);
    if (problema) return setError(problema);
    setGuardando(true);
    setError(null);
    setAviso(null);

    if (!id) {
      const { data, error: e2 } = await supabase.from('propiedades').insert(fila).select('id').single();
      setGuardando(false);
      if (e2 || !data) return setError(e2?.message || 'No se pudo crear la propiedad.');
      navegar(`/propiedades/${data.id}`, {
        replace: true,
        state: { aviso: 'Propiedad creada. Ahora agrega las fotos: la primera es la portada.' }
      });
      return;
    }

    const { data, error: e2 } = await supabase.from('propiedades')
      .update(fila).eq('id', id).select('*').maybeSingle();
    setGuardando(false);
    if (e2 || !data) return setError(e2?.message || 'No se pudo guardar: no tienes permiso para editarla.');
    const f = aFormulario(data);
    setRegistro(data);
    setForm(f);
    setOriginal(f);
    setAviso(data.publicada ? 'Cambios guardados. Ya se ven en el sitio.' : 'Cambios guardados. La propiedad no está publicada.');
  }

  /* Las fotos se guardan al subirlas, sin esperar a "Guardar": la fila solo
   * cambia su lista de fotos, así que no pisa lo que se esté editando. */
  async function guardarFotos(nuevas, anteriores) {
    setFotos(nuevas);
    const { error: e } = await supabase.from('propiedades').update({ fotos: nuevas }).eq('id', id);
    if (e) {
      setFotos(anteriores);
      setError('No se pudo guardar el orden de las fotos: ' + e.message);
      return false;
    }
    return true;
  }

  async function subirFotos(entrada) {
    // Se copia antes de limpiar el campo: vaciar el input vacía la FileList.
    const archivos = Array.from(entrada.files ?? []);
    entrada.value = '';
    if (!archivos.length) return;
    setError(null);
    setAviso(null);
    setSubiendo({ hechas: 0, total: archivos.length });

    let actuales = fotos;
    const fallidas = [];
    for (const archivo of archivos) {
      try {
        const nombre = crypto.randomUUID();
        const grande = await comprimir(archivo, 1600, 0.8);
        // La miniatura sale de la ya reducida: decodificar dos veces el
        // original de 12 MP de un teléfono es lo que más demora.
        const mini = await comprimir(grande.blob, 640, 0.72);
        const ruta = `${id}/${nombre}.jpg`;
        const rutaMini = `${id}/${nombre}-m.jpg`;
        // El nombre es único y nunca se reescribe: el navegador puede guardarla un año.
        const opciones = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
        const r1 = await supabase.storage.from(BUCKET).upload(ruta, grande.blob, opciones);
        if (r1.error) throw r1.error;
        const r2 = await supabase.storage.from(BUCKET).upload(rutaMini, mini.blob, opciones);
        if (r2.error) {
          await supabase.storage.from(BUCKET).remove([ruta]);
          throw r2.error;
        }
        const nuevas = [...actuales, { ruta, mini: rutaMini, ancho: grande.ancho, alto: grande.alto }];
        const { error: e } = await supabase.from('propiedades').update({ fotos: nuevas }).eq('id', id);
        if (e) {
          await supabase.storage.from(BUCKET).remove([ruta, rutaMini]);
          throw e;
        }
        actuales = nuevas;
        setFotos(nuevas);
      } catch (e) {
        console.error('No se pudo subir la foto', archivo.name, e);
        fallidas.push(archivo.name);
      }
      setSubiendo(s => ({ ...s, hechas: s.hechas + 1 }));
    }
    setSubiendo(null);
    if (fallidas.length) {
      setError(`No se pudieron subir: ${fallidas.join(', ')}. Prueba con JPG o PNG; algunos navegadores no leen HEIC.`);
    }
  }

  function mover(desde, hasta) {
    if (hasta < 0 || hasta >= fotos.length) return;
    const nuevas = [...fotos];
    const [foto] = nuevas.splice(desde, 1);
    nuevas.splice(hasta, 0, foto);
    guardarFotos(nuevas, fotos);
  }

  async function quitarFoto(indice) {
    if (!window.confirm('¿Quitar esta foto? Deja de verse en el sitio.')) return;
    const foto = fotos[indice];
    // Primero la fila, después el archivo: al revés, el sitio mostraría por
    // un momento una foto que ya no existe.
    const ok = await guardarFotos(fotos.filter((_, i) => i !== indice), fotos);
    if (ok) await supabase.storage.from(BUCKET).remove([foto.ruta, foto.mini].filter(Boolean));
  }

  async function eliminar() {
    if (!window.confirm(
      `¿Eliminar ${registro.codigo} "${registro.titulo}"? Se borra con sus fotos y deja de verse en el sitio. No se puede deshacer.`
    )) return;
    setError(null);
    const { data, error: e } = await supabase.from('propiedades').delete().eq('id', id).select('id');
    if (e || !data?.length) return setError(e?.message || 'No se pudo eliminar: solo administración puede hacerlo.');
    const rutas = fotos.flatMap(f => [f.ruta, f.mini]).filter(Boolean);
    if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas);
    navegar(volverA, { replace: true });
  }

  if (noExiste) {
    return (
      <div className="pantalla">
        <div className="cuerpo">
          <p className="vacio">
            Esta propiedad no existe o fue eliminada. <Link to="/propiedades">Volver a propiedades</Link>
          </p>
        </div>
      </div>
    );
  }
  if (!form) {
    return error
      ? <div className="cuerpo"><div className="aviso aviso-critico">{error}</div></div>
      : <p className="cargando">Cargando…</p>;
  }

  const f = form;
  const campo = (nombre, etiqueta, { anchoTotal = false, ...atributos } = {}) => (
    <div className={'campo' + (anchoTotal ? ' ancho-total' : '')}>
      <label className="etiqueta-campo" htmlFor={`propiedad-${nombre}`}>{etiqueta}</label>
      <input id={`propiedad-${nombre}`} value={f[nombre]} onChange={e => cambiar(nombre, e.target.value)}
             {...atributos} />
    </div>
  );
  const caracteristicas = listaCaracteristicas(f.caracteristicas);
  const sugerencias = CARACTERISTICAS_SUGERIDAS.filter(
    s => !caracteristicas.some(c => normalizar(c) === normalizar(s))
  );

  return (
    <div className="pantalla pantalla-angosta">
      <header className="encabezado">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button type="button" className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => salir(volverA)}>
            ‹ Propiedades
          </button>
        </div>
        <div className="fila" style={{ alignItems: 'flex-start' }}>
          <div className="crece">
            <h1 className="h3">{id ? registro?.titulo : 'Nueva propiedad'}</h1>
            {registro && (
              <div className="propiedad-chips" style={{ marginTop: 6 }}>
                <span className="chip chip-tipo">{registro.codigo}</span>
                <span className={'chip ' + (registro.publicada ? 'chip-cumple' : 'chip-pausado')}>
                  {registro.publicada ? 'Publicada' : 'Sin publicar'}
                </span>
              </div>
            )}
          </div>
          {registro?.publicada && !seccionOculta && (
            <a className="boton boton-secundario" href={urlSitio(registro.codigo)} target="_blank" rel="noopener noreferrer">
              Ver en el sitio
            </a>
          )}
        </div>
      </header>

      <form className="cuerpo" onSubmit={guardar} noValidate>
        {aviso && <div className="propiedad-ok" role="status">{aviso}</div>}
        {error && <div className="aviso aviso-critico" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
        {seccionOculta && f.publicada && (
          <div className="aviso" style={{ marginBottom: 12 }}>
            La sección Propiedades está oculta en el sitio: esta propiedad no se ve hasta que
            administración la muestre desde el listado de Propiedades.
          </div>
        )}

        <section className="tarjeta propiedad-seccion">
          <h2 className="h4">Publicación</h2>
          <div className="formulario-grid">
            <div className="campo">
              <label className="etiqueta-campo" htmlFor="propiedad-operacion">Operación</label>
              <select id="propiedad-operacion" value={f.operacion} onChange={e => cambiar('operacion', e.target.value)}>
                <option value="arriendo">Arriendo</option>
                <option value="venta">Venta</option>
              </select>
            </div>
            <div className="campo">
              <label className="etiqueta-campo" htmlFor="propiedad-estado">Estado</label>
              <select id="propiedad-estado" value={f.estado} onChange={e => cambiar('estado', e.target.value)}>
                {Object.entries(ESTADOS).map(([valor, [, texto]]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </div>
          </div>
          <label className="propiedad-check">
            <input type="checkbox" checked={f.publicada} onChange={e => cambiar('publicada', e.target.checked)} />
            <span>
              <strong>Publicada en el sitio</strong>
              <span className="micro" style={{ display: 'block' }}>
                Se ve en coproactiva.cl/propiedades apenas guardes. Reservada, arrendada o vendida se
                muestran con su etiqueta mientras siga publicada.
              </span>
            </span>
          </label>
          <label className="propiedad-check">
            <input type="checkbox" checked={f.destacada} onChange={e => cambiar('destacada', e.target.checked)} />
            <span>
              <strong>Destacada</strong>
              <span className="micro" style={{ display: 'block' }}>Aparece primero en el listado del sitio.</span>
            </span>
          </label>
          {f.publicada && id && fotos.length === 0 && (
            <div className="aviso" style={{ marginTop: 4 }}>Sin fotos: en el sitio se verá con una imagen genérica.</div>
          )}
        </section>

        <section className="tarjeta propiedad-seccion">
          <h2 className="h4">Datos que muestra el sitio</h2>
          <div className="formulario-grid">
            {campo('titulo', 'Título', { anchoTotal: true, maxLength: 120, placeholder: 'Departamento 2D 2B con estacionamiento' })}
            <div className="campo">
              <label className="etiqueta-campo" htmlFor="propiedad-tipo">Tipo</label>
              <select id="propiedad-tipo" value={f.tipo} onChange={e => cambiar('tipo', e.target.value)}>
                {TIPOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </div>
            <div className="campo">
              <label className="etiqueta-campo" htmlFor="propiedad-precio">Precio</label>
              <div className="propiedad-precio-campo">
                <input id="propiedad-precio" inputMode="decimal" value={f.precio} placeholder={f.moneda === 'UF' ? '4.500' : '450.000'}
                       onChange={e => cambiar('precio', e.target.value)} />
                <select aria-label="Moneda" value={f.moneda} onChange={e => cambiar('moneda', e.target.value)}>
                  <option value="CLP">Pesos</option>
                  <option value="UF">UF</option>
                </select>
              </div>
            </div>
            {campo('comuna', 'Comuna', { placeholder: 'San Bernardo' })}
            {campo('sector', 'Sector o referencia', { placeholder: 'A pasos de la plaza' })}
            {campo('gastos_comunes', 'Gastos comunes (pesos al mes)', { inputMode: 'numeric', placeholder: '85.000' })}
            {campo('dormitorios', 'Dormitorios', { type: 'number', inputMode: 'numeric', min: 0, max: 50 })}
            {campo('banos', 'Baños', { type: 'number', inputMode: 'numeric', min: 0, max: 50 })}
            {campo('superficie_util', 'Superficie útil (m²)', { inputMode: 'decimal' })}
            {campo('superficie_total', 'Superficie total (m²)', { inputMode: 'decimal' })}
            {campo('estacionamientos', 'Estacionamientos', { type: 'number', inputMode: 'numeric', min: 0, max: 50 })}
            {campo('bodegas', 'Bodegas', { type: 'number', inputMode: 'numeric', min: 0, max: 50 })}
            <div className="campo">
              <label className="etiqueta-campo" htmlFor="propiedad-mascotas">Mascotas</label>
              <select id="propiedad-mascotas" value={f.mascotas} onChange={e => cambiar('mascotas', e.target.value)}>
                <option value="">No se informa</option>
                <option value="si">Se aceptan</option>
                <option value="no">No se aceptan</option>
              </select>
            </div>
            <label className="propiedad-check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" checked={f.amoblada} onChange={e => cambiar('amoblada', e.target.checked)} />
              <strong>Amoblada</strong>
            </label>
            <div className="campo ancho-total">
              <label className="etiqueta-campo" htmlFor="propiedad-descripcion">Descripción</label>
              <textarea id="propiedad-descripcion" rows={6} value={f.descripcion}
                        onChange={e => cambiar('descripcion', e.target.value)} />
            </div>
            <div className="campo ancho-total">
              <label className="etiqueta-campo" htmlFor="propiedad-caracteristicas">Características (separadas por coma)</label>
              <input id="propiedad-caracteristicas" value={f.caracteristicas}
                     placeholder="Piscina, Quincho, Conserjería 24 h"
                     onChange={e => cambiar('caracteristicas', e.target.value)} />
              {sugerencias.length > 0 && (
                <div className="propiedad-sugerencias">
                  {sugerencias.map(s => (
                    <button key={s} type="button" className="propiedad-sugerencia"
                            onClick={() => cambiar('caracteristicas', [...caracteristicas, s].join(', '))}>
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="tarjeta propiedad-seccion">
          <div className="fila" style={{ marginBottom: 10 }}>
            <h2 className="h4 crece" style={{ margin: 0 }}>Fotos</h2>
            {id && (
              <label className={'boton boton-secundario' + (subiendo ? ' deshabilitado' : '')}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden
                       disabled={Boolean(subiendo)} onChange={e => subirFotos(e.target)} />
                Agregar fotos
              </label>
            )}
          </div>
          {!id && <p className="micro" style={{ margin: 0 }}>Guarda la propiedad para poder subir fotos.</p>}
          {id && subiendo && (
            <p className="micro" role="status">Subiendo {subiendo.hechas + 1} de {subiendo.total}…</p>
          )}
          {id && fotos.length === 0 && !subiendo && (
            <p className="micro" style={{ margin: 0 }}>
              Sin fotos todavía. Se guardan al subirlas; la primera es la portada.
            </p>
          )}
          {fotos.length > 0 && (
            <ol className="propiedad-fotos">
              {fotos.map((foto, i) => (
                <li key={foto.ruta || foto.url || i} className="propiedad-foto">
                  <img src={urlFoto(foto)} alt={`Foto ${i + 1}`} loading="lazy" />
                  {i === 0
                    ? <span className="chip chip-cumple propiedad-portada">Portada</span>
                    : (
                      <button type="button" className="chip propiedad-portada propiedad-hacer-portada"
                              onClick={() => mover(i, 0)}>
                        Usar de portada
                      </button>
                    )}
                  <div className="propiedad-foto-acciones">
                    <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0}
                            aria-label={`Mover la foto ${i + 1} antes`} title="Mover antes">‹</button>
                    <button type="button" onClick={() => mover(i, i + 1)} disabled={i === fotos.length - 1}
                            aria-label={`Mover la foto ${i + 1} después`} title="Mover después">›</button>
                    <button type="button" onClick={() => quitarFoto(i)} className="quitar"
                            aria-label={`Quitar la foto ${i + 1}`}>Quitar</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="tarjeta propiedad-seccion propiedad-privada">
          <h2 className="h4">Solo interno</h2>
          <p className="micro" style={{ margin: '-4px 0 12px' }}>
            No se muestra en el sitio: la base no entrega estos datos con la clave pública.
          </p>
          <div className="formulario-grid">
            {campo('direccion', 'Dirección exacta', { anchoTotal: true })}
            {campo('propietario_nombre', 'Propietario')}
            {campo('propietario_telefono', 'Teléfono del propietario', { type: 'tel' })}
            {campo('propietario_email', 'Correo del propietario', { type: 'email', anchoTotal: true })}
            <div className="campo ancho-total">
              <label className="etiqueta-campo" htmlFor="propiedad-notas">Notas internas</label>
              <textarea id="propiedad-notas" rows={3} value={f.notas_internas}
                        onChange={e => cambiar('notas_internas', e.target.value)} />
            </div>
          </div>
        </section>

        {id && esAdministracion && (
          <p className="micro" style={{ margin: '4px 0 0' }}>
            <button type="button" className="boton boton-texto propiedad-eliminar" onClick={eliminar}>
              Eliminar propiedad
            </button>
          </p>
        )}

        <div className="pie-fijo propiedad-pie">
          <button type="button" className="boton boton-secundario boton-movil crece"
                  onClick={() => salir(volverA)} disabled={guardando}>
            {hayCambios ? 'Descartar' : 'Volver'}
          </button>
          <button type="submit" className="boton boton-movil crece" disabled={guardando || (id && !hayCambios)}>
            {guardando ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </div>
      </form>

      {salida && (
        <Confirmar
          titulo="Hay cambios sin guardar"
          mensaje="Si sales ahora, se pierden. Las fotos ya quedaron guardadas."
          textoConfirmar="Salir sin guardar"
          onConfirmar={() => navegar(salida)}
          onCancelar={() => setSalida(null)}
        />
      )}
    </div>
  );
}
