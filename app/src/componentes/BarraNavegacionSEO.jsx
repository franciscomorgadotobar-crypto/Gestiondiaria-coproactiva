import { useId } from 'react';

/**
 * Navegación interna de SEO: no reemplaza la barra principal de Comercial.
 * En escritorio se usa la lista de pestañas de SEO.jsx; en móviles, este
 * selector nativo presenta todas las secciones sin un segundo menú «Más».
 * La vista sigue persistida en ?vista= por usePestanaHistorial.
 */
export default function BarraNavegacionSEO({ vista, secciones, vistasValidas, onSeleccionar }) {
  const id = useId();
  const opciones = [...secciones, ['diagnostico', 'Diagnóstico']];
  return (
    <div className="seo-selector-secciones">
      <label htmlFor={id}>Sección de SEO</label>
      <select
        id={id}
        aria-label="Sección de SEO"
        value={vista}
        onChange={evento => {
          const destino = evento.target.value;
          if (vistasValidas.includes(destino)) onSeleccionar?.(destino);
        }}
      >
        {opciones.map(([clave, etiqueta]) => (
          <option key={clave} value={clave}>{etiqueta}</option>
        ))}
      </select>
    </div>
  );
}
