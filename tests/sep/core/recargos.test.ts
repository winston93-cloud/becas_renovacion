// 2026-09-30: quitar recargos automáticamente (separados, tope oficial y múltiplos de $75).
import { describe, expect, test } from 'vitest'
import { pagoNetoSinRecargo, preciosBaseCandidatos } from '@/lib/sep/core/recargos'

const PRIMARIA_10M = 4880
const SECU_11M = 4780
const bases = (becaActualPct = 0, colSep = PRIMARIA_10M * 0.8) =>
  preciosBaseCandidatos({ precioOficial: PRIMARIA_10M, becaActualPct, colSep })

describe('pagoNetoSinRecargo', () => {
  test('recargo separado: 4855 con pago_recargo 75 → 4780', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4855, recargoSeparado: 75, precioOficial: SECU_11M })
    expect(r.neto).toBe(4780)
    expect(r.recargoTotal).toBe(75)
    expect(r.reglas).toEqual(['recargo_separado'])
  })

  test('pago por encima del precio oficial: 4955 → 4880', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4955, precioOficial: PRIMARIA_10M, preciosBase: bases() })
    expect(r.neto).toBe(4880)
    expect(r.recargoExcedente).toBe(75)
  })

  test('recargo metido en pago con beca SEP: 3979 → 3904', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 3979, precioOficial: PRIMARIA_10M, preciosBase: bases(20), recargoEsperado: 75 })
    expect(r.neto).toBe(3904)
    expect(r.recargoMultiplo).toBe(75)
    expect(r.reglas).toEqual(['multiplo_75'])
  })

  test('recargo de 2 meses con beca 15 %: 4298 → 4148', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4298, precioOficial: PRIMARIA_10M, preciosBase: bases(15), recargoEsperado: 150 })
    expect(r.neto).toBe(4148)
    expect(r.recargoMultiplo).toBe(150)
  })

  test('pago puntual con beca no cambia', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 3904, precioOficial: PRIMARIA_10M, preciosBase: bases(20) })
    expect(r.neto).toBe(3904)
    expect(r.recargoTotal).toBe(0)
    expect(r.reglas).toEqual([])
  })

  test('tolerancia de $2 en el múltiplo de $75', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 3980.5, precioOficial: PRIMARIA_10M, preciosBase: bases(20), recargoEsperado: 75 })
    expect(r.neto).toBe(3904)
  })

  test('pago puntual incompleto no se confunde con recargo (90958: 3548)', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 3548, precioOficial: PRIMARIA_10M, preciosBase: bases(15), recargoEsperado: 0 })
    expect(r.neto).toBe(3548)
    expect(r.recargoTotal).toBe(0)
  })

  test('el recargo detectado no rebasa el esperado por la fecha', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4298, precioOficial: PRIMARIA_10M, preciosBase: bases(15), recargoEsperado: 75 })
    expect(r.recargoMultiplo).toBe(0)
    expect(r.neto).toBe(4298)
  })

  test('importe que no encaja con ningún precio base se toma tal cual', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4000, precioOficial: PRIMARIA_10M, preciosBase: bases(20) })
    expect(r.neto).toBe(4000)
  })

  test('con varios candidatos gana el más cercano al recargo esperado', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4223.75, precioOficial: PRIMARIA_10M, preciosBase: [4148.75, 3998.75], recargoEsperado: 225 })
    expect(r.neto).toBe(3998.75)
    expect(r.recargoMultiplo).toBe(225)
  })

  test('el monto SEP aprobado cuenta como precio base: 3918 → 3843', () => {
    const r = pagoNetoSinRecargo({
      importeBruto: 3918,
      precioOficial: PRIMARIA_10M,
      preciosBase: preciosBaseCandidatos({ precioOficial: PRIMARIA_10M, becaActualPct: 15, colSep: 3904, montoAprobadoSep: 3843 }),
      recargoEsperado: 75,
    })
    expect(r.neto).toBe(3843)
  })

  test('cargo extra de horario extendido no cuenta como colegiatura', () => {
    const r = pagoNetoSinRecargo({ importeBruto: 4204, cargoExtra: 300, precioOficial: PRIMARIA_10M, preciosBase: bases(20) })
    expect(r.neto).toBe(3904)
    expect(r.recargoTotal).toBe(0)
  })

  test('inscripción: solo recargo separado y tope, sin múltiplos', () => {
    expect(pagoNetoSinRecargo({ importeBruto: 5158, precioOficial: 5083, detectarMultiplos: false }).neto).toBe(5083)
    expect(pagoNetoSinRecargo({ importeBruto: 3887, precioOficial: 5083, preciosBase: [3812], detectarMultiplos: false }).neto).toBe(3887)
  })

  test('valores inválidos se tratan como 0', () => {
    const r = pagoNetoSinRecargo({ importeBruto: Number.NaN, precioOficial: PRIMARIA_10M })
    expect(r.neto).toBe(0)
    expect(r.bruto).toBe(0)
  })
})
