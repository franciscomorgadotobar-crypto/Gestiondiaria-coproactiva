import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../lib/sesion';
import { useTutoriales } from '../../lib/tutorialesContexto';

export default function Ayuda() {
  const navegar = useNavigate();
  const { perfil } = useSesion();
  const { disponibles, estadoDe, iniciar } = useTutoriales();

  return (
    <div className="pantalla">
      <header className="encabezado">
        <div className="fila" style={{ marginBottom: 8 }}>
          <button type="button" className="boton boton-texto"
                  style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar(-1)}>
            ‹ Volver
          </button>
        </div>
        <h1 className="h3">Ayuda y tutoriales</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Aprende una tarea y repítela cuando lo necesites
        </p>
      </header>

      <div className="cuerpo">
        <div className="aviso" style={{ marginBottom: 16 }}>
          Los tutoriales guiados se hacen sobre la interfaz real. La práctica de
          levantamiento usa datos ficticios y no modifica comunidades ni controles.
        </div>

        <div className="rejilla">
          {disponibles.map(t => {
            const { asignado, progreso } = estadoDe(t);
            const completado = progreso?.estado === 'completado';
            const enCurso = progreso?.estado === 'en_curso';
            const porcentaje = enCurso
              ? Math.round(((progreso.paso_actual + 1) / t.pasos.length) * 100)
              : completado ? 100 : 0;

            return (
              <article key={t.id} className="tarjeta tutorial-listado">
                <div className="fila" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <div className="crece">
                    <span className="etiqueta-campo" style={{ marginBottom: 4 }}>
                      {t.duracion} min
                    </span>
                    <h2 className="h4" style={{ margin: 0 }}>{t.nombre}</h2>
                  </div>
                  {completado ? (
                    <span className="chip chip-cumple">Completado</span>
                  ) : asignado ? (
                    <span className="chip chip-alerta">Asignado</span>
                  ) : (
                    <span className="chip chip-tipo">Disponible</span>
                  )}
                </div>

                <p className="chico apagado" style={{ margin: '8px 0 14px' }}>{t.descripcion}</p>

                {(enCurso || completado) && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="fila" style={{ marginBottom: 5 }}>
                      <span className="micro crece">{completado ? 'Terminado' : 'Progreso'}</span>
                      <span className="micro">{porcentaje}%</span>
                    </div>
                    <div className="barra"><div style={{ width: porcentaje + '%' }} /></div>
                  </div>
                )}

                <button type="button" className="boton boton-ancho"
                        onClick={() => iniciar(t.id, { continuar: enCurso })}>
                  {completado ? 'Repetir tutorial' : enCurso ? 'Continuar' : 'Comenzar'}
                </button>
              </article>
            );
          })}
        </div>

        {disponibles.length === 0 && (
          <p className="vacio">No hay tutoriales disponibles para el rol {perfil?.rol}.</p>
        )}
      </div>
    </div>
  );
}
