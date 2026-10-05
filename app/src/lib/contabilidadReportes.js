import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';

const MARCA = {
  naranja: 'D5863B',
  tinta: '2B3138',
  pizarra: '4A5A68',
  papel: 'F7F4F0',
  niebla: 'E9E6E2',
  blanco: 'FFFFFF',
  verde: '4E6B4A',
  rojo: '93392B'
};

export function moneda(valor) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Number(valor || 0));
}

export function numero(valor) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0
  }).format(Number(valor || 0));
}

export function textoPeriodo(desde, hasta) {
  if (!desde && !hasta) return 'Todos los movimientos';
  const fecha = v => {
    if (!v) return null;
    const d = new Date(v + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  if (desde && hasta) return fecha(desde) + ' al ' + fecha(hasta);
  if (desde) return 'Desde ' + fecha(desde);
  return 'Hasta ' + fecha(hasta);
}

function suma(lista, campo = 'monto') {
  return (lista ?? []).reduce((acc, x) => acc + Number(x?.[campo] || 0), 0);
}

export function armarEstadoResultados(detalle = []) {
  const por = clave => detalle
    .filter(x => x.seccion === clave)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  const ingresos = por('ingresos_operacionales');
  const costos = por('costos_prestacion');
  const administracion = por('gastos_administracion');
  const noOperacional = por('resultado_no_operacional');
  const impuesto = por('impuesto_renta');

  const totalIngresos = suma(ingresos);
  const totalCostos = suma(costos);
  const resultadoBruto = totalIngresos - totalCostos;
  const totalAdministracion = suma(administracion);
  const resultadoOperacional = resultadoBruto - totalAdministracion;
  const totalNoOperacional = suma(noOperacional);
  const antesImpuesto = resultadoOperacional + totalNoOperacional;
  const totalImpuesto = suma(impuesto);
  const utilidad = antesImpuesto - totalImpuesto;

  const filas = [
    { tipo: 'titulo', etiqueta: 'INGRESOS OPERACIONALES' },
    ...ingresos.map(x => ({ tipo: 'cuenta', etiqueta: x.cuenta, monto: Number(x.monto || 0), codigo: x.codigo })),
    { tipo: 'total', etiqueta: 'Total Ingresos Operacionales', monto: totalIngresos },

    { tipo: 'titulo', etiqueta: '(-) COSTOS DE PRESTACIÓN DE SERVICIOS' },
    ...costos.map(x => ({ tipo: 'cuenta', etiqueta: x.cuenta, monto: Number(x.monto || 0), codigo: x.codigo })),
    { tipo: 'total', etiqueta: 'Total Costos de Prestación', monto: totalCostos },
    { tipo: 'resultado', etiqueta: '(=) RESULTADO BRUTO', monto: resultadoBruto },

    { tipo: 'titulo', etiqueta: '(-) GASTOS DE ADMINISTRACIÓN Y VENTAS' },
    ...administracion.map(x => ({ tipo: 'cuenta', etiqueta: x.cuenta, monto: Number(x.monto || 0), codigo: x.codigo })),
    { tipo: 'total', etiqueta: 'Total Gastos Administración y Ventas', monto: totalAdministracion },
    { tipo: 'resultado', etiqueta: '(=) RESULTADO OPERACIONAL', monto: resultadoOperacional },

    { tipo: 'titulo', etiqueta: '(+/-) RESULTADO NO OPERACIONAL' },
    ...noOperacional.map(x => ({ tipo: 'cuenta', etiqueta: x.cuenta, monto: Number(x.monto || 0), codigo: x.codigo })),
    { tipo: 'total', etiqueta: 'Total Resultado No Operacional', monto: totalNoOperacional },
    { tipo: 'resultado', etiqueta: '(=) RESULTADO ANTES DE IMPUESTO', monto: antesImpuesto },

    { tipo: 'titulo', etiqueta: '(-) IMPUESTO A LA RENTA' },
    ...impuesto.map(x => ({ tipo: 'cuenta', etiqueta: x.cuenta, monto: Number(x.monto || 0), codigo: x.codigo })),
    { tipo: 'resultado-final', etiqueta: '(=) UTILIDAD DEL EJERCICIO', monto: utilidad }
  ];

  return {
    filas,
    totalIngresos,
    totalCostos,
    resultadoBruto,
    totalAdministracion,
    resultadoOperacional,
    totalNoOperacional,
    antesImpuesto,
    totalImpuesto,
    utilidad
  };
}

export function totalesBalance(balance = []) {
  return {
    debe: suma(balance, 'debe'),
    haber: suma(balance, 'haber'),
    deudor: suma(balance, 'deudor'),
    acreedor: suma(balance, 'acreedor'),
    activo: suma(balance, 'activo'),
    pasivo: suma(balance, 'pasivo'),
    perdida: suma(balance, 'perdida'),
    ganancia: suma(balance, 'ganancia')
  };
}

function nombreArchivo(entidad, extension) {
  const base = String(entidad?.nombre || 'contabilidad')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return (base || 'contabilidad') + '-informe-contable.' + extension;
}

function cabeceraPdf(doc, entidad, periodo) {
  doc.setFillColor('#' + MARCA.tinta);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor('#' + MARCA.blanco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COPROACTIVA', 14, 11.5);

  doc.setTextColor('#' + MARCA.tinta);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Informe contable', 14, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor('#' + MARCA.pizarra);
  doc.text(entidad?.nombre || 'Entidad', 14, 39);
  doc.text(periodo, 14, 45);
}

function piePdf(doc) {
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor('#' + MARCA.niebla);
    doc.line(14, 286, 196, 286);
    doc.setFontSize(8);
    doc.setTextColor('#' + MARCA.pizarra);
    doc.text('CoproActiva · Informe generado desde el módulo Contabilidad', 14, 291);
    doc.text(String(p) + ' / ' + String(paginas), 196, 291, { align: 'right' });
  }
}

export function descargarPDF({
  entidad,
  desde,
  hasta,
  balance = [],
  eerrDetalle = [],
  diario = [],
  sinClasificar = []
}) {
  const periodo = textoPeriodo(desde, hasta);
  const eerr = armarEstadoResultados(eerrDetalle);
  const tb = totalesBalance(balance);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  cabeceraPdf(doc, entidad, periodo);

  doc.setFillColor('#' + MARCA.papel);
  doc.roundedRect(14, 54, 182, 48, 2, 2, 'F');

  const kpis = [
    ['Resultado del ejercicio', moneda(eerr.utilidad)],
    ['Activo', moneda(tb.activo)],
    ['Pasivo + Patrimonio', moneda(tb.pasivo)],
    ['Movimientos', numero(diario.length)]
  ];
  kpis.forEach((k, i) => {
    const x = 19 + (i % 2) * 88;
    const y = 63 + Math.floor(i / 2) * 21;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#' + MARCA.pizarra);
    doc.text(k[0].toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#' + (i === 0 && eerr.utilidad < 0 ? MARCA.rojo : MARCA.tinta));
    doc.text(k[1], x, y + 7);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#' + MARCA.tinta);
  doc.text('Estado de Resultados', 14, 116);

  autoTable(doc, {
    startY: 121,
    head: [['Concepto', 'Monto']],
    body: eerr.filas.map(f => [f.etiqueta, f.monto === undefined ? '' : moneda(f.monto)]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.1, textColor: '#' + MARCA.tinta },
    headStyles: { fillColor: '#' + MARCA.tinta, textColor: '#' + MARCA.blanco, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 42 } },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const f = eerr.filas[data.row.index];
      if (!f) return;
      if (f.tipo === 'titulo') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = '#' + MARCA.papel;
      }
      if (f.tipo === 'total' || f.tipo === 'resultado' || f.tipo === 'resultado-final') {
        data.cell.styles.fontStyle = 'bold';
        if (f.tipo === 'resultado-final') data.cell.styles.fillColor = '#' + MARCA.niebla;
      }
    }
  });

  if (sinClasificar.length) {
    let y = doc.lastAutoTable.finalY + 7;
    if (y > 260) {
      doc.addPage();
      y = 22;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#' + MARCA.rojo);
    doc.text('Cuentas con movimiento no clasificadas en el EERR del archivo base:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#' + MARCA.pizarra);
    doc.text(sinClasificar.map(x => x.codigo + ' ' + x.cuenta).join(' · '), 14, y + 5, { maxWidth: 180 });
  }

  doc.addPage('a4', 'landscape');
  doc.setFillColor('#' + MARCA.tinta);
  doc.rect(0, 0, 297, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#' + MARCA.blanco);
  doc.setFontSize(10);
  doc.text('COPROACTIVA', 14, 10.5);
  doc.setTextColor('#' + MARCA.tinta);
  doc.setFontSize(14);
  doc.text('Balance de comprobación y saldos', 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [['Código','Cuenta','Debe','Haber','Deudor','Acreedor','Activo','Pasivo','Pérdida','Ganancia']],
    body: balance.map(x => [
      x.codigo, x.cuenta, moneda(x.debe), moneda(x.haber), moneda(x.deudor), moneda(x.acreedor),
      moneda(x.activo), moneda(x.pasivo), moneda(x.perdida), moneda(x.ganancia)
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 1.4, textColor: '#' + MARCA.tinta },
    headStyles: { fillColor: '#' + MARCA.tinta, textColor: '#' + MARCA.blanco, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 55 },
      2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
      5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
      8: { halign: 'right' }, 9: { halign: 'right' }
    }
  });

  if (diario.length) {
    doc.addPage('a4', 'landscape');
    doc.setFillColor('#' + MARCA.tinta);
    doc.rect(0, 0, 297, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#' + MARCA.blanco);
    doc.setFontSize(10);
    doc.text('COPROACTIVA', 14, 10.5);
    doc.setTextColor('#' + MARCA.tinta);
    doc.setFontSize(14);
    doc.text('Libro Diario', 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [['Asiento','Fecha','Código','Cuenta','Debe','Haber','Glosa']],
      body: diario.map(x => [
        x.numero,
        x.fecha,
        x.codigo,
        x.cuenta,
        Number(x.debe || 0) ? moneda(x.debe) : '',
        Number(x.haber || 0) ? moneda(x.haber) : '',
        x.glosa_linea || x.glosa || ''
      ]),
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.5, textColor: '#' + MARCA.tinta },
      headStyles: { fillColor: '#' + MARCA.tinta, textColor: '#' + MARCA.blanco, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 22 },
        2: { cellWidth: 18 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 118 }
      }
    });
  }

  piePdf(doc);
  doc.save(nombreArchivo(entidad, 'pdf'));
}

function addPptFooter(slide, entidad, periodo, numeroSlide) {
  slide.addShape('line', { x: 0.55, y: 7.08, w: 12.22, h: 0, line: { color: MARCA.niebla, width: 1 } });
  slide.addText('CoproActiva', { x: 0.55, y: 7.12, w: 1.6, h: 0.2, fontFace: 'Arial', fontSize: 7, color: MARCA.pizarra });
  slide.addText((entidad?.nombre || 'Entidad') + ' · ' + periodo, {
    x: 2.15, y: 7.12, w: 8.6, h: 0.2, fontFace: 'Arial', fontSize: 7, color: MARCA.pizarra, align: 'center'
  });
  slide.addText(String(numeroSlide), { x: 11.9, y: 7.12, w: 0.8, h: 0.2, fontFace: 'Arial', fontSize: 7, color: MARCA.pizarra, align: 'right' });
}

function addPptTitle(slide, titulo, subtitulo = '') {
  slide.addText(titulo, {
    x: 0.6, y: 0.5, w: 8.7, h: 0.45,
    fontFace: 'Arial', fontSize: 22, bold: true, color: MARCA.tinta, margin: 0
  });
  if (subtitulo) slide.addText(subtitulo, {
    x: 0.6, y: 0.98, w: 11.9, h: 0.32,
    fontFace: 'Arial', fontSize: 10, color: MARCA.pizarra, margin: 0
  });
  slide.addShape('line', { x: 0.6, y: 1.38, w: 1.05, h: 0, line: { color: MARCA.naranja, width: 4 } });
}

export async function descargarPPT({
  entidad,
  desde,
  hasta,
  balance = [],
  eerrDetalle = [],
  diario = [],
  sinClasificar = []
}) {
  const periodo = textoPeriodo(desde, hasta);
  const eerr = armarEstadoResultados(eerrDetalle);
  const tb = totalesBalance(balance);

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'CoproActiva';
  pptx.subject = 'Informe contable';
  pptx.title = 'Informe contable · ' + (entidad?.nombre || '');
  pptx.company = 'CoproActiva';
  pptx.lang = 'es-CL';
  pptx.theme = {
    headFontFace: 'Arial',
    bodyFontFace: 'Arial',
    lang: 'es-CL'
  };

  let slide = pptx.addSlide();
  slide.background = { color: MARCA.papel };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 1.05, fill: { color: MARCA.tinta }, line: { color: MARCA.tinta } });
  slide.addText('COPROACTIVA', { x: 0.7, y: 0.35, w: 2.5, h: 0.35, fontFace: 'Arial', fontSize: 14, bold: true, color: MARCA.blanco, margin: 0 });
  slide.addText('Informe contable', { x: 0.75, y: 2.05, w: 8.8, h: 0.65, fontFace: 'Arial', fontSize: 32, bold: true, color: MARCA.tinta, margin: 0 });
  slide.addText(entidad?.nombre || 'Entidad', { x: 0.75, y: 2.85, w: 9.5, h: 0.45, fontFace: 'Arial', fontSize: 18, color: MARCA.pizarra, margin: 0 });
  slide.addText(periodo, { x: 0.75, y: 3.38, w: 7.0, h: 0.35, fontFace: 'Arial', fontSize: 12, color: MARCA.pizarra, margin: 0 });
  slide.addShape('line', { x: 0.75, y: 4.05, w: 1.2, h: 0, line: { color: MARCA.naranja, width: 5 } });
  slide.addText('Generado automáticamente desde Contabilidad', { x: 0.75, y: 5.85, w: 7.5, h: 0.35, fontFace: 'Arial', fontSize: 10, color: MARCA.pizarra, margin: 0 });

  slide = pptx.addSlide();
  slide.background = { color: MARCA.blanco };
  addPptTitle(slide, 'Resumen ejecutivo', periodo);
  const kpis = [
    ['Resultado del ejercicio', moneda(eerr.utilidad), eerr.utilidad < 0 ? MARCA.rojo : MARCA.verde],
    ['Activo', moneda(tb.activo), MARCA.tinta],
    ['Pasivo + Patrimonio', moneda(tb.pasivo), MARCA.tinta],
    ['Movimientos contables', numero(diario.length), MARCA.tinta]
  ];
  kpis.forEach((k, i) => {
    const x = 0.65 + (i % 2) * 6.15;
    const y = 1.72 + Math.floor(i / 2) * 2.05;
    slide.addShape('roundRect', { x, y, w: 5.65, h: 1.55, rectRadius: 0.06, fill: { color: MARCA.papel }, line: { color: MARCA.niebla, width: 1 } });
    slide.addText(k[0].toUpperCase(), { x: x + 0.3, y: y + 0.28, w: 4.95, h: 0.25, fontFace: 'Arial', fontSize: 9, bold: true, color: MARCA.pizarra, margin: 0 });
    slide.addText(k[1], { x: x + 0.3, y: y + 0.68, w: 4.95, h: 0.48, fontFace: 'Arial', fontSize: 22, bold: true, color: k[2], margin: 0 });
  });
  addPptFooter(slide, entidad, periodo, 2);

  slide = pptx.addSlide();
  slide.background = { color: MARCA.blanco };
  addPptTitle(slide, 'Estado de Resultados', periodo);
  const eRows = [
    ['Ingresos operacionales', moneda(eerr.totalIngresos)],
    ['Costos de prestación', moneda(eerr.totalCostos)],
    ['Resultado bruto', moneda(eerr.resultadoBruto)],
    ['Gastos administración y ventas', moneda(eerr.totalAdministracion)],
    ['Resultado operacional', moneda(eerr.resultadoOperacional)],
    ['Resultado no operacional', moneda(eerr.totalNoOperacional)],
    ['Impuesto a la renta', moneda(eerr.totalImpuesto)],
    ['Utilidad del ejercicio', moneda(eerr.utilidad)]
  ];
  slide.addTable(eRows, {
    x: 0.7, y: 1.65, w: 7.2, h: 4.7,
    border: { type: 'solid', color: MARCA.niebla, pt: 1 },
    fill: MARCA.blanco,
    color: MARCA.tinta,
    fontFace: 'Arial',
    fontSize: 11,
    margin: 0.08,
    rowH: 0.47,
    colW: [4.9, 2.3],
    bold: false,
    autoFit: false
  });
  slide.addShape('roundRect', {
    x: 8.35, y: 1.65, w: 4.25, h: 2.15,
    rectRadius: 0.06,
    fill: { color: eerr.utilidad < 0 ? 'FBEEEB' : 'EEF1E9' },
    line: { color: eerr.utilidad < 0 ? 'EDD2CB' : 'D8E0CF', width: 1 }
  });
  slide.addText('UTILIDAD DEL EJERCICIO', { x: 8.7, y: 2.05, w: 3.55, h: 0.28, fontFace: 'Arial', fontSize: 10, bold: true, color: MARCA.pizarra, margin: 0 });
  slide.addText(moneda(eerr.utilidad), { x: 8.7, y: 2.55, w: 3.55, h: 0.55, fontFace: 'Arial', fontSize: 25, bold: true, color: eerr.utilidad < 0 ? MARCA.rojo : MARCA.verde, margin: 0 });
  if (sinClasificar.length) {
    slide.addText('Atención: existen cuentas con movimiento sin clasificación en el EERR base.', {
      x: 8.35, y: 4.25, w: 4.2, h: 0.65, fontFace: 'Arial', fontSize: 10, bold: true, color: MARCA.rojo, margin: 0
    });
    slide.addText(sinClasificar.map(x => x.codigo + ' ' + x.cuenta).join('\n'), {
      x: 8.35, y: 4.95, w: 4.2, h: 1.25, fontFace: 'Arial', fontSize: 9, color: MARCA.pizarra, margin: 0
    });
  }
  addPptFooter(slide, entidad, periodo, 3);

  slide = pptx.addSlide();
  slide.background = { color: MARCA.blanco };
  addPptTitle(slide, 'Posición financiera', 'Balance de comprobación y saldos');
  const bRows = [
    ['Suma Debe', moneda(tb.debe)],
    ['Suma Haber', moneda(tb.haber)],
    ['Saldo deudor', moneda(tb.deudor)],
    ['Saldo acreedor', moneda(tb.acreedor)],
    ['Activo', moneda(tb.activo)],
    ['Pasivo + Patrimonio', moneda(tb.pasivo)],
    ['Pérdida', moneda(tb.perdida)],
    ['Ganancia', moneda(tb.ganancia)]
  ];
  slide.addTable(bRows, {
    x: 0.7, y: 1.65, w: 5.25, h: 4.7,
    border: { type: 'solid', color: MARCA.niebla, pt: 1 },
    fill: MARCA.blanco,
    color: MARCA.tinta,
    fontFace: 'Arial',
    fontSize: 11,
    margin: 0.08,
    rowH: 0.47,
    colW: [3.2, 2.05]
  });
  const top = [...balance]
    .map(x => ({ ...x, movimiento: Number(x.debe || 0) + Number(x.haber || 0) }))
    .filter(x => x.movimiento > 0)
    .sort((a, b) => b.movimiento - a.movimiento)
    .slice(0, 8)
    .map(x => [x.codigo + ' ' + x.cuenta, moneda(x.movimiento)]);
  slide.addText('Cuentas con mayor movimiento', { x: 6.45, y: 1.65, w: 5.8, h: 0.35, fontFace: 'Arial', fontSize: 13, bold: true, color: MARCA.tinta, margin: 0 });
  slide.addTable(top.length ? top : [['Sin movimientos', '']], {
    x: 6.45, y: 2.12, w: 6.1, h: 4.15,
    border: { type: 'solid', color: MARCA.niebla, pt: 1 },
    fill: MARCA.blanco,
    color: MARCA.tinta,
    fontFace: 'Arial',
    fontSize: 10,
    margin: 0.07,
    rowH: 0.43,
    colW: [4.45, 1.65]
  });
  addPptFooter(slide, entidad, periodo, 4);

  slide = pptx.addSlide();
  slide.background = { color: MARCA.blanco };
  addPptTitle(slide, 'Actividad contable', 'Últimos movimientos del período');
  const recientes = [...diario]
    .slice(-12)
    .reverse()
    .map(x => [
      '#' + x.numero,
      String(x.fecha || ''),
      x.cuenta,
      Number(x.debe || 0) ? moneda(x.debe) : moneda(x.haber),
      (x.glosa_linea || x.glosa || '').slice(0, 80)
    ]);
  slide.addTable(recientes.length ? recientes : [['','','Sin movimientos','','']], {
    x: 0.55, y: 1.6, w: 12.2, h: 5.25,
    border: { type: 'solid', color: MARCA.niebla, pt: 1 },
    fill: MARCA.blanco,
    color: MARCA.tinta,
    fontFace: 'Arial',
    fontSize: 8.5,
    margin: 0.05,
    rowH: 0.4,
    colW: [0.7, 1.2, 2.55, 1.45, 6.3]
  });
  addPptFooter(slide, entidad, periodo, 5);

  await pptx.writeFile({ fileName: nombreArchivo(entidad, 'pptx') });
}
