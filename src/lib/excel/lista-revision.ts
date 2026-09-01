/**
 * Excel (.xlsx) para listados admin — compatible Excel Windows / LibreOffice.
 */
import ExcelJS from 'exceljs';
import {
  estadoRevisionTexto,
  formatFechaExport,
  formatGradoGrupoExport,
  lineaContextoEscolarExport,
  resumenExport,
  type AdminExportPayload,
} from '@/lib/admin-export-lista';

const NAVY = 'FF14233F';
const NAVY_HEADER = 'FF1C3258';
const SLATE = 'FF4D5D73';
const BORDER = 'FFE5EAF1';
const OK_BG = 'FFE6F4EC';
const OK_FG = 'FF1F6B4A';
const WARN_BG = 'FFFFF3E0';
const WARN_FG = 'FFA84A2A';
const INFO_BG = 'FFE8EEF6';
const INFO_FG = 'FF1C3258';
const LAST_COL = 'K';

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: BORDER },
  };
  return {
    top: side,
    left: side,
    bottom: side,
    right: side,
  };
}

export async function buildListaRevisionExcel(
  payload: AdminExportPayload
): Promise<Buffer> {
  const rows = payload.rows;
  const sum = resumenExport(rows);
  const flujoLabel =
    payload.flujo === 'renovacion' ? 'Renovaciones' : 'Solicitudes nuevas';
  const generado = new Date().toLocaleString('es-MX');
  const contexto = lineaContextoEscolarExport(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Instituto Winston Churchill · Control Escolar';
  wb.created = new Date();

  const ws = wb.addWorksheet(flujoLabel.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 9 }],
  });

  ws.columns = [
    { width: 5 },
    { width: 11 },
    { width: 34 },
    { width: 14 },
    { width: 16 },
    { width: 11 },
    { width: 11 },
    { width: 17 },
    { width: 12 },
    { width: 28 },
    { width: 18 },
  ];

  ws.mergeCells(`A1:${LAST_COL}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Instituto Winston Churchill · Control Escolar · Becas';
  titleCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells(`A2:${LAST_COL}2`);
  const subCell = ws.getCell('A2');
  subCell.value = `${payload.titulo} · Filtro: ${payload.filtro_label} · Generado: ${generado}`;
  subCell.font = { name: 'Calibri', size: 11, color: { argb: SLATE } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2EFE8' },
  };
  subCell.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(`A3:${LAST_COL}3`);
  const ctxCell = ws.getCell('A3');
  ctxCell.value = contexto;
  ctxCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
  ctxCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF6' },
  };
  ctxCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  const statLabels = [
    'Total',
    'Pendientes',
    'Verificadas',
    'Autorizadas',
    'Activadas',
    'Borradores',
  ];
  const statValues = [
    sum.total,
    sum.pendientes,
    sum.verificadas,
    sum.autorizadas,
    sum.activadas,
    sum.borradores,
  ];
  const labelRow = ws.getRow(5);
  statLabels.forEach((label, i) => {
    const c = labelRow.getCell(i + 1);
    c.value = label;
    c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: SLATE } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF3F9' },
    };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
  });
  const valueRow = ws.getRow(6);
  statValues.forEach((val, i) => {
    const c = valueRow.getCell(i + 1);
    c.value = val;
    c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: NAVY } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF3F9' },
    };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
  });
  valueRow.height = 24;

  const headerRow = ws.getRow(8);
  const headers = [
    '#',
    'No. control',
    'Alumno',
    'Grado',
    'Estado',
    'Verificado',
    'Autorizado',
    'Enviado',
    'Activada',
    'Firmado por',
    'Fecha activación',
  ];
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NAVY_HEADER },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
  });
  headerRow.height = 22;

  rows.forEach((r, idx) => {
    const rowNum = 9 + idx;
    const estado = estadoRevisionTexto(r);
    const values: (string | number)[] = [
      idx + 1,
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
    const row = ws.getRow(rowNum);
    values.forEach((val, col) => {
      const c = row.getCell(col + 1);
      c.value = val;
      c.font = { name: 'Calibri', size: 11, color: { argb: NAVY } };
      c.border = thinBorder();
      c.alignment = {
        horizontal:
          col === 0 || (col >= 3 && col !== 9) ? 'center' : 'left',
        vertical: 'middle',
        wrapText: col === 2 || col === 9,
      };
      if (col === 4) {
        if (estado === 'Rechazada') {
          c.font = { ...c.font, bold: true, color: { argb: 'FF9F1239' } };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE4E6' },
          };
        } else if (estado === 'Firmada y activada') {
          c.font = { ...c.font, bold: true, color: { argb: 'FF065F46' } };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' },
          };
        } else if (estado === 'Autorizada') {
          c.font = { ...c.font, bold: true, color: { argb: OK_FG } };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: OK_BG },
          };
        } else if (estado === 'Verificada') {
          c.font = { ...c.font, bold: true, color: { argb: INFO_FG } };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: INFO_BG },
          };
        } else if (estado === 'Pendiente') {
          c.font = { ...c.font, bold: true, color: { argb: WARN_FG } };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: WARN_BG },
          };
        }
      }
      if ((col === 5 && r.verificado) || (col === 6 && r.beca_autorizada)) {
        c.font = { ...c.font, bold: true, color: { argb: OK_FG } };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: OK_BG },
        };
      }
      if (col === 8 && r.beca_activada) {
        c.font = { ...c.font, bold: true, color: { argb: 'FF065F46' } };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' },
        };
      }
      if (col === 9 && r.firmado_por?.trim()) {
        c.font = { ...c.font, bold: true, color: { argb: 'FF065F46' } };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
