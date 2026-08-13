/**
 * 2026-07-17 - Documentos requeridos según trámite (solicitud/renovación)
 * y grupo escolar (maternal/kinder 1 vs kinder 2+).
 * 2026-07-27 - Renovación: checklist circular (ingresos/domicilio/inscripción).
 * 2026-08-13 - Renovación: ya no se pide boleta SEP al papá; el promedio
 *              sale de boletas Winston MySQL en el panel admin.
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

/** Renovación: 3 PDFs (sin boleta SEP; promedio en admin). */
const RENOVACION_CIRCULAR: DocumentoTipo[] = [
  'ingresos',
  'domicilio',
  'comp_inscripcion',
];

/** Solicitud nueva: expediente de ingreso. */
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
  ingresos:
    'Comprobante(s) de ingresos de un mes (padre, madre y/o tutor)',
  domicilio: 'Comprobante de domicilio (teléfono, agua o luz)',
  boleta: 'Boleta SEP del ciclo escolar',
  comp_inscripcion: 'Comprobante(s) de pago de inscripción completa',
  acta_nacimiento: 'Acta de nacimiento',
  curp: 'CURP del alumno',
  curp_tutor: 'CURP del papá o mamá',
  constancia_no_adeudo: 'Constancia de no adeudo',
  carta_buena_conducta: 'Carta de buena conducta',
  boleta_interna: 'Última boleta interna',
};

/** Columna boolean en becas_renovacion / becas_solicitud (mismo slug). */
export const DOCUMENTO_FLAG_COLUMN: Record<DocumentoTipo, string> = {
  ingresos: 'ingresos',
  domicilio: 'domicilio',
  boleta: 'boleta',
  comp_inscripcion: 'comp_inscripcion',
  acta_nacimiento: 'acta_nacimiento',
  curp: 'curp',
  curp_tutor: 'curp_tutor',
  constancia_no_adeudo: 'constancia_no_adeudo',
  carta_buena_conducta: 'carta_buena_conducta',
  boleta_interna: 'boleta_interna',
};

export const TODOS_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  'ingresos',
  'domicilio',
  'boleta',
  'comp_inscripcion',
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

/** Lista lista para UI: tipo + etiqueta según nivel/grado. */
export function docsRequeridosConEtiqueta(opts: {
  flujo: FlujoDocumentos;
  nivel: number | null | undefined;
  grado: number | null | undefined;
}): { tipo: DocumentoTipo; label: string }[] {
  return docsRequeridos(opts).map((tipo) => ({
    tipo,
    label: labelDocRequerido(tipo),
  }));
}

/**
 * Renovación: 3 PDFs (ingresos, domicilio, inscripción).
 * Solicitud (nuevo ingreso): 3 base; +2 si Kinder 2+.
 */
export function docsRequeridos(opts: {
  flujo: FlujoDocumentos;
  nivel: number | null | undefined;
  grado: number | null | undefined;
}): DocumentoTipo[] {
  if (opts.flujo === 'renovacion') {
    return [...RENOVACION_CIRCULAR];
  }

  const maternalKinder1 = esMaternalOKinder1(opts.nivel, opts.grado);
  const list: DocumentoTipo[] = [...BASE_NUEVO_INGRESO];
  if (!maternalKinder1) {
    list.push(...EXTRA_KINDER2);
  }
  return list;
}
