/* Informe de diagnóstico comercial: dos páginas A4, misma marca y el mismo
 * patrón de impresión que informeHtml/imprimirInforme (lib/informe.js) —
 * comparte la paleta y la tipografía de la app, no la del CRM anterior.
 */

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const SEMAFORO = pct => {
  if (pct == null) return { fondo: 'var(--niebla)', borde: 'var(--pizarra)', texto: 'var(--pizarra)', etiqueta: 'No aplica' };
  if (pct >= 70) return { fondo: 'var(--ok-fondo)', borde: 'var(--ok-borde)', texto: 'var(--ok-texto)', etiqueta: 'Bien' };
  if (pct >= 40) return { fondo: 'var(--alerta-fondo)', borde: 'var(--alerta-borde)', texto: 'var(--alerta-texto)', etiqueta: 'En riesgo' };
  return { fondo: 'var(--critico-fondo)', borde: 'var(--critico-borde)', texto: 'var(--critico-texto)', etiqueta: 'Crítico' };
};

const LINEAS = {
  L1: { label: 'Administración integral', desc: 'La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes.',
        items: ['Recepción y auditoría documental completa', 'Gestión financiera con rendiciones mensuales al comité', 'Coordinación de proveedores y mantención preventiva', 'Plataforma digital para cobro y comunicación', 'Informes de gestión mensuales con indicadores clave'],
        valMin: '600.000', valMax: '900.000' },
  L2: { label: 'Nueva administración', desc: 'La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión.',
        items: ['Levantamiento del estado administrativo y financiero actual', 'Regularización legal, laboral y documental prioritaria', 'Implementación de plataforma de gestión y control de morosidad', 'Coordinación de equipamiento crítico y mantención preventiva', 'Informes periódicos al comité con plan de avance'],
        valMin: '800.000', valMax: '1.100.000' },
  L3: { label: 'Asesoría externa', desc: 'Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente.',
        items: ['Auditoría documental con informe de hallazgos', 'Asesoría legal y normativa sobre Ley 21.442', 'Orientación para regularización laboral y previsional', 'Plan de acción priorizado por nivel de riesgo', 'Acompañamiento al comité en la toma de decisiones'],
        valMin: '300.000', valMax: '500.000' }
};

const ESTILOS = `
  @page { size: A4; margin: 0; }
  :root {
    --naranja: #d5863b; --pizarra: #4a5a68; --tinta: #2b3138; --papel: #f7f4f0; --niebla: #e9e6e2;
    --ok-texto: #4e6b4a; --ok-fondo: #eef1e9; --ok-borde: #d8e0cf;
    --alerta-texto: #8a5f22; --alerta-fondo: #fdf3e6; --alerta-borde: #f0dcbd;
    --critico-texto: #93392b; --critico-fondo: #fbeeeb; --critico-borde: #edd2cb;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 9pt/1.5 'Source Sans Pro', -apple-system, system-ui, sans-serif; color: var(--tinta); background: #fff; }
  h1, h2, h3 { font-family: 'Montserrat', -apple-system, system-ui, sans-serif; margin: 0; }
  .hoja { width: 210mm; min-height: 297mm; position: relative; padding: 0 0 16mm; page-break-after: always; }
  .hoja:last-child { page-break-after: auto; }

  .cab { background: var(--tinta); padding: 10mm 16mm 6mm; position: relative; }
  .cab img { height: 22px; margin-bottom: 5mm; filter: brightness(0) invert(1); }
  .cab .pag { position: absolute; top: 10mm; right: 16mm; font-size: 7pt; color: #aab3ba; }
  .cab h1 { font-size: 17pt; font-weight: 700; color: #fff; margin-bottom: 1.5mm; }
  .cab .sub { font-size: 8pt; color: #c9ceD2; margin-bottom: 5mm; }
  .cab .ficha { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .cab .ficha dt { font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; color: #9ba3aa; margin-bottom: 1mm; }
  .cab .ficha dd { margin: 0; font-size: 8.5pt; font-weight: 700; color: #fff; }
  .cab .barra { position: absolute; bottom: 0; left: 0; right: 0; height: 1mm; background: var(--naranja); }

  .cuerpo { padding: 6mm 16mm 0; }
  .seccion-titulo {
    font-size: 7.5pt; font-weight: 700; color: var(--naranja); text-transform: uppercase;
    letter-spacing: .1em; border-bottom: 0.5mm solid var(--naranja); padding-bottom: 1.5mm; margin: 6mm 0 3.5mm;
  }
  .seccion-titulo:first-child { margin-top: 0; }

  .resultado { display: flex; align-items: center; gap: 5mm; padding: 4mm 5mm; border-radius: 2mm; border: 0.5mm solid; }
  .resultado .aro { width: 16mm; height: 16mm; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .resultado .aro .n { font-size: 14pt; font-weight: 700; line-height: 1; }
  .resultado .aro .s { font-size: 6pt; color: var(--pizarra); }
  .resultado .txt .nivel { font-family: 'Montserrat', sans-serif; font-size: 11pt; font-weight: 700; margin-bottom: 1.5mm; }
  .resultado .txt p { margin: 0; font-size: 8pt; line-height: 1.5; opacity: .9; }

  .area-fila { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.5mm; }
  .area-fila .nombre { width: 26mm; font-size: 8pt; color: var(--pizarra); }
  .area-fila .barra-fondo { flex: 1; height: 4.5mm; background: var(--niebla); border-radius: 1mm; position: relative; overflow: hidden; }
  .area-fila .barra-rellena { height: 100%; border-radius: 1mm; }
  .area-fila .pct { position: absolute; top: 50%; transform: translateY(-50%); font-size: 7pt; font-weight: 700; }
  .area-fila .estado { width: 16mm; height: 4.5mm; border-radius: 1mm; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 700; }

  .obs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; }
  .obs-tarjeta { border: 0.3mm solid var(--niebla); border-radius: 2mm; padding: 2.5mm 3mm; background: #fff; border-left: 1.5mm solid; }
  .obs-tarjeta .cab2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5mm; }
  .obs-tarjeta .nombre { font-size: 8pt; font-weight: 700; color: var(--tinta); }
  .obs-tarjeta .pct { font-size: 7pt; font-weight: 700; }
  .obs-tarjeta .texto { font-size: 7.5pt; color: var(--pizarra); line-height: 1.5; }
  .obs-tarjeta .texto em { color: #9ba3aa; }

  .hallazgo { display: flex; align-items: flex-start; gap: 3mm; padding: 2mm 3mm; background: var(--critico-fondo); border-radius: 1.5mm; border-left: 1.5mm solid var(--critico-texto); margin-bottom: 1.5mm; }
  .hallazgo .x { font-size: 9pt; font-weight: 700; color: var(--critico-texto); line-height: 1; }
  .hallazgo .t { font-size: 7.5pt; color: var(--tinta); line-height: 1.4; }
  .hallazgo-area { font-size: 7.5pt; font-weight: 700; color: var(--pizarra); border-bottom: 0.3mm solid var(--pizarra); display: inline-block; margin-bottom: 2mm; }

  .propuesta { background: var(--ok-fondo); border: 0.7mm solid var(--ok-borde); border-radius: 2mm; overflow: hidden; margin-bottom: 3mm; }
  .propuesta .banda { background: #1d5c38; padding: 3mm 5mm; }
  .propuesta .banda span { font-size: 9.5pt; font-weight: 700; color: #fff; }
  .propuesta .contenido { padding: 4mm 5mm; }
  .propuesta .desc { font-size: 8pt; color: var(--pizarra); line-height: 1.5; margin-bottom: 3mm; }
  .propuesta .item { display: flex; align-items: flex-start; gap: 3mm; margin-bottom: 2.5mm; }
  .propuesta .item .ok { width: 5mm; height: 5mm; background: #6fa885; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: 700; color: #fff; flex-shrink: 0; margin-top: .5mm; }
  .propuesta .item .txt { font-size: 8.5pt; color: var(--tinta); line-height: 1.4; }
  .propuesta .valor { background: #fff; border: 0.5mm solid var(--ok-borde); border-radius: 2mm; padding: 3mm 4mm; display: flex; align-items: center; justify-content: space-between; margin-top: 3mm; }
  .propuesta .valor .et { font-size: 7.5pt; color: var(--pizarra); margin-bottom: 1mm; }
  .propuesta .valor .sub { font-size: 6.5pt; color: #9ba3aa; }
  .propuesta .valor .monto { text-align: right; font-size: 13pt; font-weight: 700; color: #1d5c38; }
  .propuesta .valor .cur { font-size: 6.5pt; color: #9ba3aa; }

  .proximo { background: var(--tinta); border-radius: 2mm; padding: 4mm 5mm 4mm 8mm; position: relative; overflow: hidden; }
  .proximo::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2.5mm; background: var(--naranja); }
  .proximo .t { font-size: 8.5pt; font-weight: 700; color: var(--naranja); margin-bottom: 2mm; }
  .proximo .d { font-size: 7.5pt; color: #ccd2d6; line-height: 1.6; }

  .pie { margin-top: 8mm; padding: 0 16mm; font-size: 7.5pt; color: var(--pizarra); }

  @media screen { body { background: #eceae7; padding: 20px 0; } .hoja { margin: 0 auto 20px; box-shadow: 0 0 0 1px var(--niebla); } }
`;

function cabecera(pagina, total, prospecto, logo) {
  const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<div class="cab">
    ${logo ? `<img src="${escapar(logo)}" alt="CoproActiva">` : ''}
    <div class="pag">Pág. ${pagina} / ${total}</div>
    <h1>Informe de diagnóstico inicial</h1>
    <p class="sub">Diagnóstico preliminar de riesgo y propuesta de administración</p>
    <dl class="ficha">
      <div><dt>Condominio</dt><dd>${escapar(prospecto.nombre_condominio || '—')}</dd></div>
      <div><dt>Fecha</dt><dd>${fecha}</dd></div>
      <div><dt>Comuna</dt><dd>${escapar(prospecto.comuna || '—')}${prospecto.unidades ? ` · ${prospecto.unidades} unid.` : ''}</dd></div>
      <div><dt>Elaborado por</dt><dd>CoproActiva</dd></div>
    </dl>
    <div class="barra"></div>
  </div>`;
}

function pie(fecha) {
  return `<p class="pie">coproactiva · Comunidades que funcionan. — Documento confidencial — ${fecha}</p>`;
}

/**
 * @param {object} datos
 * @param {object} datos.prospecto        nombre_condominio, direccion, comuna, unidades
 * @param {object} datos.diagnostico      globalScore, nivel, hallazgosCriticos, areasBajo60 (con {area,score})
 * @param {Array}  datos.areas            [{ id, label, pct|null }] en el orden a mostrar
 * @param {object} datos.notasAreas       { [areaId]: texto }
 * @param {string} datos.lineaElegida     'L1' | 'L2' | 'L3'
 * @param {string} [datos.logo]
 */
export function diagnosticoHtml(datos) {
  const { prospecto, diagnostico, areas, notasAreas, lineaElegida, logo } = datos;
  const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const lm = LINEAS[lineaElegida] ?? LINEAS.L2;
  const resSem = SEMAFORO(diagnostico.nivel === 'Crítico' ? 10 : diagnostico.nivel === 'En riesgo' ? 45 : diagnostico.globalScore >= 80 && diagnostico.hallazgosCriticos.length ? 45 : diagnostico.globalScore);
  const areasOrdenadas = [...areas].filter(a => a.pct != null).sort((a, b) => a.pct - b.pct);

  const byArea = {};
  for (const h of diagnostico.hallazgosCriticos) {
    (byArea[h.area] ??= []).push(h.texto);
  }

  const p1 = `<div class="hoja">
    ${cabecera(1, 2, prospecto, logo)}
    <div class="cuerpo">
      <div class="seccion-titulo">Resultado del diagnóstico</div>
      <div class="resultado" style="background:${resSem.fondo};border-color:${resSem.borde}">
        <div class="aro"><div class="n" style="color:${resSem.texto}">${diagnostico.globalScore}</div><div class="s">%</div></div>
        <div class="txt">
          <div class="nivel" style="color:${resSem.texto}">${escapar(diagnostico.nivel)}</div>
          <p style="color:${resSem.texto}">${nivelDescripcion(diagnostico)}</p>
        </div>
      </div>

      <div class="seccion-titulo">Comparativo por área — de menor a mayor cumplimiento</div>
      ${areasOrdenadas.map(a => {
        const sem = SEMAFORO(a.pct);
        return `<div class="area-fila">
          <div class="nombre">${escapar(a.label)}</div>
          <div class="barra-fondo">
            <div class="barra-rellena" style="width:${a.pct}%;background:${sem.borde}"></div>
            <span class="pct" style="${a.pct > 20 ? `right:4mm;color:#fff` : `left:${a.pct}%;margin-left:2mm;color:${sem.texto}`}">${a.pct}%</span>
          </div>
          <div class="estado" style="background:${sem.fondo};color:${sem.texto}">${sem.etiqueta}</div>
        </div>`;
      }).join('')}

      <div class="seccion-titulo">Observaciones por área</div>
      <div class="obs-grid">
        ${areas.map(a => {
          const sem = SEMAFORO(a.pct);
          const texto = notasAreas?.[a.id];
          return `<div class="obs-tarjeta" style="border-left-color:${sem.borde}">
            <div class="cab2">
              <span class="nombre">${escapar(a.label)}</span>
              ${a.pct != null ? `<span class="pct" style="color:${sem.texto}">${a.pct}% · ${sem.etiqueta}</span>` : ''}
            </div>
            <div class="texto">${texto ? escapar(texto) : '<em>Sin observaciones registradas.</em>'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${pie(fecha)}
  </div>`;

  const p2 = `<div class="hoja">
    ${cabecera(2, 2, prospecto, logo)}
    <div class="cuerpo">
      ${diagnostico.hallazgosCriticos.length ? `
        <div class="seccion-titulo">Ítems críticos faltantes · ${diagnostico.hallazgosCriticos.length} sin resolver</div>
        ${Object.entries(byArea).map(([areaLabel, textos]) => `
          <div class="hallazgo-area">${escapar(areaLabel)}</div>
          ${textos.map(t => `<div class="hallazgo"><div class="x">×</div><div class="t">${escapar(t)}</div></div>`).join('')}
        `).join('')}
      ` : ''}

      <div class="seccion-titulo">Propuesta de servicio</div>
      <div class="propuesta">
        <div class="banda"><span>${escapar(lm.label)}</span></div>
        <div class="contenido">
          <div class="desc">${escapar(lm.desc)}</div>
          ${lm.items.map(it => `<div class="item"><div class="ok">OK</div><div class="txt">${escapar(it)}</div></div>`).join('')}
          <div class="valor">
            <div><div class="et">Valor mensual estimado del servicio</div><div class="sub">Sujeto a confirmación en reunión presencial</div></div>
            <div><div class="monto">$${lm.valMin} – $${lm.valMax}</div><div class="cur" style="text-align:right">CLP / mes</div></div>
          </div>
        </div>
      </div>

      <div class="seccion-titulo">Próximo paso</div>
      <div class="proximo">
        <div class="t">Próximo paso</div>
        <div class="d">CoproActiva los invita a una reunión de presentación con el comité, donde se revisará este diagnóstico en detalle y se confirmará el valor definitivo del servicio. Para coordinar fecha y hora, contáctenos a través de nuestros canales habituales.</div>
      </div>
    </div>
    ${pie(fecha)}
  </div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Diagnóstico — ${escapar(prospecto.nombre_condominio || '')}</title>
<style>${ESTILOS}</style>
</head>
<body>${p1}${p2}</body>
</html>`;
}

function nivelDescripcion(d) {
  if (d.nivel === 'Estable') return 'La comunidad presenta una gestión ordenada en todas las áreas. CoproActiva puede optimizarla de manera continua.';
  if (d.nivel === 'Estable con observaciones') {
    const motivos = [];
    if (d.areasBajo60?.length) motivos.push('focos de riesgo en: ' + d.areasBajo60.map(a => a.area?.label ?? a.label).join(', '));
    if (d.hasCritFail) motivos.push(`${d.hallazgosCriticos.length} ítem(s) crítico(s) sin resolver`);
    return `El puntaje global es satisfactorio, pero se identifican: ${motivos.join(' y ')}. Estos aspectos requieren atención aunque el resultado global sea positivo.`;
  }
  if (d.nivel === 'En riesgo') return 'Existen aspectos que requieren intervención moderada o incumplimientos en ítems críticos. Sin acción oportuna pueden derivar en problemas administrativos, legales o financieros de mayor envergadura.';
  return 'Se detectan deficiencias graves en una o más áreas. Se requiere intervención urgente para evitar consecuencias legales y financieras significativas.';
}
