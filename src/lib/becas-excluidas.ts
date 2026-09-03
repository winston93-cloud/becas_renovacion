/**
 * 2026-07-18 - Becas que este portal no tramita (p. ej. gobierno).
 * No deben aparecer en selects ni aceptarse en solicitud/renovación.
 * 2026-09-03 - Winston (id 3) unificada con Grupal (id 11); se eliminó del catálogo.
 */

/** SEP (beca_id 2 en becas_concepto_beca) — programa federal, fuera de alcance. */
export const BECA_ID_SEP = 2;

/** Winston (id 3) — obsoleta; usar Grupal (11). Defensa si reaparece en seed. */
export const BECA_ID_WINSTON_OBSOLETA = 3;

export function esBecaNoTramitable(becaId: number | null | undefined): boolean {
  if (becaId == null || Number.isNaN(Number(becaId))) return false;
  const id = Number(becaId)
  return id === BECA_ID_SEP || id === BECA_ID_WINSTON_OBSOLETA
}

export function esConceptoTramitable(c: {
  beca_id: number;
  beca_clase?: string;
}): boolean {
  if (esBecaNoTramitable(c.beca_id)) return false;
  const clase = (c.beca_clase || '').trim().toUpperCase();
  if (clase === 'SEP' || clase === 'WINSTON') return false;
  return true;
}
