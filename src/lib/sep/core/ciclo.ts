// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Reglas de calendario escolar Winston (función pura, sin BD).
 *
 * Ciclo N = año escolar (2003+N)-(2004+N). Ej.: 22 = 2025-26, 23 = 2026-27.
 * Conceptos de pago (caracteres 6-7 de pago_referencia):
 *   01–10 = septiembre–junio, 26 = julio (plan de 11 meses), 11–13 = inscripción, 16 = material.
 * Cada colegiatura vence el día 10 de su mes; después se cobran $75 por mes de atraso.
 */

export const RECARGO_POR_MES = 75
export const DIA_LIMITE_PAGO = 10

/** 2026-10-03 — Regla de recargo de un ciclo: monto por mes de atraso y día límite de pago. */
export type ReglaCiclo = { recargoMes: number; diaLimite: number; confirmada: boolean }

/** Reglas confirmadas por ciclo; un ciclo nuevo debe agregarse aquí cuando Servicios Escolares la confirme. */
const REGLAS_CICLO: Record<number, Omit<ReglaCiclo, 'confirmada'>> = {
  22: { recargoMes: RECARGO_POR_MES, diaLimite: DIA_LIMITE_PAGO },
  23: { recargoMes: RECARGO_POR_MES, diaLimite: DIA_LIMITE_PAGO },
}

/** Regla del ciclo; si no está registrada usa la del último ciclo conocido anterior y marca `confirmada: false`. */
export function reglasCiclo(ciclo: number): ReglaCiclo {
  const exacta = REGLAS_CICLO[ciclo]
  if (exacta) return { ...exacta, confirmada: true }
  const anteriores = Object.keys(REGLAS_CICLO).map(Number).filter((c) => c < ciclo).sort((a, b) => b - a)
  const base = REGLAS_CICLO[anteriores[0] ?? Math.min(...Object.keys(REGLAS_CICLO).map(Number))]
  return { ...base, confirmada: false }
}

export type PlanMeses = 10 | 11

export const CONCEPTOS_INSCRIPCION = ['11', '12', '13'] as const
const CONCEPTOS_PRIMER_ANIO = new Set(['01', '02', '03', '04'])

/** Mes calendario (01–12) en que vence cada concepto de colegiatura. */
const MES_VENCIMIENTO: Record<string, string> = {
  '01': '09', '02': '10', '03': '11', '04': '12',
  '05': '01', '06': '02', '07': '03', '08': '04', '09': '05', '10': '06', '26': '07',
}

export const NOMBRE_CONCEPTO: Record<string, string> = {
  '01': 'Septiembre', '02': 'Octubre', '03': 'Noviembre', '04': 'Diciembre',
  '05': 'Enero', '06': 'Febrero', '07': 'Marzo', '08': 'Abril', '09': 'Mayo',
  '10': 'Junio', '26': 'Julio',
}

export const NOMBRE_NIVEL: Record<number, string> = {
  1: 'Maternal', 2: 'Kínder', 3: 'Primaria', 4: 'Secundaria',
}

export function normalizarConcepto(no: string | number): string {
  const s = String(no ?? '').replace(/\D/g, '')
  return s.padStart(2, '0').slice(-2)
}

/** Conceptos de colegiatura del plan, en orden de cobro. */
export function conceptosPlan(plan: PlanMeses): string[] {
  const base = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
  return plan === 11 ? [...base, '26'] : base
}

export const esConceptoInscripcion = (c: string) =>
  (CONCEPTOS_INSCRIPCION as readonly string[]).includes(normalizarConcepto(c))

export const anioInicioCiclo = (ciclo: number) => 2003 + ciclo

/** "2025-26" para el ciclo 22. */
export const etiquetaCiclo = (ciclo: number) =>
  `${anioInicioCiclo(ciclo)}-${String(anioInicioCiclo(ciclo) + 1).slice(2)}`

/** Ciclo vigente por fecha: cambia el 10 de julio (misma regla que el portal). */
export function cicloPorFecha(fecha: Date = new Date()): number {
  const y = fecha.getFullYear()
  const md = `${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  return md < '07-10' ? y - 2004 : y - 2003
}

/** Fecha a YYYY-MM-DD; acepta ISO, "YYYY-MM-DD HH:mm:ss" o Date. Cadena vacía si no es válida. */
export function fechaIso(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** Fecha límite (día 10) del concepto en el ciclo, o null si el concepto no es colegiatura. */
export function fechaLimiteConcepto(concepto: string, ciclo: number): string | null {
  const c = normalizarConcepto(concepto)
  const mes = MES_VENCIMIENTO[c]
  if (!mes) return null
  const anio = CONCEPTOS_PRIMER_ANIO.has(c) ? anioInicioCiclo(ciclo) : anioInicioCiclo(ciclo) + 1
  // 2026-10-03: el día límite sale de la regla del ciclo.
  return `${anio}-${mes}-${String(reglasCiclo(ciclo).diaLimite).padStart(2, '0')}`
}

/** Meses de atraso al pagar (0 si se pagó a tiempo o la fecha no es válida). */
export function mesesAtraso(concepto: string, fechaPago: unknown, ciclo: number): number {
  const f = fechaIso(fechaPago)
  const limite = fechaLimiteConcepto(concepto, ciclo)
  if (!f || !limite || f <= limite) return 0
  const meses =
    (Number(f.slice(0, 4)) - Number(limite.slice(0, 4))) * 12 + (Number(f.slice(5, 7)) - Number(limite.slice(5, 7)))
  return Math.max(1, meses)
}

/** Recargo que correspondía según la fecha de pago. */
export const recargoEsperado = (concepto: string, fechaPago: unknown, ciclo: number) =>
  mesesAtraso(concepto, fechaPago, ciclo) * reglasCiclo(ciclo).recargoMes
