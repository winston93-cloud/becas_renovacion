/**
 * 2026-07-16 - PDF carta con el formulario de beca (renovación o solicitud nueva).
 * 2026-07-17 - Título de encabezado por trámite.
 * ensureSpace + cintilla footer sin páginas en blanco intermedias.
 */
import {
  createLetterDoc,
  docToBuffer,
  drawFieldRow,
  drawFooter,
  drawHeader,
  drawSectionTitle,
  ensureSpace,
} from './layout';
import { LETTER, PDF_COLORS } from './palette';
import type { PdfSolicitudData } from './types';

export type BuildSolicitudPdfOptions = {
  /** Encabezado: «Renovación de Beca» | «Solicitud de Beca» */
  title?: string;
};

export async function buildSolicitudPdf(
  data: PdfSolicitudData,
  opts?: BuildSolicitudPdfOptions
): Promise<Buffer> {
  const doc = createLetterDoc();
  const bufferPromise = docToBuffer(doc);

  let pageNum = 1;
  const pageLabel = () => String(pageNum);

  // 2026-07-17 - Encabezado alineado al portal
  drawHeader(doc, opts?.title || 'Renovación de Beca');

  doc
    .fillColor(PDF_COLORS.textSecondary)
    .fontSize(9)
    .font('Helvetica')
    .text(
      `Ciclo escolar ${data.cicloLabel}  ·  Generado el ${data.fechaGeneracion}`,
      { align: 'left' }
    );

  doc.moveDown(0.8);

  // Datos de beca
  drawSectionTitle(doc, 'Datos de beca');
  const rowY = doc.y;
  drawFieldRow(doc, 'Alumno', data.alumnoNombre, {
    half: true,
    x: LETTER.margin,
  });
  doc.y = rowY;
  drawFieldRow(doc, 'No. de Control', data.alumnoRef, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = rowY + 28;

  const rowY2 = doc.y;
  drawFieldRow(doc, 'Tipo de beca', data.becaClase, {
    half: true,
    x: LETTER.margin,
  });
  doc.y = rowY2;
  drawFieldRow(doc, 'Porcentaje', `${data.becaPorcentaje}%`, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = rowY2 + 28;

  const rowY3 = doc.y;
  drawFieldRow(
    doc,
    'Nivel / Grado / Grupo',
    `${data.nivelLabel} · ${data.grado} / ${data.grupo}`,
    {
      half: true,
      x: LETTER.margin,
    }
  );
  doc.y = rowY3;
  drawFieldRow(doc, 'Promedio requerido', data.promedioRequerido, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = rowY3 + 28;

  // Domicilio — umbral realista (~5 filas)
  if (ensureSpace(doc, 130, pageLabel())) pageNum += 1;
  drawSectionTitle(doc, 'Domicilio del alumno');
  drawFieldRow(doc, 'Calle', data.domicilio.calle);
  const dY = doc.y;
  drawFieldRow(doc, 'Número', data.domicilio.numero, {
    half: true,
    x: LETTER.margin,
  });
  doc.y = dY;
  drawFieldRow(doc, 'C.P.', data.domicilio.cp, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = dY + 28;
  drawFieldRow(doc, 'Colonia', data.domicilio.colonia);
  const dY2 = doc.y;
  drawFieldRow(doc, 'Municipio', data.domicilio.municipio, {
    half: true,
    x: LETTER.margin,
  });
  doc.y = dY2;
  drawFieldRow(doc, 'Estado', data.domicilio.estado, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = dY2 + 28;

  // Padre
  if (ensureSpace(doc, 150, pageLabel())) pageNum += 1;
  drawSectionTitle(doc, 'Datos del padre');
  drawFamiliar(doc, data.papa);

  // Madre
  if (ensureSpace(doc, 150, pageLabel())) pageNum += 1;
  drawSectionTitle(doc, 'Datos de la madre');
  drawFamiliar(doc, data.mama);

  // Adicional
  if (ensureSpace(doc, 120, pageLabel())) pageNum += 1;
  drawSectionTitle(doc, 'Información adicional');
  const aY = doc.y;
  drawFieldRow(doc, '¿Otra beca?', data.otraBeca, {
    half: true,
    x: LETTER.margin,
  });
  doc.y = aY;
  drawFieldRow(doc, '% otra beca', data.otraBecaPct, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = aY + 28;
  drawFieldRow(doc, 'Tipo de vivienda', data.casaTipo);
  drawFieldRow(doc, 'Motivo de la solicitud', data.motivo);
  drawFieldRow(doc, 'Observaciones', data.observaciones || '—');

  // Hermanos
  if (data.hermanos.length > 0) {
    if (ensureSpace(doc, 70, pageLabel())) pageNum += 1;
    drawSectionTitle(doc, 'Hermanos');
    for (const h of data.hermanos) {
      if (ensureSpace(doc, 70, pageLabel())) pageNum += 1;
      doc
        .fillColor(PDF_COLORS.primary)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Hermano ${h.orden}`, LETTER.margin, doc.y);
      doc.moveDown(0.3);
      const hY = doc.y;
      drawFieldRow(doc, 'Nombre', h.nombre, { half: true, x: LETTER.margin });
      doc.y = hY;
      drawFieldRow(doc, 'Edad', h.edad, {
        half: true,
        x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
      });
      doc.y = hY + 28;
      const hY2 = doc.y;
      drawFieldRow(doc, 'Institución', h.institucion, {
        half: true,
        x: LETTER.margin,
      });
      doc.y = hY2;
      drawFieldRow(doc, 'Colegiatura mensual', h.colegiatura, {
        half: true,
        x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
      });
      doc.y = hY2 + 28;
    }
  }

  drawFooter(doc, pageLabel());
  doc.end();
  return bufferPromise;
}

function drawFamiliar(
  doc: PDFKit.PDFDocument,
  f: PdfSolicitudData['papa']
) {
  drawFieldRow(doc, 'Nombre', f.nombre);
  const y = doc.y;
  drawFieldRow(doc, '¿Vive?', f.vive, { half: true, x: LETTER.margin });
  doc.y = y;
  drawFieldRow(doc, 'Ingreso mensual', f.ingresoMensual, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = y + 28;
  const y2 = doc.y;
  drawFieldRow(doc, 'Empresa', f.empresa, { half: true, x: LETTER.margin });
  doc.y = y2;
  drawFieldRow(doc, 'Puesto', f.puesto, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = y2 + 28;
  const y3 = doc.y;
  drawFieldRow(doc, 'Teléfono', f.tel, { half: true, x: LETTER.margin });
  doc.y = y3;
  drawFieldRow(doc, 'Celular', f.cel, {
    half: true,
    x: LETTER.margin + (LETTER.width - LETTER.margin * 2) / 2 + 6,
  });
  doc.y = y3 + 28;
  drawFieldRow(doc, 'Email', f.email);
}
