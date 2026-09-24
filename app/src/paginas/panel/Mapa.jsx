import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';

/* Mapa de lo hecho en terreno.
 *
 * Responde una pregunta que ninguna lista contesta bien: dónde estuvo el equipo
 * y qué encontró. Un check-in es una coordenada con hora y precisión; puesto en
 * el mapa se ve de inmediato si alguien pasó por los seis edificios del día o
 * si dos quedaron sin visitar.
 *
 * Los mapas son de OpenStreetMap: no necesitan clave ni tarjeta. A cambio, esta
 * pantalla sí necesita señal —las baldosas se descargan— y por eso es de
 * oficina, no de terreno.
 */

const RANGOS = [
  ['hoy', 'Hoy', 0],
  ['semana', '7 días', 7],
  ['mes', '30 días', 30],
  ['todo', 'Todo', null]
];

// El color dice el estado del levantamiento sin tener que abrirlo.
const COLORES = {
  enviado:   '#38603f',
  en_curso:  '#d5863b',
  pausado:   '#4a5a68',
  pendiente: '#8a8a8a',
  anulado:   '#a4402f'
};

/* Se dibuja el pin en SVG en vez de usar una imagen: así el color sale de los
 * tokens de marca y no hay que mantener cinco archivos png.
 *
 * Cuando el lugar tiene más de una visita, el pin muestra cuántas. Un edificio
 * revisado doce veces son doce pines encima del otro: no se distingue de uno
 * visitado una sola vez, que es justo lo que se está mirando. */
function marcador(color, critico, cuantas) {
  const muchas = cuantas > 1;
  return L.divIcon({
    className: 'pin-vacio',
    html: `<svg width="${muchas ? 32 : 26}" height="${muchas ? 42 : 34}"
                viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
             <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 21 13 21s13-11.3 13-21C26 5.8 20.2 0 13 0z"
                   fill="${color}" stroke="#fff" stroke-width="1.5"/>
             ${muchas
               ? `<circle cx="13" cy="13" r="7.5" fill="#fff"/>
                  <text x="13" y="16.5" text-anchor="middle"
                        font-family="Helvetica,Arial,sans-serif" font-size="9" font-weight="700"
                        fill="${color}">${cuantas}</text>`
               : `<circle cx="13" cy="13" r="5" fill="#fff" opacity="${critico ? 1 : 0.85}"/>
                  ${critico ? '<circle cx="13" cy="13" r="2.6" fill="#a4402f"/>' : ''}`}
           </svg>`,
    iconSize: muchas ? [32, 42] : [26, 34],
    iconAnchor: muchas ? [16, 42] : [13, 34],
    popupAnchor: [0, -34]
  });
}

export default function Mapa() {
  const navegar = useNavigate();
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);

  const [controles, setControles] = useState(null);
  const [rango, setRango] = useState('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState(null);
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    supabase
      .from('controles_con_avance')
      .select('id, comunidad_id, prospecto_id, estado, periodo, checkin_en, checkin_lat, checkin_lng, checkin_precision, enviado_en, programado_para, items_evaluados, items_totales, items_criticos, fotos, destino_nombre, destino_direccion, destino_comuna, destino_tipo')
      .not('checkin_lat', 'is', null)
      .order('checkin_en', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setControles(data ?? []);
      });
  }, []);

  /* El rango filtra por el check-in, que es cuando se estuvo en el lugar. Usar
   * la fecha de creación mostraría el día en que se programó la visita, que no
   * es lo que se está preguntando. */
  const visibles = useMemo(() => {
    if (!controles) return [];
    const opcion = RANGOS.find(r => r[0] === rango);

    if (rango === 'personalizado') {
      const a = desde ? new Date(desde + 'T00:00:00').getTime() : -Infinity;
      const b = hasta ? new Date(hasta + 'T23:59:59').getTime() : Infinity;
      return controles.filter(c => {
        const t = new Date(c.checkin_en).getTime();
        return t >= a && t <= b;
      });
    }

    if (opcion?.[2] == null) return controles;

    const limite = opcion[2] === 0
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : Date.now() - opcion[2] * 24 * 60 * 60 * 1000;
    return controles.filter(c => new Date(c.checkin_en).getTime() >= limite);
  }, [controles, rango, desde, hasta]);

  /* Las visitas se agrupan por lugar. Un edificio con doce recorridos es una
   * fila con doce dentro, no doce filas repetidas con el mismo nombre.
   *
   * La coordenada del grupo es el promedio de sus check-ins: cada uno cae unos
   * metros distinto según dónde estaba la persona, y el promedio deja el pin
   * sobre el edificio en vez de sobre el último lugar donde alguien sacó el
   * teléfono. */
  const lugares = useMemo(() => {
    const m = new Map();
    for (const c of visibles) {
      const clave = c.comunidad_id ?? c.prospecto_id ?? c.destino_nombre;
      if (!m.has(clave)) {
        m.set(clave, {
          clave,
          nombre: c.destino_nombre,
          comuna: c.destino_comuna,
          tipo: c.destino_tipo,
          visitas: []
        });
      }
      m.get(clave).visitas.push(c);
    }

    return [...m.values()].map(l => {
      const puntos = l.visitas.filter(
        v => Number.isFinite(Number(v.checkin_lat)) && Number.isFinite(Number(v.checkin_lng))
      );
      return {
        ...l,
        lat: puntos.reduce((n, v) => n + Number(v.checkin_lat), 0) / puntos.length,
        lng: puntos.reduce((n, v) => n + Number(v.checkin_lng), 0) / puntos.length,
        // El color lo pone la visita más reciente: es el estado en que quedó.
        estado: l.visitas[0].estado,
        criticos: l.visitas.reduce((n, v) => n + (v.items_criticos ?? 0), 0),
        fotos: l.visitas.reduce((n, v) => n + (v.fotos ?? 0), 0),
        ultima: l.visitas[0].checkin_en,
        // La peor precisión del grupo: si una de las mediciones fue mala, el
        // grupo no puede presentarse como preciso.
        precision: Math.max(...l.visitas.map(v => Number(v.checkin_precision) || 0))
      };
    }).sort((a, b) => new Date(b.ultima) - new Date(a.ultima));
  }, [visibles]);

  // Montaje del mapa, una sola vez.
  useEffect(() => {
    if (mapa.current || !contenedor.current) return;

    mapa.current = L.map(contenedor.current, { zoomControl: false })
      .setView([-33.45, -70.66], 11);   // Santiago, hasta que haya puntos

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(mapa.current);

    L.control.zoom({ position: 'bottomright' }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);

    return () => { mapa.current?.remove(); mapa.current = null; };
  }, []);

  // Los marcadores se rehacen cuando cambia el filtro.
  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    if (!visibles.length) return;

    const puntos = [];
    for (const l of lugares) {
      if (!Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
      puntos.push([l.lat, l.lng]);

      const pin = L.marker([l.lat, l.lng], {
        icon: marcador(COLORES[l.estado] ?? COLORES.pendiente, l.criticos > 0, l.visitas.length)
      }).addTo(capa.current);

      pin.bindPopup(`
        <strong>${l.nombre ?? 'Sin nombre'}</strong><br>
        ${l.visitas.length} visita${l.visitas.length > 1 ? 's' : ''}
        · última el ${new Date(l.ultima).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
        ${l.criticos ? `<br>${l.criticos} crítico${l.criticos > 1 ? 's' : ''}` : ''}
      `);
      pin.on('click', () => setElegido(l.clave));

      /* La precisión del GPS se dibuja como un círculo. Un check-in con 300
       * metros de margen no prueba presencia en un edificio concreto, y verlo
       * es más honesto que mostrar un pin exacto que no lo es. */
      if (l.precision > 40) {
        L.circle([l.lat, l.lng], {
          radius: l.precision,
          color: '#4a5a68', weight: 1, opacity: 0.35,
          fillColor: '#4a5a68', fillOpacity: 0.08
        }).addTo(capa.current);
      }
    }

    if (puntos.length === 1) mapa.current.setView(puntos[0], 16);
    else if (puntos.length > 1) mapa.current.fitBounds(puntos, { padding: [40, 40] });
  }, [lugares]);

  /* Tocar un lugar de la lista lo centra en el mapa. Con quince pines
   * repartidos por Santiago, buscar a ojo cuál corresponde a una fila no es
   * razonable. */
  function irAlLugar(l) {
    setElegido(l.clave);
    if (mapa.current && Number.isFinite(l.lat)) {
      mapa.current.setView([l.lat, l.lng], 16, { animate: true });
      contenedor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const resumen = useMemo(() => ({
    visitas: visibles.length,
    comunidades: lugares.length,
    criticos: visibles.reduce((n, c) => n + (c.items_criticos ?? 0), 0),
    fotos: visibles.reduce((n, c) => n + (c.fotos ?? 0), 0)
  }), [visibles, lugares]);

  return (
    <div className="pantalla pantalla-mapa">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar('/inicio')}>
            ‹ Inicio
          </button>
          <span className="crece" />
          <span className="micro">{visibles.length} visitas</span>
        </div>

        <div className="filtros-rango">
          {RANGOS.map(([valor, etiqueta]) => (
            <button key={valor} type="button"
                    className={rango === valor ? 'activo' : ''}
                    onClick={() => setRango(valor)}>
              {etiqueta}
            </button>
          ))}
          <button type="button" className={rango === 'personalizado' ? 'activo' : ''}
                  onClick={() => setRango('personalizado')}>
            Rango
          </button>
        </div>

        {rango === 'personalizado' && (
          <div className="fila" style={{ gap: 8, marginTop: 8 }}>
            <div className="campo crece" style={{ marginBottom: 0 }}>
              <label className="etiqueta-campo" htmlFor="desde">Desde</label>
              <input id="desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="campo crece" style={{ marginBottom: 0 }}>
              <label className="etiqueta-campo" htmlFor="hasta">Hasta</label>
              <input id="hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>
        )}
      </header>

      {error && <div className="aviso aviso-critico" style={{ margin: 12 }}>{error}</div>}

      <div ref={contenedor} className="lienzo-mapa" />

      <div className="panel-mapa">
        <div className="tablero" style={{ marginBottom: 12 }}>
          <div><p className="n">{resumen.visitas}</p><p className="r">Visitas</p></div>
          <div><p className="n">{resumen.comunidades}</p><p className="r">Lugares</p></div>
          <div className={resumen.criticos ? 'critico' : ''}>
            <p className="n">{resumen.criticos}</p><p className="r">Críticos</p>
          </div>
          <div><p className="n">{resumen.fotos}</p><p className="r">Fotos</p></div>
        </div>

        {controles === null && !error && <p className="cargando">Cargando…</p>}
        {controles && visibles.length === 0 && (
          <p className="vacio">No hay check-in registrados en este periodo.</p>
        )}

        {lugares.map(l => (
          <section key={l.clave}
                   className={'lugar' + (elegido === l.clave ? ' elegido' : '')}>
            <header onClick={() => irAlLugar(l)}>
              <span className="punto-estado"
                    style={{ background: COLORES[l.estado] ?? COLORES.pendiente }} />
              <span className="crece">
                <span className="nombre">{l.nombre}</span>
                <span className="detalle">
                  {l.comuna ? l.comuna + ' · ' : ''}
                  {l.visitas.length} visita{l.visitas.length > 1 ? 's' : ''}
                  {l.fotos > 0 && ` · ${l.fotos} foto${l.fotos > 1 ? 's' : ''}`}
                </span>
              </span>
              {l.criticos > 0 && <span className="chip chip-critico">{l.criticos}</span>}
              {l.tipo === 'prospecto' && <span className="chip chip-diagnostico">Diagnóstico</span>}
            </header>

            {l.visitas.map(c => (
              <Link key={c.id} to={`/control/${c.id}`} className="visita">
                <span className="crece">
                  <span className="detalle">
                    {new Date(c.checkin_en).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{c.items_evaluados} de {c.items_totales}
                    {c.checkin_precision > 40 && ` · precisión ${Math.round(c.checkin_precision)} m`}
                  </span>
                </span>
                <span className="ir" aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
