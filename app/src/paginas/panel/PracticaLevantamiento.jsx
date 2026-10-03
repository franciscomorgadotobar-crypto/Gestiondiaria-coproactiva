import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const preguntas = [
  'Iluminación perimetral y de acceso',
  'Estado de portón y control de acceso',
  'Registro de visitas'
];

export default function PracticaLevantamiento() {
  const navegar = useNavigate();
  const [categoria, setCategoria] = useState(false);
  const [pregunta, setPregunta] = useState(null);
  const [respuesta, setRespuesta] = useState(null);

  const volverLista = () => setPregunta(null);

  return (
    <div className="pantalla pantalla-angosta practica-levantamiento">
      <header className="encabezado encabezado-levantamiento" data-tutorial="practica-intro">
        <div className="fila" style={{ marginBottom: 6 }}>
          <span className="crece" />
          <span className="chip chip-alerta">Modo práctica</span>
        </div>
        <h1 className="h3">Edificio de práctica</h1>
        <p className="chico apagado" style={{ margin: '2px 0 4px' }}>Av. Ejemplo 123, Santiago</p>
        <p className="chico apagado" style={{ margin: 0 }}>Visita de entrenamiento · no guarda datos</p>
        <div style={{ marginTop: 12 }}>
          <div className="fila" style={{ marginBottom: 5 }}>
            <span className="etiqueta-campo crece" style={{ margin: 0 }}>Avance</span>
            <span className="etiqueta-campo" style={{ margin: 0 }}>{respuesta ? '1' : '0'} de 3</span>
          </div>
          <div className="barra"><div style={{ width: respuesta ? '33%' : '0%' }} /></div>
        </div>
      </header>

      <div className="cuerpo">
        <section className="categoria">
          <button
            type="button"
            data-tutorial="practica-categoria"
            className={'categoria-titulo' + (categoria ? ' abierta' : '')}
            aria-expanded={categoria}
            onClick={() => {
              setCategoria(x => !x);
              if (categoria) setPregunta(null);
            }}
          >
            <span className="crece">Accesos y seguridad</span>
            <span className="micro">{respuesta ? '1' : '0'}/3</span>
            <span className="flecha">{categoria ? '−' : '+'}</span>
          </button>

          {categoria && pregunta === null && (
            <ol className="indice-preguntas">
              {preguntas.map((texto, i) => {
                const hecha = i === 0 && Boolean(respuesta);
                return (
                  <li key={texto}>
                    <button
                      type="button"
                      {...(i === 0 ? { 'data-tutorial': 'practica-pregunta' } : {})}
                      className={'pregunta-indice' + (hecha ? ' respondida' : '')}
                      onClick={() => setPregunta(i)}
                    >
                      <span className="numero-pregunta">{i + 1}</span>
                      <span className="texto-pregunta">
                        <span>{texto}</span>
                        <small>{hecha ? 'Respondida' : 'Pendiente'}</small>
                      </span>
                      <span className="estado-pregunta">{hecha ? '✓' : '›'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {categoria && pregunta !== null && (
            <>
              <button type="button" className="volver-indice" onClick={volverLista}>
                ‹ Volver a la lista
              </button>

              <article className="tarjeta punto">
                <p style={{ margin: '0 0 4px' }}>{preguntas[pregunta]}</p>
                <p className="chico apagado ayuda-punto">
                  Comprueba visualmente la condición y registra la alternativa que corresponda.
                </p>

                <div className="opciones">
                  {['Cumple', 'No cumple', 'Cumple con observaciones', 'No aplica'].map(op => (
                    <button key={op} type="button"
                            {...(op === 'Cumple' ? { 'data-tutorial': 'practica-respuesta' } : {})}
                            aria-pressed={respuesta === op}
                            onClick={() => op === 'Cumple' && setRespuesta('Cumple')}>
                      {op}
                    </button>
                  ))}
                </div>

                <p className="micro exige-foto">Este punto exige al menos una fotografía</p>
                <div className="fotos-punto" data-tutorial="practica-evidencia">
                  <button type="button" className="agregar-foto" onClick={() => {}}>
                    <span>＋</span>Cámara
                  </button>
                  <button type="button" className="agregar-foto" onClick={() => {}}>
                    <span>＋</span>Galería
                  </button>
                </div>
              </article>

              <nav className="pasos" data-tutorial="practica-navegacion">
                <button type="button" className="boton boton-secundario"
                        disabled={pregunta === 0}
                        onClick={() => setPregunta(x => Math.max(0, x - 1))}>
                  ‹ Anterior
                </button>
                <div className="conteo">
                  <span>{pregunta + 1} de 3 · {respuesta ? '1 completada' : '0 completadas'}</span>
                  <div className="marcadores">
                    {[0,1,2].map(i => (
                      <span key={i} className={'marcador' + (i === pregunta ? ' aqui' : '') + (i === 0 && respuesta ? ' hecho' : '')} />
                    ))}
                  </div>
                </div>
                <button type="button" className="boton"
                        onClick={() => setPregunta(x => Math.min(2, x + 1))}>
                  Siguiente ›
                </button>
              </nav>
            </>
          )}
        </section>
      </div>

      <footer className="pie-fijo">
        <button type="button" className="boton boton-secundario boton-movil crece">
          Pausar
        </button>
        <button type="button" data-tutorial="practica-finalizar"
                className="boton boton-movil crece"
                disabled={!respuesta}>
          {respuesta ? 'Finalizar levantamiento' : 'Faltan 3 preguntas'}
        </button>
      </footer>
    </div>
  );
}
