/**
 * 2026-07-16 - PDF carta comprobante de registro con QR del No. Control.
 * Una sola hoja; cintilla footer institucional (layout.drawFooter).
 */
import QRCode from 'qrcode';
import {
  createLetterDoc,
  docToBuffer,
  drawFooter,
  drawHeader,
} from './layout';
import { LETTER, PDF_COLORS } from './palette';
import type { PdfComprobanteData } from './types';

export async function buildComprobantePdf(
  data: PdfComprobanteData
): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(String(data.alumnoRef), {
    type: 'png',
    width: 160,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: PDF_COLORS.primary,
      light: PDF_COLORS.white,
    },
  });

  const doc = createLetterDoc();
  const bufferPromise = docToBuffer(doc);

  drawHeader(doc, 'Comprobante de renovación de beca');

  // 2026-07-16 - Card compacta para caber arriba de la cintilla (1 hoja)
  const cardX = LETTER.margin;
  const cardW = LETTER.width - LETTER.margin * 2;
  const cardY = 100;
  const cardH = 500;

  doc
    .roundedRect(cardX, cardY, cardW, cardH, 10)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.border)
    .stroke();

  doc
    .fillColor(PDF_COLORS.primaryLight)
    .roundedRect(cardX + 1, cardY + 1, cardW - 2, 48, 9)
    .fill();

  doc
    .fillColor(PDF_COLORS.primary)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('REGISTRO RECIBIDO', cardX, cardY + 12, {
      width: cardW,
      align: 'center',
    });

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(9)
    .font('Helvetica')
    .text('Acuse para el alumno / padre de familia', cardX, cardY + 28, {
      width: cardW,
      align: 'center',
    });

  let y = cardY + 68;

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text('ALUMNO', cardX + 36, y, { width: cardW - 72, align: 'center' });

  doc
    .fillColor(PDF_COLORS.text)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(data.alumnoNombre, cardX + 36, y + 12, {
      width: cardW - 72,
      align: 'center',
    });

  y += 48;

  doc
    .strokeColor(PDF_COLORS.border)
    .lineWidth(0.5)
    .moveTo(cardX + 48, y)
    .lineTo(cardX + cardW - 48, y)
    .stroke();

  y += 20;

  drawMeta(doc, 'Grado', data.grado, cardX + 48, y, (cardW - 96) / 2 - 8);
  drawMeta(
    doc,
    'Grupo',
    data.grupo,
    cardX + 48 + (cardW - 96) / 2 + 8,
    y,
    (cardW - 96) / 2 - 8
  );

  y += 40;
  drawMeta(doc, 'Ciclo escolar', data.cicloLabel, cardX + 48, y, cardW - 96);
  y += 40;
  drawMeta(
    doc,
    'Fecha de registro',
    data.fechaRegistro,
    cardX + 48,
    y,
    cardW - 96
  );

  y += 48;

  const qrSize = 120;
  const qrX = cardX + (cardW - qrSize) / 2;
  doc.image(qrPng, qrX, y, { width: qrSize, height: qrSize });

  y += qrSize + 10;

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text('No. de Control', cardX, y, { width: cardW, align: 'center' });

  doc
    .fillColor(PDF_COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(String(data.alumnoRef), cardX, y + 12, {
      width: cardW,
      align: 'center',
    });

  y += 40;

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Conserve este comprobante. En las próximas semanas se notificará la resolución correspondiente.',
      cardX + 40,
      y,
      { width: cardW - 80, align: 'center', lineGap: 2 }
    );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
}

function drawMeta(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
) {
  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text(label.toUpperCase(), x, y, { width: w, align: 'center' });
  doc
    .fillColor(PDF_COLORS.text)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(value || '—', x, y + 12, { width: w, align: 'center' });
}
