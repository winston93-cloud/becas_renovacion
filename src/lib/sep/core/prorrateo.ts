// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
// 2026-10-08 - DIFERENCIA con BECAS-SEP-NUEVO: aquí la beca SEP SIEMPRE sustituye a la beca actual
//              (aunque la actual sea mayor), por decisión de dirección. Allá se conserva la mayor.
/**
 * 2026-09-30 — Motor único de prorrateo de beca SEP (función pura, sin BD).
 * Reproduce la fórmula del Excel "Calculos de prorrateos 25-26" (103/108 casos al centavo;
 * los 5 restantes son errores de divisor del propio Excel).
 *
 *   colSep   = oficial × (1 − %SEP)
 *   excCol   = Σ (pagoNeto − colSep) sobre los meses pagados (los negativos restan)
 *   excIns   = max(0, inscripciónNeta − insSep)
 *   n        = mesesPlan − mesesPagados
 *   mensual  = max(0, colSep − (excCol + excIns) / n)
 *   Si excCol + excIns ≥ colSep × n → año completo y saldo a favor (devolución o abono).
 *
 * Los pagos deben llegar ya sin recargos (ver recargos.ts).
 */

import { conceptosPlan, normalizarConcepto, type PlanMeses } from './ciclo'
import { r2 } from './dinero'

export type EstadoProrrateo =
  | 'prorrateo'
  | 'anio_completo'
  /** 2026-10-08 - Ya no se produce (la SEP siempre sustituye); se conserva para cálculos guardados antes. */
  | 'beca_actual_mayor'
  | 'excluido_docente'
  | 'falta_octubre'
  | 'sin_meses_restantes'

/**
 * `cubierto`: mes registrado a mano con $0 (pago_cancelado = 3). Antes del último mes con
 * pago real cuenta como transcurrido sin excedente; después, lo paga el excedente (año completo).
 */
export type PagoMesNeto = { conceptoNo: string; neto: number; cubierto?: boolean }

export type EntradaProrrateo = {
  porcentajeSep: number
  porcentajeBecaActual?: number
  colegiaturaOficial: number
  inscripcionOficial: number
  planMeses: PlanMeses
  pagosColegiatura: PagoMesNeto[]
  pagoInscripcionNeto?: number | null
  /** Default false: el Excel prorratea también a quien solo lleva septiembre. */
  exigirOctubre?: boolean
  ajusteManual?: { monto: number; motivo: string } | null
}

export type DetalleMes = {
  conceptoNo: string
  neto: number
  colSep: number
  diferencia: number
  cubierto?: boolean
}

export type ResultadoProrrateo = {
  estado: EstadoProrrateo
  /** true si el alumno cobra con beca SEP (prorrateo o año completo). */
  aplicaSep: boolean
  colSep: number
  insSep: number
  mesesPlan: PlanMeses
  mesesPagados: number
  mesesRestantes: number
  excedenteColegiatura: number
  excedenteInscripcion: number
  excedenteTotal: number
  /** Resultado de la fórmula, antes del ajuste manual. */
  montoCalculado: number | null
  /** Monto a cobrar por mes (ajuste manual si existe). */
  montoMensual: number | null
  anioCompleto: boolean
  saldoFavor: number
  ajusteManualAplicado: boolean
  detalleMeses: DetalleMes[]
  mensajes: string[]
}

const CONCEPTO_OCTUBRE = '02'

export function calcularProrrateo(e: EntradaProrrateo): ResultadoProrrateo {
  const pctSep = Number(e.porcentajeSep) || 0
  const pctActual = Number(e.porcentajeBecaActual) || 0
  const colSep = r2(e.colegiaturaOficial - e.colegiaturaOficial * (pctSep / 100))
  const insSep = r2(e.inscripcionOficial - e.inscripcionOficial * (pctSep / 100))
  const conceptos = new Set(conceptosPlan(e.planMeses))
  const mensajes: string[] = []

  const porConcepto = new Map<string, number>()
  const cubiertos = new Set<string>()
  for (const p of e.pagosColegiatura) {
    const c = normalizarConcepto(p.conceptoNo)
    if (!conceptos.has(c)) continue
    if (p.cubierto) cubiertos.add(c)
    porConcepto.set(c, r2((porConcepto.get(c) ?? 0) + (Number(p.neto) || 0)))
  }
  const entradas = Array.from(porConcepto.entries())
  const ultimoConPago = Math.max(0, ...entradas.filter(([, n]) => n > 0).map(([c]) => Number(c)))
  const detalleMeses: DetalleMes[] = entradas
    .filter(([c, neto]) => neto > 0 || (cubiertos.has(c) && Number(c) < ultimoConPago))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([conceptoNo, neto]) =>
      neto > 0
        ? { conceptoNo, neto, colSep, diferencia: r2(neto - colSep) }
        : { conceptoNo, neto: 0, colSep, diferencia: 0, cubierto: true }
    )

  const mesesPagados = detalleMeses.length
  const mesesRestantes = Math.max(0, e.planMeses - mesesPagados)
  const excedenteColegiatura = r2(detalleMeses.reduce((s, d) => s + d.diferencia, 0))
  const pagoIns = Number(e.pagoInscripcionNeto) || 0
  const excedenteInscripcion = pagoIns > 0 ? r2(Math.max(0, pagoIns - insSep)) : 0
  const excedenteTotal = r2(excedenteColegiatura + excedenteInscripcion)

  const base = {
    colSep,
    insSep,
    mesesPlan: e.planMeses,
    mesesPagados,
    mesesRestantes,
    excedenteColegiatura,
    excedenteInscripcion,
    excedenteTotal,
    detalleMeses,
  }

  const sinSep = (estado: EstadoProrrateo, msg: string): ResultadoProrrateo => ({
    ...base,
    estado,
    aplicaSep: false,
    montoCalculado: null,
    montoMensual: null,
    anioCompleto: false,
    saldoFavor: 0,
    ajusteManualAplicado: false,
    mensajes: [...mensajes, msg],
  })

  if (pctActual >= 100) {
    return sinSep('excluido_docente', 'Beca actual del 100 %: no se calcula beca SEP.')
  }
  // 2026-10-08 - La beca SEP sustituye cualquier otra beca, aunque sea mayor (la familia lo acepta al subir
  //              el documento). Los meses pagados con la beca anterior se comparan contra el precio SEP.
  if (pctActual > 0) {
    mensajes.push(
      pctActual > pctSep
        ? `Pierde su beca actual (${pctActual} %), que era mayor que la SEP (${pctSep} %): se aplica solo la SEP.`
        : `Pierde su beca actual (${pctActual} %): se aplica solo la SEP (${pctSep} %).`
    )
  }
  if (e.exigirOctubre === true && !porConcepto.get(CONCEPTO_OCTUBRE)) {
    return sinSep('falta_octubre', 'Falta pagar la colegiatura de octubre para calcular el prorrateo.')
  }
  if (mesesRestantes <= 0) {
    return sinSep('sin_meses_restantes', 'Ya no quedan colegiaturas por prorratear en el ciclo.')
  }

  const cubreAnio = excedenteTotal >= colSep * mesesRestantes
  const montoFormula = cubreAnio ? 0 : r2(Math.max(0, colSep - excedenteTotal / mesesRestantes))
  const montoCalculado = Math.min(montoFormula, r2(e.colegiaturaOficial))
  if (montoFormula > montoCalculado) {
    mensajes.push(
      `La fórmula daba $${montoFormula.toFixed(2)} (meses pagados por debajo del precio SEP); se topa en la colegiatura oficial.`
    )
  }
  const saldoFavor = cubreAnio ? r2(excedenteTotal - colSep * mesesRestantes) : 0
  if (cubreAnio) {
    mensajes.push(
      saldoFavor > 0
        ? `El excedente cubre el año completo; saldo a favor de $${saldoFavor.toFixed(2)}.`
        : 'El excedente cubre exactamente el año completo.'
    )
  }

  const ajuste = e.ajusteManual
  const ajusteManualAplicado = ajuste != null && Number.isFinite(Number(ajuste.monto)) && Number(ajuste.monto) >= 0
  if (ajusteManualAplicado) mensajes.push(`Ajuste manual: ${ajuste!.motivo || 'sin motivo'}.`)

  return {
    ...base,
    estado: cubreAnio ? 'anio_completo' : 'prorrateo',
    aplicaSep: true,
    montoCalculado,
    montoMensual: ajusteManualAplicado ? r2(Number(ajuste!.monto)) : montoCalculado,
    anioCompleto: cubreAnio,
    saldoFavor,
    ajusteManualAplicado,
    mensajes,
  }
}

export const ETIQUETA_ESTADO: Record<EstadoProrrateo, string> = {
  prorrateo: 'Prorrateo',
  anio_completo: 'Año completo',
  beca_actual_mayor: 'Conserva su beca actual',
  excluido_docente: 'Docente 100 % (excluido)',
  falta_octubre: 'Falta octubre',
  sin_meses_restantes: 'Sin meses por prorratear',
}
