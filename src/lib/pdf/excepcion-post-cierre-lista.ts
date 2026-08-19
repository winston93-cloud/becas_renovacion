/**
 * PDF interno: familias con excepción post-cierre, por nivel y grado.
 */
import PDFDocument from 'pdfkit';
import { docToBuffer } from './layout';
import { LETTER, PDF_COLORS } from './palette';
import {
  agruparPorNivelGrado,
  docTiposLista,
  nivelSeccionTitulo,
  type ExcepcionFamilia,
} from '@/lib/excepcion-post-cierre-data';

const PAGE = {
  width: LETTER.height,
  height: LETTER.width,
  margin: 36,
  footerBand: 32,
};

function drawPageChrome(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  pageNum: number
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

  const y = height - footerBand;
  const saved = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.rect(0, y, width, footerBand).fill(PDF_COLORS.primary);
  doc
    .fillColor(PDF_COLORS.white)
    .fontSize(8)
    .font('Helvetica')
    .text('Portal de Becas · Excepción post-cierre · Uso interno', margin, y + 11, {
      width: width - margin * 2 - 80,
    });
  doc.text(`Pág. ${pageNum}`, margin, y + 11, {
    width: width - margin * 2,
    align: 'right',
  });
  doc.page.margins.bottom = saved;
  doc.fillColor(PDF_COLORS.text);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, redraw: () => void) {
  const bottom = PAGE.height - PAGE.footerBand - 12;
  if (doc.y + needed > bottom) {
    doc.addPage({ size: [PAGE.width, PAGE.height], margins: doc.page.margins });
    redraw();
  }
}

export async function buildExcepcionPostCierreListaPdf(opts: {
  ciclo_label: string;
  familias: ExcepcionFamilia[];
  generado?: Date;
}): Promise<Buffer> {
  const grupos = agruparPorNivelGrado(opts.familias);
  const generado = (opts.generado || new Date()).toLocaleString('es-MX');
  const title = 'Familias con acceso post-cierre (documentos incorrectos)';
  const subtitle = `Ciclo ${opts.ciclo_label} · Total: ${opts.familias.length} familias · Generado: ${generado}`;

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
  const redraw = () => {
    pageNum += 1;
    drawPageChrome(doc, title, subtitle, pageNum);
    doc.y = 84;
  };

  drawPageChrome(doc, title, subtitle, pageNum);

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(PDF_COLORS.textSecondary)
    .text(
      'Criterio: renovación enviada, expediente no verificado, al menos un documento con revisión incorrecta. ' +
        'Estas familias pueden entrar al portal solo para re-subir esos archivos.',
      PAGE.margin,
      doc.y,
      { width: PAGE.width - PAGE.margin * 2 }
    );
  doc.moveDown(0.8);

  let lastNivel = -1;
  for (const g of grupos) {
    if (g.nivel !== lastNivel) {
      ensureSpace(doc, 40, redraw);
      doc
        .fillColor(PDF_COLORS.primary)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(nivelSeccionTitulo(g.nivel), PAGE.margin, doc.y);
      doc.moveDown(0.4);
      lastNivel = g.nivel;
    }

    ensureSpace(doc, 60, redraw);
    doc
      .fillColor(PDF_COLORS.text)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`${g.grado_label} (${g.familias.length})`, PAGE.margin, doc.y);
    doc.moveDown(0.3);

    const col = {
      ref: PAGE.margin,
      nombre: PAGE.margin + 52,
      docs: PAGE.margin + 220,
      wRef: 48,
      wNombre: 160,
      wDocs: PAGE.width - PAGE.margin * 2 - 52 - 160,
    };

    doc.fontSize(7).font('Helvetica-Bold').fillColor(PDF_COLORS.textSecondary);
    doc.text('Control', col.ref, doc.y, { width: col.wRef });
    doc.text('Alumno', col.nombre, doc.y - doc.currentLineHeight(), {
      width: col.wNombre,
    });
    doc.text('Documento(s) incorrecto(s)', col.docs, doc.y - doc.currentLineHeight(), {
      width: col.wDocs,
    });
    doc.moveDown(0.5);

    for (const f of g.familias) {
      ensureSpace(doc, 28, redraw);
      const rowY = doc.y;
      doc.fontSize(8).font('Helvetica').fillColor(PDF_COLORS.text);
      doc.text(f.alumno_ref, col.ref, rowY, { width: col.wRef });
      doc.text(f.nombre, col.nombre, rowY, { width: col.wNombre });
      doc.text(docTiposLista(f.docs_incorrectos), col.docs, rowY, {
        width: col.wDocs,
      });
      doc.y = rowY + 22;
    }

    doc.moveDown(0.6);
  }

  doc.end();
  return bufferPromise;
}
