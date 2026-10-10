// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Lecturas de InsForge para Becas SEP (solo SELECT, ver candado.ts).
 *
 * Trampas de la base que se resuelven aquí:
 *   - `alumno` guarda solo el ciclo vigente: el nivel de ciclos pasados sale de
 *     `alumno_cambio_ciclo_respaldo` (no guarda plan; el plan del ciclo pasado se captura).
 *   - `alumno_beca` guarda solo el ciclo vigente.
 *   - Los numéricos llegan como texto; se convierten aquí.
 */

import 'server-only'
import { cicloPorFecha, fechaIso, type PlanMeses } from '@/lib/sep/core/ciclo'
import type { DatosAlumnoCiclo, FilaPagoConcepto } from '@/lib/sep/core/evaluar'
import { palabrasBusqueda, rankearPorNombre } from '@/lib/sep/core/nombres'
import { consultar } from './cliente'
import { num, txt } from './candado'

export type AlumnoBasico = {
  alumnoId: number
  alumnoRef: number
  nombre: string
  nivel: number | null
  grado: number | null
  plan: PlanMeses | null
  cicloAlumno: number | null
  activo: boolean
}

const n = (v: unknown): number | null => {
  const x = Number(v)
  return v == null || v === '' || !Number.isFinite(x) ? null : x
}
const nombreDe = (f: Record<string, unknown>) =>
  [f.alumno_app, f.alumno_apm, f.alumno_nombre].map((s) => String(s ?? '').trim()).filter(Boolean).join(' ')
const planDe = (mes: unknown): PlanMeses | null => (Number(mes) === 1 ? 10 : Number(mes) === 2 ? 11 : null)

function aAlumno(f: Record<string, unknown>): AlumnoBasico {
  return {
    alumnoId: Number(f.alumno_id),
    alumnoRef: Number(f.alumno_ref),
    nombre: nombreDe(f),
    nivel: n(f.alumno_nivel),
    grado: n(f.alumno_grado),
    plan: planDe(f.mes),
    cicloAlumno: n(f.alumno_ciclo_escolar),
    activo: Number(f.alumno_status) === 1,
  }
}

const COLUMNAS_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, mes, alumno_ciclo_escolar, alumno_status'

/**
 * 2026-10-03 — Nombre completo sin acentos ni mayúsculas, calculado en la consulta (sin depender de
 * la extensión `unaccent`). Las cadenas de `translate` deben medir lo mismo (19 caracteres).
 */
const NOMBRE_SQL =
  "translate(lower(CONCAT(alumno_app,' ',alumno_apm,' ',alumno_nombre)), 'áéíóúüñàèìòùÁÉÍÓÚÜÑ', 'aeiouunaeiouaeiouun')"

export type AlumnoEncontrado = AlumnoBasico & { puntaje: number; exacto: boolean }

/** Resultado de buscar por nombre; `aproximado` = no hubo coincidencia con todas las palabras. */
export type BusquedaNombre = { alumnos: AlumnoEncontrado[]; aproximado: boolean }

const ordenar = (a: AlumnoEncontrado, b: AlumnoEncontrado) =>
  Number(b.exacto) - Number(a.exacto) || b.puntaje - a.puntaje || Number(b.activo) - Number(a.activo)

/**
 * 2026-10-03 — Búsqueda por nombre sin acentos y sin importar el orden de las palabras.
 * 1.º todas las palabras; si no hay nada, 2.º cualquier palabra o su inicio (tolera errores de dedo)
 * y se ordena por parecido. Nunca decide por el usuario: solo ordena candidatos.
 */
export async function buscarPorNombre(texto: string, limite = 20): Promise<BusquedaNombre> {
  const palabras = palabrasBusqueda(texto)
  if (!palabras.length) return { alumnos: [], aproximado: false }
  const todas = palabras.map((p) => `${NOMBRE_SQL} LIKE ${txt(`%${p}%`)}`).join(' AND ')
  const filas = (await consultar(`SELECT ${COLUMNAS_ALUMNO} FROM alumno WHERE ${todas} LIMIT 60`)).map(aAlumno)
  if (filas.length) {
    const alumnos = rankearPorNombre(texto, filas, (a) => a.nombre, 0)
      .map((c) => ({ ...c.item, puntaje: c.puntaje, exacto: c.exacto }))
      .sort(ordenar)
    return { alumnos: alumnos.slice(0, limite), aproximado: false }
  }
  const trozos = Array.from(new Set(palabras.filter((p) => p.length >= 4).flatMap((p) => (p.length >= 5 ? [p, p.slice(0, 4)] : [p]))))
  if (!trozos.length) return { alumnos: [], aproximado: true }
  const alguna = trozos.map((p) => `${NOMBRE_SQL} LIKE ${txt(`%${p}%`)}`).join(' OR ')
  const parecidos = (await consultar(`SELECT ${COLUMNAS_ALUMNO} FROM alumno WHERE ${alguna} LIMIT 300`)).map(aAlumno)
  const alumnos = rankearPorNombre(texto, parecidos, (a) => a.nombre, 0.5)
    .map((c) => ({ ...c.item, puntaje: c.puntaje, exacto: c.exacto }))
    .sort(ordenar)
  return { alumnos: alumnos.slice(0, limite), aproximado: true }
}

/** Búsqueda por número de control exacto o por nombre (máx. 20). */
export async function buscarAlumnosDetalle(texto: string): Promise<BusquedaNombre> {
  const q = texto.trim()
  if (!q) return { alumnos: [], aproximado: false }
  if (/^\d{4,6}$/.test(q)) {
    const filas = (await consultar(`SELECT ${COLUMNAS_ALUMNO} FROM alumno WHERE alumno_ref = ${num(q)} LIMIT 5`)).map(aAlumno)
    return { alumnos: filas.map((a) => ({ ...a, puntaje: 1, exacto: false })), aproximado: false }
  }
  return buscarPorNombre(q)
}

export async function buscarAlumnos(texto: string): Promise<AlumnoBasico[]> {
  return (await buscarAlumnosDetalle(texto)).alumnos
}

export async function alumnoPorRef(ref: number): Promise<AlumnoBasico | null> {
  const f = await consultar(`SELECT ${COLUMNAS_ALUMNO} FROM alumno WHERE alumno_ref = ${num(ref)} LIMIT 1`)
  return f[0] ? aAlumno(f[0]) : null
}

/** Nombres de varios alumnos en una sola lectura. */
export async function nombresPorRef(refs: number[]): Promise<Map<number, AlumnoBasico>> {
  const unicos = Array.from(new Set(refs.filter((r) => Number.isFinite(r))))
  if (!unicos.length) return new Map()
  const filas = await consultar(`SELECT ${COLUMNAS_ALUMNO} FROM alumno WHERE alumno_ref IN (${unicos.map(num).join(',')})`)
  return new Map(filas.map((f) => [Number(f.alumno_ref), aAlumno(f)]))
}

/** Nivel del alumno en el ciclo: el actual o el respaldado al cambiar de ciclo. */
async function nivelEnCiclo(a: AlumnoBasico, ciclo: number): Promise<number | null> {
  if (a.cicloAlumno === ciclo) return a.nivel
  const f = await consultar(
    `SELECT alumno_nivel FROM alumno_cambio_ciclo_respaldo WHERE alumno_id = ${num(a.alumnoId)} AND alumno_ciclo_escolar = ${num(ciclo)} ORDER BY migrado_en DESC LIMIT 1`
  )
  return f[0] ? n(f[0].alumno_nivel) : a.nivel
}

async function precios(nivel: number, ciclo: number) {
  const f = await consultar(
    `SELECT precio_inscripcion, precio_colegiatura, precio_colegiatura2 FROM pago_boucher_precio WHERE alumno_nivel = ${num(nivel)} AND precio_ciclo_escolar = ${num(ciclo)} LIMIT 1`
  )
  if (!f[0]) return null
  return {
    inscripcion: Number(f[0].precio_inscripcion) || 0,
    colegiatura10: Number(f[0].precio_colegiatura) || 0,
    colegiatura11: Number(f[0].precio_colegiatura2) || 0,
  }
}

async function pagosPorConcepto(alumnoId: number, ciclo: number): Promise<FilaPagoConcepto[]> {
  const ce = String(ciclo).padStart(2, '0')
  const filas = await consultar(
    `SELECT SUBSTR(pago_referencia,6,2) AS concepto,
            COALESCE(SUM(pago_importe),0) AS importe,
            COALESCE(SUM(pago_recargo),0) AS recargo,
            MAX(pago_fecha) AS fecha,
            SUM(CASE WHEN pago_cancelado = 3 THEN 1 ELSE 0 END) AS cubiertos
       FROM pago_detalle
      WHERE alumno_id = ${num(alumnoId)}
        AND SUBSTR(pago_referencia,8,2) = ${txt(ce)}
        AND pago_cancelado NOT IN (1, 2)
      GROUP BY SUBSTR(pago_referencia,6,2)`
  )
  return filas.map((f) => ({
    concepto: String(f.concepto ?? '').trim(),
    importe: Number(f.importe) || 0,
    recargo: Number(f.recargo) || 0,
    fecha: fechaIso(f.fecha),
    cubiertos: Number(f.cubiertos) || 0,
  }))
}

async function becaActual(alumnoId: number, ciclo: number): Promise<number | null> {
  const f = await consultar(
    `SELECT beca_porcentaje FROM alumno_beca WHERE alumno_id = ${num(alumnoId)} AND beca_estatus = 1 AND beca_ciclo_escolar = ${num(ciclo)} ORDER BY beca_porcentaje DESC LIMIT 1`
  )
  return f[0] ? n(f[0].beca_porcentaje) : null
}

/** 2026-10-09 - Beca activa del colegio en el ciclo, con su nombre (la que se pierde al aplicar la SEP). */
export async function becaActualDetalle(
  alumnoId: number,
  ciclo: number
): Promise<{ becaId: number | null; clase: string | null; porcentaje: number } | null> {
  const f = await consultar(
    `SELECT b.beca_id, b.beca_porcentaje, c.beca_clase
       FROM alumno_beca b
       LEFT JOIN becas_concepto_beca c ON c.beca_id = b.beca_id
      WHERE b.alumno_id = ${num(alumnoId)} AND b.beca_estatus = 1 AND b.beca_ciclo_escolar = ${num(ciclo)}
      ORDER BY b.beca_porcentaje DESC LIMIT 1`
  )
  if (!f[0]) return null
  const porcentaje = n(f[0].beca_porcentaje) ?? 0
  if (porcentaje <= 0) return null
  const clase = String(f[0].beca_clase ?? '').trim()
  return { becaId: n(f[0].beca_id), clase: clase || null, porcentaje }
}

/** 2026-10-09 - Correos de los familiares que aceptan recibir avisos (familiar_recibir_email = 1), sin repetir. */
export async function correosFamilia(alumnoId: number): Promise<string[]> {
  const filas = await consultar(
    `SELECT familiar_email FROM alumno_familiar
      WHERE alumno_id = ${num(alumnoId)} AND familiar_recibir_email = 1 AND familiar_email IS NOT NULL`
  )
  const correos = filas
    .map((f) => String(f.familiar_email ?? '').trim().toLowerCase())
    .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
  return Array.from(new Set(correos))
}

/** Todo lo que necesita el motor para un alumno y ciclo (null si el alumno no existe). */
export async function datosAlumnoCiclo(ref: number, ciclo: number): Promise<DatosAlumnoCiclo | null> {
  const a = await alumnoPorRef(ref)
  if (!a) return null
  const cicloVigente = cicloPorFecha()
  const nivelCiclo = await nivelEnCiclo(a, ciclo)
  // 2026-10-03: también los precios del ciclo anterior (mismo nivel) para validar los del ciclo nuevo.
  const [p, pAnterior, pagos, beca] = await Promise.all([
    nivelCiclo != null ? precios(nivelCiclo, ciclo) : Promise.resolve(null),
    nivelCiclo != null ? precios(nivelCiclo, ciclo - 1) : Promise.resolve(null),
    pagosPorConcepto(a.alumnoId, ciclo),
    ciclo === cicloVigente ? becaActual(a.alumnoId, ciclo) : Promise.resolve(null),
  ])
  return {
    alumnoId: a.alumnoId,
    alumnoRef: a.alumnoRef,
    nombre: a.nombre,
    ciclo,
    cicloVigente,
    nivelCiclo,
    nivelActual: a.nivel,
    planBase: a.cicloAlumno === ciclo ? a.plan : null,
    precios: p,
    preciosAnterior: pAnterior,
    pagos,
    becaActualBase: beca,
  }
}
