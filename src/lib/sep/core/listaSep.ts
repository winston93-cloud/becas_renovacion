// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-10-03 — Lista SEP de alumnos becados: de tabla o texto libre a filas normalizadas (función pura).
 *
 * Acepta lo que llegue: Excel/CSV con encabezados en cualquier orden y con sinónimos, texto pegado
 * (una línea por alumno, p. ej. "91313 20 11" o "PEREZ LOPEZ JUAN 25%") o el texto de un PDF.
 * No decide a qué alumno corresponde cada fila: eso lo hace la identificación con la base.
 */

import { normalizarNombre, tokensNombre } from './nombres'
import type { PlanMeses } from './ciclo'

export type FilaLista = {
  /** Dónde estaba en el original ("Hoja1 fila 5", "línea 3"). */
  origen: string
  alumnoRef: number | null
  curp: string | null
  nombre: string | null
  porcentajeSep: number | null
  planMeses: PlanMeses | null
  /** Texto original de la fila, para mostrarlo en la vista previa. */
  original: string
  errores: string[]
  /** Fila repetida dentro de la misma lista (se omite al aplicar). */
  duplicada: boolean
}

type Campo = 'ref' | 'curp' | 'nombre' | 'app' | 'apm' | 'nombres' | 'pct' | 'plan'

/** Sinónimos de encabezado, ya normalizados (sin acentos, minúsculas). */
const SINONIMOS: Record<Campo, string[]> = {
  ref: ['no control', 'num control', 'numero control', 'numero de control', 'control', 'matricula', 'no ref', 'referencia', 'alumno ref', 'clave', 'no alumno', 'id alumno'],
  curp: ['curp'],
  nombre: ['nombre completo', 'nombre del alumno', 'alumno', 'nombre alumno', 'beneficiario', 'nombre'],
  app: ['apellido paterno', 'paterno', 'primer apellido', 'ap paterno'],
  apm: ['apellido materno', 'materno', 'segundo apellido', 'ap materno'],
  nombres: ['nombres', 'nombre s', 'nombre(s)'],
  pct: ['porcentaje de beca', 'porcentaje beca', 'porcentaje', 'beca sep', 'beca', 'pct', 'descuento', '% beca', '%'],
  plan: ['plan de pagos', 'plan', 'meses', 'modalidad', 'pago a'],
}

const normEnc = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[._:#°º]/g, ' ')
    .replace(/\bde\b|\bdel\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Índice de cada campo reconocido en la fila de encabezados. */
export function detectarColumnas(encabezados: string[]): Partial<Record<Campo, number>> {
  const res: Partial<Record<Campo, number>> = {}
  const usados = new Set<number>()
  const encs = encabezados.map(normEnc)
  // Primero coincidencias exactas, luego "contiene", para que "nombre" no se coma "apellido paterno".
  for (const modo of ['exacto', 'contiene'] as const) {
    for (const campo of Object.keys(SINONIMOS) as Campo[]) {
      if (res[campo] != null) continue
      for (const sin of SINONIMOS[campo]) {
        const s = normEnc(sin)
        const idx = encs.findIndex((e, i) => !usados.has(i) && e && (modo === 'exacto' ? e === s : s.length >= 3 && e.includes(s)))
        if (idx >= 0) {
          res[campo] = idx
          usados.add(idx)
          break
        }
      }
    }
  }
  return res
}

/** "20", "20 %", "0.20", 20 → 20. Fuera de (0, 100] → null. */
export function leerPorcentaje(v: unknown): number | null {
  if (v == null || v === '') return null
  const t = String(v).replace(',', '.').replace(/[^\d.]/g, '')
  if (!t) return null
  let n = Number(t)
  if (!Number.isFinite(n)) return null
  if (n > 0 && n <= 1 && !String(v).includes('%')) n = n * 100
  n = Math.round(n * 100) / 100
  return n > 0 && n <= 100 ? n : null
}

/** "10", "10m", "11 meses", "Plan 11" → 10 | 11. */
export function leerPlan(v: unknown): PlanMeses | null {
  const m = String(v ?? '').match(/\b(10|11)\b|\b(10|11)\s*m/i)
  const n = Number(m?.[1] ?? m?.[2])
  return n === 10 || n === 11 ? n : null
}

const REGEX_CURP = /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i
/** En columna "No. control" se aceptan 4 a 6 dígitos; en texto libre solo 5 (los años también tienen 4). */
const REGEX_REF = /^\d{4,6}$/
const REGEX_REF_LIBRE = /^\d{5}$/
const REGEX_FECHA = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g

/** Palabras de una línea libre que no son parte del nombre. */
const RUIDO = new Set([
  'plan', 'meses', 'mes', 'beca', 'sep', 'porcentaje', 'alumno', 'nombre', 'control', 'no', 'num', 'numero', 'curp',
  'maternal', 'kinder', 'preescolar', 'primaria', 'secundaria', 'grado', 'grupo', 'nivel', 'm',
])

/** Una línea de texto libre → fila. */
export function leerLinea(texto: string, origen: string): FilaLista {
  const original = texto.trim()
  let resto = ` ${original} `.replace(REGEX_FECHA, ' ')
  const curp = resto.match(REGEX_CURP)?.[0]?.toUpperCase() ?? null
  if (curp) resto = resto.replace(REGEX_CURP, ' ')

  let planMeses: PlanMeses | null = null
  const plan = resto.match(/\b(?:plan\s*(?:de\s*)?)?(10|11)\s*(?:m\b|meses\b)|\bplan\s*(?:de\s*)?(10|11)\b/i)
  if (plan) {
    planMeses = Number(plan[1] ?? plan[2]) as PlanMeses
    resto = resto.replace(plan[0], ' ')
  }

  let porcentajeSep: number | null = null
  const pct = resto.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/) ?? resto.match(/\b(0[.,]\d{1,2})\b/)
  if (pct) {
    porcentajeSep = leerPorcentaje(pct[0])
    resto = resto.replace(pct[0], ' ')
  }

  const numeros = Array.from(resto.matchAll(/\b\d+(?:[.,]\d+)?\b/g)).map((m) => m[0])
  let alumnoRef: number | null = null
  const ref = numeros.find((n) => REGEX_REF_LIBRE.test(n))
  if (ref) alumnoRef = Number(ref)
  const chicos = numeros.filter((n) => n !== ref && Number(n.replace(',', '.')) <= 100)
  if (porcentajeSep == null && chicos.length) porcentajeSep = leerPorcentaje(chicos.shift())
  if (planMeses == null && chicos.length) planMeses = leerPlan(chicos.shift())

  const palabras = resto
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .split(/[\s,;|\t]+/)
    .filter((p) => /[a-záéíóúüñ]/i.test(p) && !RUIDO.has(normalizarNombre(p)) && normalizarNombre(p).length >= 2)
  const nombre = palabras.length ? palabras.join(' ').replace(/\s+/g, ' ').trim() : null
  return validar({ origen, alumnoRef, curp, nombre, porcentajeSep, planMeses, original, errores: [], duplicada: false })
}

function validar(f: FilaLista): FilaLista {
  const errores: string[] = []
  if (f.porcentajeSep == null) errores.push('Sin porcentaje de beca SEP.')
  if (f.alumnoRef == null && !f.curp && !(f.nombre && tokensNombre(f.nombre).length >= 2)) {
    errores.push('Sin número de control ni nombre completo.')
  }
  return { ...f, errores }
}

const celda = (fila: unknown[], i: number | undefined) => (i == null ? '' : String(fila[i] ?? '').trim())

/** Tabla (Excel/CSV) → filas. Busca el encabezado en las primeras 10 filas; si no hay, lee cada fila como texto libre. */
export function leerTabla(tabla: unknown[][], nombreHoja = ''): FilaLista[] {
  const pref = nombreHoja ? `${nombreHoja} ` : ''
  const limite = Math.min(10, tabla.length)
  let filaEnc = -1
  let cols: Partial<Record<Campo, number>> = {}
  for (let i = 0; i < limite; i++) {
    const c = detectarColumnas(tabla[i].map((x) => String(x ?? '')))
    const tieneId = c.ref != null || c.curp != null || c.nombre != null || c.app != null || c.nombres != null
    if (tieneId && c.pct != null) {
      filaEnc = i
      cols = c
      break
    }
  }
  const filas: FilaLista[] = []
  tabla.forEach((fila, i) => {
    if (i <= filaEnc) return
    const texto = fila.map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
    if (!texto) return
    const origen = `${pref}fila ${i + 1}`
    if (filaEnc < 0) {
      filas.push(leerLinea(texto, origen))
      return
    }
    const refTxt = celda(fila, cols.ref).replace(/\D/g, '')
    // Con columnas de apellidos, "Nombre" es solo el nombre de pila: se arma el completo.
    const separado = cols.app != null || cols.apm != null
    const nombre =
      (separado
        ? [celda(fila, cols.app), celda(fila, cols.apm), celda(fila, cols.nombres) || celda(fila, cols.nombre)].filter(Boolean).join(' ')
        : celda(fila, cols.nombre) || celda(fila, cols.nombres)) || null
    const curpTxt = celda(fila, cols.curp).toUpperCase()
    filas.push(
      validar({
        origen,
        alumnoRef: REGEX_REF.test(refTxt) ? Number(refTxt) : null,
        curp: REGEX_CURP.test(curpTxt) ? curpTxt : null,
        nombre,
        porcentajeSep: leerPorcentaje(celda(fila, cols.pct)),
        planMeses: leerPlan(celda(fila, cols.plan)),
        original: texto,
        errores: [],
        duplicada: false,
      })
    )
  })
  return filas
}

/** Separa una línea CSV respetando comillas. */
function partirCsv(linea: string, sep: string): string[] {
  const out: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else comillas = !comillas
    } else if (ch === sep && !comillas) {
      out.push(actual)
      actual = ''
    } else actual += ch
  }
  out.push(actual)
  return out
}

/** Texto (CSV, pegado de Excel o de un PDF) → filas. Con separador consistente se lee como tabla. */
export function leerTexto(texto: string, nombre = ''): FilaLista[] {
  const lineas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (!lineas.length) return []
  const muestra = lineas.slice(0, 10)
  const sep = ['\t', ';', ','].find((s) => muestra.filter((l) => l.includes(s)).length >= Math.ceil(muestra.length * 0.6))
  if (sep) {
    const tabla = lineas.map((l) => partirCsv(l, sep))
    const conEncabezado = tabla.slice(0, 10).some((f) => {
      const c = detectarColumnas(f)
      return c.pct != null && (c.ref != null || c.nombre != null || c.app != null || c.curp != null)
    })
    // Con coma pero sin encabezado, "20,5" o "PEREZ, JUAN" confunden: mejor línea por línea.
    if (conEncabezado || sep !== ',') return marcarDuplicados(leerTabla(tabla, nombre))
  }
  const pref = nombre ? `${nombre} ` : ''
  return marcarDuplicados(lineas.map((l, i) => leerLinea(l, `${pref}línea ${i + 1}`)))
}

/** Marca como duplicadas las filas repetidas (mismo número de control, CURP o nombre). */
export function marcarDuplicados(filas: FilaLista[]): FilaLista[] {
  const vistos = new Map<string, string>()
  return filas.map((f) => {
    if (f.duplicada) return f
    const clave = f.alumnoRef != null ? `r${f.alumnoRef}` : f.curp ? `c${f.curp}` : f.nombre ? `n${tokensNombre(f.nombre).sort().join(' ')}` : null
    if (!clave) return f
    const previo = vistos.get(clave)
    if (previo) return { ...f, duplicada: true, errores: [...f.errores, `Repetida (igual que ${previo}).`] }
    vistos.set(clave, f.origen)
    return f
  })
}

/** Filas sin nada útil (títulos, totales, renglones vacíos) que no vale la pena mostrar. */
export const esFilaVacia = (f: FilaLista) => f.alumnoRef == null && !f.curp && !f.nombre && f.porcentajeSep == null
