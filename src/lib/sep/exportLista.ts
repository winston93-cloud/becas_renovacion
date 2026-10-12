/**
 * 2026-10-12 - Excel y PDF de la lista Beca SEP (mismo estilo que «Solicitudes nuevas»).
 * Las filas se arman en el servidor con los trámites del nivel de quien exporta; el navegador solo
 * manda el orden y qué filas están visibles.
 */
import 'server-only';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { docToBuffer } from '@/lib/pdf/layout';
import { LETTER, PDF_COLORS } from '@/lib/pdf/palette';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { esRefPruebaSep } from '@/lib/sep/activo';
import { montoVigente, porcentajeEfectivo, requiereRevisionManual } from '@/lib/sep/servicio';
import type { SolicitudSep } from '@/lib/sep/tipos';

export type FilaExportSep = {
  ref: number;
  nombre: string;
  grado: string;
  estado: string;
  tono: 'pendiente' | 'aviso' | 'ok' | 'correccion' | 'neutro';
  porcentaje: string;
  mensualidad: string;
  enviado: string;
};

export type MetaExportSep = { titulo: string; filtro: string; area: string };

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function filaExportSep(s: SolicitudSep): FilaExportSep {
  const nivel = s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : 'Sin nivel';
  const manual = s.estado === 'enviada' && requiereRevisionManual(s);
  const [estado, tono]: [string, FilaExportSep['tono']] =
    s.estado === 'aplicada'
      ? ['Aplicada', 'ok']
      : s.estado === 'enviada'
        ? manual
          ? ['Revisar a mano', 'aviso']
          : ['Por revisar', 'pendiente']
        : s.estado === 'correccion'
          ? ['Otro documento pedido', 'correccion']
          : ['Sin enviar', 'neutro'];
  const pct = porcentajeEfectivo(s);
  const monto = s.estado === 'aplicada' ? montoVigente(s) : null;
  return {
    ref: s.alumnoRef,
    nombre: `${s.nombreAlumno}${esRefPruebaSep(s.alumnoRef) ? ' (prueba)' : ''}`,
    grado: s.grado ? `${s.grado}° de ${nivel}` : nivel,
    estado,
    tono,
    porcentaje: pct != null ? `${pct} %` : '—',
    mensualidad: monto != null ? pesos(monto) : '—',
    enviado: fecha(s.enviadaEn ?? s.aplicadaEn ?? s.actualizadaEn ?? s.creadaEn),
  };
}

function resumen(filas: FilaExportSep[]) {
  const cuenta = (e: string) => filas.filter((f) => f.estado === e).length;
  return [
    ['Total', filas.length],
    ['Por revisar', cuenta('Por revisar')],
    ['Revisar a mano', cuenta('Revisar a mano')],
    ['Esperando familia', cuenta('Otro documento pedido') + cuenta('Sin enviar')],
    ['Aplicadas', cuenta('Aplicada')],
  ] as const;
}

const ENCABEZADOS = ['#', 'No. control', 'Alumno', 'Grado', 'Estado', 'Beca SEP', 'Mensualidad', 'Enviado'];
const valores = (f: FilaExportSep, i: number) => [String(i + 1), String(f.ref), f.nombre, f.grado, f.estado, f.porcentaje, f.mensualidad, f.enviado];

const TONO_EXCEL: Record<FilaExportSep['tono'], { bg: string; fg: string } | null> = {
  pendiente: { bg: 'FFFFF7ED', fg: 'FFC2410C' },
  aviso: { bg: 'FFFFFBEB', fg: 'FFB45309' },
  ok: { bg: 'FFD1FAE5', fg: 'FF065F46' },
  correccion: { bg: 'FFFEF2F2', fg: 'FFB91C1C' },
  neutro: null,
};
const TONO_PDF: Record<FilaExportSep['tono'], string> = {
  pendiente: '#C2410C',
  aviso: '#B45309',
  ok: '#047857',
  correccion: '#B91C1C',
  neutro: PDF_COLORS.textSecondary,
};

export async function excelListaSep(filas: FilaExportSep[], meta: MetaExportSep): Promise<Buffer> {
  const NAVY = 'FF14233F';
  const borde: Partial<ExcelJS.Borders> = Object.fromEntries(
    (['top', 'left', 'bottom', 'right'] as const).map((k) => [k, { style: 'thin', color: { argb: 'FFE5EAF1' } }])
  );
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Instituto Winston Churchill · Control Escolar';
  const ws = wb.addWorksheet('Beca SEP', { views: [{ state: 'frozen', ySplit: 8 }] });
  ws.columns = [5, 12, 36, 18, 22, 11, 15, 18].map((width) => ({ width }));

  ws.mergeCells('A1:H1');
  const t = ws.getCell('A1');
  t.value = 'Instituto Winston Churchill · Control Escolar · Beca SEP';
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:H2');
  const sub = ws.getCell('A2');
  sub.value = `${meta.titulo} · ${meta.area} · Filtro: ${meta.filtro} · Generado: ${new Date().toLocaleString('es-MX')}`;
  sub.font = { name: 'Calibri', size: 11, color: { argb: 'FF4D5D73' } };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2EFE8' } };

  resumen(filas).forEach(([label, valor], i) => {
    const l = ws.getRow(4).getCell(i + 1);
    l.value = label;
    l.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4D5D73' } };
    const v = ws.getRow(5).getCell(i + 1);
    v.value = valor;
    v.font = { name: 'Calibri', size: 14, bold: true, color: { argb: NAVY } };
    for (const c of [l, v]) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3F9' } };
      c.alignment = { horizontal: 'center' };
      c.border = borde;
    }
  });

  const head = ws.getRow(7);
  ENCABEZADOS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C3258' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borde;
  });
  head.height = 22;

  filas.forEach((f, i) => {
    const row = ws.getRow(8 + i);
    valores(f, i).forEach((v, col) => {
      const c = row.getCell(col + 1);
      c.value = col === 1 ? Number(v) : v;
      c.font = { name: 'Calibri', size: 11, color: { argb: NAVY } };
      c.border = borde;
      c.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle', wrapText: col === 2 };
      const tono = TONO_EXCEL[f.tono];
      if (col === 4 && tono) {
        c.font = { ...c.font, bold: true, color: { argb: tono.fg } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tono.bg } };
      }
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function pdfListaSep(filas: FilaExportSep[], meta: MetaExportSep): Promise<Buffer> {
  const W = LETTER.height;
  const H = LETTER.width;
  const M = 36;
  const PIE = 32;
  const titulo = 'Listado Beca SEP';
  const sub = `${meta.titulo} · ${meta.area} · Filtro: ${meta.filtro} · Generado: ${new Date().toLocaleString('es-MX')}`;
  const doc = new PDFDocument({
    size: [W, H],
    margins: { top: 84, bottom: PIE + 8, left: M, right: M },
    info: { Title: titulo, Author: 'Instituto Winston Churchill', Creator: 'Portal de Becas' },
  });
  const buffer = docToBuffer(doc);
  let pagina = 1;

  const marco = () => {
    doc.rect(0, 0, W, 56).fill(PDF_COLORS.primary);
    doc.fillColor(PDF_COLORS.white).fontSize(8).font('Helvetica').text('INSTITUTO WINSTON CHURCHILL · CONTROL ESCOLAR · BECA SEP', M, 12, { width: W - M * 2, characterSpacing: 0.8 });
    doc.fontSize(13).font('Helvetica-Bold').text(titulo, M, 28, { width: W - M * 2 });
    doc.fillColor(PDF_COLORS.textSecondary).fontSize(8).font('Helvetica').text(sub, M, 64, { width: W - M * 2 });
    const yPie = H - PIE;
    const margen = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.rect(0, yPie, W, PIE).fill(PDF_COLORS.primary);
    doc.fillColor(PDF_COLORS.white).fontSize(8).text('Portal de Becas · Uso interno Control Escolar', M, yPie + 11, { width: W - M * 2 - 80 });
    doc.text(`Pág. ${pagina}`, M, yPie + 11, { width: W - M * 2, align: 'right' });
    doc.page.margins.bottom = margen;
  };
  marco();

  let x = M;
  for (const [label, valor] of resumen(filas)) {
    doc.roundedRect(x, 78, 112, 34, 6).fill(PDF_COLORS.primaryLight);
    doc.fillColor(PDF_COLORS.textSecondary).fontSize(7).font('Helvetica').text(label.toUpperCase(), x + 8, 84, { width: 100 });
    doc.fillColor(PDF_COLORS.primary).fontSize(14).font('Helvetica-Bold').text(String(valor), x + 8, 94, { width: 100 });
    x += 120;
  }

  const anchos = [26, 62, 210, 96, 104, 56, 80, 86];
  const ancho = anchos.reduce((a, b) => a + b, 0);
  const ALTO = 18;
  let y = 124;
  const encabezado = () => {
    doc.rect(M, y, ancho, 20).fill(PDF_COLORS.primary);
    let cx = M;
    ENCABEZADOS.forEach((h, i) => {
      doc.fillColor(PDF_COLORS.white).fontSize(7).font('Helvetica-Bold').text(h.toUpperCase(), cx + 3, y + 6, { width: anchos[i] - 6, align: i === 2 ? 'left' : 'center' });
      cx += anchos[i];
    });
    y += 20;
  };
  encabezado();

  filas.forEach((f, i) => {
    if (y + ALTO > H - PIE - 12) {
      doc.addPage();
      pagina += 1;
      marco();
      y = 84;
      encabezado();
    }
    if (i % 2 === 0) doc.rect(M, y, ancho, ALTO).fill(PDF_COLORS.bg);
    let cx = M;
    valores(f, i).forEach((v, col) => {
      doc
        .fillColor(col === 4 ? TONO_PDF[f.tono] : PDF_COLORS.text)
        .fontSize(7)
        .font(col === 4 || col === 1 ? 'Helvetica-Bold' : 'Helvetica')
        .text(v, cx + 3, y + 5, { width: anchos[col] - 6, align: col === 2 ? 'left' : 'center', lineBreak: false, ellipsis: true });
      cx += anchos[col];
    });
    doc.strokeColor(PDF_COLORS.border).lineWidth(0.5).moveTo(M, y + ALTO).lineTo(M + ancho, y + ALTO).stroke();
    y += ALTO;
  });

  if (!filas.length) {
    doc.fillColor(PDF_COLORS.textSecondary).fontSize(10).font('Helvetica').text('No hay trámites con el filtro actual.', M, y + 12);
  }
  doc.end();
  return buffer;
}
