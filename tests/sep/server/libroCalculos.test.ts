// 2026-10-05: Excel de cálculos (Resumen con fórmulas, Pagos y una hoja por alumno).
import ExcelJS from 'exceljs'
import { describe, expect, test } from 'vitest'
import { evaluarBeca, type DatosAlumnoCiclo, type FilaPagoConcepto } from '@/lib/sep/core/evaluar'
import { entradaDesdeEvaluacion } from '@/lib/sep/core/hojaCalculo'
import { libroCalculos, type FilaExcel } from '@/lib/sep/excel/libroCalculos'

const PRECIOS_23 = { colegiatura10: 5470, colegiatura11: 4930, inscripcion: 5490 }
const pago = (concepto: string, importe: number, fecha: string): FilaPagoConcepto => ({ concepto, importe, recargo: 0, fecha, cubiertos: 0 })

function fila(ref: number, nombre: string, pagos: FilaPagoConcepto[], pctSep: number, becaActual: number): FilaExcel {
  const datos: DatosAlumnoCiclo = {
    alumnoId: ref, alumnoRef: ref, nombre, ciclo: 23, cicloVigente: 23, nivelCiclo: 3, nivelActual: 3, planBase: 10,
    precios: PRECIOS_23, preciosAnterior: null, pagos, becaActualBase: becaActual,
  }
  const ev = evaluarBeca(datos, { porcentajeSep: pctSep, porcentajeBecaActual: null, planMeses: null })
  return {
    alumnoRef: ref, nombre, nivel: 3, planMeses: 10, porcentajeSep: pctSep, porcentajeBecaActual: becaActual,
    colegiaturaOficial: ev.colegiaturaOficial, inscripcionOficial: ev.inscripcionOficial,
    entrada: entradaDesdeEvaluacion(ev, pctSep), estadoBeca: 'PENDIENTE', montoAprobado: null, alertas: ev.alertas, fuente: 'vivo',
  }
}

async function leer(filas: FilaExcel[]) {
  const buf = await libroCalculos(filas, { titulo: 'Prueba', ciclo: '2026-27', generadoPor: 'admin', fecha: new Date('2026-10-05T12:00:00') })
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buf as unknown as ArrayBuffer)
  return libro
}

describe('libro de cálculos', () => {
  const juanito = fila(99999, 'PEREZ JUANITO', [pago('01', 4376, '2026-09-05'), pago('02', 4376, '2026-10-03'), pago('11', 4392, '2026-07-01')], 50, 20)
  const mayor = fila(88888, 'LOPEZ ANA', [pago('01', 2188, '2026-09-05')], 20, 60)
  const sinDatos: FilaExcel = { ...mayor, alumnoRef: 77777, nombre: 'SIN DATOS', entrada: null, fuente: 'sin_datos', nota: 'InsForge no respondió' }

  test('hojas: Resumen, Pagos, una por alumno y la guía', async () => {
    const libro = await leer([juanito, mayor, sinDatos])
    expect(libro.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Pagos', '99999 PEREZ', '88888 LOPEZ', '77777 SIN', 'Cómo se calcula'])
  })

  test('Resumen trae fórmulas con el resultado del sistema', async () => {
    const ws = (await leer([juanito])).getWorksheet('Resumen')!
    const r = ws.getRow(5)
    const valor = (c: number) => r.getCell(c).value as ExcelJS.CellFormulaValue
    expect(valor(9).formula).toBe('ROUND(G5-G5*F5/100,2)')
    expect(valor(9).result).toBe(2735)
    expect(valor(17).result).toBe(4929)
    expect(valor(19).result).toBe(2118.88)
    expect(r.getCell(21).value).toBe(2118.88)
    expect(valor(22).formula).toContain('REVISAR')
    expect(r.getCell(23).value).toBe('Noviembre, Diciembre, Enero, Febrero, Marzo, Abril, Mayo, Junio')
  })

  test('Pagos: neto = pagado − recargo − otros, e inscripción aparte', async () => {
    const ws = (await leer([juanito])).getWorksheet('Pagos')!
    expect(ws.rowCount).toBe(4)
    const ins = ws.getRow(4)
    expect(ins.getCell(4).value).toBe('Inscripción')
    expect((ins.getCell(9).value as ExcelJS.CellFormulaValue).result).toBe(4392)
    expect((ws.getRow(2).getCell(13).value as ExcelJS.CellFormulaValue).result).toBe(1641)
  })

  // 2026-10-09 - Con beca actual mayor ya no sale "Conserva beca actual": se calcula la mensualidad SEP.
  test('beca actual mayor y sin datos quedan explicados', async () => {
    const ws = (await leer([mayor, sinDatos])).getWorksheet('Resumen')!
    expect(typeof ws.getRow(5).getCell(21).value).toBe('number')
    expect(ws.getRow(6).getCell(24).value).toBe('InsForge no respondió')
  })
})
