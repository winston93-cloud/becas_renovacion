/**
 * Promedio mínimo en carta de aceptación de beca (firma electrónica).
 * Socioeconómica 9.0 · Académica / Excelencia 9.5 (editable en admin) · demás 8.0
 */
export const BECA_ID_ACADEMICA = 8;
export const BECA_ID_EXCELENCIA = 6;
export const BECA_ID_SOCIOECONOMICA = 9;

export const PROMEDIO_CARTA_ACADEMICA_DEFAULT = 9.5;
export const PROMEDIO_CARTA_SOCIOECONOMICA = 9.0;
export const PROMEDIO_CARTA_GENERAL = 8.0;

const ENTEROS: Record<number, string> = {
  8: 'OCHO',
  9: 'NUEVE',
  10: 'DIEZ',
};

const DECIMAS: Record<number, string> = {
  0: 'CERO',
  5: 'CINCO',
};

function normalizarClase(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function esBecaAcademica(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  if (Number(becaId) === BECA_ID_ACADEMICA) return true;
  const c = normalizarClase(becaClase);
  return c.includes('academ') && !c.includes('socio');
}

export function esBecaExcelencia(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  if (Number(becaId) === BECA_ID_EXCELENCIA) return true;
  return normalizarClase(becaClase).includes('excelencia');
}

/** Académica y Excelencia comparten default 9.5 editable en admin. */
export function esBecaPromedioMinimoCartaEditable(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  return esBecaAcademica(becaId, becaClase) || esBecaExcelencia(becaId, becaClase);
}

export function esBecaSocioeconomica(
  becaId?: number | null,
  becaClase?: string | null
): boolean {
  if (Number(becaId) === BECA_ID_SOCIOECONOMICA) return true;
  return normalizarClase(becaClase).includes('socioeconom');
}

export function normalizarPromedioCarta(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

export function resolverPromedioMinimoCarta(opts: {
  becaId?: number | null;
  becaClase?: string | null;
  promedioAcademicoOverride?: number | null;
}): number {
  if (esBecaSocioeconomica(opts.becaId, opts.becaClase)) {
    return PROMEDIO_CARTA_SOCIOECONOMICA;
  }
  if (esBecaPromedioMinimoCartaEditable(opts.becaId, opts.becaClase)) {
    const ov = normalizarPromedioCarta(opts.promedioAcademicoOverride);
    return ov ?? PROMEDIO_CARTA_ACADEMICA_DEFAULT;
  }
  return PROMEDIO_CARTA_GENERAL;
}

export function parsePromedioMinimoCartaAdmin(body: {
  promedio_minimo_carta?: unknown;
  beca_id?: unknown;
}): { ok: true; value: number | null } | { ok: false; error: string } {
  if (body.promedio_minimo_carta == null || body.promedio_minimo_carta === '') {
    return { ok: true, value: null };
  }
  const becaId = Number(body.beca_id);
  if (!esBecaPromedioMinimoCartaEditable(becaId)) {
    return {
      ok: false,
      error: 'El promedio de carta solo aplica a beca Académica o Excelencia.',
    };
  }
  const n = normalizarPromedioCarta(body.promedio_minimo_carta);
  if (n == null) {
    return {
      ok: false,
      error: 'Indique un promedio mínimo válido (0.1 – 10.0).',
    };
  }
  return { ok: true, value: n };
}
