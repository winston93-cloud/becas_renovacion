// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-10-05 — Libro de Excel con los cálculos de beca SEP (sin BD, para poder probarlo).
 *
 *   Resumen  → un renglón por alumno con FÓRMULAS de Excel (precio con SEP, saldos, reparto) y una
 *              columna que compara contra el pago mensual del sistema ("¿Coincide?").
 *   Pagos    → un renglón por mes pagado e inscripción: pagado − recargo − otros cargos = neto.
 *   Una hoja por alumno con la hoja de cálculo paso a paso (la misma de la pestaña Cálculo).
 *   Cómo se calcula → explicación de cada columna.
 */

import ExcelJS from 'exceljs'
import type { Alerta } from '@/lib/sep/core/alertas'
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo'
import { r2 } from '@/lib/sep/core/dinero'
import { armarHojaCalculo, type EntradaHoja, type HojaCalculo } from '@/lib/sep/core/hojaCalculo'
import { ETIQUETA_ESTADO } from '@/lib/sep/core/prorrateo'

export type FilaExcel = {
  alumnoRef: number
  nombre: string
  nivel: number | null
  planMeses: number | null
  porcentajeSep: number | null
  porcentajeBecaActual: number | null
  colegiaturaOficial: number | null
  inscripcionOficial: number | null
  entrada: EntradaHoja | null
  estadoBeca: string
  montoAprobado: number | null
  alertas: Alerta[]
  /** vivo = pagos de hoy; guardado = último cálculo guardado (InsForge no respondió). */
  fuente: 'vivo' | 'guardado' | 'sin_datos'
  nota?: string
}

export type MetaLibro = { titulo: string; ciclo: string; generadoPor: string; fecha: Date }

const MONEDA = '"$"#,##0.00'
const AZUL = 'FF0B2D8C'
const LIMA = 'FFC6F432'

/** Texto que la fórmula del Excel pone cuando no hay pago mensual (debe coincidir con `textoSistema`). */
const TEXTO_ESTADO: Partial<Record<string, string>> = {
  excluido_docente: 'No aplica',
  beca_actual_mayor: 'Conserva beca actual',
  sin_meses_restantes: 'Sin meses',
}

const nombreHoja = (ref: number, nombre: string, usadas: Set<string>) => {
  const base = `${ref} ${nombre.split(/\s+/)[0] ?? ''}`.replace(/[[\]:*?/\\']/g, '').slice(0, 28).trim()
  let n = base
  for (let i = 2; usadas.has(n.toLowerCase()); i++) n = `${base.slice(0, 25)} ${i}`
  usadas.add(n.toLowerCase())
  return n
}

function encabezado(ws: ExcelJS.Worksheet, fila: number) {
  const r = ws.getRow(fila)
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  r.alignment = { vertical: 'middle', wrapText: true }
  r.height = 32
  r.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  })
}

export async function libroCalculos(filas: FilaExcel[], meta: MetaLibro): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Becas SEP · Instituto Winston Churchill'
  libro.created = meta.fecha
  libro.calcProperties.fullCalcOnLoad = true

  const resumen = libro.addWorksheet('Resumen', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] })
  const pagos = libro.addWorksheet('Pagos', { views: [{ state: 'frozen', ySplit: 1 }] })
  const usadas = new Set(['resumen', 'pagos', 'cómo se calcula'])
  const hojas = filas.map((f) => ({ f, nombre: nombreHoja(f.alumnoRef, f.nombre, usadas), h: f.entrada ? armarHojaCalculo(f.entrada) : null }))

  // ── Pagos ──────────────────────────────────────────────────────────────────
  pagos.columns = [
    { header: 'No. control', key: 'ref', width: 11 },
    { header: 'Alumno', key: 'nombre', width: 34 },
    { header: 'Concepto', key: 'concepto', width: 9 },
    { header: 'Mes', key: 'mes', width: 13 },
    { header: 'Fecha de pago', key: 'fecha', width: 13 },
    { header: 'Pagado', key: 'pagado', width: 13, style: { numFmt: MONEDA } },
    { header: 'Recargo quitado', key: 'recargo', width: 13, style: { numFmt: MONEDA } },
    { header: 'Otros cargos quitados', key: 'otros', width: 13, style: { numFmt: MONEDA } },
    { header: 'Neto (Pagado − Recargo − Otros)', key: 'neto', width: 15, style: { numFmt: MONEDA } },
    { header: 'Cubierto a mano', key: 'cubierto', width: 10 },
    { header: 'Cuenta con pago', key: 'cuenta', width: 10 },
    { header: 'Colegiatura con SEP', key: 'conSep', width: 13, style: { numFmt: MONEDA } },
    { header: 'Saldo (Neto − Con SEP)', key: 'saldo', width: 14, style: { numFmt: MONEDA } },
    { header: 'Nota', key: 'nota', width: 40 },
  ]
  encabezado(pagos, 1)
  for (const { f, h } of hojas) {
    if (!h || !f.entrada) continue
    const colSep = f.entrada.resultado.colSep
    for (const m of h.meses) {
      const otros = r2(m.pagado - m.recargo - m.neto)
      const cuenta = m.cuenta && !m.cubierto
      const fila = pagos.addRow({
        ref: f.alumnoRef, nombre: f.nombre, concepto: m.concepto, mes: m.nombre, fecha: m.fecha,
        pagado: m.pagado, recargo: m.recargo, otros, cubierto: m.cubierto ? 'Sí' : 'No', cuenta: cuenta ? 'Sí' : 'No', nota: m.nota,
      })
      const r = fila.number
      fila.getCell('neto').value = { formula: `ROUND(F${r}-G${r}-H${r},2)`, result: m.neto }
      fila.getCell('conSep').value = { formula: `IF(K${r}="Sí",INDEX(Resumen!$I:$I,MATCH(A${r},Resumen!$A:$A,0)),"")`, result: cuenta ? colSep : '' }
      fila.getCell('saldo').value = { formula: `IF(K${r}="Sí",ROUND(I${r}-L${r},2),"")`, result: cuenta ? r2(m.neto - colSep) : '' }
    }
    const ins = f.entrada.inscripcion
    if (ins && ins.bruto > 0) {
      const fila = pagos.addRow({
        ref: f.alumnoRef, nombre: f.nombre, concepto: '11', mes: 'Inscripción', fecha: '',
        pagado: ins.bruto, recargo: ins.recargoTotal, otros: r2(ins.bruto - ins.recargoTotal - ins.neto), cubierto: 'No', cuenta: 'No',
        nota: 'Se compara contra la inscripción con SEP en Resumen',
      })
      fila.getCell('neto').value = { formula: `ROUND(F${fila.number}-G${fila.number}-H${fila.number},2)`, result: ins.neto }
    }
  }
  pagos.autoFilter = { from: 'A1', to: 'N1' }

  // ── Resumen ────────────────────────────────────────────────────────────────
  resumen.mergeCells('A1:H1')
  resumen.getCell('A1').value = meta.titulo
  resumen.getCell('A1').font = { bold: true, size: 14, color: { argb: AZUL } }
  resumen.mergeCells('A2:L2')
  resumen.getCell('A2').value =
    `Ciclo ${meta.ciclo} · ${filas.length} alumnos · generado el ${meta.fecha.toLocaleString('es-MX')} por ${meta.generadoPor}. ` +
    'Las columnas en azul claro son fórmulas: puedes revisar cada cuenta. "¿Coincide?" compara la fórmula con el sistema.'
  resumen.getCell('A2').font = { italic: true, size: 9 }

  const columnas: { titulo: string; ancho: number; moneda?: boolean; formula?: boolean }[] = [
    { titulo: 'No. control', ancho: 10 },
    { titulo: 'Alumno', ancho: 34 },
    { titulo: 'Nivel', ancho: 11 },
    { titulo: 'Plan (meses)', ancho: 8 },
    { titulo: 'Beca actual %', ancho: 8 },
    { titulo: 'Beca SEP %', ancho: 8 },
    { titulo: 'Colegiatura oficial', ancho: 12, moneda: true },
    { titulo: 'Inscripción oficial', ancho: 12, moneda: true },
    { titulo: 'Colegiatura con SEP = G − G×F%', ancho: 13, moneda: true, formula: true },
    { titulo: 'Inscripción con SEP = H − H×F%', ancho: 13, moneda: true, formula: true },
    { titulo: 'Meses transcurridos', ancho: 10 },
    { titulo: 'Meses con pago', ancho: 8, formula: true },
    { titulo: 'Colegiaturas pagadas netas', ancho: 13, moneda: true, formula: true },
    { titulo: 'Saldo colegiaturas = M − I×L', ancho: 13, moneda: true, formula: true },
    { titulo: 'Inscripción pagada neta', ancho: 13, moneda: true, formula: true },
    { titulo: 'Saldo inscripción = O − J (mín. 0)', ancho: 13, moneda: true, formula: true },
    { titulo: 'Saldo a favor = N + P', ancho: 13, moneda: true, formula: true },
    { titulo: 'Meses por pagar = D − K', ancho: 9, formula: true },
    { titulo: 'Pago mensual = I − Q ÷ R', ancho: 14, moneda: true, formula: true },
    { titulo: 'Saldo a devolver = Q − I×R', ancho: 13, moneda: true, formula: true },
    { titulo: 'Pago mensual del sistema', ancho: 14, moneda: true },
    { titulo: '¿Coincide?', ancho: 10, formula: true },
    { titulo: 'Meses por pagar (nombres)', ancho: 40 },
    { titulo: 'Resultado', ancho: 16 },
    { titulo: 'Estado de la beca', ancho: 11 },
    { titulo: 'Aprobado mensual', ancho: 13, moneda: true },
    { titulo: 'Alertas', ancho: 60 },
    { titulo: 'Origen de los datos', ancho: 16 },
  ]
  const FILA_TITULOS = 4
  columnas.forEach((c, i) => {
    resumen.getColumn(i + 1).width = c.ancho
    if (c.moneda) resumen.getColumn(i + 1).numFmt = MONEDA
    resumen.getRow(FILA_TITULOS).getCell(i + 1).value = c.titulo
  })
  encabezado(resumen, FILA_TITULOS)
  resumen.getRow(FILA_TITULOS).height = 58

  hojas.forEach(({ f, nombre, h }, i) => {
    const r = FILA_TITULOS + 1 + i
    const fila = resumen.getRow(r)
    const e = f.entrada
    const res = e?.resultado
    fila.getCell(1).value = f.alumnoRef
    fila.getCell(2).value = { text: f.nombre, hyperlink: `#'${nombre}'!A1` }
    fila.getCell(2).font = { color: { argb: 'FF1A59FF' }, underline: true }
    fila.getCell(3).value = f.nivel != null ? NOMBRE_NIVEL[f.nivel] ?? String(f.nivel) : ''
    fila.getCell(4).value = e?.planMeses ?? f.planMeses ?? null
    fila.getCell(5).value = e?.porcentajeBecaActual ?? f.porcentajeBecaActual ?? 0
    fila.getCell(6).value = e?.porcentajeSep ?? f.porcentajeSep ?? null
    fila.getCell(7).value = e?.colegiaturaOficial ?? f.colegiaturaOficial ?? null
    fila.getCell(8).value = e?.inscripcionOficial ?? f.inscripcionOficial ?? null
    fila.getCell(25).value = f.estadoBeca
    fila.getCell(26).value = f.montoAprobado
    fila.getCell(27).value = f.alertas.filter((a) => a.nivel !== 'info').map((a) => a.mensaje).join(' | ')
    fila.getCell(28).value = f.fuente === 'vivo' ? 'Pagos de hoy' : f.fuente === 'guardado' ? 'Último cálculo guardado' : 'Sin datos'

    if (!e || !res || !h) {
      fila.getCell(24).value = f.nota ?? 'Falta porcentaje, plan o precios'
      return
    }
    const insNeto = e.inscripcion?.neto ?? 0
    const mesesConPago = h.totalesMeses.contados
    const textoSistema = TEXTO_ESTADO[res.estado]
    const f_ = (formula: string, result: ExcelJS.CellValue) => ({ formula, result }) as ExcelJS.CellFormulaValue
    fila.getCell(9).value = f_(`ROUND(G${r}-G${r}*F${r}/100,2)`, res.colSep)
    fila.getCell(10).value = f_(`ROUND(H${r}-H${r}*F${r}/100,2)`, res.insSep)
    fila.getCell(11).value = res.mesesPagados
    fila.getCell(12).value = f_(`COUNTIFS(Pagos!$A:$A,A${r},Pagos!$K:$K,"Sí")`, mesesConPago)
    fila.getCell(13).value = f_(`SUMIFS(Pagos!$I:$I,Pagos!$A:$A,A${r},Pagos!$K:$K,"Sí")`, h.totalesMeses.neto)
    fila.getCell(14).value = f_(`ROUND(M${r}-I${r}*L${r},2)`, res.excedenteColegiatura)
    fila.getCell(15).value = f_(`SUMIFS(Pagos!$I:$I,Pagos!$A:$A,A${r},Pagos!$D:$D,"Inscripción")`, insNeto)
    fila.getCell(16).value = f_(`IF(O${r}>0,MAX(0,ROUND(O${r}-J${r},2)),0)`, res.excedenteInscripcion)
    fila.getCell(17).value = f_(`ROUND(N${r}+P${r},2)`, res.excedenteTotal)
    fila.getCell(18).value = f_(`D${r}-K${r}`, res.mesesRestantes)
    // 2026-10-09 - Sin la regla "conserva beca actual": la SEP sustituye cualquier otra beca aunque sea mayor.
    fila.getCell(19).value = f_(
      `IF(E${r}>=100,"No aplica",IF(R${r}<=0,"Sin meses",IF(Q${r}>=I${r}*R${r},0,MIN(ROUND(I${r}-Q${r}/R${r},2),G${r}))))`,
      textoSistema ?? res.montoCalculado ?? 0
    )
    fila.getCell(20).value = f_(
      `IF(AND(E${r}<100,R${r}>0,Q${r}>=I${r}*R${r}),ROUND(Q${r}-I${r}*R${r},2),0)`,
      res.saldoFavor
    )
    fila.getCell(21).value = textoSistema ?? res.montoMensual ?? 0
    fila.getCell(22).value = f_(
      `IF(ISNUMBER(S${r}),IF(ABS(S${r}-U${r})<0.005,"Sí","REVISAR"),IF(S${r}=U${r},"Sí","REVISAR"))`,
      'Sí'
    )
    fila.getCell(23).value = h.mesesPorPagar.join(', ')
    fila.getCell(24).value = ETIQUETA_ESTADO[res.estado] ?? res.estado
    for (const c of [9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22]) {
      fila.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FF' } }
    }
    fila.getCell(19).font = { bold: true }
  })
  const ultima = FILA_TITULOS + hojas.length
  resumen.autoFilter = { from: { row: FILA_TITULOS, column: 1 }, to: { row: FILA_TITULOS, column: columnas.length } }
  if (hojas.length) {
    resumen.addConditionalFormatting({
      ref: `V${FILA_TITULOS + 1}:V${ultima}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"REVISAR"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Sí"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } } },
      ],
    })
  }

  // ── Una hoja por alumno ────────────────────────────────────────────────────
  for (const { f, nombre, h } of hojas) {
    hojaAlumno(libro.addWorksheet(nombre), f, h, meta)
  }

  // ── Cómo se calcula ────────────────────────────────────────────────────────
  const guia = libro.addWorksheet('Cómo se calcula')
  guia.getColumn(1).width = 30
  guia.getColumn(2).width = 100
  const lineas: [string, string][] = [
    ['Cómo se calcula la beca SEP', ''],
    ['Colegiatura con SEP', 'Colegiatura oficial − (colegiatura oficial × % SEP). Igual para la inscripción.'],
    ['Pagos netos', 'A cada pago se le quitan los recargos ($75 por mes de atraso) y cargos que no son colegiatura (hoja Pagos).'],
    ['Saldo de colegiaturas', 'Suma de lo pagado neto en los meses con pago − colegiatura con SEP × esos meses. Si pagó de menos, resta.'],
    ['Saldo de inscripción', 'Inscripción pagada neta − inscripción con SEP. Si pagó menos o no pagó, es $0.'],
    ['Saldo a favor', 'Saldo de colegiaturas + saldo de inscripción.'],
    ['Meses por pagar', 'Meses del plan (10 u 11) − meses ya transcurridos (incluye meses cubiertos a mano con $0).'],
    ['Pago mensual', 'Colegiatura con SEP − saldo a favor ÷ meses por pagar (redondeado al centavo, máximo la colegiatura oficial).'],
    ['Año completo', 'Si el saldo a favor alcanza para todos los meses por pagar, el pago mensual es $0 y lo que sobra se devuelve.'],
    // 2026-10-09 - Regla nueva: la SEP siempre sustituye a la beca actual.
    ['Beca actual', 'La beca SEP sustituye cualquier otra beca (Winston / convenio), aunque sea mayor; la otra beca se pierde.'],
    ['Beca del 100 %', 'No paga colegiatura: la beca SEP no se aplica.'],
    ['¿Coincide?', 'Compara la fórmula de Excel con el pago mensual que calculó el sistema. "REVISAR" indica que hay que verlo a mano.'],
    ['Hojas por alumno', 'Cada alumno tiene su hoja con el cálculo paso a paso (clic en su nombre en Resumen).'],
  ]
  lineas.forEach(([a, b], i) => {
    const fila = guia.addRow([a, b])
    fila.getCell(1).font = { bold: true, ...(i === 0 ? { size: 14, color: { argb: AZUL } } : {}) }
    fila.getCell(2).alignment = { wrapText: true }
  })

  return Buffer.from(await libro.xlsx.writeBuffer())
}

function hojaAlumno(ws: ExcelJS.Worksheet, f: FilaExcel, h: HojaCalculo | null, meta: MetaLibro) {
  ws.getColumn(1).width = 38
  ws.getColumn(2).width = 52
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 14
  ws.getColumn(6).width = 14
  ws.getColumn(7).width = 14
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }

  const titulo = ws.addRow([f.nombre])
  titulo.font = { bold: true, size: 14, color: { argb: AZUL } }
  ws.addRow([`No. control ${f.alumnoRef} · Ciclo ${meta.ciclo} · ${f.nivel != null ? NOMBRE_NIVEL[f.nivel] ?? '' : ''} · Plan ${f.entrada?.planMeses ?? f.planMeses ?? '—'} meses`]).font = { size: 10 }
  ws.addRow(['← Volver al resumen']).getCell(1).value = { text: '← Volver al resumen', hyperlink: "#'Resumen'!A1" }
  ws.addRow([])

  if (!h) {
    ws.addRow([f.nota ?? 'No se puede calcular: falta porcentaje, plan o precios del ciclo.']).font = { bold: true, color: { argb: 'FF9C0006' } }
    return
  }

  const resultado = ws.addRow(['RESULTADO', h.conclusion])
  resultado.font = { bold: true }
  resultado.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIMA } }
  resultado.getCell(2).alignment = { wrapText: true }
  if (h.mensual != null) {
    const m = ws.addRow(['Pago mensual', '', h.mensual])
    m.font = { bold: true, size: 13 }
    m.getCell(3).numFmt = MONEDA
  }
  ws.addRow([])

  const filaPaso = (texto: string) => {
    const r = ws.addRow([texto])
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    for (let c = 1; c <= 3; c++) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  }
  const tabla = (titulos: string[], filas: (string | number)[][], monedaDesde: number) => {
    const t = ws.addRow(titulos)
    t.font = { bold: true }
    t.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FF' } }))
    for (const valores of filas) {
      const r = ws.addRow(valores)
      r.eachCell((c, n) => {
        if (n >= monedaDesde && typeof c.value === 'number') c.numFmt = MONEDA
      })
    }
  }

  for (const p of h.pasos) {
    filaPaso(`${p.numero}. ${p.titulo}`)
    if (p.explicacion) ws.addRow([p.explicacion]).font = { italic: true, size: 9 }
    if (p.numero === 4 && h.meses.length) {
      tabla(
        ['Mes', 'Fecha de pago', 'Pagado', '− Recargo', '= Neto', '− Con SEP', '= Saldo'],
        h.meses.map((m) => [m.nombre, m.fecha, m.pagado, m.recargo, m.neto, m.conSep ?? '—', m.diferencia ?? (m.cuenta ? '—' : 'no cuenta')]),
        3
      )
    }
    for (const r of p.renglones) {
      const fila = ws.addRow([r.texto, r.formula, r.formula ? `= ${r.resultado}` : r.resultado])
      fila.getCell(3).alignment = { horizontal: 'right' }
      if (r.destacado) fila.font = { bold: true }
    }
    for (const n of p.notas ?? []) {
      const fila = ws.addRow([n])
      fila.font = { size: 9, color: { argb: 'FF444444' } }
    }
    if (p.numero === 8 && h.reparto.length && h.totalesReparto) {
      tabla(
        ['Mes por pagar', 'Colegiatura con SEP', '− Saldo aplicado', '= A pagar'],
        [
          ...h.reparto.map((x) => [x.nombre, x.conSep, x.abono, x.aPagar]),
          ['Total', h.totalesReparto.conSep, h.totalesReparto.abono, h.totalesReparto.aPagar],
        ],
        2
      )
    }
    ws.addRow([])
  }

  if (h.comprobacion) {
    filaPaso('Comprobación: lo pagado + lo que falta = costo anual con SEP')
    for (const r of h.comprobacion.renglones) {
      const fila = ws.addRow([r.texto, r.formula, r.formula ? `= ${r.resultado}` : r.resultado])
      fila.getCell(3).alignment = { horizontal: 'right' }
      if (r.destacado) fila.font = { bold: true }
    }
    const c = h.comprobacion
    const estado = ws.addRow([c.diferencia === 0 ? 'Cuadra al centavo.' : c.cuadra ? `Cuadra. Diferencia explicada:` : 'NO CUADRA: revisar antes de liberar.'])
    estado.font = { bold: true, color: { argb: c.cuadra ? 'FF006100' : 'FF9C0006' } }
    for (const x of c.explicacion) ws.addRow([x]).font = { size: 9 }
  }

  ws.addRow([])
  ws.addRow([])
  ws.addRow(['Revisó (nombre y firma): ______________________', 'Fecha: ____________', ''])
  ws.addRow(['Liberado en Servicios Administrativos: ________________'])
}
