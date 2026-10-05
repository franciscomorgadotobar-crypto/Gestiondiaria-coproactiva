import { useMemo, useState } from 'react';

/*
 * Diálogo visual para pedir uno o varios datos sin recurrir a prompt()/alert().
 * Usa el mismo lenguaje visual que Confirmar y el resto de formularios.
 */
export default function DialogoCampos({
  titulo,
  mensaje,
  campos = [],
  textoConfirmar = 'Aceptar',
  textoCancelar = 'Cancelar',
  mostrarCancelar = true,
  onConfirmar,
  onCancelar
}) {
  const inicial = useMemo(
    () => Object.fromEntries(campos.map(c => [c.id, c.valor ?? ''])),
    [campos]
  );
  const [valores, setValores] = useState(inicial);

  const valido = campos.every(c =>
    !c.obligatorio || String(valores[c.id] ?? '').trim()
  );

  function cambiar(id, valor) {
    setValores(v => ({ ...v, [id]: valor }));
  }

  function enviar(e) {
    e.preventDefault();
    if (!valido) return;
    onConfirmar?.(valores);
  }

  return (
    <div className="modal-fondo" role="presentation" onClick={onCancelar}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogo-campos-titulo"
        onSubmit={enviar}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dialogo-campos-titulo" className="h3">{titulo}</h2>
        {mensaje && <p className="chico apagado">{mensaje}</p>}

        {campos.map((campo, i) => (
          <div className="campo" key={campo.id}>
            <label className="etiqueta-campo" htmlFor={'dialogo-' + campo.id}>
              {campo.label}
              {campo.obligatorio ? ' *' : ''}
            </label>
            {campo.multiline ? (
              <textarea
                id={'dialogo-' + campo.id}
                rows={campo.filas ?? 4}
                autoFocus={i === 0}
                value={valores[campo.id] ?? ''}
                placeholder={campo.placeholder ?? ''}
                onChange={e => cambiar(campo.id, e.target.value)}
              />
            ) : (
              <input
                id={'dialogo-' + campo.id}
                type={campo.tipo ?? 'text'}
                autoFocus={i === 0}
                value={valores[campo.id] ?? ''}
                placeholder={campo.placeholder ?? ''}
                onChange={e => cambiar(campo.id, e.target.value)}
              />
            )}
            {campo.ayuda && <p className="micro apagado" style={{ margin: '5px 0 0' }}>{campo.ayuda}</p>}
          </div>
        ))}

        <div className="fila-botones">
          {mostrarCancelar && (
            <button type="button" className="boton boton-secundario boton-movil" onClick={onCancelar}>
              {textoCancelar}
            </button>
          )}
          <button type="submit" className="boton boton-movil" disabled={!valido}>
            {textoConfirmar}
          </button>
        </div>
      </form>
    </div>
  );
}
