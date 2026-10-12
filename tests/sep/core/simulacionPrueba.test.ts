// 2026-10-12: simulación de prueba completa plan y precios faltantes.
// 2026-10-12: además usa pagos de ejemplo (inscripción, cuota de inicio de curso, septiembre) y beca PEMEX 20 %,
//             ignorando los pagos/beca reales que leyera de la base.
import { describe, expect, test } from 'vitest'
import {
  BECA_SIMULACION_PRUEBA,
  becaSustituidaSimulacion,
  completarDatosSimulacionPrueba,
  PAGOS_SIMULACION_PRUEBA,
  PRECIOS_SIMULACION_PRUEBA,
  REF_PRUEBA_SIN_BECA,
} from '@/lib/sep/simulacionPrueba'
import { evaluarBeca, type DatosAlumnoCiclo } from '@/lib/sep/core/evaluar'

const hueco = (): DatosAlumnoCiclo => ({
  alumnoId: 2680, alumnoRef: 29905, nombre: 'PRUEBA', ciclo: 23, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: null, precios: null, pagos: [{ concepto: '01', importe: 9999, recargo: 0, fecha: '2026-09-05', cubiertos: 0 }],
  becaActualBase: 35,
})

describe('completarDatosSimulacionPrueba', () => {
  test('llena plan, precios, pagos de ejemplo y beca PEMEX 20 %', () => {
    const d = completarDatosSimulacionPrueba(hueco())
    expect(d.planBase).toBe(11)
    expect(d.precios).toEqual(PRECIOS_SIMULACION_PRUEBA)
    expect(d.pagos).toEqual(PAGOS_SIMULACION_PRUEBA)
    expect(d.becaActualBase).toBe(BECA_SIMULACION_PRUEBA.porcentaje)
  })

  test('septiembre se pagó con el 20 % de PEMEX y a tiempo', () => {
    const sep = PAGOS_SIMULACION_PRUEBA.find((p) => p.concepto === '01')
    expect(sep?.importe).toBe(3944)
    expect(sep?.recargo).toBe(0)
  })

  test('con 50 % SEP: prorratea el excedente de septiembre e inscripción; la cuota de inicio no cuenta', () => {
    const ev = evaluarBeca(completarDatosSimulacionPrueba(hueco()), { porcentajeSep: 50, porcentajeBecaActual: null, planMeses: null })
    expect(ev.bloqueada).toBe(false)
    expect(ev.becaActualPct).toBe(20)
    expect(ev.meses.map((m) => m.concepto)).toEqual(['01'])
    expect(ev.inscripcion?.neto).toBe(5490)
    expect(ev.resultado?.estado).toBe('prorrateo')
    expect(ev.resultado?.montoMensual).toBeGreaterThan(0)
    expect(ev.resultado?.montoMensual).toBeLessThan(4930 * 0.5)
  })
})

// 2026-10-12: ALAN PRUEBA (29904), segundo alumno de prueba sin beca previa.
describe('escenario sin beca (ALAN PRUEBA 29904)', () => {
  const alan = (): DatosAlumnoCiclo => ({ ...hueco(), alumnoId: 2683, alumnoRef: REF_PRUEBA_SIN_BECA })

  test('pagó septiembre a precio completo y no tenía beca', () => {
    const d = completarDatosSimulacionPrueba(alan())
    expect(d.becaActualBase).toBe(0)
    expect(d.pagos.find((p) => p.concepto === '01')?.importe).toBe(4930)
    expect(becaSustituidaSimulacion(23, REF_PRUEBA_SIN_BECA)).toBeNull()
    expect(becaSustituidaSimulacion(23, 29905)).toEqual({ ...BECA_SIMULACION_PRUEBA, ciclo: 23 })
  })

  test('con 50 % SEP: (2745 + 2465) ÷ 10 = 521 menos al mes → 1944', () => {
    const ev = evaluarBeca(completarDatosSimulacionPrueba(alan()), { porcentajeSep: 50, porcentajeBecaActual: null, planMeses: null })
    expect(ev.becaActualPct).toBe(0)
    expect(ev.resultado?.excedenteTotal).toBe(5210)
    expect(ev.resultado?.montoMensual).toBe(1944)
  })
})
