/**
 * 2026-07-16 - Helpers compartidos para dibujar PDFs con pdfkit.
 * Footer en cintilla institucional; no dibujar texto bajo el bottom margin
 * (pdfkit abre página nueva y genera hojas en blanco).
 */
import PDFDocument from 'pdfkit';
import { LETTER, PDF_COLORS } from './palette';

export function createLetterDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'LETTER',
    margins: {
      top: LETTER.margin,
      // 2026-07-16 - Reserva espacio para la cintilla; el pie se dibuja ahí
      bottom: LETTER.footerBand,
      left: LETTER.margin,
      right: LETTER.margin,
    },
    info: {
      Author: 'Instituto Winston Churchill',
      // 2026-07-17 - Pie/creator unificado (solicitud + renovación)
      Creator: 'Portal de Becas',
    },
  });
}

export function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  const { width } = LETTER;
  doc.rect(0, 0, width, 72).fill(PDF_COLORS.primary);

  doc
    .fillColor(PDF_COLORS.white)
    .fontSize(9)
    .font('Helvetica')
    .text('INSTITUTO WINSTON CHURCHILL', LETTER.margin, 18, {
      width: width - LETTER.margin * 2,
      align: 'left',
      characterSpacing: 1.2,
    });

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(title, LETTER.margin, 36, {
      width: width - LETTER.margin * 2,
    });

  doc.fillColor(PDF_COLORS.text);
  doc.y = 92;
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, label: string) {
  const y = doc.y + 6;
  doc
    .rect(LETTER.margin, y, LETTER.width - LETTER.margin * 2, 22)
    .fill(PDF_COLORS.primaryLight);

  doc
    .fillColor(PDF_COLORS.primary)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(label, LETTER.margin + 10, y + 6);

  doc.fillColor(PDF_COLORS.text);
  doc.y = y + 28;
}

export function drawFieldRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts?: { half?: boolean; x?: number }
) {
  const contentWidth = LETTER.width - LETTER.margin * 2;
  const colW = opts?.half ? contentWidth / 2 - 6 : contentWidth;
  const x = opts?.x ?? LETTER.margin;
  const startY = doc.y;

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(8)
    .font('Helvetica')
    .text(label.toUpperCase(), x, startY, { width: colW });

  doc
    .fillColor(PDF_COLORS.text)
    .fontSize(10)
    .font('Helvetica')
    .text(value || '—', x, startY + 11, { width: colW });

  if (!opts?.half) {
    doc.y = startY + 28;
  }
}

/**
 * 2026-07-16 - Cintilla full-bleed #0B173A. Baja temporalmente bottom margin
 * a 0 para que el texto no dispare auto-página.
 */
export function drawFooter(doc: PDFKit.PDFDocument, pageLabel?: string) {
  const bandH = LETTER.footerBand;
  const y = LETTER.height - bandH;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.rect(0, y, LETTER.width, bandH).fill(PDF_COLORS.primary);

  const textY = y + (bandH - 10) / 2;
  const labelW = pageLabel ? 48 : 0;

  doc
    .fillColor(PDF_COLORS.white)
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Instituto Winston Churchill · Portal de Becas',
      LETTER.margin,
      textY,
      {
        width: LETTER.width - LETTER.margin * 2 - labelW,
        align: 'left',
        lineBreak: false,
      }
    );

  if (pageLabel) {
    doc.text(pageLabel, LETTER.width - LETTER.margin - labelW, textY, {
      width: labelW,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.page.margins.bottom = savedBottom;
}

/** Límite inferior del área de contenido (arriba de la cintilla). */
export function contentBottom(): number {
  return LETTER.height - LETTER.footerBand;
}

export function ensureSpace(
  doc: PDFKit.PDFDocument,
  needed: number,
  pageLabel?: string
) {
  // 2026-07-16 - Umbral = borde de la cintilla; evita páginas fantasma del footer viejo
  if (doc.y + needed > contentBottom()) {
    drawFooter(doc, pageLabel);
    doc.addPage();
    doc.y = LETTER.margin;
    return true;
  }
  return false;
}
