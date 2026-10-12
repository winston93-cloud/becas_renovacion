// 2026-10-12: simulación de prueba no inventa pagos ni beca; solo completa plan y precios faltantes.
import { describe, expect, test } from 'vitest'
import { completarDatosSimulacionPrueba, PRECIOS_SIMULACION_PRUEBA } from '@/lib/sep/simulacionPrueba'
import { evaluarBeca, type DatosAlumnoCiclo } from '@/lib/sep/core/evaluar'

const hueco = (): DatosAlumnoCiclo => ({
  alumnoId: 2680, alumnoRef: 29905, nombre: 'PRUEBA', ciclo: 23, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: null, precios: null, pagos: [{ concepto: '01', importe: 9999, recargo: 0, fecha: '2026-09-05', cubiertos: 0 }],
  becaActualBase: 20,
})

describe('completarDatosSimulacionPrueba', () => {
  test('llena plan y precios y borra pagos/beca para no fingir dinero', () => {
    const d = completarDatosSimulacionPrueba(hueco())
    expect(d.planBase).toBe(11)
    expect(d.precios).toEqual(PRECIOS_SIMULACION_PRUEBA)
    expect(d.pagos).toEqual([])
    expect(d.becaActualBase).toBeNull()
  })

  test('con 50 % el motor ya no bloquea por falta de plan o precios', () => {
    const ev = evaluarBeca(completarDatosSimulacionPrueba(hueco()), { porcentajeSep: 50, porcentajeBecaActual: null, planMeses: null })
    expect(ev.bloqueada).toBe(false)
    expect(ev.alertas.some((a) => a.codigo === 'sin_plan' || a.codigo === 'sin_precios')).toBe(false)
    expect(ev.resultado?.montoMensual).toBeGreaterThan(0)
  })
})
