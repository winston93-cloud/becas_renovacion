// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Alertas visibles para Servicios Escolares (función pura).
 *
 * nivel:
 *   - 'bloqueante': no se puede aprobar sin confirmar que se revisó (y escribir justificación).
 *   - 'advertencia': se muestra resaltada; no impide aprobar.
 *   - 'info': contexto útil.
 */

import { NOMBRE_CONCEPTO, NOMBRE_NIVEL } from './ciclo'
import { igualCentavo, pesos, r2 } from './dinero'
import type { CasoConocido } from './casosConocidos'
import type { ResultadoProrrateo } from './prorrateo'
import type { ResultadoPagoNeto } from './recargos'

export type NivelAlerta = 'bloqueante' | 'advertencia' | 'info'

export type CodigoAlerta =
  | 'sin_porcentaje'
  | 'sin_precios'
  | 'sin_plan'
  | 'caso_conocido'
  | 'pago_600_menos'
  | 'pago_incompleto'
  | 'nivel_cambiado'
  | 'diferencia_excel'
  | 'diferencia_portal'
  | 'monto_topado'
  | 'anio_completo'
  | 'recargos_quitados'
  | 'sin_beca_actual_registrada'
  | 'pagos_distintos_excel'
  | 'precios_sospechosos'
  | 'regla_ciclo_sin_confirmar'

export type Alerta = { codigo: CodigoAlerta; nivel: NivelAlerta; mensaje: string }

export type MesEvaluado = ResultadoPagoNeto & { concepto: string; fecha: string; cubierto: boolean; recargoEsperado: number }

export type EntradaAlertas = {
  resultado: ResultadoProrrateo | null
  meses: MesEvaluado[]
  preciosBase: number[]
  recargosTotales: number
  nivelCiclo: number | null
  nivelActual: number | null
  cicloEsPasado: boolean
  becaActualDeRespaldoLocal: boolean
  caso: CasoConocido | null
  montoExcel: number | null
  montoPortal: number | null
  faltantes: { porcentaje: boolean; precios: boolean; plan: boolean }
  /** 2026-09-30: pagos por concepto que usó el Excel (solo becas importadas). */
  pagosExcel?: Record<string, number> | null
  /** 2026-10-03: problemas de `revisarPrecios` en los precios del ciclo. */
  avisosPrecios?: string[]
  /** 2026-10-03: el ciclo no tiene regla de recargo registrada (se usó la del ciclo anterior). */
  reglaSinConfirmar?: boolean
}

const DIFERENCIA_600 = 600
const TOL = 2

export function detectarAlertas(e: EntradaAlertas): Alerta[] {
  const a: Alerta[] = []
  if (e.faltantes.porcentaje) a.push({ codigo: 'sin_porcentaje', nivel: 'bloqueante', mensaje: 'Falta capturar el porcentaje de beca SEP.' })
  if (e.faltantes.plan) a.push({ codigo: 'sin_plan', nivel: 'bloqueante', mensaje: 'El alumno no tiene plan de pagos (10 u 11 meses).' })
  if (e.faltantes.precios) a.push({ codigo: 'sin_precios', nivel: 'bloqueante', mensaje: 'No hay precios oficiales para su nivel en el ciclo.' })
  // 2026-10-03: precios del ciclo nuevo sin validar todavía.
  if (e.avisosPrecios?.length) {
    a.push({ codigo: 'precios_sospechosos', nivel: 'advertencia', mensaje: `Revisar precios oficiales: ${e.avisosPrecios.join(' ')}` })
  }
  if (e.reglaSinConfirmar) {
    a.push({
      codigo: 'regla_ciclo_sin_confirmar',
      nivel: 'info',
      mensaje: 'El ciclo no tiene regla de recargo confirmada; se usó la del ciclo anterior ($ por mes y día límite).',
    })
  }

  if (e.caso) {
    a.push({ codigo: 'caso_conocido', nivel: e.caso.resolucion === 'revision' ? 'bloqueante' : 'info', mensaje: e.caso.mensaje })
  }

  const r = e.resultado
  if (r) {
    for (const m of e.meses) {
      if (m.cubierto || m.neto <= 0) continue
      const nombre = NOMBRE_CONCEPTO[m.concepto] ?? m.concepto
      const base600 = e.preciosBase.find((b) => Math.abs(b - m.neto - DIFERENCIA_600) <= TOL)
      if (base600 != null) {
        a.push({
          codigo: 'pago_600_menos',
          nivel: 'advertencia',
          mensaje: `${nombre}: pagó ${pesos(m.neto)}, justo $600 menos que ${pesos(base600)}. ¿Parte del pago quedó en otro concepto? Revisar antes de aprobar.`,
        })
      } else if (m.neto < r.colSep - TOL) {
        a.push({
          codigo: 'pago_incompleto',
          nivel: 'advertencia',
          mensaje: `${nombre}: pagó ${pesos(m.neto)}, menos que la colegiatura con SEP (${pesos(r.colSep)}). Ese faltante reduce el excedente.`,
        })
      }
    }
    if (r.mensajes.some((t) => t.includes('se topa'))) {
      a.push({ codigo: 'monto_topado', nivel: 'advertencia', mensaje: 'Los meses pagados quedaron por debajo del precio SEP; la mensualidad se limitó a la colegiatura oficial.' })
    }
    if (r.anioCompleto) {
      a.push({
        codigo: 'anio_completo',
        nivel: 'info',
        mensaje:
          r.saldoFavor > 0
            ? `Año completo: no paga más colegiaturas y tiene ${pesos(r.saldoFavor)} a favor. Genera la orden de devolución o abono al aprobar.`
            : 'Año completo: el excedente cubre exactamente lo que falta.',
      })
    }
    // 2026-09-30: explica diferencias con el Excel mes por mes (pago distinto en la base).
    if (e.pagosExcel) {
      const netos = new Map(e.meses.map((m) => [m.concepto, m.neto]))
      const distintos = Object.entries(e.pagosExcel)
        .filter(([c, v]) => Math.abs((netos.get(c) ?? 0) - v) > TOL)
        .map(([c, v]) => `${NOMBRE_CONCEPTO[c] ?? c}: Excel ${pesos(v)}, base ${pesos(netos.get(c) ?? 0)}`)
      if (distintos.length) {
        a.push({
          codigo: 'pagos_distintos_excel',
          nivel: 'advertencia',
          mensaje: `Los pagos de la base no son los que usó el Excel (${distintos.join('; ')}). Por eso el monto puede no coincidir.`,
        })
      }
    }
    const monto = r.montoMensual
    if (monto != null && e.montoExcel != null && !igualCentavo(monto, e.montoExcel, 0.02)) {
      const automatica = e.caso?.resolucion === 'automatica'
      a.push({
        codigo: 'diferencia_excel',
        nivel: automatica ? 'info' : 'advertencia',
        mensaje: `El Excel dice ${pesos(e.montoExcel)} y el sistema calcula ${pesos(monto)} (diferencia ${pesos(r2(monto - e.montoExcel))}).`,
      })
    }
    if (monto != null && e.montoPortal != null && !igualCentavo(monto, e.montoPortal, 0.02)) {
      a.push({
        codigo: 'diferencia_portal',
        nivel: 'info',
        mensaje: `El portal cobra hoy ${pesos(e.montoPortal)}; con este cálculo serían ${pesos(monto)}.`,
      })
    }
  }

  if (e.nivelCiclo != null && e.nivelActual != null && e.nivelCiclo !== e.nivelActual) {
    a.push({
      codigo: 'nivel_cambiado',
      nivel: 'info',
      mensaje: `En ese ciclo estaba en ${NOMBRE_NIVEL[e.nivelCiclo] ?? e.nivelCiclo} (hoy en ${NOMBRE_NIVEL[e.nivelActual] ?? e.nivelActual}); se usan los precios de ${NOMBRE_NIVEL[e.nivelCiclo] ?? e.nivelCiclo}.`,
    })
  }
  if (e.cicloEsPasado && !e.becaActualDeRespaldoLocal) {
    a.push({
      codigo: 'sin_beca_actual_registrada',
      nivel: 'advertencia',
      mensaje: 'La base solo guarda becas Winston del ciclo vigente. Captura la beca actual que tenía en ese ciclo.',
    })
  }
  if (e.recargosTotales > 0) {
    a.push({ codigo: 'recargos_quitados', nivel: 'info', mensaje: `Se quitaron ${pesos(e.recargosTotales)} de recargos; no cuentan para el cálculo.` })
  }
  return a
}

export const hayBloqueantes = (alertas: Alerta[]) => alertas.some((x) => x.nivel === 'bloqueante')
