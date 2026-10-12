// 2026-10-12: reversión de Beca SEP: regresa a la beca del colegio y reparte lo pagado de más o de menos.
import { describe, expect, test } from 'vitest'
import { calcularReversion, comparativoBecaColegio, sepMasCara } from '@/lib/sep/core/reversion'

describe('comparativoBecaColegio', () => {
  test('SEP 20 % contra Winston 50 %: aviso de que paga más', () => {
    const c = comparativoBecaColegio({ colegiaturaOficial: 4930, porcentajeColegio: 50, mensualSep: 4108.33 })
    expect(c?.precioColegio).toBe(2465)
    expect(c?.diferencia).toBe(1643.33)
    expect(sepMasCara(c)).toBe(true)
  })

  test('sin beca del colegio no hay comparativo', () => {
    expect(comparativoBecaColegio({ colegiaturaOficial: 4930, porcentajeColegio: 0, mensualSep: 3944 })).toBeNull()
  })

  test('SEP mayor que la beca del colegio: no avisa', () => {
    const c = comparativoBecaColegio({ colegiaturaOficial: 4930, porcentajeColegio: 20, mensualSep: 2465 })
    expect(sepMasCara(c)).toBe(false)
  })
})

const base = { colegiaturaOficial: 4930, planMeses: 11 as const }

describe('calcularReversion', () => {
  test('SEP 20 % en lugar de Winston 50 %: lo pagado de más baja los meses que faltan', () => {
    const r = calcularReversion({
      ...base,
      porcentajeBeca: 50,
      pagosColegiatura: [
        { conceptoNo: '01', neto: 2465 },
        { conceptoNo: '02', neto: 3944 },
      ],
    })
    expect(r.precioConBeca).toBe(2465)
    expect(r.excedente).toBe(1479)
    expect(r.mesesRestantes).toBe(9)
    expect(r.mensual).toBe(2300.67)
    expect(r.porPagar[0]).toBe('03')
    expect(r.esperados['26']).toBe(2300.67)
    expect(r.esperados['01']).toBeUndefined()
  })

  test('sin beca del colegio: lo que faltó se completa aunque pase de la colegiatura oficial', () => {
    const r = calcularReversion({
      ...base,
      porcentajeBeca: 0,
      pagosColegiatura: [
        { conceptoNo: '01', neto: 3944 },
        { conceptoNo: '02', neto: 3944 },
      ],
    })
    expect(r.excedente).toBe(-1972)
    expect(r.mensual).toBe(5149.11)
  })

  test('sin pagos: la mensualidad es el precio con su beca del colegio', () => {
    const r = calcularReversion({ ...base, porcentajeBeca: 20, pagosColegiatura: [] })
    expect(r.mensual).toBe(3944)
    expect(Object.keys(r.esperados)).toHaveLength(11)
  })

  test('si lo pagado de más cubre lo que falta, ya no paga y queda saldo a favor', () => {
    const r = calcularReversion({
      colegiaturaOficial: 1000,
      planMeses: 10,
      porcentajeBeca: 90,
      pagosColegiatura: [{ conceptoNo: '01', neto: 1000 }],
    })
    expect(r.anioCompleto).toBe(true)
    expect(r.mensual).toBe(0)
    expect(r.saldoFavor).toBe(0)
  })

  test('ciclo ya pagado completo: no quedan meses', () => {
    const pagos = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((c) => ({ conceptoNo: c, neto: 1000 }))
    const r = calcularReversion({ colegiaturaOficial: 1000, planMeses: 10, porcentajeBeca: 0, pagosColegiatura: pagos })
    expect(r.mensual).toBeNull()
    expect(r.esperados).toEqual({})
  })
})
