import { useEffect, useRef, useState } from 'react';
import { opcionesDe } from '../lib/opciones';

/* Cómo se responde cada punto del levantamiento.
 *
 * El tipo lo define la plantilla y llega copiado en el propio punto. Cada tipo
 * escribe en `respuesta` con la forma que le corresponde; el componente no sabe
 * nada de guardado, solo avisa hacia arriba. Así la pantalla de levantamiento
 * mantiene un único camino de escritura hacia el teléfono y la cola de subida.
 */

const ESTADOS = [
  ['cumple', 'Conforme'],
  ['observacion', 'Observa'],
  ['critico', 'Crítico']
];

export default function CampoPunto({ item, cerrado, onEstado, onRespuesta }) {
  const r = item.respuesta ?? {};
  const cfg = item.config ?? {};

  switch (item.tipo_ingreso) {
    case 'texto':
      return (
        <div className="campo" style={{ marginBottom: 0 }}>
          <textarea
            rows={cfg.lineas ?? 3}
            defaultValue={r.texto ?? ''}
            placeholder={cfg.ejemplo ?? 'Escribe lo que observaste'}
            disabled={cerrado}
            onBlur={e => onRespuesta({ texto: e.target.value })}
          />
        </div>
      );

    case 'numero':
      return (
        <div className="campo campo-medida" style={{ marginBottom: 0 }}>
          <input
            type="number"
            inputMode="decimal"
            step={cfg.decimales ? Math.pow(10, -cfg.decimales) : 'any'}
            defaultValue={r.numero ?? ''}
            placeholder="0"
            disabled={cerrado}
            onBlur={e => onRespuesta(
              e.target.value === '' ? null : { numero: Number(e.target.value) }
            )}
          />
          {cfg.unidad && <span className="unidad">{cfg.unidad}</span>}
        </div>
      );

    case 'escala':
      return (
        <Escala
          valor={r.valor}
          min={cfg.min ?? 1}
          max={cfg.max ?? 10}
          etiquetaMin={cfg.etiqueta_min}
          etiquetaMax={cfg.etiqueta_max}
          cerrado={cerrado}
          onCambio={valor => onRespuesta(valor == null ? null : { valor })}
        />
      );

    case 'seleccion':
      return (
        <div className="opciones">
          {(cfg.opciones ?? []).map(op => (
            <button
              key={op} type="button" disabled={cerrado}
              aria-pressed={r.opcion === op}
              onClick={() => onRespuesta(r.opcion === op ? null : { opcion: op })}
            >
              {op}
            </button>
          ))}
        </div>
      );

    /* Opciones de la plantilla (Cumple, No cumple, No aplica…). Si la elegida
     * exige evidencia, el punto pide aparte comentario y foto. */
    case 'opciones':
      return (
        <div className="opciones">
          {opcionesDe(cfg).map(({ texto: op }) => (
            <button
              key={op} type="button" disabled={cerrado}
              aria-pressed={r.opcion === op}
              onClick={() => onRespuesta(r.opcion === op ? null : { opcion: op })}
            >
              {op}
            </button>
          ))}
        </div>
      );

    case 'checklist': {
      const marcadas = r.opciones ?? [];
      return (
        <div className="lista-marcas">
          {(cfg.opciones ?? []).map(op => {
            const activa = marcadas.includes(op);
            return (
              <label key={op} className={'marca' + (activa ? ' activa' : '')}>
                <input
                  type="checkbox" checked={activa} disabled={cerrado}
                  onChange={() => onRespuesta({
                    opciones: activa
                      ? marcadas.filter(x => x !== op)
                      : [...marcadas, op]
                  })}
                />
                <span>{op}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'firma':
      return (
        <Firma
          cerrado={cerrado}
          nombre={r.firmante_nombre}
          rut={r.firmante_rut}
          hecha={r.firmada}
          pedirNombre={cfg.pedir_nombre !== false}
          pedirRut={cfg.pedir_rut === true}
          onFirmar={onRespuesta}
        />
      );

    // 'foto' no dibuja nada acá: las fotos las maneja la grilla del punto, que
    // ya sabe comprimir, guardar el blob y encolar la subida.
    case 'foto':
      return null;

    case 'estado':
    default:
      return (
        <div className="selector">
          {ESTADOS.map(([valor, etiqueta]) => (
            <button key={valor} type="button" className={valor}
                    aria-pressed={item.estado === valor} disabled={cerrado}
                    onClick={() => onEstado(valor)}>
              {etiqueta}
            </button>
          ))}
        </div>
      );
  }
}

/* Escala numérica. Botones y no un deslizador: con guantes o con el teléfono en
 * una mano, arrastrar un control fino es impreciso, y un 7 marcado por error
 * pasa desapercibido. */
function Escala({ valor, min, max, etiquetaMin, etiquetaMax, cerrado, onCambio }) {
  const valores = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="escala">
      <div className="escala-botones">
        {valores.map(n => (
          <button key={n} type="button" disabled={cerrado}
                  aria-pressed={valor === n}
                  onClick={() => onCambio(valor === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      {(etiquetaMin || etiquetaMax) && (
        <div className="escala-extremos">
          <span>{etiquetaMin ?? ''}</span>
          <span>{etiquetaMax ?? ''}</span>
        </div>
      )}
    </div>
  );
}

/* Firma con el dedo sobre el teléfono.
 *
 * Se dibuja en un canvas y se entrega como blob PNG, que la pantalla guarda
 * como adjunto de clase 'firma'. Va aparte de las fotos: en el informe no entra
 * a la grilla, va al pie como constancia de quién recibió el levantamiento. */
function Firma({ cerrado, nombre, rut, hecha, pedirNombre, pedirRut, onFirmar }) {
  const lienzo = useRef(null);
  const dibujando = useRef(false);
  const [conTrazo, setConTrazo] = useState(Boolean(hecha));
  const [datos, setDatos] = useState({ nombre: nombre ?? '', rut: rut ?? '' });

  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    /* El canvas se dimensiona al ancho real en píxeles del dispositivo. Sin
     * esto el trazo sale borroso y desplazado respecto del dedo en pantallas
     * de alta densidad. */
    const escala = window.devicePixelRatio || 1;
    const caja = c.getBoundingClientRect();
    c.width = caja.width * escala;
    c.height = caja.height * escala;
    const ctx = c.getContext('2d');
    ctx.scale(escala, escala);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2b3138';
  }, []);

  function punto(e) {
    const caja = lienzo.current.getBoundingClientRect();
    const t = e.touches?.[0] ?? e;
    return { x: t.clientX - caja.left, y: t.clientY - caja.top };
  }

  function iniciar(e) {
    if (cerrado) return;
    e.preventDefault();
    dibujando.current = true;
    const ctx = lienzo.current.getContext('2d');
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function mover(e) {
    if (!dibujando.current) return;
    e.preventDefault();
    const ctx = lienzo.current.getContext('2d');
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!conTrazo) setConTrazo(true);
  }

  function terminar() { dibujando.current = false; }

  function limpiar() {
    const c = lienzo.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setConTrazo(false);
    onFirmar(null);
  }

  function confirmar() {
    lienzo.current.toBlob(blob => {
      onFirmar({
        firmada: true,
        firmante_nombre: datos.nombre || null,
        firmante_rut: datos.rut || null,
        blob
      });
    }, 'image/png');
  }

  return (
    <div className="firma">
      {pedirNombre && (
        <div className="campo">
          <label className="etiqueta-campo">Nombre de quien recibe</label>
          <input type="text" value={datos.nombre} disabled={cerrado}
                 onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
        </div>
      )}
      {pedirRut && (
        <div className="campo">
          <label className="etiqueta-campo">RUT</label>
          <input type="text" inputMode="text" value={datos.rut} disabled={cerrado}
                 onChange={e => setDatos({ ...datos, rut: e.target.value })} />
        </div>
      )}

      <canvas
        ref={lienzo} className="lienzo-firma"
        onMouseDown={iniciar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
        onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={terminar}
      />
      <p className="micro apagado" style={{ margin: '4px 0 8px' }}>
        Firme con el dedo dentro del recuadro
      </p>

      {!cerrado && (
        <div className="fila" style={{ gap: 8 }}>
          <button type="button" className="boton boton-secundario crece"
                  onClick={limpiar} disabled={!conTrazo}>
            Borrar
          </button>
          <button type="button" className="boton crece"
                  onClick={confirmar} disabled={!conTrazo}>
            Confirmar firma
          </button>
        </div>
      )}
    </div>
  );
}
