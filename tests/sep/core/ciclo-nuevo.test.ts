// 2026-10-03: preparación del ciclo 23 (2026-27): casos del Excel por ciclo, reglas de recargo y precios.
import { beforeAll, describe, expect, test } from 'vitest'
import { casoConocido, fijarCasosConocidos } from '@/lib/sep/core/casosConocidos'
import { reglasCiclo, recargoEsperado } from '@/lib/sep/core/ciclo'
import { cobroConSep } from '@/lib/sep/core/cobro'
import { evaluarBeca, type DatosAlumnoCiclo } from '@/lib/sep/core/evaluar'
import { revisarPrecios } from '@/lib/sep/core/precios'

const PRECIOS_23 = { colegiatura10: 5470, colegiatura11: 4930, inscripcion: 5490 }
const PRECIOS_22 = { colegiatura10: 4880, colegiatura11: 4400, inscripcion: 5083 }

const base = (over: Partial<DatosAlumnoCiclo> = {}): DatosAlumnoCiclo => ({
  alumnoId: 1, alumnoRef: 90603, nombre: 'Prueba', ciclo: 23, cicloVigente: 23,
  nivelCiclo: 3, nivelActual: 3, planBase: 11,
  precios: PRECIOS_23, preciosAnterior: PRECIOS_22,
  pagos: [], becaActualBase: null, ...over,
})

describe('casos conocidos por ciclo', () => {
  // 2026-10-10 - Casos ficticios: la lista real no se publica.
  beforeAll(() => {
    fijarCasosConocidos([
      { alumnoRef: 90603, ciclo: 22, tipo: 'monto_manual_excel', resolucion: 'revision', mensaje: 'Caso de prueba.' },
      { alumnoRef: 90837, ciclo: 22, tipo: 'docente_100', resolucion: 'automatica', mensaje: 'Caso de prueba.' },
    ])
  })

  test('90603 tiene caso del Excel en el ciclo 22 y no en el 23', () => {
    expect(casoConocido(90603, 22)?.tipo).toBe('monto_manual_excel')
    expect(casoConocido(90603, 23)).toBeNull()
  })

  test('en el ciclo 23 el 90603 no hereda la alerta bloqueante del Excel', () => {
    const ev = evaluarBeca(base(), { porcentajeSep: 50, porcentajeBecaActual: null, planMeses: null })
    expect(ev.alertas.some((a) => a.codigo === 'caso_conocido')).toBe(false)
    expect(ev.bloqueada).toBe(false)
  })

  test('los docentes del Excel 25-26 no quedan excluidos en el ciclo 23', () => {
    expect(casoConocido(90837, 22)?.tipo).toBe('docente_100')
    expect(casoConocido(90837, 23)).toBeNull()
  })
})

describe('plan de 11 meses en el ciclo 23', () => {
  test('usa la colegiatura de 11 meses y reparte entre 11 conceptos (incluye julio)', () => {
    const ev = evaluarBeca(
      base({ pagos: [{ concepto: '01', importe: 4930, recargo: 0, fecha: '2026-09-05', cubiertos: 0 }] }),
      { porcentajeSep: 20, porcentajeBecaActual: null, planMeses: null }
    )
    expect(ev.colegiaturaOficial).toBe(4930)
    expect(ev.resultado?.mesesPlan).toBe(11)
    expect(ev.resultado?.mesesRestantes).toBe(10)
    // colSep 3944; excedente 986 + inscripción sin pagar → (3944·10 − 986)/10
    expect(ev.resultado?.montoMensual).toBe(3845.4)
  })

  test('plan de 10 meses usa la colegiatura de 10', () => {
    const ev = evaluarBeca(base({ planBase: 10 }), { porcentajeSep: 20, porcentajeBecaActual: null, planMeses: null })
    expect(ev.colegiaturaOficial).toBe(5470)
  })
})

describe('reglas de recargo por ciclo', () => {
  test('22 y 23 confirmadas con $75 y día 10', () => {
    expect(reglasCiclo(22)).toEqual({ recargoMes: 75, diaLimite: 10, confirmada: true })
    expect(reglasCiclo(23).confirmada).toBe(true)
  })

  test('un ciclo sin regla usa la anterior y lo avisa', () => {
    expect(reglasCiclo(24)).toEqual({ recargoMes: 75, diaLimite: 10, confirmada: false })
    const ev = evaluarBeca(base({ ciclo: 24, cicloVigente: 24 }), { porcentajeSep: 20, porcentajeBecaActual: null, planMeses: 10 })
    expect(ev.alertas.some((a) => a.codigo === 'regla_ciclo_sin_confirmar')).toBe(true)
  })

  test('recargo esperado y cobro usan la regla del ciclo', () => {
    expect(recargoEsperado('01', '2026-10-15', 23)).toBe(75)
    expect(cobroConSep(3000, '01', '2026-11-15', 23).recargo).toBe(150)
  })
})

describe('revisión de precios', () => {
  test('precios reales 2026-27 contra 2025-26 no generan avisos', () => {
    expect(revisarPrecios(PRECIOS_23, PRECIOS_22)).toEqual([])
  })

  test('11 meses vacío o igual a 10 meses', () => {
    expect(revisarPrecios({ colegiatura10: 5470, colegiatura11: 0, inscripcion: 5490 })[0]).toMatch(/vacía/)
    expect(revisarPrecios({ colegiatura10: 5470, colegiatura11: 5470, inscripcion: 5490 }).join(' ')).toMatch(/igual/)
  })

  test('aumento mayor a 15 % o baja contra el ciclo anterior', () => {
    const avisos = revisarPrecios({ colegiatura10: 6000, colegiatura11: 5455, inscripcion: 5000 }, PRECIOS_22)
    expect(avisos.some((a) => a.includes('subió'))).toBe(true)
    expect(avisos.some((a) => a.includes('bajó'))).toBe(true)
  })

  test('la alerta aparece en la evaluación como advertencia (no bloquea)', () => {
    const ev = evaluarBeca(base({ precios: { colegiatura10: 5470, colegiatura11: 5470, inscripcion: 5490 } }), {
      porcentajeSep: 20, porcentajeBecaActual: null, planMeses: 10,
    })
    const a = ev.alertas.find((x) => x.codigo === 'precios_sospechosos')
    expect(a?.nivel).toBe('advertencia')
  })
})
