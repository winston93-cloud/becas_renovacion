// 2026-09-30: motor de prorrateo (fórmula del Excel, año completo, exclusiones y meses cubiertos).
import { describe, expect, test } from 'vitest'
import { calcularProrrateo, type EntradaProrrateo } from '@/lib/sep/core/prorrateo'

describe('calcularProrrateo', () => {
  test('ejemplo A: beca actual 15 %, SEP 20 % → $3,843 al mes', () => {
    const r = calcularProrrateo({
      porcentajeSep: 20, porcentajeBecaActual: 15, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10,
      pagosColegiatura: [{ conceptoNo: '01', neto: 4148 }, { conceptoNo: '02', neto: 4148 }],
      pagoInscripcionNeto: 3812,
    })
    expect(r.estado).toBe('prorrateo')
    expect(r.excedenteInscripcion).toBe(0)
    expect(r.mesesRestantes).toBe(8)
    expect(r.montoMensual).toBe(3843)
    expect(r.montoMensual! * 8).toBe(30744)
  })

  test('ejemplo B (90603): beca actual 20 %, SEP 90 % → año completo y $6,231.70 a favor', () => {
    const r = calcularProrrateo({
      porcentajeSep: 90, porcentajeBecaActual: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10,
      pagosColegiatura: [{ conceptoNo: '01', neto: 3904 }, { conceptoNo: '02', neto: 3904 }],
      pagoInscripcionNeto: 3812,
    })
    expect(r.estado).toBe('anio_completo')
    expect(r.colSep).toBe(488)
    expect(r.excedenteColegiatura).toBe(6832)
    expect(r.excedenteInscripcion).toBe(3303.7)
    expect(r.montoMensual).toBe(0)
    expect(r.saldoFavor).toBe(6231.7)
  })

  test('volver a calcular tras pagar el monto aprobado no cambia el monto', () => {
    const pagos = [{ conceptoNo: '01', neto: 4148 }, { conceptoNo: '02', neto: 4148 }]
    const base: EntradaProrrateo = { porcentajeSep: 20, porcentajeBecaActual: 15, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: pagos }
    const inicial = calcularProrrateo(base).montoMensual!
    const tras = calcularProrrateo({ ...base, pagosColegiatura: [...pagos, { conceptoNo: '03', neto: inicial }, { conceptoNo: '04', neto: inicial }] })
    expect(tras.montoMensual).toBe(inicial)
    expect(tras.mesesRestantes).toBe(6)
  })

  // 2026-10-09 - Regla nueva: la SEP sustituye a la beca actual aunque sea mayor; lo pagado de menos sube la mensualidad.
  test('beca actual mayor que la SEP: la pierde y se aplica la SEP', () => {
    const r = calcularProrrateo({ porcentajeSep: 20, porcentajeBecaActual: 40, colegiaturaOficial: 5260, inscripcionOficial: 5520, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 3156 }] })
    expect(r.estado).toBe('prorrateo')
    expect(r.aplicaSep).toBe(true)
    expect(r.montoMensual).toBeGreaterThan(4208)
  })

  test('beca actual igual a la SEP: sí prorratea (solo excluye si es mayor)', () => {
    const r = calcularProrrateo({ porcentajeSep: 20, porcentajeBecaActual: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 3904 }] })
    expect(r.estado).toBe('prorrateo')
  })

  test('docente 100 % excluido', () => {
    const r = calcularProrrateo({ porcentajeSep: 0, porcentajeBecaActual: 100, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: [] })
    expect(r.estado).toBe('excluido_docente')
  })

  test('octubre no se exige por defecto (criterio del Excel)', () => {
    const entrada: EntradaProrrateo = { porcentajeSep: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 4880 }] }
    expect(calcularProrrateo(entrada).estado).toBe('prorrateo')
    expect(calcularProrrateo({ ...entrada, exigirOctubre: true }).estado).toBe('falta_octubre')
  })

  test('ajuste manual sustituye el monto y conserva el calculado', () => {
    const r = calcularProrrateo({ porcentajeSep: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 3904 }], ajusteManual: { monto: 3500, motivo: 'Acuerdo con dirección' } })
    expect(r.montoCalculado).toBe(3904)
    expect(r.montoMensual).toBe(3500)
    expect(r.ajusteManualAplicado).toBe(true)
  })

  test('plan de 11 meses incluye julio (26) y material (16) no cuenta', () => {
    const r = calcularProrrateo({ porcentajeSep: 20, colegiaturaOficial: 4400, inscripcionOficial: 5083, planMeses: 11, pagosColegiatura: [{ conceptoNo: '01', neto: 4400 }, { conceptoNo: '16', neto: 900 }] })
    expect(r.mesesPagados).toBe(1)
    expect(r.mesesRestantes).toBe(10)
    expect(r.montoMensual).toBe(3432)
  })

  test('un mes pagado de menos resta del excedente', () => {
    const r = calcularProrrateo({ porcentajeSep: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 3548 }, { conceptoNo: '02', neto: 4148 }] })
    expect(r.excedenteColegiatura).toBe(-112)
    expect(r.montoMensual).toBe(3918)
  })

  test('mes cubierto a mano antes del último pago cuenta como transcurrido (90413)', () => {
    const r = calcularProrrateo({
      porcentajeSep: 20, porcentajeBecaActual: 15, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10,
      pagosColegiatura: [{ conceptoNo: '01', neto: 0, cubierto: true }, { conceptoNo: '02', neto: 4148 }],
      pagoInscripcionNeto: 3814,
    })
    expect(r.mesesPagados).toBe(2)
    expect(r.excedenteColegiatura).toBe(244)
    expect(r.montoMensual).toBe(3873.5)
  })

  test('meses cubiertos después del último pago los paga el excedente (90603)', () => {
    const r = calcularProrrateo({
      porcentajeSep: 90, porcentajeBecaActual: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10,
      pagosColegiatura: [
        { conceptoNo: '01', neto: 3904 }, { conceptoNo: '02', neto: 3904 },
        ...['03', '04', '05', '06', '07', '08', '09', '10'].map((c) => ({ conceptoNo: c, neto: 0, cubierto: true })),
      ],
      pagoInscripcionNeto: 3812,
    })
    expect(r.mesesRestantes).toBe(8)
    expect(r.estado).toBe('anio_completo')
    expect(r.saldoFavor).toBe(6231.7)
  })

  test('sin meses restantes: no propone monto nuevo', () => {
    const r = calcularProrrateo({
      porcentajeSep: 20, colegiaturaOficial: 4880, inscripcionOficial: 5083, planMeses: 10,
      pagosColegiatura: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((c) => ({ conceptoNo: c, neto: 3904 })),
    })
    expect(r.estado).toBe('sin_meses_restantes')
    expect(r.montoMensual).toBeNull()
  })

  test('la mensualidad nunca pasa de la colegiatura oficial', () => {
    const r = calcularProrrateo({
      porcentajeSep: 20, colegiaturaOficial: 5260, inscripcionOficial: 5520, planMeses: 10,
      pagosColegiatura: ['02', '03', '04', '05', '06', '07', '08', '09', '10'].map((c) => ({ conceptoNo: c, neto: 2653.75 })),
    })
    expect(r.montoMensual).toBe(5260)
    expect(r.mensajes.some((m) => m.includes('se topa'))).toBe(true)
  })

  test('excedente exacto = año completo sin saldo', () => {
    const r = calcularProrrateo({ porcentajeSep: 50, colegiaturaOficial: 4000, inscripcionOficial: 4000, planMeses: 10, pagosColegiatura: [{ conceptoNo: '01', neto: 4000 }, { conceptoNo: '02', neto: 4000 }, { conceptoNo: '03', neto: 4000 }, { conceptoNo: '04', neto: 4000 }, { conceptoNo: '05', neto: 4000 }] })
    expect(r.excedenteColegiatura).toBe(10000)
    expect(r.estado).toBe('anio_completo')
    expect(r.saldoFavor).toBe(0)
  })
})
