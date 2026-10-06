import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARCA = {
  tinta: [43, 49, 56],
  naranja: [197, 124, 52],
  papel: [247, 244, 240],
  gris: [102, 113, 124],
  borde: [227, 222, 215]
};

function nombreArchivo(texto) {
  return String(texto || 'plantilla')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function siNo(v) {
  return v ? 'Sí' : 'No';
}

export function descargarGuiaPlantilla(plantilla, items = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const fecha = new Date().toLocaleDateString('es-CL');
  const ordenados = [...items]
    .filter(x => x.activo !== false)
    .sort((a, b) =>
      Number(a.orden_grupo || 0) - Number(b.orden_grupo || 0)
      || String(a.grupo || '').localeCompare(String(b.grupo || ''), 'es')
      || Number(a.orden || 0) - Number(b.orden || 0)
    );

  doc.setFillColor(...MARCA.tinta);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COPROACTIVA · GUÍA DE LEVANTAMIENTO', 14, 13.5);

  doc.setTextColor(...MARCA.tinta);
  doc.setFontSize(18);
  doc.text(plantilla.nombre || 'Plantilla', 14, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MARCA.gris);
  const descripcion = plantilla.descripcion || 'Guía de respaldo de los puntos que deben revisarse.';
  const desc = doc.splitTextToSize(descripcion, 178);
  doc.text(desc, 14, 41);

  let y = 41 + desc.length * 4.2 + 5;
  doc.setDrawColor(...MARCA.borde);
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFontSize(8.5);
  doc.text(`Puntos: ${ordenados.length}   ·   Generado: ${fecha}   ·   Uso: guía / respaldo`, 14, y);
  y += 7;

  const grupos = new Map();
  for (const item of ordenados) {
    const grupo = item.grupo || 'Sin categoría';
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(item);
  }

  let numero = 1;
  for (const [grupo, filas] of grupos.entries()) {
    if (y > 255) {
      doc.addPage();
      y = 18;
    }

    doc.setFillColor(...MARCA.papel);
    doc.rect(14, y - 4, 182, 8, 'F');
    doc.setTextColor(...MARCA.tinta);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(grupo.toUpperCase(), 16, y + 1);
    y += 7;

    const body = filas.map(item => [
      String(numero++),
      item.texto || '',
      item.ayuda || '—',
      [
        item.obligatorio ? 'Obligatorio' : 'Opcional',
        item.requiere_foto ? 'Foto' : null,
        item.es_critico ? 'Crítico' : null
      ].filter(Boolean).join(' · ')
    ]);

    autoTable(doc, {
      startY: y,
      head: [['N°', 'Punto a revisar', 'Guía', 'Condición']],
      body,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.2,
        textColor: MARCA.tinta,
        lineColor: MARCA.borde,
        lineWidth: 0.15,
        valign: 'top'
      },
      headStyles: {
        fillColor: MARCA.tinta,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 76 },
        3: { cellWidth: 36 }
      },
      didDrawPage: data => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MARCA.gris);
        doc.text(
          `${plantilla.nombre || 'Plantilla'} · Página ${doc.getNumberOfPages()}`,
          14,
          291
        );
      }
    });

    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  if (!ordenados.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MARCA.gris);
    doc.text('Esta plantilla todavía no tiene puntos activos.', 14, y + 5);
  }

  doc.save(`CoproActiva_${nombreArchivo(plantilla.nombre)}_${new Date().toISOString().slice(0,10)}.pdf`);
}
