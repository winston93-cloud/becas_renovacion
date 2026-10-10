// 2026-10-03: lectura de la lista SEP en cualquier formato (tabla con sinónimos, texto libre, duplicados).
import { describe, expect, test } from 'vitest'
import { detectarColumnas, leerLinea, leerPlan, leerPorcentaje, leerTabla, leerTexto, marcarDuplicados } from '@/lib/sep/core/listaSep'

describe('valores sueltos', () => {
  test('porcentaje en distintos formatos', () => {
    expect(leerPorcentaje('20')).toBe(20)
    expect(leerPorcentaje('25 %')).toBe(25)
    expect(leerPorcentaje('0.30')).toBe(30)
    expect(leerPorcentaje('0,5')).toBe(50)
    expect(leerPorcentaje('150')).toBeNull()
    expect(leerPorcentaje('')).toBeNull()
  })
  test('plan', () => {
    expect(leerPlan('11 meses')).toBe(11)
    expect(leerPlan('10m')).toBe(10)
    expect(leerPlan('Plan 11')).toBe(11)
    expect(leerPlan('12')).toBeNull()
  })
})

describe('detectarColumnas', () => {
  test('sinónimos y apellidos separados', () => {
    const c = detectarColumnas(['No.', 'Matrícula', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', '% Beca', 'Plan de pagos'])
    expect(c).toMatchObject({ ref: 1, app: 2, apm: 3, nombres: 4, pct: 5, plan: 6 })
  })
})

describe('leerLinea (texto libre o PDF)', () => {
  test('control, porcentaje y plan', () => {
    expect(leerLinea('91313 20 11', 'l1')).toMatchObject({ alumnoRef: 91313, porcentajeSep: 20, planMeses: 11, errores: [] })
  })
  test('nombre con porcentaje', () => {
    expect(leerLinea('PEREZ LOPEZ JUAN 25%', 'l2')).toMatchObject({ alumnoRef: null, nombre: 'PEREZ LOPEZ JUAN', porcentajeSep: 25 })
  })
  test('una fecha no se confunde con número de control', () => {
    const f = leerLinea('CARLOS RUIZ SOTO 12/11/2025 50 %', 'l3')
    expect(f.alumnoRef).toBeNull()
    expect(f.porcentajeSep).toBe(50)
    expect(f.nombre).toBe('CARLOS RUIZ SOTO')
  })
  test('CURP se reconoce y no ensucia el nombre', () => {
    const f = leerLinea('PRUEBA GARCIA ANA PUGA150101MTSRRNA1 30%', 'l4')
    expect(f.curp).toBe('PUGA150101MTSRRNA1')
    expect(f.nombre).toBe('PRUEBA GARCIA ANA')
  })
  test('sin porcentaje queda con error', () => {
    expect(leerLinea('91313', 'l5').errores).toContain('Sin porcentaje de beca SEP.')
  })
})

describe('leerTabla / leerTexto', () => {
  test('tabla con título arriba y apellidos separados', () => {
    const filas = leerTabla([
      ['BECAS SEP 2026-2027'],
      ['No. control', 'Paterno', 'Materno', 'Nombre', 'Porcentaje', 'Meses'],
      ['91313', 'PEREZ', 'LOPEZ', 'JUAN', '20%', '11'],
      ['', 'MUÑOZ', 'SOTO', 'EVA', '0.25', '10 meses'],
    ], 'Primaria')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ origen: 'Primaria fila 3', alumnoRef: 91313, nombre: 'PEREZ LOPEZ JUAN', porcentajeSep: 20, planMeses: 11 })
    expect(filas[1]).toMatchObject({ alumnoRef: null, nombre: 'MUÑOZ SOTO EVA', porcentajeSep: 25, planMeses: 10 })
  })

  test('CSV con punto y coma y encabezado', () => {
    const filas = leerTexto('Matricula;Alumno;% beca\n90603;PRUEBA GARCIA ANA;50\n91051;PRUEBA LOPEZ CARLO;30')
    expect(filas.map((f) => [f.alumnoRef, f.porcentajeSep])).toEqual([[90603, 50], [91051, 30]])
  })

  test('pegado de Excel (tabuladores)', () => {
    const filas = leerTexto('No control\tNombre\tBeca\n91313\tPEREZ LOPEZ JUAN\t20')
    expect(filas[0]).toMatchObject({ alumnoRef: 91313, porcentajeSep: 20 })
  })

  test('texto a mano línea por línea con comas y duplicados', () => {
    const filas = leerTexto('91313, 20%\n90603, 50 %, plan 10\n91313 20')
    expect(filas[0]).toMatchObject({ alumnoRef: 91313, porcentajeSep: 20, duplicada: false })
    expect(filas[1]).toMatchObject({ alumnoRef: 90603, porcentajeSep: 50, planMeses: 10 })
    expect(filas[2].duplicada).toBe(true)
    expect(marcarDuplicados(filas)[2].errores.filter((e) => e.startsWith('Repetida'))).toHaveLength(1)
  })
})
