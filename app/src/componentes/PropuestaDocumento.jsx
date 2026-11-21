import {contenidoEditable,interpolar,filas,puntos} from '../lib/plantillasDocumentalesEditables';

const propDocStyles = {
  head: { display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 10, borderBottom: '1.5px solid #2b3138', marginBottom: 16, breakAfter: 'avoid-page', pageBreakAfter: 'avoid', breakInside: 'avoid' },
  num: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '.14em', color: '#d5863b' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 23.5, letterSpacing: '-.015em', color: '#2b3138' },
  h3: { margin: '22px 0 10px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#8b939b', breakAfter: 'avoid-page', pageBreakAfter: 'avoid' },
  sec: { marginTop: 26, breakInside: 'auto' },
  p: { margin: '0 0 12px', fontSize: 15.5, lineHeight: 1.53, color: '#3a4149', orphans: 3, widows: 3, whiteSpace: 'pre-line' },
  note: { margin: '16px 0 0', fontSize: 14, lineHeight: 1.55, color: '#6b7480' },
  table: { width: '100%', borderCollapse: 'collapse', breakInside:'avoid-page', pageBreakInside:'avoid' },
  th: { background: '#2b3138', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px' },
  thSm: { background: '#2b3138', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', textAlign: 'left', padding: '10px 12px' },
  td: { padding: '11px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.55, color: '#3a4149', verticalAlign: 'top' },
  tdLabel: { padding: '11px 14px', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: '#2b3138', verticalAlign: 'top' },
  tdSm: { padding: '11px 12px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#3a4149', verticalAlign: 'top' },
  tdSmInk: { padding: '11px 12px', borderBottom: '1px solid #e9e6e2', fontSize: 15, color: '#2b3138', verticalAlign: 'top' },
  tdCat: { padding: '11px 12px', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#d5863b', verticalAlign: 'top' },
  tdDeliv: { padding: '12px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#3a4149' },
  tdPeriod: { padding: '12px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#2b3138' },
  zebra: { background: '#faf8f5', breakInside: 'avoid-page', pageBreakInside: 'avoid' },
  plain: { breakInside: 'avoid-page', pageBreakInside: 'avoid' },
  ul: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 },
  li: { display: 'flex', gap: 12, fontSize: 15, lineHeight: 1.5, color: '#3a4149', breakInside: 'avoid-page', pageBreakInside: 'avoid' },
  dash: { flex: 'none', color: '#d5863b', fontWeight: 700 },
  metaLabel: { padding: '12px 14px 12px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b939b', verticalAlign: 'baseline' },
  metaVal: { padding: '12px 0', borderBottom: '1px solid #e9e6e2', fontSize: 16, color: '#3a4149', verticalAlign: 'baseline' },
  metaValStrong: { padding: '12px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: '#2b3138', verticalAlign: 'baseline' },
  feeLabel: { padding: '13px 16px', background: '#f7f4f0', borderBottom: '1px solid #e9e6e2', fontSize: 15.5, color: '#3a4149' },
  feeVal: { padding: '13px 16px', background: '#f7f4f0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, color: '#2b3138', textAlign: 'right' },
  totLabel: { padding: 16, background: '#2b3138', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#fff' },
  totVal: { padding: 16, background: '#2b3138', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: '#fff', textAlign: 'right' },
  ph: { color: '#c9a97f' },
  approachLabel: { width: '29%', padding: '11px 18px 11px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, lineHeight: 1.3, color: '#2b3138', verticalAlign: 'top' },
  approachText: { padding: '11px 0', borderBottom: '1px solid #e9e6e2', fontSize: 15.5, lineHeight: 1.55, color: '#3a4149', verticalAlign: 'top' }
};

const Ph = ({ value, hint }) => value ? <>{value}</> : <span style={propDocStyles.ph}>{hint}</span>;

const SecHead = ({ n, title, showNum }) => (
  <div style={propDocStyles.head}>
    {showNum ? <span style={propDocStyles.num}>{n}</span> : null}
    <h2 style={propDocStyles.h2}>{title}</h2>
  </div>
);

const Bullets = ({ items }) => (
  <ul style={propDocStyles.ul}>
    {items.map((t, i) => (
      <li key={i} style={propDocStyles.li}><span style={propDocStyles.dash}>-</span><span>{t}</span></li>
    ))}
  </ul>
);

const AREAS = [
  ['Legal y normativa', 'Convocatoria y ejecución de asambleas, actas y acuerdos, cumplimiento del reglamento de copropiedad, representación de la comunidad en materias de administración y conservación.'],
  ['Financiera y contable', 'Presupuesto estimativo anual, emisión y cobro de gastos comunes, control de morosidad y cobranza extrajudicial, administración del fondo común de reserva, rendición mensual y balance anual.'],
  ['Operativa y técnica', 'Programa anual de mantenciones, coordinación y supervisión de proveedores, gestión de incidencias, control de certificaciones obligatorias y conservación de bienes comunes.'],
  ['Laboral y previsional', 'Contratos del personal de la comunidad, remuneraciones, cotizaciones, cumplimiento de la normativa laboral vigente y representación ante la autoridad administrativa del trabajo.']
];

const PLAN = [
  ['Días 1 a 5', 'Recepción documental formal de la administración saliente, levantamiento de accesos, claves, contratos vigentes y estado financiero.'],
  ['Días 6 a 15', 'Informe de diagnóstico inicial de brechas por área: legal, financiera, laboral, técnica, documental y de seguridad.'],
  ['Días 16 a 30', 'Plan de regularización con acciones, plazos y responsables por área, presentado al Comité para su aprobación.'],
  ['Mensual', 'Informe de avance del proceso de regularización, incorporado en la rendición mensual de cuentas al Comité.']
];

const ENTREGABLES = [
  ['Informe de diagnóstico inicial de brechas', 'Primeros 15 días'],
  ['Plan de regularización aprobado por el Comité', 'Primeros 30 días'],
  ['Rendición documentada de gestión: balance, egresos, cartolas y respaldos', 'Mensual, al Comité'],
  ['Informe de avance del proceso de regularización', 'Mensual'],
  ['Presupuesto estimativo anual de obligaciones económicas', 'Anual'],
  ['Balance anual para votación en asamblea ordinaria', 'Anual'],
  ['Informe de gestión al término del contrato', 'Al término']
];

const SLA = [
  ['Urgente', 'Riesgo para personas o daño activo a bienes comunes sin alternativa disponible.', '30 min', '2 horas'],
  ['Normal', 'Falla operativa con alternativa disponible o sin riesgo inmediato.', '2 horas', '24 horas hábiles'],
  ['Programado', 'Mantención preventiva o solicitud administrativa no urgente.', '24 hrs hábiles', '72 horas hábiles']
];

const ENFOQUE = [
  ['Cumplimiento normativo', 'Cada decisión se funda en el texto legal aplicable: Ley N°21.442, Decreto N°7/2025 y el reglamento de copropiedad de la comunidad. No improvisamos criterios.'],
  ['Transparencia financiera', 'Los fondos de la comunidad se administran exclusivamente en cuentas de titularidad de la propia comunidad, con rendición mensual documentada y respaldo verificable de cada egreso.'],
  ['Tecnología aplicada a la comunidad', 'Contamos con la capacidad y el enfoque para incorporar tecnología a la gestión del condominio según lo que cada comunidad requiera, con un objetivo claro: administrar mejor, comunicar mejor y mejorar la calidad de vida de quienes viven en ella.'],
  ['Respuesta oportuna', 'Compromisos de atención definidos por categoría de incidencia, medibles y auditables por el Comité, con canal de urgencias disponible 24/7.']
];

function PropuestaDoc({ d, calc, opts, plantillaContenido=null }) {
  const s = propDocStyles;
  const plantilla=contenidoEditable('propuesta_comercial',plantillaContenido);
  const variables={
    comunidad:d.comunidad?.trim()||'[NOMBRE DEL EDIFICIO O CONDOMINIO]',
    destinatario:d.destinatario||'Comité de Administración',
    email:d.email||'contacto@coproactiva.cl',
    diasPago:d.diasPago||'5',
    mesesContrato:d.mesesContrato||'12',
    vigencia:d.vigencia||'30'
  };
  const texto=clave=>interpolar(plantilla[clave],variables);
  const matriz=(clave,original,columnas)=>filas(plantilla[clave],columnas);
  const lista=(clave,original)=>puntos(plantilla[clave]).map(t=>interpolar(t,variables));
  const comunidad = d.comunidad.trim();
  const nombreEnTexto = comunidad || '[NOMBRE DEL EDIFICIO O CONDOMINIO]';
  const reglasBase = calc.tipoHonorarios === 'fijo' ? [
    'El honorario propuesto es un monto fijo mensual y no depende del valor de los gastos comunes de la comunidad.',
    'El honorario se presenta con su valor neto, IVA del 19% y total mensual. El honorario neto se reajusta anualmente por IPC.',
    'El valor de la oferta queda sujeto a confirmación definitiva después del diagnóstico administrativo, financiero y operativo del condominio.'
  ] : [
    'La base de referencia corresponde a los gastos comunes ordinarios mensuales del condominio antes de incorporar el honorario de administración.',
    'El porcentaje indicado se aplica sobre la base de referencia para obtener el honorario neto. A continuación, se agrega el IVA del 19%.',
    'El honorario neto calculado se reajusta anualmente por IPC y queda sujeto a confirmación después del diagnóstico del condominio.'
  ];
  const reglas=lista(calc.tipoHonorarios==='fijo'?'reglasFijo':'reglasPorcentaje',reglasBase);
  const condiciones=lista('condiciones',[
    `Pago dentro de los primeros ${d.diasPago||'5'} días corridos de cada mes, mediante transferencia electrónica.`,
    `Contrato de ${d.mesesContrato||'12'} meses, renovable automáticamente salvo aviso escrito con 60 días corridos de anticipación.`,
    'El honorario neto mensual se reajustará anualmente conforme a la variación acumulada del Índice de Precios al Consumidor (IPC) publicada por el INE durante los 12 meses anteriores al aniversario del contrato.'
  ]);
  const noIncluidas=lista('noIncluidas',[
    'Servicios jurídicos: asesoría legal especializada, elaboración o modificación del reglamento de copropiedad y patrocinio en procedimientos que requieran abogado habilitado.',
    'Ejecución de obras, remodelaciones y reparaciones mayores. Coproactiva coordina y supervisa proveedores, pero no ejecuta obras por cuenta propia.',
    'Peritajes, informes estructurales y certificaciones que requieran profesional habilitado.',
    'Reconstrucción documental cuando la comunidad no disponga de archivos, actas o registros contables históricos.',
    'Regularización de deudas laborales, previsionales o tributarias originadas con anterioridad al inicio del contrato.'
  ]);
  const canales=lista('canales',[
    `Incidencias normales y programadas: ${d.email||'contacto@coproactiva.cl'} · lunes a viernes, 09:00 a 18:00 hrs.`,
    'Urgencias: WhatsApp 24/7. El plazo corre desde el acuse de recibo.',
    'Modalidad de atención mixta (presencial/telemática) con un mínimo de 8 horas de disponibilidad mensuales.'
  ]);
  return (
    <doc-page margin="0.72in" style={{ fontFamily: 'var(--font-body)' }}>
      <div slot="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9aa1a8', borderTop: '1px solid #e9e6e2', paddingTop: 9 }}>
        <span>{texto('pieEmpresa')}</span>
        <span>{comunidad ? comunidad + ' · ' : ''}{texto('pieDocumento')}</span>
      </div>

      {opts.portada ? (
        <div style={{ breakAfter: 'page' }}>
          <img src={import.meta.env.BASE_URL+"brand/imagologo-horizontal-naranja.svg"} alt="CoproActiva" style={{ display: 'block', height: 31, width: 'auto' }} />
          <div style={{ height: 1.5, background: '#2b3138', marginTop: 28 }}></div>
          <div style={{ marginTop: 26, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.36em', textTransform: 'uppercase', color: '#d5863b' }}>{texto('portadaEtiqueta')}</div>
          <h1 style={{ margin: '16px 0 0', fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 43, lineHeight: 1.12, letterSpacing: '-.02em', color: '#2b3138' }}>{texto('portadaTitulo')}</h1>
          <p style={{ margin: '22px 0 0', fontSize: 16.5, lineHeight: 1.6, color: '#5a636c', maxWidth: '32em' }}>{texto('portadaSubtitulo')}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 56 }}>
            <tbody>
              <tr style={s.plain}>
                <td style={{ ...s.metaLabel, width: '34%' }}>{texto('portadaEtiquetaComunidad')}</td>
                <td style={s.metaValStrong}><Ph value={comunidad} hint="[NOMBRE DEL EDIFICIO O CONDOMINIO]" /></td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>{texto('portadaEtiquetaUbicacion')}</td>
                <td style={s.metaVal}>
                  <Ph value={d.direccion} hint="[DIRECCIÓN]" />, <Ph value={d.comuna} hint="[COMUNA]" />, {texto('portadaRegion')}
                </td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>{texto('portadaEtiquetaDestinatario')}</td>
                <td style={s.metaVal}>{d.destinatario || 'Comité de Administración'}</td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>{texto('portadaEtiquetaFecha')}</td>
                <td style={s.metaVal}>{texto('portadaPrefijoFecha').trimEnd()} <Ph value={calc.fechaTexto} hint="[FECHA]" /></td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>{texto('portadaEtiquetaVigencia')}</td>
                <td style={s.metaVal}>{texto('portadaTextoVigencia')}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 44, display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14, color: '#6b7480' }}>
            <span style={{ color: '#d5863b', fontWeight: 700 }}>·</span>
            <span>{texto('pieEmpresa')} · {d.email || 'contacto@coproactiva.cl'}</span>
          </div>
        </div>
      ) : null}

      <section className="propuesta-seccion propuesta-presentacion" style={{ breakInside: 'auto' }}>
        <SecHead n="01" title={texto('tituloPresentacion')} showNum={opts.numeros} />
        <p style={s.p}>{texto('saludo')}</p>
        <p style={s.p}>{texto('presentacion')}</p>
        <p style={s.p}>{texto('compromiso')}</p>
        <p style={{ ...s.p, margin: 0 }}>{texto('cierre')}</p>
        <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #e9e6e2', breakInside: 'avoid' }}>
          <div style={{ fontFamily: 'var(--font-script)', fontSize: 39, lineHeight: 1, color: '#2b3138' }}>{d.firmante || texto('firmantePredeterminado')}</div>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: '#6b7480' }}>{d.cargo || texto('cargoPredeterminado')}</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6b7480' }}>{texto('pieEmpresa')}</div>
        </div>
      </section>

      <section className="propuesta-seccion propuesta-enfoque" style={s.sec}>
        <SecHead n="02" title={texto('tituloEnfoque')} showNum={opts.numeros} />
        <table style={s.table}>
          <tbody>
            {matriz('enfoques',ENFOQUE,2).map(([k, v]) => (
              <tr key={k} style={s.plain}>
                <td style={s.approachLabel}>{k}</td>
                <td style={s.approachText}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="propuesta-seccion propuesta-servicio" style={s.sec}>
        <SecHead n="03" title={texto('tituloServicio')} showNum={opts.numeros} />
        <p style={{ ...s.p, margin: '0 0 20px' }}>{texto('servicioIntro')}</p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: '31%' }}>{texto('tablaServicioArea')}</th>
              <th style={s.th}>{texto('tablaServicioComprende')}</th>
            </tr>
          </thead>
          <tbody>
            {matriz('areas',AREAS,2).map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdLabel}>{k}</td>
                <td style={s.td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="propuesta-seccion propuesta-plan" style={s.sec}>
        <SecHead n="04" title={texto('tituloPlan')} showNum={opts.numeros} />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: '22%' }}>{texto('tablaPlanPlazo')}</th>
              <th style={s.th}>{texto('tablaPlanHito')}</th>
            </tr>
          </thead>
          <tbody>
            {matriz('plan',PLAN,2).map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdLabel}>{k}</td>
                <td style={s.td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={s.note}>{texto('notaPlan')}</p>
      </section>

      <section className="propuesta-seccion propuesta-entregables" style={s.sec}>
        <SecHead n="05" title={texto('tituloEntregables')} showNum={opts.numeros} />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{texto('tablaEntregable')}</th>
              <th style={{ ...s.th, width: '31%' }}>{texto('tablaPeriodicidad')}</th>
            </tr>
          </thead>
          <tbody>
            {matriz('entregables',ENTREGABLES,2).map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdDeliv}>{k}</td>
                <td style={s.tdPeriod}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="propuesta-seccion propuesta-atencion" style={s.sec}>
        <div className="propuesta-bloque-tabla">
          <SecHead n="06" title={texto('tituloAtencion')} showNum={opts.numeros} />
          <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.thSm, width: '17%' }}>{texto('tablaAtencionCategoria')}</th>
              <th style={s.thSm}>{texto('tablaAtencionDefinicion')}</th>
              <th style={{ ...s.thSm, width: '15%' }}>{texto('tablaAtencionAcuse')}</th>
              <th style={{ ...s.thSm, width: '20%' }}>{texto('tablaAtencionPlan')}</th>
            </tr>
          </thead>
          <tbody>
            {matriz('sla',SLA,4).map(([cat, def, ac, pa], i) => (
              <tr key={cat} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdCat}>{cat}</td>
                <td style={s.tdSm}>{def}</td>
                <td style={s.tdSmInk}>{ac}</td>
                <td style={s.tdSmInk}>{pa}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        <h3 style={{ ...s.h3, marginTop: 26 }}>{texto('tituloCanales')}</h3>
        <Bullets items={canales} />
        <p style={{ ...s.note, marginTop: 18 }}>{texto('notaCanales')}</p>
      </section>

      {opts.honorarios ? (
        <section className="propuesta-seccion propuesta-honorarios" style={s.sec}>
          <div className="propuesta-bloque-tabla">
            <SecHead n="07" title={texto('tituloHonorarios')} showNum={opts.numeros} />
            <table style={{ ...s.table, breakInside: 'avoid-page' }}>
            <tbody>
              {calc.tipoHonorarios==='porcentaje' ? (
                <>
                  <tr>
                    <td style={s.feeLabel}>{texto('conceptoBase')}</td>
                    <td style={{ ...s.feeVal, width: '30%' }}><Ph value={calc.base} hint="$[VALOR]" /></td>
                  </tr>
                  <tr>
                    <td style={s.feeLabel}>{texto('conceptoPorcentaje')}</td>
                    <td style={s.feeVal}><Ph value={calc.pct} hint="[PORCENTAJE]" /></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td style={s.feeLabel}>{texto('conceptoFijo')}</td>
                  <td style={{ ...s.feeVal, width: '30%' }}>{texto('conceptoFijoValor')}</td>
                </tr>
              )}
              <tr>
                <td style={s.feeLabel}>{texto('conceptoNeto')}</td>
                <td style={s.feeVal}><Ph value={calc.neto} hint="$[VALOR]" /></td>
              </tr>
              <tr>
                <td style={s.feeLabel}>{texto('conceptoIVA')}</td>
                <td style={s.feeVal}><Ph value={calc.iva} hint="$[VALOR]" /></td>
              </tr>
              <tr>
                <td style={s.totLabel}>{texto('conceptoTotal')}</td>
                <td style={s.totVal}><Ph value={calc.total} hint="$[VALOR]" /></td>
              </tr>
            </tbody>
            </table>
          </div>
          <h3 style={s.h3}>{texto('tituloReglas')}</h3>
          <Bullets items={reglas} />
          <h3 style={s.h3}>{texto('tituloCondiciones')}</h3>
          <Bullets items={condiciones} />
        </section>
      ) : null}

      <section className="propuesta-seccion propuesta-exclusiones" style={s.sec}>
        <SecHead n={opts.honorarios ? '08' : '07'} title={texto('tituloNoIncluidas')} showNum={opts.numeros} />
        <p style={{ ...s.p, margin: '0 0 18px' }}>{texto('introduccionNoIncluidas')}</p>
        <Bullets items={noIncluidas} />
      </section>
    </doc-page>
  );
}

export default PropuestaDoc;
