/**
 * 2026-08-13 - Calcula promedio_ciclo (ciclo 22) desde MySQL hosting
 * y genera JSON + SQL para InsForge Boletas.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrar-promedio-ciclo-mysql-a-insforge.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createMysqlLegacyConnection } from '../src/lib/mysqlLegacy.ts';
import { origenCalifsDesdeFicha } from '../src/lib/origenCalifsBecados.ts';
import { cargarPromediosKinderMysql } from '../src/lib/kinderPromedioMysql.ts';
import { cargarPromediosPrimariaMysql } from '../src/lib/primariaPromedioMysql.ts';
import { cargarPromediosSecundariaMysql } from '../src/lib/secundariaPromedioMysql.ts';

const CICLO = Number(process.env.CICLO_DATOS || 22);

function esc(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const mysql = await createMysqlLegacyConnection();
  try {
    const [becas] = await mysql.query(
      `SELECT DISTINCT alumno_id
       FROM alumno_beca
       WHERE beca_ciclo_escolar = ?
         AND beca_estatus IN (0, 1)`,
      [CICLO]
    );
    const ids = [...new Set(becas.map((b) => Number(b.alumno_id)).filter((n) => n > 0))];
    console.log('alumnos_beca', ids.length);

    const filas = [];
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const ph = slice.map(() => '?').join(',');
      const [rows] = await mysql.query(
        `SELECT alumno_id, alumno_ref, alumno_nivel, alumno_grado, alumno_status
         FROM alumno
         WHERE alumno_id IN (${ph})`,
        slice
      );
      for (const a of rows) filas.push(a);
    }
    console.log('alumnos_ficha', filas.length);

    const conOrigen = [];
    for (const a of filas) {
      const origen = origenCalifsDesdeFicha(Number(a.alumno_nivel), Number(a.alumno_grado));
      if (!origen) continue;
      conOrigen.push({ alumno: a, origen });
    }
    console.log('con_origen_califs', conOrigen.length);

    const idsKinder = [
      ...new Set(
        conOrigen.filter((x) => x.origen.fuente === 'kinder').map((x) => Number(x.alumno.alumno_id))
      ),
    ];
    const primInputs = conOrigen
      .filter((x) => x.origen.fuente === 'primaria')
      .map((x) => ({
        alumnoId: Number(x.alumno.alumno_id),
        alumnoRef: String(x.alumno.alumno_ref ?? '').trim(),
        grado: x.origen.gradoOrigen,
      }));
    const idsSec = [
      ...new Set(
        conOrigen
          .filter((x) => x.origen.fuente === 'secundaria')
          .map((x) => Number(x.alumno.alumno_id))
      ),
    ];

    console.log('kinder', idsKinder.length, 'primaria', primInputs.length, 'sec', idsSec.length);

    const mapa = new Map();
    if (idsKinder.length) {
      const p = await cargarPromediosKinderMysql(idsKinder);
      for (const [id, v] of p) mapa.set(id, { ...v, fuente: 'kinder' });
    }
    if (primInputs.length) {
      const p = await cargarPromediosPrimariaMysql(primInputs);
      for (const [id, v] of p) mapa.set(id, { ...v, fuente: 'primaria' });
    }
    if (idsSec.length) {
      const p = await cargarPromediosSecundariaMysql(idsSec, CICLO);
      for (const [id, v] of p) mapa.set(id, { ...v, fuente: 'secundaria' });
    }

    // Puente 6°→7mo: ficha secundaria grado 1 pide primaria 6°, pero en ciclo
    // de datos ya tienen boleta secundaria (sin filas en prim_*). Fallback.
    const puente7mo = conOrigen.filter(
      (x) =>
        Number(x.alumno.alumno_nivel) === 4 &&
        Number(x.alumno.alumno_grado) === 1 &&
        x.origen.fuente === 'primaria' &&
        (mapa.get(Number(x.alumno.alumno_id)) == null ||
          mapa.get(Number(x.alumno.alumno_id)).promedio == null)
    );
    const idsPuente = [
      ...new Set(puente7mo.map((x) => Number(x.alumno.alumno_id))),
    ];
    if (idsPuente.length) {
      console.log('fallback_7mo_secundaria', idsPuente.length);
      const p = await cargarPromediosSecundariaMysql(idsPuente, CICLO);
      for (const [id, v] of p) {
        if (v.promedio == null) continue;
        mapa.set(id, {
          ...v,
          fuente: 'secundaria',
          nivelOrigenOverride: 4,
          gradoOrigenOverride: 1,
        });
      }
    }

    // Puente kinder 3→1° primaria: ficha primaria grado 1 pide kinder 3, pero
    // en ciclo de datos ya tienen boleta primaria (sin filas en pke/pk). Fallback.
    const puente1prim = conOrigen.filter(
      (x) =>
        Number(x.alumno.alumno_nivel) === 3 &&
        Number(x.alumno.alumno_grado) === 1 &&
        x.origen.fuente === 'kinder' &&
        (mapa.get(Number(x.alumno.alumno_id)) == null ||
          mapa.get(Number(x.alumno.alumno_id)).promedio == null)
    );
    const idsPuente1 = [
      ...new Set(puente1prim.map((x) => Number(x.alumno.alumno_id))),
    ];
    if (idsPuente1.length) {
      console.log('fallback_1prim_primaria', idsPuente1.length);
      const inputs = puente1prim.map((x) => ({
        alumnoId: Number(x.alumno.alumno_id),
        alumnoRef: String(x.alumno.alumno_ref ?? '').trim(),
        grado: 1,
      }));
      const p = await cargarPromediosPrimariaMysql(inputs);
      for (const [id, v] of p) {
        if (v.promedio == null) continue;
        mapa.set(id, {
          ...v,
          fuente: 'primaria',
          nivelOrigenOverride: 3,
          gradoOrigenOverride: 1,
        });
      }
    }

    const out = [];
    for (const { alumno, origen } of conOrigen) {
      const id = Number(alumno.alumno_id);
      const p = mapa.get(id);
      if (!p || p.promedio == null) continue;
      const fuente = p.fuente || origen.fuente;
      const nivelOrigen =
        p.nivelOrigenOverride != null ? p.nivelOrigenOverride : origen.nivelOrigen;
      const gradoOrigen =
        p.gradoOrigenOverride != null ? p.gradoOrigenOverride : origen.gradoOrigen;
      out.push({
        alumno_id: id,
        alumno_ref: String(alumno.alumno_ref ?? '').trim(),
        ciclo: CICLO,
        nivel_origen: nivelOrigen,
        grado_origen: gradoOrigen,
        fuente,
        promedio_es: p.promedioEs ?? null,
        promedio_en: p.promedioEn ?? null,
        letra_en: p.letraEn ?? null,
        promedio_general: p.promedio,
        nivel_ficha: Number(alumno.alumno_nivel),
        grado_ficha: Number(alumno.alumno_grado),
      });
    }

    console.log('con_promedio', out.length);

    mkdirSync('tmp', { recursive: true });
    const jsonPath = `tmp/promedio_ciclo_${CICLO}.json`;
    writeFileSync(jsonPath, JSON.stringify(out, null, 2));
    console.log('wrote', jsonPath);

    const lines = [
      `-- promedio_ciclo ciclo ${CICLO} — generado ${new Date().toISOString()}`,
      `-- ${out.length} filas`,
      `DELETE FROM public.promedio_ciclo WHERE ciclo = ${CICLO};`,
    ];
    for (let i = 0; i < out.length; i += 100) {
      const chunk = out.slice(i, i + 100);
      const values = chunk
        .map(
          (r) =>
            `(${r.alumno_id}, ${esc(r.alumno_ref)}, ${r.ciclo}, ${r.nivel_origen}, ${r.grado_origen}, ${esc(r.fuente)}, ${esc(r.promedio_es)}, ${esc(r.promedio_en)}, ${esc(r.letra_en)}, ${esc(r.promedio_general)})`
        )
        .join(',\n');
      lines.push(
        `INSERT INTO public.promedio_ciclo (alumno_id, alumno_ref, ciclo, nivel_origen, grado_origen, fuente, promedio_es, promedio_en, letra_en, promedio_general) VALUES\n${values};`
      );
    }
    const sqlPath = `tmp/promedio_ciclo_${CICLO}.sql`;
    writeFileSync(sqlPath, lines.join('\n') + '\n');
    console.log('wrote', sqlPath);

    // Intento InsForge Boletas si el backend ya responde
    const base = process.env.INSFORGE_BOLETAS_URL?.trim();
    const key = process.env.INSFORGE_BOLETAS_API_KEY?.trim();
    if (base && key) {
      const health = await fetch(`${base}/api/database/tables`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      console.log('boletas_backend', health.status);
      if (health.status === 200) {
        const { createAdminClient } = await import('@insforge/sdk');
        const db = createAdminClient({ baseUrl: base, apiKey: key });
        // upsert in chunks
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
          }));
          const { error } = await db.database.from('promedio_ciclo').upsert(chunk);
          if (error) {
            console.error('upsert_fail', error.message);
            break;
          }
          console.log('upserted', Math.min(i + chunk.length, out.length), '/', out.length);
        }
      } else {
        console.log('Boletas aún sin backend (503). SQL/JSON listos en tmp/.');
      }
    }
  } finally {
    await mysql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
