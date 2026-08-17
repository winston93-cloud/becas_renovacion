/**
 * Backfill 1° primaria (ficha primaria grado 1 ← kinder 3):
 * sin califs en boletas kinder, promedio desde primaria grado 1 del ciclo.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-1prim-desde-primaria.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { createMysqlLegacyConnection } from '../src/lib/mysqlLegacy'
import { origenCalifsDesdeFicha } from '../src/lib/origenCalifsBecados'
import { cargarPromediosKinderMysql } from '../src/lib/kinderPromedioMysql'
import { cargarPromediosPrimariaMysql } from '../src/lib/primariaPromedioMysql'

const CICLO = Number(process.env.CICLO_DATOS || 22)

type OutRow = {
  alumno_id: number
  alumno_ref: string
  ciclo: number
  nivel_origen: number
  grado_origen: number
  fuente: string
  promedio_es: number | null
  promedio_en: number | null
  letra_en: string | null
  promedio_general: number
  via: 'kinder' | 'primaria_fallback'
}

async function main() {
  const mysql = await createMysqlLegacyConnection()
  const out: OutRow[] = []
  let sin = 0
  try {
    const [rows] = await mysql.query(
      `SELECT DISTINCT a.alumno_id, a.alumno_ref, a.alumno_nivel, a.alumno_grado, a.alumno_status
       FROM alumno_beca ab
       JOIN alumno a ON a.alumno_id = ab.alumno_id
       WHERE ab.beca_ciclo_escolar = ?
         AND ab.beca_estatus IN (0, 1)
         AND a.alumno_nivel = 3
         AND a.alumno_grado = 1`,
      [CICLO]
    )
    const list = rows as {
      alumno_id: number
      alumno_ref: string | number
      alumno_nivel: number
      alumno_grado: number
      alumno_status: number
    }[]
    console.log('1prim_becados', list.length, {
      activos: list.filter((a) => Number(a.alumno_status) === 1).length,
    })

    const ids = list.map((a) => Number(a.alumno_id))
    const kinderMap = await cargarPromediosKinderMysql(ids)
    const needPrim = list.filter((a) => {
      const v = kinderMap.get(Number(a.alumno_id))
      return !v || v.promedio == null
    })
    const primMap = await cargarPromediosPrimariaMysql(
      needPrim.map((a) => ({
        alumnoId: Number(a.alumno_id),
        alumnoRef: String(a.alumno_ref ?? '').trim(),
        grado: 1,
      }))
    )

    for (const a of list) {
      const id = Number(a.alumno_id)
      const ref = String(a.alumno_ref ?? '').trim()
      const origen = origenCalifsDesdeFicha(
        Number(a.alumno_nivel),
        Number(a.alumno_grado)
      )
      const kinder = kinderMap.get(id)
      if (kinder?.promedio != null) {
        out.push({
          alumno_id: id,
          alumno_ref: ref,
          ciclo: CICLO,
          nivel_origen: origen?.nivelOrigen ?? 2,
          grado_origen: origen?.gradoOrigen ?? 3,
          fuente: 'kinder',
          promedio_es: kinder.promedioEs ?? null,
          promedio_en: kinder.promedioEn ?? null,
          letra_en: kinder.letraEn ?? null,
          promedio_general: kinder.promedio,
          via: 'kinder',
        })
        continue
      }
      const prim = primMap.get(id)
      if (prim?.promedio != null) {
        out.push({
          alumno_id: id,
          alumno_ref: ref,
          ciclo: CICLO,
          nivel_origen: 3,
          grado_origen: 1,
          fuente: 'primaria',
          promedio_es: prim.promedioEs ?? null,
          promedio_en: prim.promedioEn ?? null,
          letra_en: null,
          promedio_general: prim.promedio,
          via: 'primaria_fallback',
        })
        continue
      }
      sin++
      if (sin <= 8) console.log('sin_promedio', ref, a.alumno_status)
    }

    console.log({
      con_promedio: out.length,
      via_kinder: out.filter((r) => r.via === 'kinder').length,
      via_primaria: out.filter((r) => r.via === 'primaria_fallback').length,
      sin_promedio: sin,
    })
    console.log('sample', out.slice(0, 5))
  } finally {
    await mysql.end()
  }

  mkdirSync('tmp', { recursive: true })
  const jsonPath = `tmp/backfill_1prim_ciclo_${CICLO}.json`
  writeFileSync(jsonPath, JSON.stringify(out, null, 2))
  console.log('wrote', jsonPath)

  const base = process.env.INSFORGE_BOLETAS_URL?.trim()
  const key = process.env.INSFORGE_BOLETAS_API_KEY?.trim()
  if (!base || !key || out.length === 0) {
    console.log('skip upsert (sin env o sin filas)')
    return
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  }

  for (let i = 0; i < out.length; i += 50) {
    const chunk = out.slice(i, i + 50).map((r) => ({
      alumno_id: r.alumno_id,
      alumno_ref: r.alumno_ref,
      ciclo: r.ciclo,
      nivel_origen: r.nivel_origen,
      grado_origen: r.grado_origen,
      fuente: r.fuente,
      promedio_es: r.promedio_es,
      promedio_en: r.promedio_en,
      letra_en: r.letra_en,
      promedio_general: r.promedio_general,
    }))
    const res = await fetch(`${base}/api/database/records/promedio_ciclo`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('upsert_fail', res.status, text.slice(0, 500))
      process.exit(1)
    }
    console.log('upserted', Math.min(i + chunk.length, out.length), '/', out.length)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
