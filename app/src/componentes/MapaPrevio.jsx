import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* Vista previa del mapa para el inicio.
 *
 * Leaflet y sus estilos pesan 156 kB, y el inicio es la primera pantalla que
 * abre alguien en terreno con mala señal. Por eso la carga es diferida: la
 * tarjeta se dibuja de inmediato con su marco y sus cifras, y el mapa aparece
 * cuando termina de llegar. Si no llega -sin datos, por ejemplo- la tarjeta
 * sigue sirviendo: informa cuántas visitas hay y lleva al mapa completo.
 *
 * No es interactivo a propósito. Arrastrarlo sin querer al desplazar la página
 * es molesto, y para explorar está la pantalla completa.
 */

const COLORES = {
  enviado:   '#38603f',
  en_curso:  '#d5863b',
  pausado:   '#4a5a68',
  pendiente: '#8a8a8a',
  anulado:   '#a4402f'
};

export default function MapaPrevio({ controles }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const [listo, setListo] = useState(false);

  const conUbicacion = (controles ?? []).filter(
    c => c.checkin_lat != null && c.checkin_lng != null
  );

  useEffect(() => {
    let vivo = true;

    (async () => {
      if (!contenedor.current || mapa.current) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !contenedor.current) return;

      mapa.current = L.map(contenedor.current, {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false
      }).setView([-33.45, -70.66], 10);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
        .addTo(mapa.current);

      const puntos = [];
      for (const c of conUbicacion) {
        const lat = Number(c.checkin_lat);
        const lng = Number(c.checkin_lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        puntos.push([lat, lng]);

        L.circleMarker([lat, lng], {
          radius: 7,
          color: '#fff', weight: 2,
          fillColor: COLORES[c.estado] ?? COLORES.pendiente,
          fillOpacity: 1
        }).addTo(mapa.current);
      }

      if (puntos.length === 1) mapa.current.setView(puntos[0], 14);
      else if (puntos.length > 1) mapa.current.fitBounds(puntos, { padding: [28, 28] });

      setListo(true);
    })();

    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [controles]);

  return (
    <section className="tarjeta-mapa">
      <div ref={contenedor} className="previo">
        {!listo && <span className="cargando-mapa">Cargando el mapa…</span>}
      </div>

      <div className="pie-mapa">
        <span className="crece">
          <strong>{conUbicacion.length}</strong>
          {conUbicacion.length === 1 ? ' visita registrada' : ' visitas registradas'}
        </span>
        <Link to="/mapa" className="boton">Ver mapa completo →</Link>
      </div>
    </section>
  );
}
