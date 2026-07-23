/**
 * 2026-07-18 - Becas que este portal no tramita (p. ej. gobierno).
 * No deben aparecer en selects ni aceptarse en solicitud/renovación.
 */

/** SEP (beca_id 2 en becas_concepto_beca) — programa federal, fuera de alcance. */
export const BECA_ID_SEP = 2;

export function esBecaNoTramitable(becaId: number | null | undefined): boolean {
  if (becaId == null || Number.isNaN(Number(becaId))) return false;
  return Number(becaId) === BECA_ID_SEP;
}

export function esConceptoTramitable(c: {
  beca_id: number;
  beca_clase?: string;
}): boolean {
  if (esBecaNoTramitable(c.beca_id)) return false;
  if ((c.beca_clase || '').trim().toUpperCase() === 'SEP') return false;
  return true;
}
