/**
 * 2026-09-03 - Etiquetas Hermanos: admin ve (2)/(3); papás una sola «Hermanos».
 */

export const BECA_ID_HERMANOS_2 = 10;
export const BECA_ID_HERMANOS_3 = 13;

export function esBecaHermanos(becaId: number | null | undefined): boolean {
  const id = Number(becaId);
  return id === BECA_ID_HERMANOS_2 || id === BECA_ID_HERMANOS_3;
}

/** Etiqueta para papás / carta / renovación: sin distinguir 2 vs 3. */
export function etiquetaBecaParaPadres(
  becaClase: string | null | undefined
): string {
  const raw = (becaClase || '').trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  if (
    upper === 'HERMANOS' ||
    /^HERMANOS\s*\([23]\)$/.test(upper) ||
    /^POR\s+[23]\s+HERMANOS$/.test(upper)
  ) {
    return 'Hermanos';
  }
  return raw;
}

/**
 * Select de solicitud (papás): una sola opción Hermanos.
 * Si el expediente ya tiene id 13, se conserva ese value etiquetado «Hermanos».
 */
export function conceptosParaSelectPadres<
  T extends { beca_id: number; beca_clase: string },
>(conceptos: T[], becaIdActual?: number | null): T[] {
  const actual =
    becaIdActual != null && Number(becaIdActual) > 0
      ? Number(becaIdActual)
      : null;
  const preferirTres = actual === BECA_ID_HERMANOS_3;
  const out: T[] = [];
  let hermanosPuesto = false;

  for (const c of conceptos) {
    const id = Number(c.beca_id);

    if (id === BECA_ID_HERMANOS_2) {
      if (preferirTres || hermanosPuesto) continue;
      out.push({ ...c, beca_clase: 'Hermanos' });
      hermanosPuesto = true;
      continue;
    }

    if (id === BECA_ID_HERMANOS_3) {
      if (!preferirTres || hermanosPuesto) continue;
      out.push({ ...c, beca_clase: 'Hermanos' });
      hermanosPuesto = true;
      continue;
    }

    out.push(c);
  }

  return out;
}
