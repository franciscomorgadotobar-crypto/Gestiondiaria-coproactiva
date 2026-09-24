import { Suspense, lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Levantamiento from './Control';

/* /control/:id sirve dos cosas distintas: un levantamiento normal (el
 * renderer genérico de Control.jsx) o un diagnóstico comercial (puntaje
 * ponderado, ítems condicionales, línea sugerida) — que necesita su propia
 * pantalla y no calza en el renderer genérico sin arriesgar los
 * levantamientos reales.
 *
 * Este despachador decide cuál mostrar según `controles.es_diagnostico`, fijado
 * al crear el levantamiento (Programar.jsx). Así todo lo que ya enlaza a
 * /control/:id —tarjetas del inicio, comunidades, etc.— sigue funcionando sin
 * tocarlo.
 */
const DiagnosticoComercial = lazy(() => import('../comercial/DiagnosticoComercial'));

export default function Despacho() {
  const { id } = useParams();
  const [esDiagnostico, setEsDiagnostico] = useState(null);

  useEffect(() => {
    let vigente = true;
    supabase.from('controles').select('es_diagnostico').eq('id', id).maybeSingle()
      .then(({ data }) => { if (vigente) setEsDiagnostico(Boolean(data?.es_diagnostico)); });
    return () => { vigente = false; };
  }, [id]);

  if (esDiagnostico === null) return <p className="cargando">Cargando…</p>;
  if (!esDiagnostico) return <Levantamiento />;

  return (
    <Suspense fallback={<p className="cargando">Cargando…</p>}>
      <DiagnosticoComercial id={id} />
    </Suspense>
  );
}
