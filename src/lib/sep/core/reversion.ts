/**
 * 2026-10-12 - Reversión de una Beca SEP aplicada (función pura, sin BD).
 * La familia regresa a su beca del colegio (o a la colegiatura completa si no tenía). Lo que ya pagó con la
 * SEP se compara contra el precio con su beca del colegio y la diferencia se reparte en los meses que faltan:
 *
 *   precio   = oficial × (1 − %beca del colegio)
 *   exc      = Σ (pagoNeto − precio) sobre los meses pagados (los negativos restan)
 *   mensual  = max(0, precio − exc / mesesRestantes)      ← sin tope: si pagó de menos, se completa
 *   Si exc ≥ precio × mesesRestantes → ya no paga y queda saldo a favor.
 *
 * La inscripción no cuenta: se pagó con las reglas del colegio y la reversión no la cambia.
 */
import { conceptosPlan, type PlanMeses } from './ciclo'
import { r2 } from './dinero'
import { calcularProrrateo, type PagoMesNeto } from './prorrateo'

export type EntradaReversion = {
  colegiaturaOficial: number
  planMeses: PlanMeses
  /** Beca del colegio que recupera (0 = no tenía). */
  porcentajeBeca: number
  pagosColegiatura: PagoMesNeto[]
}

export type ResultadoReversion = {
  precioConBeca: number
  mesesPagados: number
  mesesRestantes: number
  excedente: number
  /** Mensualidad de los meses que faltan (null si ya no quedan meses). */
  mensual: number | null
  anioCompleto: boolean
  saldoFavor: number
  /** Conceptos que faltan por pagar, en orden de cobro. */
  porPagar: string[]
  /** Mensualidad por concepto de los meses que faltan (lo que cobrará el baucher). */
  esperados: Record<string, number>
}

export type ComparativoBecaColegio = {
  porcentajeColegio: number
  precioColegio: number
  mensualSep: number
  /** Positivo = con la SEP la familia paga más cada mes que con su beca del colegio. */
  diferencia: number
}

/**
 * 2026-10-12 - Aviso interno (no se muestra a la familia): la SEP le sale más cara que su beca del colegio.
 * null si no tenía beca del colegio o no hay mensualidad SEP.
 */
export function comparativoBecaColegio(e: {
  colegiaturaOficial: number
  porcentajeColegio: number | null | undefined
  mensualSep: number | null | undefined
}): ComparativoBecaColegio | null {
  const pct = Number(e.porcentajeColegio) || 0
  if (pct <= 0 || e.mensualSep == null) return null
  const precioColegio = r2(e.colegiaturaOficial * (1 - pct / 100))
  return { porcentajeColegio: pct, precioColegio, mensualSep: e.mensualSep, diferencia: r2(e.mensualSep - precioColegio) }
}

/** Más cara por al menos un peso al mes (evita avisos por redondeo). */
export const sepMasCara = (c: ComparativoBecaColegio | null): c is ComparativoBecaColegio => !!c && c.diferencia >= 1

export function calcularReversion(e: EntradaReversion): ResultadoReversion {
  const pct = Math.min(100, Math.max(0, Number(e.porcentajeBeca) || 0))
  const r = calcularProrrateo({
    porcentajeSep: pct,
    porcentajeBecaActual: 0,
    colegiaturaOficial: e.colegiaturaOficial,
    inscripcionOficial: 0,
    planMeses: e.planMeses,
    pagosColegiatura: e.pagosColegiatura,
    pagoInscripcionNeto: 0,
  })
  const pagados = new Set(r.detalleMeses.map((d) => d.conceptoNo))
  const porPagar = conceptosPlan(e.planMeses).filter((c) => !pagados.has(c))
  const n = porPagar.length
  const precio = r.colSep
  const exc = r.excedenteColegiatura
  const anioCompleto = n > 0 && exc >= precio * n
  const mensual = n === 0 ? null : anioCompleto ? 0 : r2(Math.max(0, precio - exc / n))
  return {
    precioConBeca: precio,
    mesesPagados: r.mesesPagados,
    mesesRestantes: n,
    excedente: exc,
    mensual,
    anioCompleto,
    saldoFavor: anioCompleto ? r2(exc - precio * n) : 0,
    porPagar,
    esperados: mensual == null ? {} : Object.fromEntries(porPagar.map((c) => [c, mensual])),
  }
}
