import { useAtrasCierraDialogo } from '../lib/dialogoHistorial';
import { useRef } from 'react';
import { useFocoDialogo } from '../lib/focoDialogo';
/* Recuadro de confirmación genérico: un título, un texto y dos salidas.
 *
 * Existe para el caso de "estás por perder algo": cambios sin guardar,
 * una acción que no se puede deshacer. `onCancelar` vuelve a donde estaba
 * la persona; `onConfirmar` sigue adelante con lo que iba a pasar.
 */
export default function Confirmar({
  titulo, mensaje, textoConfirmar = 'Aceptar', textoCancelar = 'Volver a editar',
  onConfirmar, onCancelar
}) {
  useAtrasCierraDialogo(onCancelar);
  const modalRef = useRef(null);
  useFocoDialogo(modalRef,onCancelar);
  return (
    <div className="modal-fondo" role="presentation" onClick={onCancelar}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo"
           ref={modalRef} tabIndex={-1}
           onClick={e => e.stopPropagation()}>
        <h2 id="confirmar-titulo" className="h3">{titulo}</h2>
        <p className="chico apagado">{mensaje}</p>
        <div className="fila-botones">
          <button type="button" className="boton boton-secundario boton-movil" onClick={onCancelar}>
            {textoCancelar}
          </button>
          <button type="button" className="boton boton-movil" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
