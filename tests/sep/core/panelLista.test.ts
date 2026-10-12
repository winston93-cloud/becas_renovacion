// 2026-10-12: cola de trabajo del panel Beca SEP (filtros, orden FIFO y paginación).
import { describe, expect, test } from 'vitest'
import {
  filtrarCuestionario,
  filtrarTramites,
  ordenarCuestionario,
  ordenarTramites,
  paginar,
  type FilaCuestionarioSep,
  type FilaTramiteSep,
} from '@/lib/sep/panelLista'

const t = (over: Partial<FilaTramiteSep>): FilaTramiteSep => ({
  id: over.id ?? '1',
  alumnoRef: 90101,
  nombreAlumno: 'ANA PRUEBA',
  nivel: 3,
  grado: 3,
  estado: 'enviada',
  porcentaje: 50,
  monto: null,
  fecha: '2026-10-01T10:00:00.000Z',
  revisionManual: false,
  motivoCorreccion: null,
  ...over,
})

const c = (over: Partial<FilaCuestionarioSep>): FilaCuestionarioSep => ({
  alumnoRef: 90101,
  alumnoNivel: 3,
  aplico: true,
  beneficio: 'sep',
  beneficioNombre: null,
  recibio: true,
  esPrueba: false,
  actualizadoEn: '2026-10-12T10:00:00.000Z',
  tieneTramite: false,
  tramiteId: null,
  ...over,
})

describe('filtrar y ordenar trámites', () => {
  const filas = [
    t({ id: 'a', alumnoRef: 90101, nombreAlumno: 'ANA PRUEBA', fecha: '2026-10-01T10:00:00.000Z', grado: 2 }),
    t({ id: 'b', alumnoRef: 90102, nombreAlumno: 'BETO PRUEBA', fecha: '2026-10-03T10:00:00.000Z', grado: 4, revisionManual: true }),
    t({ id: 'c', alumnoRef: 90103, nombreAlumno: 'CARLA PRUEBA', estado: 'aplicada', fecha: '2026-10-05T10:00:00.000Z' }),
  ]

  test('Por revisar es FIFO: el más antiguo primero', () => {
    const lista = ordenarTramites(filtrarTramites(filas, { vista: 'revisar', q: '', grado: null, soloManual: false }), 'espera')
    expect(lista.map((f) => f.id)).toEqual(['a', 'b'])
  })

  test('busca por número de control o nombre', () => {
    const lista = filtrarTramites(filas, { vista: 'revisar', q: '90102', grado: null, soloManual: false })
    expect(lista.map((f) => f.id)).toEqual(['b'])
    expect(filtrarTramites(filas, { vista: 'revisar', q: 'ana', grado: null, soloManual: false }).map((f) => f.id)).toEqual(['a'])
  })

  test('filtra grado y revisión a mano', () => {
    expect(filtrarTramites(filas, { vista: 'revisar', q: '', grado: 4, soloManual: false }).map((f) => f.id)).toEqual(['b'])
    expect(filtrarTramites(filas, { vista: 'revisar', q: '', grado: null, soloManual: true }).map((f) => f.id)).toEqual(['b'])
  })
})

describe('cuestionario', () => {
  const filas = [
    c({ alumnoRef: 1, recibio: true, tieneTramite: false, actualizadoEn: '2026-10-10T00:00:00.000Z' }),
    c({ alumnoRef: 2, recibio: true, tieneTramite: true, tramiteId: 't2' }),
    c({ alumnoRef: 3, recibio: false }),
    c({ alumnoRef: 4, aplico: false, beneficio: null, recibio: null }),
    c({ alumnoRef: 5, esPrueba: true, recibio: true, tieneTramite: false }),
  ]

  test('sin documento queda primero y las de prueba no se mezclan en «todas»', () => {
    const visibles = ordenarCuestionario(filtrarCuestionario(filas, { q: '', filtro: 'todas' }))
    expect(visibles.map((f) => f.alumnoRef)).toEqual([1, 2, 3, 4])
    expect(filtrarCuestionario(filas, { q: '', filtro: 'sin_doc' }).map((f) => f.alumnoRef)).toEqual([1])
    expect(filtrarCuestionario(filas, { q: '', filtro: 'prueba' }).map((f) => f.alumnoRef)).toEqual([5])
  })
})

describe('paginar', () => {
  test('parte en páginas de 25 y no se sale de rango', () => {
    const filas = Array.from({ length: 60 }, (_, i) => t({ id: String(i), alumnoRef: 90000 + i }))
    const p1 = paginar(filas, 1)
    expect(p1.items).toHaveLength(25)
    expect(p1.paginas).toBe(3)
    expect(paginar(filas, 99).pagina).toBe(3)
    expect(paginar(filas, 3).items).toHaveLength(10)
  })
})
