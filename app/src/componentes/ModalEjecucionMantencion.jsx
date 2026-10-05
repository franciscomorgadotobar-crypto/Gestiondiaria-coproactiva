import { useState } from 'react';

export default function ModalEjecucionMantencion({
  titulo = 'Registrar mantención',
  mensaje,
  ejecutorInicial = '',
  evidenciaObligatoria = false,
  tiposRequeridos = [],
  guardando = false,
  onConfirmar,
  onCancelar
}) {
  const [ejecutor, setEjecutor] = useState(ejecutorInicial);
  const [observaciones, setObservaciones] = useState('');
  const [archivos, setArchivos] = useState([]);

  const valido = ejecutor.trim()
    && (!evidenciaObligatoria || archivos.length > 0);

  function enviar(e) {
    e.preventDefault();
    if (!valido || guardando) return;
    onConfirmar?.({ ejecutor, observaciones, archivos });
  }

  return (
    <div className="modal-fondo" role="presentation" onClick={onCancelar}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ejecucion-mantencion-titulo"
        onSubmit={enviar}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="ejecucion-mantencion-titulo" className="h3">{titulo}</h2>
        {mensaje && <p className="chico apagado">{mensaje}</p>}

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="mantencion-ejecutor">Quién realizó la mantención *</label>
          <input
            id="mantencion-ejecutor"
            autoFocus
            value={ejecutor}
            onChange={e => setEjecutor(e.target.value)}
          />
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="mantencion-observaciones">Qué se realizó</label>
          <textarea
            id="mantencion-observaciones"
            rows="4"
            value={observaciones}
            placeholder="Trabajo realizado, hallazgos u observaciones"
            onChange={e => setObservaciones(e.target.value)}
          />
        </div>

        <div className="campo">
          <label className="etiqueta-campo" htmlFor="mantencion-archivos">
            Evidencias {evidenciaObligatoria ? '*' : ''}
          </label>
          {tiposRequeridos.length > 0 && (
            <p className="micro apagado" style={{ margin: '0 0 8px' }}>
              Requeridas: {tiposRequeridos.join(', ')}
            </p>
          )}
          <label className="mantencion-selector-archivo" htmlFor="mantencion-archivos">
            <span>{archivos.length ? 'Agregar más archivos' : 'Seleccionar archivos'}</span>
            <span className="micro apagado">PDF, fotos, Word o Excel · hasta 25 MB por archivo</span>
          </label>
          <input
            id="mantencion-archivos"
            className="visualmente-oculto"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp"
            onChange={e => {
              const nuevos = Array.from(e.target.files ?? []);
              setArchivos(xs => [...xs, ...nuevos]);
              e.target.value = '';
            }}
          />
          {archivos.length > 0 && (
            <div className="mantencion-archivos-seleccionados">
              {archivos.map((archivo, i) => (
                <div key={archivo.name + '-' + i} className="mantencion-archivo-seleccionado">
                  <span className="chico">{archivo.name}</span>
                  <button
                    type="button"
                    className="boton boton-texto"
                    onClick={() => setArchivos(xs => xs.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fila-botones">
          <button type="button" className="boton boton-secundario boton-movil" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="boton boton-movil" disabled={!valido || guardando}>
            {guardando ? 'Guardando…' : 'Registrar ejecución'}
          </button>
        </div>
      </form>
    </div>
  );
}
