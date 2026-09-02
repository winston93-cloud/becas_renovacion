/**
 * Mes desde el cual aplica la beca en colegiaturas (identificación admin).
 * No modifica cobros por sí solo.
 */

export const MES_APLICA_DEFAULT = 9; // septiembre — flujo en tiempo
export const MES_APLICA_POST_CIERRE = 10; // octubre — renovación tardía típica

const NOMBRES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

/** Meses relevantes del ciclo escolar (ago → jul del ciclo). */
export const MESES_APLICA_OPCIONES: { value: number; label: string }[] = [
  9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7,
].map((value) => ({ value, label: NOMBRES[value] }));

export function normalizarMesAplica(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

/** Valor efectivo para UI (NULL → septiembre). */
export function mesAplicaEfectivo(raw: unknown): number {
  return normalizarMesAplica(raw) ?? MES_APLICA_DEFAULT;
}

export function etiquetaMesAplica(raw: unknown): string {
  const m = mesAplicaEfectivo(raw);
  return NOMBRES[m] ?? `Mes ${m}`;
}

export function etiquetaMesAplicaCorta(raw: unknown): string {
  return `Desde ${etiquetaMesAplica(raw)}`;
}

/** true si no es el mes normal de inicio (septiembre). */
export function esMesAplicaTardio(raw: unknown): boolean {
  return mesAplicaEfectivo(raw) !== MES_APLICA_DEFAULT;
}
