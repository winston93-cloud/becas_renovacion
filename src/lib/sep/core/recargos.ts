// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Pago neto de un mes sin recargos (función pura, sin BD).
 *
 * Los recargos nunca entran al prorrateo y se quitan siempre de forma automática:
 * 1. Recargo separado (`pago_recargo`) y cargo extra de horario extendido.
 * 2. Lo que rebase el precio oficial del plan se considera recargo.
 * 3. Recargo metido en un pago con descuento: `neto − base` múltiplo de $75
 *    (1–12 meses, tolerancia $2) sobre un precio base posible. Solo aplica si por la
 *    fecha de pago sí correspondía recargo y nunca quita más de lo esperado
 *    (un pago puntual incompleto no se confunde con recargo).
 * La inscripción solo usa los pasos 1 y 2 (`detectarMultiplos: false`).
 */

import { RECARGO_POR_MES } from './ciclo'
import { r2 } from './dinero'

export const TOLERANCIA_MULTIPLO = 2
export const MAX_MESES_RECARGO = 12

export type ReglaRecargo = 'recargo_separado' | 'cargo_extra' | 'tope_precio_oficial' | 'multiplo_75'

export type EntradaPagoNeto = {
  /** Suma de `pago_importe` del mes (pagos no cancelados). */
  importeBruto: number
  /** Suma de `pago_recargo` del mes. */
  recargoSeparado?: number
  /** Cargo extra de horario extendido cobrado dentro del importe. */
  cargoExtra?: number
  /** Colegiatura (o inscripción) oficial del plan, sin beca. */
  precioOficial: number
  /** Precios base posibles cuando el recargo viene dentro de un pago con descuento. */
  preciosBase?: number[]
  /** Recargo que correspondía según la fecha del pago. */
  recargoEsperado?: number
  /** false para inscripción. */
  detectarMultiplos?: boolean
  /** 2026-10-03: recargo por mes del ciclo (por defecto $75). */
  recargoMes?: number
}

export type ResultadoPagoNeto = {
  bruto: number
  recargoSeparado: number
  cargoExtra: number
  recargoExcedente: number
  recargoMultiplo: number
  /** Recargos quitados (separado + excedente + múltiplo); no incluye cargo extra. */
  recargoTotal: number
  neto: number
  precioBase: number | null
  reglas: ReglaRecargo[]
}

/**
 * Precios base posibles de un mes: oficial, con la beca actual, colegiatura SEP,
 * monto SEP aprobado y oficial con descuento de 0 % a 50 % en pasos de 5.
 */
export function preciosBaseCandidatos(opts: {
  precioOficial: number
  becaActualPct?: number
  colSep?: number
  montoAprobadoSep?: number | null
}): number[] {
  const { precioOficial } = opts
  const lista: number[] = [precioOficial]
  if (opts.becaActualPct && opts.becaActualPct > 0 && opts.becaActualPct < 100) {
    lista.push(precioOficial * (1 - opts.becaActualPct / 100))
  }
  if (opts.colSep && opts.colSep > 0) lista.push(opts.colSep)
  if (opts.montoAprobadoSep && opts.montoAprobadoSep > 0) lista.push(opts.montoAprobadoSep)
  for (let d = 0; d <= 50; d += 5) lista.push(precioOficial * (1 - d / 100))
  return Array.from(new Set(lista.map(r2)))
    .filter((p) => p > 0)
    .sort((a, b) => b - a)
}

export function pagoNetoSinRecargo(e: EntradaPagoNeto): ResultadoPagoNeto {
  const bruto = r2(Math.max(0, Number(e.importeBruto) || 0))
  const recargoSeparado = r2(Math.max(0, Number(e.recargoSeparado) || 0))
  const cargoExtra = r2(Math.max(0, Number(e.cargoExtra) || 0))
  const precioOficial = r2(Number(e.precioOficial) || 0)
  const reglas: ReglaRecargo[] = []

  let neto = bruto
  if (recargoSeparado > 0) {
    neto -= recargoSeparado
    reglas.push('recargo_separado')
  }
  if (cargoExtra > 0 && neto > 0) {
    neto -= Math.min(cargoExtra, neto)
    reglas.push('cargo_extra')
  }
  neto = r2(Math.max(0, neto))

  let recargoExcedente = 0
  if (precioOficial > 0 && neto > precioOficial + 0.005) {
    recargoExcedente = r2(neto - precioOficial)
    neto = precioOficial
    reglas.push('tope_precio_oficial')
  }

  let recargoMultiplo = 0
  let precioBase: number | null = null
  const esperado = Math.max(0, Number(e.recargoEsperado) || 0)
  const puedeDetectar =
    e.detectarMultiplos !== false &&
    esperado > 0 &&
    recargoSeparado === 0 &&
    recargoExcedente === 0 &&
    neto > 0 &&
    neto < precioOficial

  const recargoMes = e.recargoMes && e.recargoMes > 0 ? e.recargoMes : RECARGO_POR_MES
  if (puedeDetectar) {
    const candidatos = (e.preciosBase ?? [precioOficial])
      .map(r2)
      .filter((b) => b > 0 && b < neto)
      .map((b) => {
        const d = r2(neto - b)
        return { b, d, k: Math.round(d / recargoMes) }
      })
      .filter(
        ({ d, k }) =>
          k >= 1 &&
          k <= MAX_MESES_RECARGO &&
          Math.abs(d - k * recargoMes) <= TOLERANCIA_MULTIPLO &&
          d <= esperado + TOLERANCIA_MULTIPLO
      )
      .sort((x, y) => Math.abs(x.d - esperado) - Math.abs(y.d - esperado) || y.b - x.b)

    if (candidatos.length > 0) {
      recargoMultiplo = candidatos[0].d
      precioBase = candidatos[0].b
      neto = candidatos[0].b
      reglas.push('multiplo_75')
    }
  }

  return {
    bruto,
    recargoSeparado,
    cargoExtra,
    recargoExcedente,
    recargoMultiplo,
    recargoTotal: r2(recargoSeparado + recargoExcedente + recargoMultiplo),
    neto: r2(neto),
    precioBase,
    reglas,
  }
}
