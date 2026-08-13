/**
 * Backfill 7mo (ficha secundaria grado 1): sin califs en primaria 6°,
 * promedio desde boleta_calificacion ciclo de datos (secundaria).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-7mo-desde-secundaria.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { createMysqlLegacyConnection } from '../src/lib/mysqlLegacy'
import { origenCalifsDesdeFicha } from '../src/lib/origenCalifsBecados'
import { cargarPromediosPrimariaMysql } from '../src/lib/primariaPromedioMysql'
import { cargarPromediosSecundariaMysql } from '../src/lib/secundariaPromedioMysql'

const CICLO = Number(process.env.CICLO_DATOS || 22)

type OutRow = {
  alumno_id: number
  alumno_ref: string
  ciclo: number
  nivel_origen: number
  grado_origen: number
  fuente: string
  promedio_es: null
  promedio_en: null
  letra_en: null
  promedio_general: number
  via: 'primaria' | 'secundaria_fallback'
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
         AND a.alumno_nivel = 4
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
    console.log('7mo_becados', list.length, {
      activos: list.filter((a) => Number(a.alumno_status) === 1).length,
    })

    const primInputs = list.map((a) => {
      const origen = origenCalifsDesdeFicha(
        Number(a.alumno_nivel),
        Number(a.alumno_grado)
      )
      return {
        alumnoId: Number(a.alumno_id),
        alumnoRef: String(a.alumno_ref ?? '').trim(),
        grado: origen?.gradoOrigen ?? 6,
        origen,
        status: Number(a.alumno_status),
      }
    })

    const primMap = await cargarPromediosPrimariaMysql(
      primInputs.map((p) => ({
        alumnoId: p.alumnoId,
        alumnoRef: p.alumnoRef,
        grado: p.grado,
      }))
    )

    const needSec = primInputs.filter((p) => {
      const v = primMap.get(p.alumnoId)
      return !v || v.promedio == null
    })
    const secMap = await cargarPromediosSecundariaMysql(
      needSec.map((p) => p.alumnoId),
      CICLO
    )

    for (const p of primInputs) {
      const prim = primMap.get(p.alumnoId)
      if (prim?.promedio != null) {
        out.push({
          alumno_id: p.alumnoId,
          alumno_ref: p.alumnoRef,
          ciclo: CICLO,
          nivel_origen: p.origen?.nivelOrigen ?? 3,
          grado_origen: p.origen?.gradoOrigen ?? 6,
          fuente: 'primaria',
          promedio_es: null,
          promedio_en: null,
          letra_en: null,
          promedio_general: prim.promedio,
          via: 'primaria',
        })
        continue
      }
      const sec = secMap.get(p.alumnoId)
      if (sec?.promedio != null) {
        // Datos reales del ciclo: boleta secundaria (ya inscritos en 7mo durante el ciclo).
        out.push({
          alumno_id: p.alumnoId,
          alumno_ref: p.alumnoRef,
          ciclo: CICLO,
          nivel_origen: 4,
          grado_origen: 1,
          fuente: 'secundaria',
          promedio_es: null,
          promedio_en: null,
          letra_en: null,
          promedio_general: sec.promedio,
          via: 'secundaria_fallback',
        })
        continue
      }
      sin++
      if (sin <= 8) console.log('sin_promedio', p.alumnoRef, p.status)
    }

    console.log({
      con_promedio: out.length,
      via_primaria: out.filter((r) => r.via === 'primaria').length,
      via_secundaria: out.filter((r) => r.via === 'secundaria_fallback').length,
      sin_promedio: sin,
    })
    console.log('sample', out.slice(0, 5))
  } finally {
    await mysql.end()
  }

  mkdirSync('tmp', { recursive: true })
  const jsonPath = `tmp/backfill_7mo_ciclo_${CICLO}.json`
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
