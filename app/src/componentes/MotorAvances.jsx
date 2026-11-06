import { limitarAvance } from '../lib/motorAvances';
import './MotorAvances.css';

/** Barra y métricas idénticas para checklists y subtareas. */
export default function MotorAvances({
  valor = 0, completados = 0, total = 0, etiqueta = 'Avance', compacto = false
}) {
  const porcentaje = limitarAvance(valor);
  return <div className={'motor-avances'+(compacto?' motor-avances--compacto':'')}>
    <div className="motor-avances-cabecera">
      <span>{etiqueta}</span>
      <strong>{completados} de {total} · {porcentaje}%</strong>
    </div>
    <div className="motor-avances-barra" role="progressbar"
      aria-label={etiqueta} aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
      <div style={{width:porcentaje+'%'}}/>
    </div>
  </div>;
}
