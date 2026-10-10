// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-10-05 — Hoja de cálculo de una beca SEP (función pura, sin BD).
 * Convierte el resultado del prorrateo en pasos con cada operación escrita (precio, porcentaje,
 * resta, suma, división) para que una sola persona pueda revisarlo a mano antes de liberar la beca.
 * No calcula nada distinto a prorrateo.ts: solo lo explica y comprueba que las cuentas cuadren.
 */

import { conceptosPlan, NOMBRE_CONCEPTO, type PlanMeses } from './ciclo'
import { pesos, r2 } from './dinero'
import type { MesEvaluado } from './alertas'
import type { ResultadoPagoNeto } from './recargos'
import type { EstadoProrrateo, ResultadoProrrateo } from './prorrateo'
import type { Evaluacion } from './evaluar'

export type EntradaHoja = {
  porcentajeSep: number
  /** null si no se conoce (cálculo guardado sin ese dato). */
  porcentajeBecaActual: number | null
  planMeses: PlanMeses
  colegiaturaOficial: number
  inscripcionOficial: number
  meses: MesEvaluado[]
  inscripcion: ResultadoPagoNeto | null
  resultado: ResultadoProrrateo
}

/** Un renglón de cuenta: "Colegiatura oficial × 50 % = $2,735.00". */
export type Renglon = { texto: string; formula: string; resultado: string; destacado?: boolean }

export type Paso = { numero: number; titulo: string; explicacion?: string; renglones: Renglon[]; notas?: string[] }

export type FilaMesHoja = {
  concepto: string
  nombre: string
  fecha: string
  pagado: number
  recargo: number
  neto: number
  conSep: number | null
  diferencia: number | null
  cuenta: boolean
  cubierto: boolean
  nota: string
}

export type FilaReparto = { concepto: string; nombre: string; conSep: number; abono: number; aPagar: number }

export type HojaCalculo = {
  estado: EstadoProrrateo
  aplicaSep: boolean
  pasos: Paso[]
  meses: FilaMesHoja[]
  totalesMeses: { pagado: number; recargo: number; neto: number; conSep: number; diferencia: number; contados: number }
  reparto: FilaReparto[]
  totalesReparto: { conSep: number; abono: number; aPagar: number } | null
  conclusion: string
  /** Lo que se libera en Servicios Administrativos. */
  mensual: number | null
  mesesPorPagar: string[]
  saldoSobrante: number
  comprobacion: { renglones: Renglon[]; diferencia: number; cuadra: boolean; explicacion: string[] } | null
}

const pct = (n: number) => `${Number(n.toFixed(2))} %`
const nombreMes = (c: string) => NOMBRE_CONCEPTO[c] ?? c
const conSigno = (n: number) => (n < 0 ? `− ${pesos(Math.abs(n))}` : pesos(n))

const REGLA: Record<string, string> = {
  recargo_separado: 'recargo registrado aparte',
  cargo_extra: 'cargo de horario extendido (no cuenta)',
  tope_precio_oficial: 'pagó más que el precio oficial',
  multiplo_75: 'recargo incluido en el pago',
}

/** Entrada de la hoja a partir de una evaluación completa; null si falta porcentaje, plan o precios. */
export function entradaDesdeEvaluacion(ev: Evaluacion, porcentajeSep: number | null): EntradaHoja | null {
  if (!ev.listo || !ev.resultado || !ev.planMeses || !ev.colegiaturaOficial || !ev.inscripcionOficial || porcentajeSep == null) return null
  return {
    porcentajeSep,
    porcentajeBecaActual: ev.becaActualPct,
    planMeses: ev.planMeses,
    colegiaturaOficial: ev.colegiaturaOficial,
    inscripcionOficial: ev.inscripcionOficial,
    meses: ev.meses,
    inscripcion: ev.inscripcion,
    resultado: ev.resultado,
  }
}

export function armarHojaCalculo(e: EntradaHoja): HojaCalculo {
  const r = e.resultado
  const N = e.planMeses
  const oficial = e.colegiaturaOficial
  const insOficial = e.inscripcionOficial
  const pasos: Paso[] = []

  // ── Paso 1: precios oficiales ──────────────────────────────────────────────
  const anualOficial = r2(oficial * N + insOficial)
  pasos.push({
    numero: 1,
    titulo: 'Precios oficiales del ciclo (sin ninguna beca)',
    renglones: [
      { texto: `Colegiatura mensual (plan de ${N} meses)`, formula: '', resultado: pesos(oficial) },
      { texto: 'Inscripción', formula: '', resultado: pesos(insOficial) },
      {
        texto: 'Costo anual sin beca',
        formula: `${pesos(oficial)} × ${N} meses + ${pesos(insOficial)}`,
        resultado: pesos(anualOficial),
        destacado: true,
      },
    ],
  })

  // ── Paso 2: beca actual contra beca SEP ────────────────────────────────────
  const actual = e.porcentajeBecaActual
  const renglonesActual: Renglon[] = []
  if (actual != null && actual > 0) {
    const descActual = r2(oficial * (actual / 100))
    renglonesActual.push(
      { texto: `Descuento de la beca actual (${pct(actual)})`, formula: `${pesos(oficial)} × ${pct(actual)}`, resultado: pesos(descActual) },
      { texto: 'Colegiatura con la beca actual', formula: `${pesos(oficial)} − ${pesos(descActual)}`, resultado: pesos(r2(oficial - descActual)) }
    )
  }
  const decision =
    r.estado === 'excluido_docente'
      ? `Beca actual del ${pct(actual ?? 100)}: no paga colegiatura, la beca SEP no se aplica.`
      : r.estado === 'beca_actual_mayor'
        ? `La beca actual (${pct(actual ?? 0)}) es mayor que la SEP (${pct(e.porcentajeSep)}): conserva su beca actual (cálculo anterior al 2026-10-08).`
        : actual != null && actual > e.porcentajeSep
          ? // 2026-10-09 - La SEP sustituye a la beca actual aunque sea mayor: lo pagado de menos se reparte en los meses que faltan.
            `Pierde su beca actual (${pct(actual)}) y se aplica solo la SEP (${pct(e.porcentajeSep)}), aunque es menor. Lo que pagó de menos en los meses anteriores se reparte en los meses que faltan.`
          : actual != null && actual > 0
          ? `Pierde su beca actual (${pct(actual)}) y se aplica solo la SEP (${pct(e.porcentajeSep)}); lo que pagó de más se le reconoce.`
          : actual == null
            ? `Beca SEP del ${pct(e.porcentajeSep)} (la beca actual no quedó guardada en este cálculo).`
            : `No tiene otra beca: se aplica la SEP del ${pct(e.porcentajeSep)}.`
  pasos.push({
    numero: 2,
    titulo: 'Beca actual contra beca SEP',
    renglones: [
      { texto: 'Beca actual (Winston / convenio)', formula: '', resultado: actual == null ? 'sin dato' : pct(actual) },
      { texto: 'Beca SEP otorgada', formula: '', resultado: pct(e.porcentajeSep) },
      ...renglonesActual,
    ],
    notas: [decision],
  })

  // ── Paso 3: precio con beca SEP ────────────────────────────────────────────
  const descCol = r2(oficial - r.colSep)
  const descIns = r2(insOficial - r.insSep)
  const anualSep = r2(r.colSep * N + r.insSep)
  pasos.push({
    numero: 3,
    titulo: `Precio con la beca SEP del ${pct(e.porcentajeSep)}`,
    renglones: [
      { texto: 'Descuento SEP en colegiatura', formula: `${pesos(oficial)} × ${pct(e.porcentajeSep)}`, resultado: pesos(descCol) },
      { texto: 'Colegiatura con SEP', formula: `${pesos(oficial)} − ${pesos(descCol)}`, resultado: pesos(r.colSep), destacado: true },
      { texto: 'Descuento SEP en inscripción', formula: `${pesos(insOficial)} × ${pct(e.porcentajeSep)}`, resultado: pesos(descIns) },
      { texto: 'Inscripción con SEP', formula: `${pesos(insOficial)} − ${pesos(descIns)}`, resultado: pesos(r.insSep), destacado: true },
      {
        texto: 'Costo anual con SEP',
        formula: `${pesos(r.colSep)} × ${N} meses + ${pesos(r.insSep)}`,
        resultado: pesos(anualSep),
        destacado: true,
      },
    ],
  })

  // ── Paso 4: colegiaturas ya pagadas ────────────────────────────────────────
  const contados = new Map(r.detalleMeses.map((d) => [d.conceptoNo, d]))
  const meses: FilaMesHoja[] = e.meses.map((m) => {
    const d = contados.get(m.concepto)
    const cuenta = !!d
    const cubierto = !!d?.cubierto
    return {
      concepto: m.concepto,
      nombre: nombreMes(m.concepto),
      fecha: m.fecha,
      pagado: m.cubierto ? 0 : m.bruto,
      recargo: m.recargoTotal,
      neto: m.neto,
      conSep: cuenta && !cubierto ? r.colSep : null,
      diferencia: cuenta && !cubierto ? d!.diferencia : null,
      cuenta,
      cubierto,
      nota: [
        ...m.reglas.map((x) => REGLA[x] ?? x),
        ...(m.cubierto ? ['mes cubierto a mano ($0)'] : []),
        ...(cuenta ? [] : ['no entra al cálculo']),
      ].join(' · '),
    }
  })
  const reales = meses.filter((m) => m.cuenta && !m.cubierto)
  const totalesMeses = {
    pagado: r2(reales.reduce((s, m) => s + m.pagado, 0)),
    recargo: r2(reales.reduce((s, m) => s + m.recargo, 0)),
    neto: r2(reales.reduce((s, m) => s + m.neto, 0)),
    conSep: r2(r.colSep * reales.length),
    diferencia: r.excedenteColegiatura,
    contados: reales.length,
  }
  const cubiertos = meses.filter((m) => m.cubierto).length
  pasos.push({
    numero: 4,
    titulo: 'Colegiaturas ya pagadas (sin recargos)',
    explicacion:
      'A cada mes pagado se le quitan los recargos; lo que pagó de más contra la colegiatura con SEP es saldo a su favor (si pagó de menos, resta).',
    renglones: [
      {
        texto: `Total pagado neto en ${reales.length} ${reales.length === 1 ? 'mes' : 'meses'}`,
        formula: `${pesos(totalesMeses.pagado)} pagado − ${pesos(totalesMeses.recargo)} recargos`,
        resultado: pesos(totalesMeses.neto),
      },
      {
        texto: 'Lo que debía pagar con SEP esos meses',
        formula: `${pesos(r.colSep)} × ${reales.length}`,
        resultado: pesos(totalesMeses.conSep),
      },
      {
        texto: 'Saldo de colegiaturas',
        formula: `${pesos(totalesMeses.neto)} − ${pesos(totalesMeses.conSep)}`,
        resultado: conSigno(r.excedenteColegiatura),
        destacado: true,
      },
    ],
    notas: cubiertos ? [`${cubiertos} ${cubiertos === 1 ? 'mes cubierto' : 'meses cubiertos'} a mano con $0 cuentan como transcurridos sin saldo.`] : undefined,
  })

  // ── Paso 5: inscripción ────────────────────────────────────────────────────
  const ins = e.inscripcion
  const insNeto = ins?.neto ?? 0
  const renglonesIns: Renglon[] = []
  const notasIns: string[] = []
  if (ins && ins.bruto > 0) {
    renglonesIns.push(
      { texto: 'Inscripción pagada neta', formula: `${pesos(ins.bruto)} pagado − ${pesos(ins.recargoTotal)} recargos`, resultado: pesos(insNeto) },
      {
        texto: 'Saldo de inscripción',
        formula: `${pesos(insNeto)} − ${pesos(r.insSep)} (inscripción con SEP)`,
        resultado: pesos(r.excedenteInscripcion),
        destacado: true,
      }
    )
    if (insNeto < r.insSep) notasIns.push('Pagó menos que la inscripción con SEP: no genera saldo (se toma $0).')
  } else {
    renglonesIns.push({ texto: 'Saldo de inscripción', formula: 'sin pago de inscripción registrado', resultado: pesos(0), destacado: true })
  }
  pasos.push({ numero: 5, titulo: 'Inscripción', renglones: renglonesIns, notas: notasIns.length ? notasIns : undefined })

  // ── Paso 6: saldo a favor total ────────────────────────────────────────────
  pasos.push({
    numero: 6,
    titulo: 'Saldo a favor total',
    renglones: [
      {
        texto: 'Saldo a favor',
        formula: `${conSigno(r.excedenteColegiatura)} colegiaturas + ${pesos(r.excedenteInscripcion)} inscripción`,
        resultado: conSigno(r.excedenteTotal),
        destacado: true,
      },
    ],
    notas: r.excedenteTotal < 0 ? ['El saldo es en contra: los meses pagados quedaron por debajo del precio con SEP y se reparte como cargo.'] : undefined,
  })

  // ── Paso 7: meses por pagar ────────────────────────────────────────────────
  const porPagar = conceptosPlan(N).filter((c) => !contados.has(c))
  pasos.push({
    numero: 7,
    titulo: 'Meses que faltan por pagar',
    renglones: [
      {
        texto: 'Meses por pagar',
        formula: `${N} meses del plan − ${r.mesesPagados} ya transcurridos`,
        resultado: `${r.mesesRestantes} ${r.mesesRestantes === 1 ? 'mes' : 'meses'}`,
        destacado: true,
      },
    ],
    notas: porPagar.length ? [porPagar.map(nombreMes).join(', ')] : ['No quedan meses por pagar en el ciclo.'],
  })

  // ── Paso 8: reparto del saldo en partes iguales ────────────────────────────
  let reparto: FilaReparto[] = []
  let totalesReparto: HojaCalculo['totalesReparto'] = null
  let conclusion = ''
  const n = r.mesesRestantes
  const topado = r.mensajes.some((m) => m.includes('se topa'))
  if (!r.aplicaSep) {
    conclusion = r.mensajes[r.mensajes.length - 1] ?? 'No se aplica beca SEP.'
  } else if (r.anioCompleto) {
    const costoRestante = r2(r.colSep * n)
    pasos.push({
      numero: 8,
      titulo: 'El saldo cubre el resto del año',
      renglones: [
        { texto: 'Costo de los meses que faltan', formula: `${pesos(r.colSep)} × ${n}`, resultado: pesos(costoRestante) },
        { texto: 'Saldo que sobra', formula: `${pesos(r.excedenteTotal)} − ${pesos(costoRestante)}`, resultado: pesos(r.saldoFavor), destacado: true },
        { texto: 'Pago mensual', formula: 'el saldo alcanza para todos los meses', resultado: pesos(0), destacado: true },
      ],
      notas: r.saldoFavor > 0 ? ['El saldo que sobra se devuelve o se abona (orden de devolución).'] : undefined,
    })
    reparto = porPagar.map((c) => ({ concepto: c, nombre: nombreMes(c), conSep: r.colSep, abono: r.colSep, aPagar: 0 }))
    totalesReparto = { conSep: costoRestante, abono: costoRestante, aPagar: 0 }
    conclusion = `No paga colegiatura el resto del ciclo (${porPagar.map(nombreMes).join(', ')}).${r.saldoFavor > 0 ? ` Además tiene ${pesos(r.saldoFavor)} a favor.` : ''}`
  } else {
    const calculado = r.montoCalculado ?? 0
    // Se muestra el descuento ya redondeado que usó el motor, para que la resta cuadre al centavo.
    const porMes = topado ? r2(r.excedenteTotal / n) : r2(r.colSep - calculado)
    const renglones: Renglon[] = [
      {
        texto: 'Saldo que se descuenta cada mes',
        formula: `${conSigno(r.excedenteTotal)} ÷ ${n} ${n === 1 ? 'mes' : 'meses'}`,
        resultado: conSigno(porMes),
      },
      {
        texto: 'Pago mensual con SEP',
        formula: topado ? `${pesos(r.colSep)} − ${conSigno(porMes)} (topado)` : `${pesos(r.colSep)} − ${conSigno(porMes)}`,
        resultado: pesos(calculado),
        destacado: true,
      },
    ]
    const notas: string[] = []
    if (topado) notas.push(`El resultado superaba la colegiatura oficial; se cobra como máximo ${pesos(oficial)}.`)
    if (r.ajusteManualAplicado && r.montoMensual != null) {
      renglones.push({ texto: 'Ajuste manual autorizado', formula: 'sustituye al cálculo', resultado: pesos(r.montoMensual), destacado: true })
    }
    pasos.push({
      numero: 8,
      titulo: 'Reparto del saldo en partes iguales',
      explicacion: 'El saldo a favor se divide entre los meses que faltan y se descuenta igual en cada uno.',
      renglones,
      notas: notas.length ? notas : undefined,
    })
    const mensual = r.montoMensual ?? calculado
    reparto = porPagar.map((c) => ({ concepto: c, nombre: nombreMes(c), conSep: r.colSep, abono: r2(r.colSep - mensual), aPagar: mensual }))
    totalesReparto = {
      conSep: r2(r.colSep * n),
      abono: r2(reparto.reduce((s, f) => s + f.abono, 0)),
      aPagar: r2(mensual * n),
    }
    conclusion = `Pagar ${pesos(mensual)} cada mes en ${porPagar.map(nombreMes).join(', ')} (${n} ${n === 1 ? 'mes' : 'meses'}, total ${pesos(r2(mensual * n))}).`
  }

  // ── Comprobación: lo pagado + lo que falta = costo anual con SEP ───────────
  let comprobacion: HojaCalculo['comprobacion'] = null
  if (r.aplicaSep) {
    const mensual = r.montoMensual ?? 0
    const pagado = r2(totalesMeses.neto + insNeto)
    const falta = r2(mensual * n)
    const total = r2(pagado + falta - r.saldoFavor)
    const diferencia = r2(total - anualSep)
    const explicacion: string[] = []
    let explicado = 0
    const faltaIns = r2(Math.max(0, r.insSep - insNeto))
    if (faltaIns > 0) {
      explicado -= faltaIns
      explicacion.push(`${conSigno(-faltaIns)}: la inscripción pagada quedó por debajo de la inscripción con SEP.`)
    }
    if (cubiertos) {
      const c = r2(r.colSep * cubiertos)
      explicado -= c
      explicacion.push(`${conSigno(-c)}: ${cubiertos} ${cubiertos === 1 ? 'mes cubierto' : 'meses cubiertos'} a mano con $0.`)
    }
    const resto = r2(diferencia - explicado)
    const centavos = Math.abs(resto) <= r2(0.01 * Math.max(1, n) + 0.01)
    if (resto !== 0) {
      explicacion.push(
        centavos
          ? `${conSigno(resto)}: redondeo de centavos al dividir el saldo entre ${n} meses.`
          : `${conSigno(resto)}: ${r.ajusteManualAplicado ? 'ajuste manual autorizado' : 'tope en la colegiatura oficial'}.`
      )
    }
    comprobacion = {
      renglones: [
        { texto: 'Ya pagado (neto, sin recargos)', formula: `${pesos(totalesMeses.neto)} colegiaturas + ${pesos(insNeto)} inscripción`, resultado: pesos(pagado) },
        { texto: 'Por pagar', formula: `${pesos(mensual)} × ${n}`, resultado: pesos(falta) },
        ...(r.saldoFavor > 0 ? [{ texto: 'Menos saldo que se devuelve', formula: '', resultado: conSigno(-r.saldoFavor) }] : []),
        { texto: 'Total del año', formula: r.saldoFavor > 0 ? `${pesos(pagado)} + ${pesos(falta)} − ${pesos(r.saldoFavor)}` : `${pesos(pagado)} + ${pesos(falta)}`, resultado: pesos(total), destacado: true },
        { texto: 'Costo anual con SEP (paso 3)', formula: '', resultado: pesos(anualSep), destacado: true },
      ],
      diferencia,
      // Cuadra si toda la diferencia tiene explicación (inscripción baja, meses cubiertos, centavos, ajuste o tope).
      cuadra: resto === 0 || centavos || r.ajusteManualAplicado || topado,
      explicacion,
    }
  }

  return {
    estado: r.estado,
    aplicaSep: r.aplicaSep,
    pasos,
    meses,
    totalesMeses,
    reparto,
    totalesReparto,
    conclusion,
    mensual: r.aplicaSep ? r.montoMensual : null,
    mesesPorPagar: porPagar.map(nombreMes),
    saldoSobrante: r.saldoFavor,
    comprobacion,
  }
}
