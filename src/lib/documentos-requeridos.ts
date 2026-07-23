/**
 * 2026-07-17 - Documentos requeridos según trámite (solicitud/renovación)
 * y grupo escolar (maternal/kinder 1 vs kinder 2+).
 */
import type { DocumentoTipo } from '@/lib/types';

export type FlujoDocumentos = 'solicitud' | 'renovacion';

/** Maternal (nivel 1) o Kinder 1 (nivel 2 + grado 1). */
export function esMaternalOKinder1(
  nivel: number | null | undefined,
  grado: number | null | undefined
): boolean {
  const n = nivel != null ? Number(nivel) : NaN;
  const g = grado != null ? Number(grado) : NaN;
  if (n === 1) return true;
  if (n === 2 && g === 1) return true;
  return false;
}

const BASE_NUEVO_INGRESO: DocumentoTipo[] = [
  'acta_nacimiento',
  'curp',
  'curp_tutor',
];

const EXTRA_KINDER2: DocumentoTipo[] = [
  'constancia_no_adeudo',
  'carta_buena_conducta',
];

const LABELS: Record<DocumentoTipo, string> = {
  acta_nacimiento: 'Acta de nacimiento',
  curp: 'CURP del alumno',
  curp_tutor: 'CURP del papá o mamá',
  constancia_no_adeudo: 'Constancia de no adeudo',
  carta_buena_conducta: 'Carta de buena conducta',
  boleta_interna: 'Última boleta interna',
};

/** Columna boolean en becas_renovacion / becas_solicitud (mismo slug). */
export const DOCUMENTO_FLAG_COLUMN: Record<DocumentoTipo, string> = {
  acta_nacimiento: 'acta_nacimiento',
  curp: 'curp',
  curp_tutor: 'curp_tutor',
  constancia_no_adeudo: 'constancia_no_adeudo',
  carta_buena_conducta: 'carta_buena_conducta',
  boleta_interna: 'boleta_interna',
};

export const TODOS_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  'acta_nacimiento',
  'curp',
  'curp_tutor',
  'constancia_no_adeudo',
  'carta_buena_conducta',
  'boleta_interna',
];

export function labelDocRequerido(tipo: DocumentoTipo): string {
  return LABELS[tipo];
}

/**
 * Solicitud (nuevo ingreso): 3 base; +2 si Kinder 2+.
 * Renovación (reingreso): lo de solicitud + boleta_interna.
 */
export function docsRequeridos(opts: {
  flujo: FlujoDocumentos;
  nivel: number | null | undefined;
  grado: number | null | undefined;
}): DocumentoTipo[] {
  const maternalKinder1 = esMaternalOKinder1(opts.nivel, opts.grado);
  const list: DocumentoTipo[] = [...BASE_NUEVO_INGRESO];
  if (!maternalKinder1) {
    list.push(...EXTRA_KINDER2);
  }
  if (opts.flujo === 'renovacion') {
    list.push('boleta_interna');
  }
  return list;
}
