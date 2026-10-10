// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Evaluación completa de una beca SEP (función pura).
 * Recibe los datos crudos del alumno (ya leídos de InsForge) y la configuración de la beca;
 * devuelve pagos netos por mes, resultado del prorrateo, alertas y un resumen para la pantalla.
 */

import { conceptosPlan, esConceptoInscripcion, normalizarConcepto, recargoEsperado, reglasCiclo, type PlanMeses } from './ciclo'
import { r2 } from './dinero'
import { revisarPrecios, type PreciosNivel } from './precios'
import { detectarAlertas, hayBloqueantes, type Alerta, type MesEvaluado } from './alertas'
import { casoConocido } from './casosConocidos'
import { calcularProrrateo, type ResultadoProrrateo } from './prorrateo'
import { pagoNetoSinRecargo, preciosBaseCandidatos, type ResultadoPagoNeto } from './recargos'

/** Pagos de un concepto agrupados (una fila por concepto del ciclo). */
export type FilaPagoConcepto = {
  concepto: string
  importe: number
  recargo: number
  /** Última fecha de pago del concepto. */
  fecha: string
  /** Filas con pago_cancelado = 3 (mes cubierto a mano). */
  cubiertos: number
}

export type DatosAlumnoCiclo = {
  alumnoId: number
  alumnoRef: number
  nombre: string
  ciclo: number
  cicloVigente: number
  nivelCiclo: number | null
  nivelActual: number | null
  /** Plan leído de la base (solo confiable en el ciclo vigente). */
  planBase: PlanMeses | null
  precios: PreciosNivel | null
  /** 2026-10-03: precios del mismo nivel en el ciclo anterior, para detectar capturas raras. */
  preciosAnterior?: PreciosNivel | null
  pagos: FilaPagoConcepto[]
  /** Beca Winston/convenio leída de la base (solo existe para el ciclo vigente). */
  becaActualBase: number | null
}

export type ConfiguracionBeca = {
  porcentajeSep: number | null
  /** Captura manual; tiene prioridad sobre la base (necesaria en ciclos pasados). */
  porcentajeBecaActual: number | null
  /** Captura manual; tiene prioridad sobre la base. */
  planMeses: PlanMeses | null
  /** Solo cuentan los meses hasta este concepto (incluido); null = todos. */
  mesCorte?: string | null
  montoAprobado?: number | null
  montoExcel?: number | null
  montoPortal?: number | null
  /** 2026-09-30: pagos por concepto del Excel, para explicar diferencias. */
  pagosExcel?: Record<string, number> | null
}

export type Evaluacion = {
  listo: boolean
  planMeses: PlanMeses | null
  becaActualPct: number
  colegiaturaOficial: number | null
  inscripcionOficial: number | null
  meses: MesEvaluado[]
  inscripcion: ResultadoPagoNeto | null
  resultado: ResultadoProrrateo | null
  recargosQuitados: number
  alertas: Alerta[]
  bloqueada: boolean
}

export function evaluarBeca(datos: DatosAlumnoCiclo, cfg: ConfiguracionBeca): Evaluacion {
  const planMeses = cfg.planMeses ?? datos.planBase
  const pctSep = cfg.porcentajeSep
  const becaActualLocal = cfg.porcentajeBecaActual != null
  const becaActualPct = cfg.porcentajeBecaActual ?? datos.becaActualBase ?? 0
  const cicloEsPasado = datos.ciclo < datos.cicloVigente

  const colegiaturaOficial = datos.precios && planMeses ? (planMeses === 11 ? datos.precios.colegiatura11 : datos.precios.colegiatura10) : null
  const inscripcionOficial = datos.precios?.inscripcion ?? null
  const faltantes = {
    porcentaje: pctSep == null,
    plan: planMeses == null,
    precios: !colegiaturaOficial || !inscripcionOficial,
  }

  // 2026-10-03: los casos del Excel solo aplican a su ciclo; recargo y precios se validan por ciclo.
  const caso = casoConocido(datos.alumnoRef, datos.ciclo)
  const regla = reglasCiclo(datos.ciclo)
  const baseAlertas = {
    avisosPrecios: revisarPrecios(datos.precios, datos.preciosAnterior),
    reglaSinConfirmar: !regla.confirmada,
    nivelCiclo: datos.nivelCiclo,
    nivelActual: datos.nivelActual,
    cicloEsPasado,
    becaActualDeRespaldoLocal: becaActualLocal,
    caso,
    montoExcel: cfg.montoExcel ?? null,
    montoPortal: cfg.montoPortal ?? null,
    pagosExcel: cfg.pagosExcel ?? null,
    faltantes,
  }

  if (faltantes.porcentaje || faltantes.plan || faltantes.precios || !planMeses || !colegiaturaOficial || !inscripcionOficial || pctSep == null) {
    const alertas = detectarAlertas({ ...baseAlertas, resultado: null, meses: [], preciosBase: [], recargosTotales: 0 })
    return {
      listo: false, planMeses, becaActualPct, colegiaturaOficial, inscripcionOficial,
      meses: [], inscripcion: null, resultado: null, recargosQuitados: 0, alertas, bloqueada: true,
    }
  }

  const plan = conceptosPlan(planMeses)
  const idxCorte = cfg.mesCorte ? plan.indexOf(normalizarConcepto(cfg.mesCorte)) : -1
  const conceptosValidos = new Set(idxCorte >= 0 ? plan.slice(0, idxCorte + 1) : plan)
  const colSep = r2(colegiaturaOficial * (1 - pctSep / 100))
  const preciosBase = preciosBaseCandidatos({
    precioOficial: colegiaturaOficial,
    becaActualPct,
    colSep,
    montoAprobadoSep: cfg.montoAprobado ?? null,
  })

  const meses: MesEvaluado[] = []
  let insBruto = 0
  let insRecargo = 0
  for (const f of datos.pagos) {
    const concepto = normalizarConcepto(f.concepto)
    if (esConceptoInscripcion(concepto)) {
      insBruto += Number(f.importe) || 0
      insRecargo += Number(f.recargo) || 0
      continue
    }
    if (!conceptosValidos.has(concepto)) continue
    const importe = Number(f.importe) || 0
    const cubierto = importe <= 0 && f.cubiertos > 0
    if (importe <= 0 && !cubierto) continue
    const esperado = recargoEsperado(concepto, f.fecha, datos.ciclo)
    const neto = pagoNetoSinRecargo({
      importeBruto: importe,
      recargoSeparado: f.recargo,
      precioOficial: colegiaturaOficial,
      preciosBase,
      recargoEsperado: esperado,
      recargoMes: regla.recargoMes,
    })
    meses.push({ concepto, fecha: f.fecha, cubierto, recargoEsperado: esperado, ...neto })
  }
  meses.sort((a, b) => plan.indexOf(a.concepto) - plan.indexOf(b.concepto))

  const inscripcion = pagoNetoSinRecargo({
    importeBruto: insBruto,
    recargoSeparado: insRecargo,
    precioOficial: inscripcionOficial,
    detectarMultiplos: false,
  })

  const resultado = calcularProrrateo({
    porcentajeSep: pctSep,
    porcentajeBecaActual: becaActualPct,
    colegiaturaOficial,
    inscripcionOficial,
    planMeses,
    pagosColegiatura: meses.map((m) => ({ conceptoNo: m.concepto, neto: m.neto, cubierto: m.cubierto })),
    pagoInscripcionNeto: inscripcion.neto,
  })

  const recargosQuitados = r2(meses.reduce((s, m) => s + m.recargoTotal, 0) + inscripcion.recargoTotal)
  const alertas = detectarAlertas({ ...baseAlertas, resultado, meses, preciosBase, recargosTotales: recargosQuitados })

  return {
    listo: true, planMeses, becaActualPct, colegiaturaOficial, inscripcionOficial,
    meses, inscripcion, resultado, recargosQuitados, alertas, bloqueada: hayBloqueantes(alertas),
  }
}
