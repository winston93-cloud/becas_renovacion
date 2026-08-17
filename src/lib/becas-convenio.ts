/**
 * 2026-08-17 - Becas de convenio (PEMEX, IMSS, CFE, TELMEX).
 * Solicitud nueva exige comprobante de ingresos además del expediente.
 * IDs del catálogo becas_concepto_beca; clase como respaldo si el id cambia.
 */

/** 1 PEMEX, 15 IMSS, 16 CFE, 17 TELMEX */
export const BECA_IDS_CONVENIO = [1, 15, 16, 17] as const;

const CLASES_CONVENIO = new Set(['PEMEX', 'IMSS', 'CFE', 'TELMEX']);

export function esBecaConvenio(opts: {
  becaId?: number | null;
  becaClase?: string | null;
}): boolean {
  const id = opts.becaId != null ? Number(opts.becaId) : NaN;
  if (
    Number.isFinite(id) &&
    (BECA_IDS_CONVENIO as readonly number[]).includes(id)
  ) {
    return true;
  }
  const clase = (opts.becaClase || '').trim().toUpperCase();
  return clase.length > 0 && CLASES_CONVENIO.has(clase);
}
