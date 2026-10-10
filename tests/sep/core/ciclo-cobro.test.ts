// 2026-09-30: calendario escolar (día 10, ciclo N = 2003+N) y regla de cobro Winston vs SEP.
import { describe, expect, test } from 'vitest'
import { cicloPorFecha, etiquetaCiclo, fechaIso, fechaLimiteConcepto, mesesAtraso, recargoEsperado } from '@/lib/sep/core/ciclo'
import { cobroConBecaWinston, cobroConSep } from '@/lib/sep/core/cobro'

describe('ciclo escolar', () => {
  test('ciclo 22 = 2025-26 (no 2022: bug de la app vieja)', () => {
    expect(etiquetaCiclo(22)).toBe('2025-26')
    expect(fechaLimiteConcepto('01', 22)).toBe('2025-09-10')
    expect(fechaLimiteConcepto('05', 22)).toBe('2026-01-10')
    expect(fechaLimiteConcepto('26', 22)).toBe('2026-07-10')
    expect(fechaLimiteConcepto('16', 22)).toBeNull()
  })

  test('ciclo vigente cambia el 10 de julio', () => {
    expect(cicloPorFecha(new Date(2026, 6, 9))).toBe(22)
    expect(cicloPorFecha(new Date(2026, 6, 10))).toBe(23)
    expect(cicloPorFecha(new Date(2026, 8, 30))).toBe(23)
  })

  test('meses de atraso y recargo esperado', () => {
    expect(mesesAtraso('01', '2025-09-10', 22)).toBe(0)
    expect(mesesAtraso('01', '2025-09-11', 22)).toBe(1)
    expect(mesesAtraso('01', '2025-11-02', 22)).toBe(2)
    expect(recargoEsperado('02', '2025-12-15', 22)).toBe(150)
    expect(mesesAtraso('01', 'fecha rara', 22)).toBe(0)
  })

  test('fechaIso acepta varios formatos', () => {
    expect(fechaIso('2025-09-05 10:00:00')).toBe('2025-09-05')
    expect(fechaIso(new Date('2025-09-05T12:00:00Z'))).toBe('2025-09-05')
    expect(fechaIso('')).toBe('')
  })
})

describe('regla del día 10 al cobrar', () => {
  test('beca SEP no se pierde: solo suma recargo', () => {
    const c = cobroConSep(3843, '03', '2025-12-02', 22)
    expect(c).toMatchObject({ base: 3843, recargo: 75, total: 3918, perdioBecaWinston: false })
  })

  test('beca Winston se pierde después del día 10', () => {
    const tarde = cobroConBecaWinston(4880, 15, '03', '2025-11-11', 22)
    expect(tarde).toMatchObject({ base: 4880, recargo: 75, total: 4955, perdioBecaWinston: true })
    const puntual = cobroConBecaWinston(4880, 15, '03', '2025-11-10', 22)
    expect(puntual).toMatchObject({ base: 4148, recargo: 0, total: 4148, perdioBecaWinston: false })
  })
})
