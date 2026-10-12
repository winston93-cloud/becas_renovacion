// 2026-10-12: resumen de respuestas del cuestionario Beneficios externos (datos ficticios).
import { describe, expect, test } from 'vitest'
import { resumirBeneficiosExternos, type FilaBeneficioExterno } from '@/lib/sep/beneficiosExternos'

const fila = (over: Partial<FilaBeneficioExterno>): FilaBeneficioExterno => ({
  alumno_nivel: 3, aplico: false, beneficio: null, beneficio_nombre: null, recibio: null, es_prueba: false, ...over,
})

describe('resumirBeneficiosExternos', () => {
  test('cuenta por beneficio, estado y nivel, sin las respuestas de prueba', () => {
    const r = resumirBeneficiosExternos([
      fila({}),
      fila({ aplico: true, beneficio: 'sep', recibio: true }),
      fila({ alumno_nivel: 4, aplico: true, beneficio: 'sep', recibio: false }),
      fila({ aplico: true, beneficio: 'otra', beneficio_nombre: 'beca municipal', recibio: false }),
      fila({ alumno_nivel: 4, aplico: true, beneficio: 'otra', beneficio_nombre: ' Beca Municipal ', recibio: true }),
      fila({ aplico: true, beneficio: 'sep', recibio: true, es_prueba: true }),
    ])
    expect(r.contestaron).toBe(5)
    expect(r.noAplicaron).toBe(1)
    expect(r.aplicaron).toBe(4)
    expect(r.sep).toEqual({ total: 2, recibida: 1, enEspera: 1 })
    expect(r.otra).toMatchObject({ total: 2, recibida: 1, enEspera: 1, nombres: [{ nombre: 'BECA MUNICIPAL', total: 2 }] })
    expect(r.porNivel).toEqual([
      { nivel: 3, contestaron: 3, aplicaron: 2, sep: 1 },
      { nivel: 4, contestaron: 2, aplicaron: 2, sep: 1 },
    ])
    expect(r.dePrueba).toBe(1)
    expect(r.pruebas).toHaveLength(1)
  })
})
