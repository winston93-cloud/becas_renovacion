/**
 * Filas y etiquetas para exportar listados admin (renovación / solicitud).
 */
export type AdminExportFlujo = 'renovacion' | 'solicitud';

export type AdminExportRow = {
  alumno_ref: string;
  nombre: string;
  nivel_label: string;
  grado: number | string | null;
  grupo: string;
  enviado: boolean;
  enviado_en: string | null;
  verificado: boolean;
  beca_autorizada: boolean;
};

export type AdminExportPayload = {
  flujo: AdminExportFlujo;
  formato: 'excel' | 'pdf';
  titulo: string;
  filtro_label: string;
  ciclo_label?: string;
  rows: AdminExportRow[];
};

export function etiquetaFiltroEstado(estado: string): string {
  switch (estado) {
    case 'enviadas':
      return 'Enviadas';
    case 'pendientes':
      return 'Pendientes de verificar';
    case 'correccion_documentos':
      return 'Corrección de documentos';
    case 'verificadas':
      return 'Verificadas';
    case 'autorizadas':
      return 'Autorizadas';
    case 'todas':
      return 'Todas';
    default:
      return estado;
  }
}

export function estadoRevisionTexto(row: AdminExportRow): string {
  if (row.beca_autorizada) return 'Autorizada';
  if (row.verificado) return 'Verificada';
  if (row.enviado) return 'Pendiente';
  return 'Borrador';
}

export function resumenExport(rows: AdminExportRow[]) {
  let pendientes = 0;
  let verificadas = 0;
  let autorizadas = 0;
  let borradores = 0;
  for (const r of rows) {
    if (r.beca_autorizada) autorizadas += 1;
    if (r.verificado) verificadas += 1;
    if (r.enviado && !r.verificado) pendientes += 1;
    if (!r.enviado) borradores += 1;
  }
  return {
    total: rows.length,
    pendientes,
    verificadas,
    autorizadas,
    borradores,
  };
}

export function formatFechaExport(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
