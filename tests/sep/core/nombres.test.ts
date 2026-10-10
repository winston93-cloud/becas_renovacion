// 2026-10-03: búsqueda por nombre sin acentos, en cualquier orden y con tolerancia a errores.
import { describe, expect, test } from 'vitest'
import { esMismoNombre, normalizarNombre, palabrasBusqueda, puntajeNombre, rankearPorNombre } from '@/lib/sep/core/nombres'

describe('normalizarNombre', () => {
  test('quita acentos, ñ, mayúsculas, puntuación y partículas', () => {
    expect(normalizarNombre('  MUÑOZ de la Peña,  José   Ángel ')).toBe('munoz pena jose angel')
    expect(normalizarNombre('Ma. Guadalupe')).toBe('maria guadalupe')
  })
})

describe('puntajeNombre', () => {
  test('García = Garcia', () => {
    expect(puntajeNombre('Garcia Lopez Ana', 'GARCÍA LÓPEZ ANA')).toBe(1)
  })
  test('el orden no importa', () => {
    expect(esMismoNombre('Juan Pérez López', 'PEREZ LOPEZ JUAN')).toBe(true)
  })
  test('Hernandes encuentra Hernández (un error de dedo)', () => {
    expect(puntajeNombre('Hernandes Ruiz Luis', 'HERNANDEZ RUIZ LUIS')).toBeGreaterThan(0.9)
  })
  test('Muñoz = Munoz', () => {
    expect(esMismoNombre('Muñoz Soto Eva', 'MUNOZ SOTO EVA')).toBe(true)
  })
  test('nombres distintos puntúan bajo', () => {
    expect(puntajeNombre('Martinez Diaz Sofia', 'PRUEBA GARCIA ANA')).toBeLessThan(0.3)
  })
  test('palabras cortas no toleran errores (Ana ≠ Ama)', () => {
    expect(puntajeNombre('Ana', 'Ama')).toBe(0)
  })
})

describe('rankearPorNombre', () => {
  const alumnos = [
    { ref: 1, nombre: 'PEREZ LOPEZ JUAN' },
    { ref: 2, nombre: 'PEREZ LOPEZ JUANA' },
    { ref: 3, nombre: 'PEREZ LOPEZ JUAN' },
    { ref: 4, nombre: 'GOMEZ RUIZ ANA' },
  ]
  test('exactos primero; homónimos quedan los dos como exactos', () => {
    const r = rankearPorNombre('Juan Pérez López', alumnos, (a) => a.nombre)
    expect(r.filter((c) => c.exacto).map((c) => c.item.ref)).toEqual([1, 3])
    expect(r.map((c) => c.item.ref)).not.toContain(4)
  })
  test('palabras de búsqueda sin repetir ni partículas', () => {
    expect(palabrasBusqueda('de la Peña Peña Ana')).toEqual(['pena', 'ana'])
  })
})
