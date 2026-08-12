/**
 * Excel (.xls SpreadsheetML) institucional para revisión de listados admin.
 * Sin dependencias extra; Excel / LibreOffice lo abren con formato.
 */
import {
  estadoRevisionTexto,
  formatFechaExport,
  resumenExport,
  type AdminExportPayload,
} from '@/lib/admin-export-lista';

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(v: string | number, style = 'Normal'): string {
  if (typeof v === 'number') {
    return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
}

export function buildListaRevisionExcel(payload: AdminExportPayload): Buffer {
  const rows = payload.rows;
  const sum = resumenExport(rows);
  const flujoLabel =
    payload.flujo === 'renovacion' ? 'Renovaciones' : 'Solicitudes nuevas';
  const generado = new Date().toLocaleString('es-MX');

  const headerCells = [
    '#',
    'No. control',
    'Alumno',
    'Nivel',
    'Grado',
    'Grupo',
    'Estado',
    'Verificado',
    'Autorizado',
    'Enviado',
  ]
    .map((h) => cell(h, 'Header'))
    .join('');

  const dataRows = rows
    .map((r, i) => {
      const estado = estadoRevisionTexto(r);
      const styleEstado =
        estado === 'Autorizada'
          ? 'Ok'
          : estado === 'Verificada'
            ? 'Info'
            : estado === 'Pendiente'
              ? 'Warn'
              : 'Normal';
      return `<Row>
${cell(i + 1, 'Center')}
${cell(r.alumno_ref, 'Center')}
${cell(r.nombre)}
${cell(r.nivel_label)}
${cell(r.grado ?? '—', 'Center')}
${cell(r.grupo || '—', 'Center')}
${cell(estado, styleEstado)}
${cell(r.verificado ? 'Sí' : 'No', r.verificado ? 'Ok' : 'Center')}
${cell(r.beca_autorizada ? 'Sí' : 'No', r.beca_autorizada ? 'Ok' : 'Center')}
${cell(formatFechaExport(r.enviado_en), 'Center')}
</Row>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${esc(payload.titulo)}</Title>
  <Author>Instituto Winston Churchill · Control Escolar</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#14233F"/>
  </Style>
  <Style ss:ID="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5EAF1"/>
   </Borders>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5EAF1"/>
   </Borders>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#14233F" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#4D5D73"/>
   <Interior ss:Color="#F2EFE8" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="StatLabel">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#4D5D73"/>
   <Interior ss:Color="#EEF3F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="StatValue">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#14233F"/>
   <Interior ss:Color="#EEF3F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1C3258" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Ok">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1F6B4A"/>
   <Interior ss:Color="#E6F4EC" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Warn">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#A84A2A"/>
   <Interior ss:Color="#FFF3E0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Info">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1C3258"/>
   <Interior ss:Color="#E8EEF6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${esc(flujoLabel.slice(0, 31))}">
  <Table>
   <Column ss:Width="36"/>
   <Column ss:Width="72"/>
   <Column ss:Width="220"/>
   <Column ss:Width="90"/>
   <Column ss:Width="48"/>
   <Column ss:Width="48"/>
   <Column ss:Width="90"/>
   <Column ss:Width="72"/>
   <Column ss:Width="72"/>
   <Column ss:Width="120"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="9" ss:StyleID="Title"><Data ss:Type="String">${esc('Instituto Winston Churchill · Control Escolar · Becas')}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="9" ss:StyleID="Subtitle"><Data ss:Type="String">${esc(`${payload.titulo} · Filtro: ${payload.filtro_label} · Generado: ${generado}`)}</Data></Cell>
   </Row>
   <Row/>
   <Row>
    ${cell('Total', 'StatLabel')}
    ${cell('Pendientes', 'StatLabel')}
    ${cell('Verificadas', 'StatLabel')}
    ${cell('Autorizadas', 'StatLabel')}
    ${cell('Borradores', 'StatLabel')}
   </Row>
   <Row ss:Height="24">
    ${cell(sum.total, 'StatValue')}
    ${cell(sum.pendientes, 'StatValue')}
    ${cell(sum.verificadas, 'StatValue')}
    ${cell(sum.autorizadas, 'StatValue')}
    ${cell(sum.borradores, 'StatValue')}
   </Row>
   <Row/>
   <Row ss:Height="22">${headerCells}</Row>
   ${dataRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>7</SplitHorizontal>
   <TopRowBottomPane>7</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf8');
}
