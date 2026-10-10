// 2026-09-30: evaluación completa (datos crudos → neto sin recargo → prorrateo → alertas).
import { beforeAll, describe, expect, test } from 'vitest'
import { fijarCasosConocidos } from '@/lib/sep/core/casosConocidos'
import { evaluarBeca, type DatosAlumnoCiclo } from '@/lib/sep/core/evaluar'

// 2026-10-10 - Casos ficticios: la lista real no se publica.
beforeAll(() => {
  fijarCasosConocidos([
    { alumnoRef: 90603, ciclo: 22, tipo: 'monto_manual_excel', resolucion: 'revision', mensaje: 'Caso de prueba.' },
    { alumnoRef: 91313, ciclo: 22, tipo: 'error_divisor_excel', resolucion: 'automatica', montoExcel: 3538, montoMotor: 3485.71, mensaje: 'Caso de prueba.' },
  ])
})

const base = (over: Partial<DatosAlumnoCiclo> = {}): DatosAlumnoCiclo => ({
  alumnoId: 1, alumnoRef: 99999, nombre: 'Prueba', ciclo: 22, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: 10,
  precios: { colegiatura10: 4880, colegiatura11: 4400, inscripcion: 5083 },
  pagos: [], becaActualBase: null, ...over,
})

describe('evaluarBeca', () => {
  test('recargo sumado en el importe se quita y no cuenta como excedente', () => {
    const ev = evaluarBeca(
      base({
        pagos: [
          { concepto: '01', importe: 4148, recargo: 0, fecha: '2025-09-05', cubiertos: 0 },
          { concepto: '02', importe: 4223, recargo: 0, fecha: '2025-10-20', cubiertos: 0 },
          { concepto: '11', importe: 3812, recargo: 0, fecha: '2025-07-01', cubiertos: 0 },
        ],
      }),
      { porcentajeSep: 20, porcentajeBecaActual: 15, planMeses: 10 }
    )
    expect(ev.meses[1].neto).toBe(4148)
    expect(ev.recargosQuitados).toBe(75)
    expect(ev.resultado?.montoMensual).toBe(3843)
    expect(ev.alertas.some((a) => a.codigo === 'recargos_quitados')).toBe(true)
  })

  test('pago con $600 menos genera alerta visible', () => {
    const ev = evaluarBeca(
      base({ pagos: [{ concepto: '01', importe: 4280, recargo: 0, fecha: '2025-09-05', cubiertos: 0 }] }),
      { porcentajeSep: 20, porcentajeBecaActual: 0, planMeses: 10 }
    )
    expect(ev.alertas.find((a) => a.codigo === 'pago_600_menos')?.nivel).toBe('advertencia')
  })

  test('cambio de nivel informa y usa el nivel del ciclo', () => {
    const ev = evaluarBeca(base({ nivelCiclo: 2, nivelActual: 3 }), { porcentajeSep: 20, porcentajeBecaActual: 0, planMeses: 10 })
    expect(ev.alertas.some((a) => a.codigo === 'nivel_cambiado')).toBe(true)
  })

  test('caso conocido del Excel (90603) bloquea la aprobación', () => {
    const ev = evaluarBeca(base({ alumnoRef: 90603 }), { porcentajeSep: 90, porcentajeBecaActual: 20, planMeses: 10 })
    expect(ev.bloqueada).toBe(true)
    expect(ev.alertas.some((a) => a.codigo === 'caso_conocido' && a.nivel === 'bloqueante')).toBe(true)
  })

  test('error de divisor del Excel se resuelve automáticamente (no bloquea)', () => {
    const ev = evaluarBeca(base({ alumnoRef: 91313 }), { porcentajeSep: 20, porcentajeBecaActual: 0, planMeses: 10, montoExcel: 3538 })
    expect(ev.bloqueada).toBe(false)
  })

  test('sin porcentaje SEP no calcula y bloquea', () => {
    const ev = evaluarBeca(base(), { porcentajeSep: null, porcentajeBecaActual: 0, planMeses: 10 })
    expect(ev.listo).toBe(false)
    expect(ev.bloqueada).toBe(true)
  })

  test('ciclo pasado sin beca actual capturada pide capturarla', () => {
    const ev = evaluarBeca(base(), { porcentajeSep: 20, porcentajeBecaActual: null, planMeses: 10 })
    expect(ev.alertas.some((a) => a.codigo === 'sin_beca_actual_registrada')).toBe(true)
  })

  test('mes de corte limita los meses considerados', () => {
    const pagos = ['01', '02', '03'].map((c) => ({ concepto: c, importe: 4148, recargo: 0, fecha: '2025-08-01', cubiertos: 0 }))
    const ev = evaluarBeca(base({ pagos }), { porcentajeSep: 20, porcentajeBecaActual: 15, planMeses: 10, mesCorte: '02' })
    expect(ev.resultado?.mesesPagados).toBe(2)
  })

  // 2026-09-30: diferencias de pagos contra el Excel quedan explicadas.
  test('pagos distintos a los del Excel generan advertencia mes por mes', () => {
    const pagos = [
      { concepto: '01', importe: 3608, recargo: 0, fecha: '2025-09-05', cubiertos: 0 },
      { concepto: '02', importe: 4208, recargo: 0, fecha: '2025-10-05', cubiertos: 0 },
    ]
    const ev = evaluarBeca(base({ pagos }), {
      porcentajeSep: 20, porcentajeBecaActual: 20, planMeses: 10, pagosExcel: { '01': 4208, '02': 4208 },
    })
    const a = ev.alertas.find((x) => x.codigo === 'pagos_distintos_excel')
    expect(a?.nivel).toBe('advertencia')
    expect(a?.mensaje).toContain('Septiembre')
    expect(a?.mensaje).not.toContain('Octubre')
    const igual = evaluarBeca(base({ pagos }), {
      porcentajeSep: 20, porcentajeBecaActual: 20, planMeses: 10, pagosExcel: { '01': 3608, '02': 4208 },
    })
    expect(igual.alertas.some((x) => x.codigo === 'pagos_distintos_excel')).toBe(false)
  })

  test('mes cubierto a mano (pago_cancelado = 3, $0) se reconoce', () => {
    const ev = evaluarBeca(
      base({
        pagos: [
          { concepto: '01', importe: 0, recargo: 0, fecha: '', cubiertos: 1 },
          { concepto: '02', importe: 4148, recargo: 0, fecha: '2025-10-05', cubiertos: 0 },
        ],
      }),
      { porcentajeSep: 20, porcentajeBecaActual: 15, planMeses: 10 }
    )
    expect(ev.resultado?.mesesPagados).toBe(2)
  })
})
