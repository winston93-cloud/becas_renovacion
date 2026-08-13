import { createMysqlLegacyConnection } from './mysqlLegacy'
import {
  letraKinderEnANumero,
  PONDERADOR_LETRA_KINDER_EN,
} from './kinderPromedioPonderador'

const TABLA_ES = 'boleta_calificacionpke'
/** Materias académicas inglés Kinder (letras). */
const TABLA_EN_PK = 'boleta_calificacionpk'
/** AVERAGE guardado por trimestre (opcional, para etiqueta). */
const TABLA_EN_PKP = 'boleta_calificacionpkp'
/** Trimestres de la boleta (1º, 2º, 3º). */
const TRIMESTRES = [1, 2, 3]
/**
 * Music + Mindfulness por grado (boletas_materiask): excluidos del promedio
 * igual que en legacy `boletasik` (Kinder inglés).
 */
const MATERIAS_EN_EXCLUIDAS = new Set([6, 7, 13, 14, 20, 21])

export type KinderPromedioAlumno = {
  alumnoId: number
  promedioEs: number | null
  promedioEn: number | null
  /** Promedio combinado ES/EN (o el único disponible). */
  promedio: number | null
  letraEn: string | null
  trimestresEs: number
  trimestresEn: number
  materiasEs: number
}

function parseCalificacionNumerica(raw: string): number | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/,/g, '.')
  if (!s || /^-+$/.test(s) || s === 'N/A' || s === '----') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  return n
}

function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}

function promedioLista(vals: number[]): number | null {
  if (vals.length === 0) return null
  return redondear1(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** Número → letra (misma escala ENGLISH PRESCHOOL). */
function numeroALetraKinderEn(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n < 5 || n > 10) return null
  const entero = Math.round(n)
  const inv: Record<number, string> = {}
  for (const [letra, val] of Object.entries(PONDERADOR_LETRA_KINDER_EN)) {
    inv[val] = letra
  }
  return inv[entero] ?? null
}

/**
 * Promedios Kinder desde MySQL (`winston_general`).
 *
 * Fuentes legacy (Proyectos):
 * - EN: carpeta `boletasik` (Kinder inglés) — tablas `boleta_calificacionpk` / `pkp`
 * - ES: tablas `boleta_calificacionpke` (par `boletasik` / `boletasek`)
 *
 * ES (`boleta_calificacionpke`):
 * 1) Por materia: (T1+T2+T3) / trimestres con nota
 * 2) General: media de esos promedios de materia (boleta completa)
 *
 * EN (`boleta_calificacionpk`, legacy boletasik):
 * 1) Por trimestre: media de letras→número (sin Music/Mindfulness)
 * 2) General: media de los trimestres disponibles
 * Ponderador: E=10 VG=9 G=8 R=7 S=6 NI=5
 */
export async function cargarPromediosKinderMysql(
  alumnoIds: number[]
): Promise<Map<number, KinderPromedioAlumno>> {
  const mapa = new Map<number, KinderPromedioAlumno>()
  if (alumnoIds.length === 0) return mapa

  const unicos = [...new Set(alumnoIds.filter((id) => Number.isInteger(id) && id > 0))]
  for (const id of unicos) {
    mapa.set(id, {
      alumnoId: id,
      promedioEs: null,
      promedioEn: null,
      promedio: null,
      letraEn: null,
      trimestresEs: 0,
      trimestresEn: 0,
      materiasEs: 0,
    })
  }

  const mysql = await createMysqlLegacyConnection()
  try {
    const placeholders = unicos.map(() => '?').join(',')

    type FilaCal = {
      fk_alumno: string | number
      fk_bimestre: number
      fk_materia: string | number
      calificacion: string
    }

    // ——— Español ———
    const [rowsEs] = await mysql.query(
      `SELECT fk_alumno, fk_bimestre, fk_materia, calificacion
       FROM ${TABLA_ES}
       WHERE fk_alumno IN (${placeholders})
         AND fk_bimestre IN (1, 2, 3)`,
      unicos
    )

    const esPorAlumno = new Map<number, Map<string, Map<number, number>>>()
    for (const row of rowsEs as FilaCal[]) {
      const alumnoId = Number(row.fk_alumno)
      const materia = String(row.fk_materia)
      const bim = Number(row.fk_bimestre)
      if (!TRIMESTRES.includes(bim)) continue
      const nota = parseCalificacionNumerica(row.calificacion)
      if (nota == null) continue
      if (!esPorAlumno.has(alumnoId)) esPorAlumno.set(alumnoId, new Map())
      const porMat = esPorAlumno.get(alumnoId)!
      if (!porMat.has(materia)) porMat.set(materia, new Map())
      porMat.get(materia)!.set(bim, nota)
    }

    for (const [alumnoId, porMat] of esPorAlumno) {
      const entry = mapa.get(alumnoId)
      if (!entry) continue
      const promMaterias: number[] = []
      const trimestresUsados = new Set<number>()

      for (const porBim of porMat.values()) {
        const trim: number[] = []
        for (const b of TRIMESTRES) {
          const n = porBim.get(b)
          if (n != null) {
            trim.push(n)
            trimestresUsados.add(b)
          }
        }
        const p = promedioLista(trim)
        if (p != null) promMaterias.push(p)
      }

      entry.promedioEs = promedioLista(promMaterias)
      entry.trimestresEs = trimestresUsados.size
      entry.materiasEs = promMaterias.length
    }

    // ——— Inglés: promedio por trimestre de materias pk ———
    const [rowsEn] = await mysql.query(
      `SELECT fk_alumno, fk_bimestre, fk_materia, calificacion
       FROM ${TABLA_EN_PK}
       WHERE fk_alumno IN (${placeholders})
         AND fk_bimestre IN (1, 2, 3)`,
      unicos
    )

    // alumno -> bimestre -> notas de materias
    const enPorAlumno = new Map<number, Map<number, number[]>>()
    for (const row of rowsEn as FilaCal[]) {
      const alumnoId = Number(row.fk_alumno)
      const bim = Number(row.fk_bimestre)
      const materia = Number(row.fk_materia)
      if (!TRIMESTRES.includes(bim)) continue
      if (MATERIAS_EN_EXCLUIDAS.has(materia)) continue
      const nota = letraKinderEnANumero(row.calificacion)
      if (nota == null) continue
      if (!enPorAlumno.has(alumnoId)) enPorAlumno.set(alumnoId, new Map())
      const porBim = enPorAlumno.get(alumnoId)!
      if (!porBim.has(bim)) porBim.set(bim, [])
      porBim.get(bim)!.push(nota)
    }

    for (const [alumnoId, porBim] of enPorAlumno) {
      const entry = mapa.get(alumnoId)
      if (!entry) continue
      const promTrimestres: number[] = []
      for (const b of TRIMESTRES) {
        const notas = porBim.get(b)
        if (!notas || notas.length === 0) continue
        const p = promedioLista(notas)
        if (p != null) promTrimestres.push(p)
      }
      entry.promedioEn = promedioLista(promTrimestres)
      entry.trimestresEn = promTrimestres.length
      entry.letraEn = numeroALetraKinderEn(entry.promedioEn)
    }

    // Si no hubo pk pero sí AVERAGE en pkp, usar esa fila como respaldo.
    const sinEn = unicos.filter((id) => mapa.get(id)?.promedioEn == null)
    if (sinEn.length > 0) {
      const ph = sinEn.map(() => '?').join(',')
      const [rowsPkp] = await mysql.query(
        `SELECT fk_alumno, fk_bimestre, calificacion
         FROM ${TABLA_EN_PKP}
         WHERE fk_alumno IN (${ph})
           AND fk_bimestre IN (1, 2, 3)
           AND CAST(fk_materia AS UNSIGNED) = 1`,
        sinEn
      )
      const pkpPorAlumno = new Map<number, number[]>()
      for (const row of rowsPkp as FilaCal[]) {
        const alumnoId = Number(row.fk_alumno)
        const nota = letraKinderEnANumero(row.calificacion)
        if (nota == null) continue
        if (!pkpPorAlumno.has(alumnoId)) pkpPorAlumno.set(alumnoId, [])
        pkpPorAlumno.get(alumnoId)!.push(nota)
      }
      for (const [alumnoId, notas] of pkpPorAlumno) {
        const entry = mapa.get(alumnoId)
        if (!entry || entry.promedioEn != null) continue
        entry.promedioEn = promedioLista(notas)
        entry.trimestresEn = notas.length
        entry.letraEn = numeroALetraKinderEn(entry.promedioEn)
      }
    }

    for (const entry of mapa.values()) {
      const partes: number[] = []
      if (entry.promedioEs != null) partes.push(entry.promedioEs)
      if (entry.promedioEn != null) partes.push(entry.promedioEn)
      entry.promedio = promedioLista(partes)
    }
  } finally {
    await mysql.end()
  }

  return mapa
}
