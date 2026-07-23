/**
 * 2026-07-18 - Presentación de alumno_grupo (BD numérico → letra legible).
 * 0 = sin grupo asignado; 1 = A; 2 = B; 3 = C.
 * Solo para UI / PDF / correo; no cambia el valor en BD.
 */

export function labelGrupo(
  grupo: number | string | null | undefined
): string {
  if (grupo == null || grupo === '') return '—';
  const n = Number(grupo);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'sin grupo asignado';
  if (n === 1) return 'A';
  if (n === 2) return 'B';
  if (n === 3) return 'C';
  return '—';
}
