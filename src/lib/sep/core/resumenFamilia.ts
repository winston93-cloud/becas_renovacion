/**
 * 2026-10-12 - Resumen del cálculo de Beca SEP para la familia (correo y constancia PDF), en tres pasos:
 *   1) precios con Beca SEP (inscripción y colegiatura),
 *   2) lo que ya pagó contra esos precios (inscripción incluida),
 *   3) cómo se reparte el saldo en los meses que faltan → nueva mensualidad.
 * No calcula nada nuevo: ordena lo que ya resolvió prorrateo.ts.
 */
import { NOMBRE_CONCEPTO } from './ciclo'
import { r2 } from './dinero'
import type { EntradaHoja } from './hojaCalculo'

export type RenglonPagado = { concepto: string; pago: number; conSep: number; diferencia: number }

export type ResumenFamiliaSep = {
  porcentajeSep: number
  inscripcionOficial: number
  inscripcionConSep: number
  colegiaturaOficial: number
  colegiaturaConSep: number
  pagados: RenglonPagado[]
  /** Positivo = a favor de la familia; negativo = le faltó pagar. */
  saldo: number
  mesesPorPagar: string[]
  /** Saldo repartido entre los meses que faltan (positivo = se descuenta de cada mes). */
  porMes: number | null
  mensualCalculada: number | null
  /** Lo que se cobra: ajuste de Dirección General si existe. */
  mensual: number | null
  anioCompleto: boolean
  saldoAlFinal: number
  /** La fórmula daba más que la colegiatura oficial y se cobró la oficial. */
  topada: boolean
}

export function resumenFamiliaSep(e: EntradaHoja, mesesPorPagar: string[], ajusteManual?: number | null): ResumenFamiliaSep {
  const r = e.resultado
  const pagados: RenglonPagado[] = []
  const pagoIns = e.inscripcion?.neto ?? 0
  if (pagoIns > 0) {
    pagados.push({ concepto: 'Inscripción', pago: pagoIns, conSep: r.insSep, diferencia: r.excedenteInscripcion })
  }
  for (const m of r.detalleMeses) {
    pagados.push({
      concepto: NOMBRE_CONCEPTO[m.conceptoNo] ?? m.conceptoNo,
      pago: m.neto,
      conSep: m.colSep,
      diferencia: m.diferencia,
    })
  }
  const n = mesesPorPagar.length
  const porMes = n > 0 && !r.anioCompleto ? r2(r.excedenteTotal / n) : null
  return {
    porcentajeSep: e.porcentajeSep,
    inscripcionOficial: e.inscripcionOficial,
    inscripcionConSep: r.insSep,
    colegiaturaOficial: e.colegiaturaOficial,
    colegiaturaConSep: r.colSep,
    pagados,
    saldo: r.excedenteTotal,
    mesesPorPagar,
    porMes,
    mensualCalculada: r.montoCalculado,
    mensual: ajusteManual ?? r.montoMensual,
    anioCompleto: r.anioCompleto,
    saldoAlFinal: r.saldoFavor,
    topada: porMes != null && r.montoCalculado != null && r2(r.colSep - porMes) > r.montoCalculado + 0.01,
  }
}

/** "Octubre a Julio" / "Octubre" / "—". */
export const periodoMeses = (meses: string[]) =>
  meses.length === 0 ? '—' : meses.length === 1 ? meses[0] : `${meses[0]} a ${meses[meses.length - 1]}`
