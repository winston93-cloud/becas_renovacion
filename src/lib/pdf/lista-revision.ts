/**
 * PDF landscape institucional para seguimiento de verificaciones admin.
 */
import PDFDocument from 'pdfkit';
import { docToBuffer } from './layout';
import { LETTER, PDF_COLORS } from './palette';
import {
  estadoRevisionTexto,
  formatFechaExport,
  formatGradoGrupoExport,
  lineaContextoEscolarExport,
  resumenExport,
  type AdminExportPayload,
} from '@/lib/admin-export-lista';

const PAGE = {
  width: LETTER.height, // landscape
  height: LETTER.width,
  margin: 36,
  footerBand: 32,
};

function drawPageChrome(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  pageNum: number,
  pageCountHint: string
) {
  const { width, height, margin, footerBand } = PAGE;
  doc.rect(0, 0, width, 56).fill(PDF_COLORS.primary);
  doc
    .fillColor(PDF_COLORS.white)
    .fontSize(8)
    .font('Helvetica')
    .text('INSTITUTO WINSTON CHURCHILL · CONTROL ESCOLAR · BECAS', margin, 12, {
      width: width - margin * 2,
      characterSpacing: 0.8,
    });
  doc
    .fontSize(13)
    .font('Helvetica-Bold')
    .text(title, margin, 28, { width: width - margin * 2 });

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text(subtitle, margin, 64, { width: width - margin * 2 });

  // Footer band
  const y = height - footerBand;
  const saved = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.rect(0, y, width, footerBand).fill(PDF_COLORS.primary);
  doc
    .fillColor(PDF_COLORS.white)
    .fontSize(8)
    .font('Helvetica')
    .text('Portal de Becas · Uso interno Control Escolar', margin, y + 11, {
      width: width - margin * 2 - 80,
    });
  doc.text(`Pág. ${pageNum}${pageCountHint}`, margin, y + 11, {
    width: width - margin * 2,
    align: 'right',
  });
  doc.page.margins.bottom = saved;
  doc.fillColor(PDF_COLORS.text);
}

export async function buildListaRevisionPdf(
  payload: AdminExportPayload
): Promise<Buffer> {
  const rows = payload.rows;
  const sum = resumenExport(rows);
  const title =
    payload.flujo === 'renovacion'
      ? 'Listado de renovaciones'
      : 'Listado de solicitudes nuevas';
  const generado = new Date().toLocaleString('es-MX');
  const contexto = lineaContextoEscolarExport(rows);
  const subtitle = `${payload.titulo} · Filtro: ${payload.filtro_label} · ${contexto} · Generado: ${generado}`;

  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margins: {
      top: 84,
      bottom: PAGE.footerBand + 8,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    info: {
      Title: title,
      Author: 'Instituto Winston Churchill',
      Creator: 'Portal de Becas',
    },
  });
  const bufferPromise = docToBuffer(doc);

  let pageNum = 1;
  drawPageChrome(doc, title, subtitle, pageNum, '');

  // Summary chips
  let x = PAGE.margin;
  const chipY = 78;
  const chips: Array<[string, number, string]> = [
    ['Total', sum.total, PDF_COLORS.primary],
    ['Pendientes', sum.pendientes, '#A84A2A'],
    ['Verificadas', sum.verificadas, '#1C3258'],
    ['Autorizadas', sum.autorizadas, '#1F6B4A'],
    ['Activadas', sum.activadas, '#047857'],
  ];
  for (const [label, value, color] of chips) {
    doc.roundedRect(x, chipY, 102, 34, 6).fill(PDF_COLORS.primaryLight);
    doc
      .fillColor(PDF_COLORS.textSecondary)
      .fontSize(7)
      .font('Helvetica')
      .text(label.toUpperCase(), x + 8, chipY + 6, { width: 94 });
    doc
      .fillColor(color)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(String(value), x + 8, chipY + 16, { width: 94 });
    x += 110;
  }

  const cols = [
    { key: 'n', label: '#', w: 24 },
    { key: 'ref', label: 'No. control', w: 56 },
    { key: 'nombre', label: 'Alumno', w: 132 },
    { key: 'grado', label: 'Grado', w: 50 },
    { key: 'estado', label: 'Estado', w: 62 },
    { key: 'ver', label: 'Verif.', w: 34 },
    { key: 'aut', label: 'Autoriz.', w: 38 },
    { key: 'env', label: 'Enviado', w: 68 },
    { key: 'act', label: 'Activ.', w: 32 },
    { key: 'firm', label: 'Firmado por', w: 96 },
    { key: 'fact', label: 'Fecha activ.', w: 68 },
  ] as const;
  const tableW = cols.reduce((a, c) => a + c.w, 0);
  const tableX = PAGE.margin;
  let y = 124;
  const rowH = 18;

  const drawHeaderRow = () => {
    doc.rect(tableX, y, tableW, 20).fill(PDF_COLORS.primary);
    let cx = tableX;
    for (const c of cols) {
      doc
        .fillColor(PDF_COLORS.white)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(c.label.toUpperCase(), cx + 3, y + 6, {
          width: c.w - 6,
          align: c.key === 'nombre' ? 'left' : 'center',
        });
      cx += c.w;
    }
    y += 20;
  };

  drawHeaderRow();

  const ensureSpace = () => {
    if (y + rowH > PAGE.height - PAGE.footerBand - 12) {
      doc.addPage();
      pageNum += 1;
      drawPageChrome(doc, title, subtitle, pageNum, '');
      y = 84;
      drawHeaderRow();
    }
  };

  rows.forEach((r, i) => {
    ensureSpace();
    const zebra = i % 2 === 0;
    if (zebra) {
      doc.rect(tableX, y, tableW, rowH).fill('#F7F9FC');
    }
    const estado = estadoRevisionTexto(r);
    const values = [
      String(i + 1),
      r.alumno_ref,
      r.nombre,
      formatGradoGrupoExport(r),
      estado,
      r.verificado ? 'Sí' : 'No',
      r.beca_autorizada ? 'Sí' : 'No',
      formatFechaExport(r.enviado_en),
      r.beca_activada ? 'Sí' : 'No',
      r.firmado_por?.trim() || '—',
      formatFechaExport(r.beca_activada_en ?? null),
    ];
    let cx = tableX;
    values.forEach((val, idx) => {
      const c = cols[idx];
      const isEstado = c.key === 'estado';
      let fill: string = PDF_COLORS.text;
      if (isEstado) {
        if (estado === 'Rechazada') fill = '#BE123C';
        else if (estado === 'Firmada y activada') fill = '#047857';
        else if (estado === 'Autorizada') fill = '#1F6B4A';
        else if (estado === 'Verificada') fill = '#1C3258';
        else if (estado === 'Pendiente') fill = '#A84A2A';
      }
      if ((c.key === 'ver' && r.verificado) || (c.key === 'aut' && r.beca_autorizada)) {
        fill = '#1F6B4A';
      }
      if (c.key === 'act' && r.beca_activada) {
        fill = '#047857';
      }
      if (c.key === 'firm' && r.firmado_por?.trim()) {
        fill = '#047857';
      }
      doc
        .fillColor(fill)
        .fontSize(7)
        .font(
          isEstado ||
          c.key === 'ver' ||
          c.key === 'aut' ||
          c.key === 'act' ||
          c.key === 'firm'
            ? 'Helvetica-Bold'
            : 'Helvetica'
        )
        .text(val, cx + 3, y + 5, {
          width: c.w - 6,
          align: c.key === 'nombre' || c.key === 'firm' ? 'left' : 'center',
          lineBreak: false,
          ellipsis: true,
        });
      cx += c.w;
    });
    doc
      .strokeColor(PDF_COLORS.border)
      .lineWidth(0.5)
      .moveTo(tableX, y + rowH)
      .lineTo(tableX + tableW, y + rowH)
      .stroke();
    y += rowH;
  });

  if (rows.length === 0) {
    doc
      .fillColor(PDF_COLORS.textSecondary)
      .fontSize(10)
      .font('Helvetica')
      .text('No hay registros para exportar con el filtro actual.', tableX, y + 12);
  }

  doc.end();
  return bufferPromise;
}
