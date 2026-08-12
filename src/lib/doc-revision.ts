/**
 * Estados de revisión de documentos (Control Escolar).
 */
export type RevisionEstadoDoc =
  | 'pendiente'
  | 'ok'
  | 'incorrecto'
  | 'reenviado';

export function normalizarRevisionEstado(raw: unknown): RevisionEstadoDoc {
  const s = String(raw ?? '').trim().toLowerCase();
  if (
    s === 'ok' ||
    s === 'incorrecto' ||
    s === 'pendiente' ||
    s === 'reenviado'
  ) {
    return s;
  }
  return 'pendiente';
}

/** Valores al (re)subir un PDF por primera vez / reemplazo normal. */
export const REVISION_AL_SUBIR = {
  revision_estado: 'pendiente' as const,
  revision_nota: null,
  revisado_en: null,
  revisado_por: null,
};

/** Valores cuando el padre corrige un documento marcado incorrecto. */
export const REVISION_AL_REENVIAR = {
  revision_estado: 'reenviado' as const,
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
    case 'reenviado':
      return 'Reenviado';
    default:
      return 'Por revisar';
  }
}
