// 2026-10-12: resumen para la familia (correo y constancia) con la inscripción incluida.
import { describe, expect, test } from 'vitest'
import { completarDatosSimulacionPrueba } from '@/lib/sep/simulacionPrueba'
import { evaluarBeca, type DatosAlumnoCiclo } from '@/lib/sep/core/evaluar'
import { armarHojaCalculo, entradaDesdeEvaluacion } from '@/lib/sep/core/hojaCalculo'
import { periodoMeses, resumenFamiliaSep } from '@/lib/sep/core/resumenFamilia'

const hueco = (): DatosAlumnoCiclo => ({
  alumnoId: 2680, alumnoRef: 29905, nombre: 'PRUEBA', ciclo: 23, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: null, precios: null, pagos: [], becaActualBase: 0,
})

function resumen(pct: number, ajuste?: number) {
  const ev = evaluarBeca(completarDatosSimulacionPrueba(hueco()), { porcentajeSep: pct, porcentajeBecaActual: null, planMeses: null })
  const entrada = entradaDesdeEvaluacion(ev, pct)!
  const hoja = armarHojaCalculo(entrada)
  return resumenFamiliaSep(entrada, hoja.mesesPorPagar, ajuste)
}

describe('resumenFamiliaSep', () => {
  test('50 %: inscripción y septiembre a favor, repartidos en 10 meses', () => {
    const r = resumen(50)
    expect(r.inscripcionConSep).toBe(2745)
    expect(r.colegiaturaConSep).toBe(2465)
    expect(r.pagados).toEqual([
      { concepto: 'Inscripción', pago: 5490, conSep: 2745, diferencia: 2745 },
      { concepto: 'Septiembre', pago: 3944, conSep: 2465, diferencia: 1479 },
    ])
    expect(r.saldo).toBe(4224)
    expect(r.mesesPorPagar).toHaveLength(10)
    expect(periodoMeses(r.mesesPorPagar)).toBe('Octubre a Julio')
    expect(r.porMes).toBe(422.4)
    expect(r.mensual).toBe(2042.6)
    expect(r.topada).toBe(false)
  })

  test('10 %: septiembre quedó por debajo del precio SEP (saldo en contra parcial)', () => {
    const r = resumen(10)
    expect(r.pagados[1].diferencia).toBe(-493)
    expect(r.saldo).toBe(56)
    expect(r.mensual).toBe(4431.4)
  })

  test('100 %: año completo, sin reparto por mes y con saldo al final', () => {
    const r = resumen(100)
    expect(r.anioCompleto).toBe(true)
    expect(r.porMes).toBeNull()
    expect(r.mensual).toBe(0)
    expect(r.saldoAlFinal).toBe(9434)
  })

  test('ajuste de Dirección General: se cobra el ajuste', () => {
    expect(resumen(50, 2000).mensual).toBe(2000)
  })
})
