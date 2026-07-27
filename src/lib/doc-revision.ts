/**
 * Estados de revisión de documentos (Control Escolar).
 */
export type RevisionEstadoDoc = 'pendiente' | 'ok' | 'incorrecto';

export function normalizarRevisionEstado(raw: unknown): RevisionEstadoDoc {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'ok' || s === 'incorrecto' || s === 'pendiente') return s;
  return 'pendiente';
}

/** Valores al (re)subir un PDF: vuelve a pendiente de revisión. */
export const REVISION_AL_SUBIR = {
  revision_estado: 'pendiente' as const,
  revision_nota: null,
  revisado_en: null,
  revisado_por: null,
};

export function etiquetaRevisionEstado(estado: RevisionEstadoDoc): string {
  switch (estado) {
    case 'ok':
      return 'OK';
    case 'incorrecto':
      return 'Incorrecto';
    default:
      return 'Por revisar';
  }
}
