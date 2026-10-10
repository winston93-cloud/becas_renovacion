// 2026-10-05: hoja de cálculo paso a paso (pestaña Cálculo): cada operación escrita debe cuadrar.
import { describe, expect, test } from 'vitest'
import { evaluarBeca, type DatosAlumnoCiclo, type FilaPagoConcepto } from '@/lib/sep/core/evaluar'
import { armarHojaCalculo, entradaDesdeEvaluacion } from '@/lib/sep/core/hojaCalculo'

const PRECIOS_23 = { colegiatura10: 5470, colegiatura11: 4930, inscripcion: 5490 }

const pago = (concepto: string, importe: number, fecha: string, recargo = 0): FilaPagoConcepto => ({
  concepto, importe, recargo, fecha, cubiertos: 0,
})

const alumno = (pagos: FilaPagoConcepto[], over: Partial<DatosAlumnoCiclo> = {}): DatosAlumnoCiclo => ({
  alumnoId: 1, alumnoRef: 99999, nombre: 'PEREZ JUANITO', ciclo: 23, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: 10, precios: PRECIOS_23, preciosAnterior: null,
  pagos, becaActualBase: 20, ...over,
})

function hoja(datos: DatosAlumnoCiclo, pctSep: number) {
  const ev = evaluarBeca(datos, { porcentajeSep: pctSep, porcentajeBecaActual: null, planMeses: null })
  const entrada = entradaDesdeEvaluacion(ev, pctSep)
  expect(entrada).not.toBeNull()
  return { ev, h: armarHojaCalculo(entrada!) }
}

const resultadoDe = (h: ReturnType<typeof armarHojaCalculo>, paso: number, texto: string) =>
  h.pasos.find((p) => p.numero === paso)!.renglones.find((r) => r.texto.startsWith(texto))!.resultado

describe('Juanito Pérez: PEMEX 20 % y SEP 50 %, primaria plan 10 meses', () => {
  // Pagó septiembre y octubre con su beca del 20 % (5,470 × 0.8 = 4,376) e inscripción 5,490 × 0.8 = 4,392.
  const { ev, h } = hoja(
    alumno([pago('01', 4376, '2026-09-05'), pago('02', 4376, '2026-10-03'), pago('11', 4392, '2026-07-01')]),
    50
  )

  test('precios con SEP y saldo a favor', () => {
    expect(resultadoDe(h, 3, 'Colegiatura con SEP')).toBe('$2,735.00')
    expect(resultadoDe(h, 3, 'Inscripción con SEP')).toBe('$2,745.00')
    expect(resultadoDe(h, 3, 'Costo anual con SEP')).toBe('$30,095.00')
    // (4,376 − 2,735) × 2 = 3,282 ; 4,392 − 2,745 = 1,647
    expect(resultadoDe(h, 4, 'Saldo de colegiaturas')).toBe('$3,282.00')
    expect(resultadoDe(h, 5, 'Saldo de inscripción')).toBe('$1,647.00')
    expect(resultadoDe(h, 6, 'Saldo a favor')).toBe('$4,929.00')
  })

  test('reparte el saldo en partes iguales entre los 8 meses que faltan', () => {
    expect(h.mesesPorPagar).toEqual(['Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'])
    // 4,929 ÷ 8 = 616.125 → 2,735 − 616.125 = 2,118.875 → 2,118.88
    expect(h.mensual).toBe(2118.88)
    expect(h.mensual).toBe(ev.resultado!.montoMensual)
    expect(resultadoDe(h, 8, 'Saldo que se descuenta')).toBe('$616.12')
    expect(h.reparto).toHaveLength(8)
    expect(h.reparto.every((f) => f.aPagar === 2118.88 && f.abono === 616.12)).toBe(true)
  })

  test('la comprobación cuadra (solo centavos de redondeo)', () => {
    expect(h.comprobacion!.diferencia).toBe(0.04)
    expect(h.comprobacion!.cuadra).toBe(true)
    expect(h.comprobacion!.explicacion[0]).toContain('redondeo')
  })

  test('la beca actual queda como referencia y se explica por qué aplica la SEP', () => {
    expect(resultadoDe(h, 2, 'Colegiatura con la beca actual')).toBe('$4,376.00')
    expect(h.pasos[1].notas![0]).toContain('se aplica solo la SEP')
  })
})

describe('otros resultados', () => {
  test('recargos no cuentan como saldo a favor', () => {
    const { h } = hoja(alumno([pago('01', 4451, '2026-09-20', 75)], { becaActualBase: 20 }), 50)
    expect(h.totalesMeses.recargo).toBe(75)
    expect(h.totalesMeses.neto).toBe(4376)
  })

  // 2026-10-09 - Regla nueva: la SEP sustituye a la beca actual aunque sea mayor.
  test('beca actual mayor que la SEP: la pierde y se aplica solo la SEP', () => {
    const { h } = hoja(alumno([pago('01', 2735, '2026-09-05')], { becaActualBase: 60 }), 50)
    expect(h.aplicaSep).toBe(true)
    expect(h.comprobacion).not.toBeNull()
    expect(h.pasos[1].notas![0]).toContain('Pierde su beca actual')
  })

  test('año completo: el saldo cubre los meses que faltan y sobra para devolver', () => {
    // SEP 100 %: todo lo pagado es saldo; colegiatura con SEP $0.
    const { h } = hoja(alumno([pago('01', 4376, '2026-09-05')]), 100)
    expect(h.mensual).toBe(0)
    expect(h.saldoSobrante).toBe(4376)
    expect(h.comprobacion!.diferencia).toBe(0)
    expect(h.conclusion).toContain('No paga colegiatura')
  })

  test('sin pago de inscripción la diferencia se explica', () => {
    const { h } = hoja(alumno([pago('01', 4376, '2026-09-05')]), 50)
    expect(resultadoDe(h, 5, 'Saldo de inscripción')).toBe('$0.00')
    expect(h.comprobacion!.cuadra).toBe(true)
    expect(h.comprobacion!.explicacion.some((x) => x.includes('inscripción'))).toBe(true)
  })
})
