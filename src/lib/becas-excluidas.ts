/**
 * 2026-07-18 - Becas que este portal no tramita (p. ej. gobierno).
 * No deben aparecer en selects ni aceptarse en solicitud/renovación.
 * 2026-09-03 - Winston (id 3) → Grupal (11); Por 3 Hermanos (id 13) → Por Familia (7).
 */

/** SEP (beca_id 2 en becas_concepto_beca) — programa federal, fuera de alcance. */
export const BECA_ID_SEP = 2;

/** Winston (id 3) — obsoleta; usar Grupal (11). Defensa si reaparece en seed. */
export const BECA_ID_WINSTON_OBSOLETA = 3;

/** Por 3 Hermanos (id 13) — obsoleta; usar Por Familia (7). */
export const BECA_ID_TRES_HERMANOS_OBSOLETA = 13;

const IDS_NO_TRAMITABLES = new Set([
  BECA_ID_SEP,
  BECA_ID_WINSTON_OBSOLETA,
  BECA_ID_TRES_HERMANOS_OBSOLETA,
]);

const CLASES_NO_TRAMITABLES = new Set([
  'SEP',
  'WINSTON',
  'POR 3 HERMANOS',
]);

export function esBecaNoTramitable(becaId: number | null | undefined): boolean {
  if (becaId == null || Number.isNaN(Number(becaId))) return false;
  return IDS_NO_TRAMITABLES.has(Number(becaId));
}

export function esConceptoTramitable(c: {
  beca_id: number;
  beca_clase?: string;
}): boolean {
  if (esBecaNoTramitable(c.beca_id)) return false;
  const clase = (c.beca_clase || '').trim().toUpperCase();
  if (CLASES_NO_TRAMITABLES.has(clase)) return false;
  return true;
}
