import { createMysqlLegacyConnection } from './mysqlLegacy'

const BIMESTRES = [1, 2, 3] as const
/** Mindfulness en boleta_materia (secundaria) — fuera del PROMEDIO WINSTON. */
const MATERIA_IDS_MINDFULNESS = [45, 46, 47]

export type SecundariaPromedioAlumno = {
  alumnoId: number
  /** Promedio Final Winston (única columna). */
  promedio: number | null
  bimestres: number
}

function parseNota(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '.')
  if (!s || /^-+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null
  return n
}

/** Equivalente a PHP `bcdiv($n, 1, $dec)`: trunca. */
function truncar(n: number, dec: number): number {
  const neg = n < 0
  const abs = Math.abs(n)
  const f = 10 ** dec
  const truncado = Math.floor(abs * f + 1e-9) / f
  return neg ? -truncado : truncado
}

function promedioLista(vals: number[], dec: number): number | null {
  if (vals.length === 0) return null
  return truncar(vals.reduce((a, b) => a + b, 0) / vals.length, dec)
}

/**
 * Promedio Final Winston desde `boleta_calificacion` (carpeta legacy `boletas`).
 *
 * Una sola boleta (sin EN aparte): media de trimestres 1–3 de todas las materias
 * numéricas excepto Mindfulness (ids 45–47). Igual que BoletaPdfGenerator para 7º/8º.
 */
export async function cargarPromediosSecundariaMysql(
  alumnoIds: number[],
  ciclo: number
): Promise<Map<number, SecundariaPromedioAlumno>> {
  const mapa = new Map<number, SecundariaPromedioAlumno>()
  const ids = [...new Set(alumnoIds.filter((id) => Number.isInteger(id) && id > 0))]
  for (const id of ids) {
    mapa.set(id, { alumnoId: id, promedio: null, bimestres: 0 })
  }
  if (ids.length === 0) return mapa

  const mysql = await createMysqlLegacyConnection()
  try {
    const ph = ids.map(() => '?').join(',')
    const mindPh = MATERIA_IDS_MINDFULNESS.map(() => '?').join(',')
    const [rows] = await mysql.query(
      `SELECT b.alumno_id, b.calificacion_bimestre, b.calificacion_puntos
       FROM boleta_calificacion b
       INNER JOIN boleta_materia m ON m.materia_id = b.materia_id
       WHERE b.alumno_id IN (${ph})
         AND b.calificacion_ciclo_escolar = ?
         AND b.calificacion_bimestre IN (1, 2, 3)
         AND m.materia_id NOT IN (${mindPh})`,
      [...ids, ciclo, ...MATERIA_IDS_MINDFULNESS]
    )

    // alumno → bimestre → notas
    const porAlumno = new Map<number, Map<number, number[]>>()
    for (const row of rows as {
      alumno_id: number
      calificacion_bimestre: number
      calificacion_puntos: string | number
    }[]) {
      const id = Number(row.alumno_id)
      const bim = Number(row.calificacion_bimestre)
      if (!BIMESTRES.includes(bim as 1 | 2 | 3)) continue
      const nota = parseNota(row.calificacion_puntos)
      if (nota == null) continue
      if (!porAlumno.has(id)) porAlumno.set(id, new Map())
      const porBim = porAlumno.get(id)!
      if (!porBim.has(bim)) porBim.set(bim, [])
      porBim.get(bim)!.push(nota)
    }

    for (const [id, porBim] of porAlumno) {
      const trimAvgs: number[] = []
      for (const bim of BIMESTRES) {
        const notas = porBim.get(bim) ?? []
        const p = promedioLista(notas, 1)
        if (p != null) trimAvgs.push(p)
      }
      const entry = mapa.get(id)!
      entry.bimestres = trimAvgs.length
      entry.promedio = promedioLista(trimAvgs, 1)
    }
  } finally {
    await mysql.end()
  }

  return mapa
}
