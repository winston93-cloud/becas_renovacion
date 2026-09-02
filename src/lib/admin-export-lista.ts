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
  beca_rechazada?: boolean;
  beca_activada?: boolean;
  firmado_por?: string | null;
  beca_activada_en?: string | null;
  aplica_desde?: string | null;
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
    case 'activadas':
      return 'Firmadas y activadas';
    case 'rechazadas':
      return 'Rechazadas';
    case 'todas':
      return 'Todas';
    default:
      return estado;
  }
}

export function estadoRevisionTexto(row: AdminExportRow): string {
  if (row.beca_rechazada) return 'Rechazada';
  if (row.beca_activada) return 'Firmada y activada';
  if (row.beca_autorizada) return 'Autorizada';
  if (row.verificado) return 'Verificada';
  if (row.enviado) return 'Pendiente';
  return 'Borrador';
}

export function resumenExport(rows: AdminExportRow[]) {
  let pendientes = 0;
  let verificadas = 0;
  let autorizadas = 0;
  let activadas = 0;
  let borradores = 0;
  for (const r of rows) {
    if (r.beca_activada) activadas += 1;
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
    activadas,
    borradores,
  };
}

export function formatGradoExport(
  grado: number | string | null | undefined
): string {
  if (grado == null) return '—';
  const s = String(grado).trim();
  if (!s || s.toLowerCase() === 'nan') return '—';
  return s;
}

/** Igual que la columna Grado del dashboard admin. */
export function formatGradoGrupoExport(row: AdminExportRow): string {
  const grado = formatGradoExport(row.grado);
  const grupo = String(row.grupo ?? '').trim();
  if (grado === '—' && !grupo) return '—';
  if (grado === '—') return grupo || '—';
  if (!grupo) return grado;
  return `${grado} / ${grupo}`;
}

/** Nivel común del listado (para encabezado del export). */
export function contextoNivelExport(rows: AdminExportRow[]): string {
  const niveles = [
    ...new Set(rows.map((r) => r.nivel_label.trim()).filter(Boolean)),
  ];
  if (niveles.length === 1) return niveles[0];
  if (niveles.length === 0) return '—';
  return 'Varios niveles';
}

export function lineaContextoEscolarExport(rows: AdminExportRow[]): string {
  return `Nivel: ${contextoNivelExport(rows)}`;
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
