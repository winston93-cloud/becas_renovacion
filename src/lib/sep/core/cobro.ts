// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Regla del día 10 al cobrar (función pura).
 *
 * - Beca Winston/convenio: se PIERDE si se paga después del día 10 (precio oficial + recargo).
 * - Beca SEP: NUNCA se pierde; si paga tarde solo suma $75 por mes de atraso.
 */

// 2026-10-03: el recargo por mes sale de la regla del ciclo.
import { mesesAtraso, reglasCiclo } from './ciclo'
import { r2 } from './dinero'

export type CobroMes = {
  /** Monto base del mes (sin recargo). */
  base: number
  recargo: number
  total: number
  mesesAtraso: number
  /** true si la beca Winston se perdió por pagar después del día 10. */
  perdioBecaWinston: boolean
}

/** Cobro de un mes con beca SEP aprobada: el monto se respeta y solo suma recargo. */
export function cobroConSep(montoAprobado: number, concepto: string, fechaPago: unknown, ciclo: number): CobroMes {
  const m = mesesAtraso(concepto, fechaPago, ciclo)
  const recargo = m * reglasCiclo(ciclo).recargoMes
  return { base: r2(montoAprobado), recargo, total: r2(montoAprobado + recargo), mesesAtraso: m, perdioBecaWinston: false }
}

/** Cobro de un mes con beca Winston: después del día 10 se cobra el oficial más recargo. */
export function cobroConBecaWinston(
  precioOficial: number,
  becaPct: number,
  concepto: string,
  fechaPago: unknown,
  ciclo: number
): CobroMes {
  const m = mesesAtraso(concepto, fechaPago, ciclo)
  const perdio = m > 0 && becaPct > 0
  const base = perdio ? r2(precioOficial) : r2(precioOficial * (1 - becaPct / 100))
  const recargo = m * reglasCiclo(ciclo).recargoMes
  return { base, recargo, total: r2(base + recargo), mesesAtraso: m, perdioBecaWinston: perdio }
}
