const propDocStyles = {
  head: { display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 10, borderBottom: '1.5px solid #2b3138', marginBottom: 22 },
  num: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '.14em', color: '#d5863b' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 25, letterSpacing: '-.015em', color: '#2b3138' },
  h3: { margin: '28px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#8b939b' },
  sec: { marginTop: 46, breakInside: 'auto' },
  p: { margin: '0 0 14px', fontSize: 16, lineHeight: 1.62, color: '#3a4149' },
  note: { margin: '16px 0 0', fontSize: 14, lineHeight: 1.55, color: '#6b7480' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { background: '#2b3138', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px' },
  thSm: { background: '#2b3138', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', textAlign: 'left', padding: '10px 12px' },
  td: { padding: '13px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.55, color: '#3a4149', verticalAlign: 'top' },
  tdLabel: { padding: '13px 14px', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: '#2b3138', verticalAlign: 'top' },
  tdSm: { padding: '13px 12px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#3a4149', verticalAlign: 'top' },
  tdSmInk: { padding: '13px 12px', borderBottom: '1px solid #e9e6e2', fontSize: 15, color: '#2b3138', verticalAlign: 'top' },
  tdCat: { padding: '13px 12px', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#d5863b', verticalAlign: 'top' },
  tdDeliv: { padding: '12px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#3a4149' },
  tdPeriod: { padding: '12px 14px', borderBottom: '1px solid #e9e6e2', fontSize: 15, lineHeight: 1.5, color: '#2b3138' },
  zebra: { background: '#faf8f5', breakInside: 'avoid' },
  plain: { breakInside: 'avoid' },
  ul: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 },
  li: { display: 'flex', gap: 12, fontSize: 15.5, lineHeight: 1.55, color: '#3a4149', breakInside: 'avoid' },
  dash: { flex: 'none', color: '#d5863b', fontWeight: 700 },
  metaLabel: { padding: '12px 14px 12px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b939b', verticalAlign: 'baseline' },
  metaVal: { padding: '12px 0', borderBottom: '1px solid #e9e6e2', fontSize: 16, color: '#3a4149', verticalAlign: 'baseline' },
  metaValStrong: { padding: '12px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: '#2b3138', verticalAlign: 'baseline' },
  feeLabel: { padding: '13px 16px', background: '#f7f4f0', borderBottom: '1px solid #e9e6e2', fontSize: 15.5, color: '#3a4149' },
  feeVal: { padding: '13px 16px', background: '#f7f4f0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, color: '#2b3138', textAlign: 'right' },
  totLabel: { padding: 16, background: '#2b3138', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#fff' },
  totVal: { padding: 16, background: '#2b3138', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: '#fff', textAlign: 'right' },
  ph: { color: '#c9a97f' },
  approachLabel: { width: '29%', padding: '14px 18px 14px 0', borderBottom: '1px solid #e9e6e2', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, lineHeight: 1.3, color: '#2b3138', verticalAlign: 'top' },
  approachText: { padding: '14px 0', borderBottom: '1px solid #e9e6e2', fontSize: 15.5, lineHeight: 1.55, color: '#3a4149', verticalAlign: 'top' }
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

function PropuestaDoc({ d, calc, opts }) {
  const s = propDocStyles;
  const comunidad = d.comunidad.trim();
  const nombreEnTexto = comunidad || '[NOMBRE DEL EDIFICIO O CONDOMINIO]';
  const reglas = [
        'La base de referencia corresponde al monto total mensual de gastos comunes ordinarios del condominio, antes de incorporar el honorario de administración, para evitar que el propio honorario forme parte de su base de cálculo.',
        'El honorario base se expresa en pesos (sin decimales) y permanece fijo, por lo que no cambia por las variaciones mensuales del gasto común. Este monto base solo se actualizará una vez al año según la inflación (IPC), manteniéndose así a menos que ambas partes acuerden por escrito una nueva tarifa de referencia.',
        'Los honorarios detallados en esta propuesta se presentan de manera referencial y quedarán sujetos a confirmación definitiva tras el diagnóstico de la situación operativa, administrativa y financiera actual del condominio.'
      ];
    const condiciones = [
          `Pago dentro de los primeros ${d.diasPago || '5'} días corridos de cada mes, mediante transferencia electrónica.`,
          `Contrato de ${d.mesesContrato || '12'} meses, renovable automáticamente salvo aviso escrito con 60 días corridos de anticipación.`
        ];
  const noIncluidas = [
    'Servicios jurídicos: asesoría legal especializada, elaboración o modificación del reglamento de copropiedad y patrocinio en procedimientos que requieran abogado habilitado.',
    'Cobranza judicial. La cobranza extrajudicial a copropietarios morosos sí está incluida en el servicio.',
    'Ejecución de obras, remodelaciones y reparaciones mayores. CoproActiva coordina y supervisa proveedores, pero no ejecuta obras por cuenta propia.',
    'Peritajes, informes estructurales y certificaciones que requieran profesional habilitado.',
    'Reconstrucción documental cuando la comunidad no disponga de archivos, actas o registros contables históricos.',
    'Regularización de deudas laborales, previsionales o tributarias originadas con anterioridad al inicio del contrato.'
  ];
  const canales = [
    `Incidencias normales y programadas: ${d.email || 'contacto@coproactiva.cl'} · lunes a viernes, 09:00 a 18:00 hrs.`,
    'Urgencias: WhatsApp 24/7. El plazo corre desde el acuse de recibo.',
    'Modalidad de atención mixta (presencial/telemática) con un mínimo de 8 horas de disponibilidad mensuales.'
  ];
  return (
    <doc-page margin="0.72in" style={{ fontFamily: 'var(--font-body)' }}>
      <div slot="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9aa1a8', borderTop: '1px solid #e9e6e2', paddingTop: 9 }}>
        <span>CoproActiva Administración SpA</span>
        <span>{comunidad ? comunidad + ' · ' : ''}Propuesta comercial · Confidencial</span>
      </div>

      {opts.portada ? (
        <div style={{ breakAfter: 'page' }}>
          <img src="./logo-coproactiva.svg" alt="CoproActiva" style={{ display: 'block', height: 31, width: 'auto' }} />
          <div style={{ height: 1.5, background: '#2b3138', marginTop: 28 }}></div>
          <div style={{ marginTop: 26, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.36em', textTransform: 'uppercase', color: '#d5863b' }}>Propuesta comercial</div>
          <h1 style={{ margin: '16px 0 0', fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 43, lineHeight: 1.12, letterSpacing: '-.02em', color: '#2b3138' }}>Administración integral de condominios y comunidades</h1>
          <p style={{ margin: '22px 0 0', fontSize: 16.5, lineHeight: 1.6, color: '#5a636c', maxWidth: '32em' }}>Gestión profesional estructurada sobre la Ley N°21.442.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 56 }}>
            <tbody>
              <tr style={s.plain}>
                <td style={{ ...s.metaLabel, width: '34%' }}>Comunidad</td>
                <td style={s.metaValStrong}><Ph value={comunidad} hint="[NOMBRE DEL EDIFICIO O CONDOMINIO]" /></td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>Ubicación</td>
                <td style={s.metaVal}>
                  <Ph value={d.direccion} hint="[DIRECCIÓN]" />, <Ph value={d.comuna} hint="[COMUNA]" />, Región Metropolitana
                </td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>Preparada para</td>
                <td style={s.metaVal}>{d.destinatario || 'Comité de Administración'}</td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>Fecha</td>
                <td style={s.metaVal}>Santiago, <Ph value={calc.fechaTexto} hint="[FECHA]" /></td>
              </tr>
              <tr style={s.plain}>
                <td style={s.metaLabel}>Vigencia de la oferta</td>
                <td style={s.metaVal}>{d.vigencia || '30'} días corridos desde la fecha de emisión</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 44, display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14, color: '#6b7480' }}>
            <span style={{ color: '#d5863b', fontWeight: 700 }}>·</span>
            <span>CoproActiva Administración SpA · {d.email || 'contacto@coproactiva.cl'}</span>
          </div>
        </div>
      ) : null}

      <section style={{ breakInside: 'auto' }}>
        <SecHead n="01" title="Presentación" showNum={opts.numeros} />
        <p style={s.p}>Estimados miembros del {d.destinatario || 'Comité de Administración'}:</p>
        <p style={s.p}>Agradecemos la oportunidad de presentar esta propuesta para la administración de {comunidad ? comunidad : <span style={s.ph}>{nombreEnTexto}</span>}. CoproActiva Administración SpA es una empresa de administración profesional de condominios, cuyo trabajo se estructura íntegramente sobre la Ley N°21.442 sobre Copropiedad Inmobiliaria y su Reglamento, aprobado por el Decreto Supremo N°7 del Ministerio de Vivienda y Urbanismo.</p>
        <p style={s.p}>Nuestro compromiso es simple: una comunidad administrada con orden legal, información financiera verificable y respuesta oportuna. No entendemos la administración como un servicio de trámites, sino como la gestión responsable de un patrimonio común y de las obligaciones que la ley impone a quien lo administra.</p>
        <p style={{ ...s.p, margin: 0 }}>Esta propuesta describe el alcance del servicio, los entregables comprometidos, los tiempos de respuesta y las condiciones económicas. Quedamos a disposición del Comité para presentarla en reunión y resolver cualquier consulta.</p>
        <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #e9e6e2', breakInside: 'avoid' }}>
          <div style={{ fontFamily: 'var(--font-script)', fontSize: 39, lineHeight: 1, color: '#2b3138' }}>{d.firmante || 'Osmar André Meza Aguilar'}</div>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: '#6b7480' }}>{d.cargo || 'Contador Auditor · Administrador Inscrito · Representante Legal'}</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6b7480' }}>CoproActiva Administración SpA</div>
        </div>
      </section>

      <section style={s.sec}>
        <SecHead n="02" title="Nuestro enfoque" showNum={opts.numeros} />
        <table style={s.table}>
          <tbody>
            {ENFOQUE.map(([k, v]) => (
              <tr key={k} style={s.plain}>
                <td style={s.approachLabel}>{k}</td>
                <td style={s.approachText}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={s.sec}>
        <SecHead n="03" title="Servicio: administración integral" showNum={opts.numeros} />
        <p style={{ ...s.p, margin: '0 0 20px' }}>Modalidad aplicable a comunidades con historial y operación en marcha. CoproActiva asume la totalidad de las funciones que la Ley N°21.442 y su Reglamento asignan al administrador, organizadas en cuatro áreas de gestión:</p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: '31%' }}>Área de gestión</th>
              <th style={s.th}>Comprende</th>
            </tr>
          </thead>
          <tbody>
            {AREAS.map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdLabel}>{k}</td>
                <td style={s.td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={s.sec}>
        <SecHead n="04" title="Plan de trabajo" showNum={opts.numeros} />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: '22%' }}>Plazo</th>
              <th style={s.th}>Hito</th>
            </tr>
          </thead>
          <tbody>
            {PLAN.map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdLabel}>{k}</td>
                <td style={s.td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={s.note}>Los plazos se cuentan desde la firma del contrato y se ajustan en función de los antecedentes efectivamente recibidos de la administración saliente.</p>
      </section>

      <section style={s.sec}>
        <SecHead n="05" title="Entregables comprometidos" showNum={opts.numeros} />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Entregable</th>
              <th style={{ ...s.th, width: '31%' }}>Periodicidad</th>
            </tr>
          </thead>
          <tbody>
            {ENTREGABLES.map(([k, v], i) => (
              <tr key={k} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdDeliv}>{k}</td>
                <td style={s.tdPeriod}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={s.sec}>
        <SecHead n="06" title="Atención y tiempos de respuesta" showNum={opts.numeros} />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.thSm, width: '17%' }}>Categoría</th>
              <th style={s.thSm}>Definición</th>
              <th style={{ ...s.thSm, width: '15%' }}>Acuse</th>
              <th style={{ ...s.thSm, width: '20%' }}>Plan de acción</th>
            </tr>
          </thead>
          <tbody>
            {SLA.map(([cat, def, ac, pa], i) => (
              <tr key={cat} style={i % 2 === 0 ? s.zebra : s.plain}>
                <td style={s.tdCat}>{cat}</td>
                <td style={s.tdSm}>{def}</td>
                <td style={s.tdSmInk}>{ac}</td>
                <td style={s.tdSmInk}>{pa}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ ...s.h3, marginTop: 26 }}>Canales oficiales</h3>
        <Bullets items={canales} />
        <p style={{ ...s.note, marginTop: 18 }}>Los tiempos comprometidos miden la respuesta y gestión de CoproActiva, no el plazo de resolución definitiva cuando ésta depende de proveedores externos o de la aprobación del Comité.</p>
      </section>

      {opts.honorarios ? (
        <section style={s.sec}>
          <SecHead n="07" title="Honorarios y condiciones económicas" showNum={opts.numeros} />
          <table style={{ ...s.table, breakInside: 'avoid' }}>
            <tbody>
              <tr>
                <td style={s.feeLabel}>Base de referencia mensual de gastos comunes ordinarios</td>
                <td style={{ ...s.feeVal, width: '30%' }}><Ph value={calc.base} hint="$[VALOR]" /></td>
              </tr>
              <tr>
                <td style={s.feeLabel}>Porcentaje de honorario aplicado</td>
                <td style={s.feeVal}><Ph value={calc.pct} hint="[8% - 10%]" /></td>
              </tr>
              <tr>
                <td style={s.feeLabel}>Honorario mensual neto</td>
                <td style={s.feeVal}><Ph value={calc.neto} hint="$[VALOR]" /></td>
              </tr>
              <tr>
                <td style={s.feeLabel}>IVA (19%)</td>
                <td style={s.feeVal}><Ph value={calc.iva} hint="$[VALOR]" /></td>
              </tr>
              <tr>
                <td style={s.totLabel}>Total mensual</td>
                <td style={s.totVal}><Ph value={calc.total} hint="$[VALOR]" /></td>
              </tr>
            </tbody>
          </table>
          <h3 style={s.h3}>Reglas de aplicación</h3>
          <Bullets items={reglas} />
          <h3 style={s.h3}>Condiciones</h3>
          <Bullets items={condiciones} />
        </section>
      ) : null}

      <section style={s.sec}>
        <SecHead n={opts.honorarios ? '08' : '07'} title="Prestaciones no incluidas" showNum={opts.numeros} />
        <p style={{ ...s.p, margin: '0 0 18px' }}>Las siguientes materias requieren presupuestación y acuerdo escrito por separado:</p>
        <Bullets items={noIncluidas} />
      </section>
    </doc-page>
  );
}

export default PropuestaDoc;
