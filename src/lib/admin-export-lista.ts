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

export function formatGradoExport(
  grado: number | string | null | undefined
): string {
  if (grado == null) return '—';
  const s = String(grado).trim();
  if (!s || s.toLowerCase() === 'nan') return '—';
  return s;
}

/** Nivel y grado comunes del listado (para encabezado del export). */
export function contextoEscolarExport(rows: AdminExportRow[]): {
  nivel: string;
  grado: string;
} {
  const niveles = [
    ...new Set(rows.map((r) => r.nivel_label.trim()).filter(Boolean)),
  ];
  const grados = [
    ...new Set(
      rows.map((r) => formatGradoExport(r.grado)).filter((g) => g !== '—')
    ),
  ];
  return {
    nivel:
      niveles.length === 1
        ? niveles[0]
        : niveles.length === 0
          ? '—'
          : 'Varios niveles',
    grado:
      grados.length === 1
        ? grados[0]
        : grados.length === 0
          ? '—'
          : 'Varios grados',
  };
}

export function lineaContextoEscolarExport(rows: AdminExportRow[]): string {
  const { nivel, grado } = contextoEscolarExport(rows);
  return `Nivel: ${nivel} · Grado: ${grado}`;
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
