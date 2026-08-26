/**
 * 2026-08-26 - Backfill promedio_ciclo para alumnos Winston en solicitud nueva.
 *
 * Calcula desde InsForge Boletas `boleta_calificacion` (no MySQL hosting).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-promedio-solicitudes-winston.ts
 *
 * Requiere INSFORGE_URL/API_KEY + INSFORGE_BOLETAS_URL/API_KEY.
 * Opcional: CICLO_DATOS=22
 */
import { origenCalifsDesdeFicha } from '../src/lib/origenCalifsBecados';

const CICLO = Number(process.env.CICLO_DATOS || 22);
const MIND = new Set([45, 46, 47]);
const BIMESTRES = [1, 2, 3] as const;

type Ficha = {
  alumno_id: number;
  alumno_ref: string | number;
  alumno_nivel: number;
  alumno_grado: number;
};

function cfg(nameUrl: string, nameKey: string) {
  const baseUrl = process.env[nameUrl]?.trim();
  const apiKey = process.env[nameKey]?.trim();
  if (!baseUrl || !apiKey) throw new Error(`Faltan ${nameUrl} / ${nameKey}`);
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

async function fetchRecords<T>(
  baseUrl: string,
  apiKey: string,
  table: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${baseUrl}/api/database/records/${table}?${query}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : data?.data || []) as T[];
}

function parseNota(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().replace(/,/g, '.');
  if (!s || /^-+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null;
  return n;
}

function truncar(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.floor(Math.abs(n) * f + 1e-9) / f * (n < 0 ? -1 : 1);
}

function promedioLista(vals: number[], dec: number): number | null {
  if (!vals.length) return null;
  return truncar(vals.reduce((a, b) => a + b, 0) / vals.length, dec);
}

async function promedioSecundaria(
  boletas: { baseUrl: string; apiKey: string },
  alumnoId: number,
  ciclo: number
): Promise<number | null> {
  const rows = await fetchRecords<{
    materia_id: number;
    calificacion_bimestre: number;
    calificacion_puntos: string | number;
  }>(
    boletas.baseUrl,
    boletas.apiKey,
    'boleta_calificacion',
    `alumno_id=eq.${alumnoId}&calificacion_ciclo_escolar=eq.${ciclo}&calificacion_bimestre=in.(1,2,3)&limit=2000`
  );
  const porBim = new Map<number, number[]>();
  for (const row of rows) {
    if (MIND.has(Number(row.materia_id))) continue;
    const bim = Number(row.calificacion_bimestre);
    if (!BIMESTRES.includes(bim as 1 | 2 | 3)) continue;
    const nota = parseNota(row.calificacion_puntos);
    if (nota == null) continue;
    if (!porBim.has(bim)) porBim.set(bim, []);
    porBim.get(bim)!.push(nota);
  }
  const trim: number[] = [];
  for (const bim of BIMESTRES) {
    const p = promedioLista(porBim.get(bim) ?? [], 1);
    if (p != null) trim.push(p);
  }
  return promedioLista(trim, 1);
}

async function main() {
  const winston = cfg('INSFORGE_URL', 'INSFORGE_API_KEY');
  const boletas = cfg('INSFORGE_BOLETAS_URL', 'INSFORGE_BOLETAS_API_KEY');

  const sols = await fetchRecords<{ alumno_id: number }>(
    winston.baseUrl,
    winston.apiKey,
    'becas_solicitud',
    'select=alumno_id&limit=5000'
  );
  const ids = [
    ...new Set(
      sols.map((s) => Number(s.alumno_id)).filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  console.log('solicitudes', ids.length);

  const fichas: Ficha[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const rows = await fetchRecords<Ficha>(
      winston.baseUrl,
      winston.apiKey,
      'alumno',
      `alumno_id=in.(${slice.join(',')})&select=alumno_id,alumno_ref,alumno_nivel,alumno_grado`
    );
    fichas.push(...rows);
  }

  const out: Record<string, unknown>[] = [];
  let sin = 0;
  for (const alumno of fichas) {
    const origen = origenCalifsDesdeFicha(
      Number(alumno.alumno_nivel),
      Number(alumno.alumno_grado)
    );
    if (!origen || origen.fuente !== 'secundaria') continue;
    const prom = await promedioSecundaria(
      boletas,
      Number(alumno.alumno_id),
      CICLO
    );
    if (prom == null) {
      sin += 1;
      console.log('sin_promedio', alumno.alumno_ref, alumno.alumno_id);
      continue;
    }
    out.push({
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: String(alumno.alumno_ref ?? '').trim(),
      ciclo: CICLO,
      nivel_origen: origen.nivelOrigen,
      grado_origen: origen.gradoOrigen,
      fuente: 'secundaria',
      promedio_es: null,
      promedio_en: null,
      letra_en: null,
      promedio_general: prom,
    });
  }

  console.log(JSON.stringify({ upsert: out.length, sin }));
  const headers = {
    Authorization: `Bearer ${boletas.apiKey}`,
    apikey: boletas.apiKey,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  for (let i = 0; i < out.length; i += 50) {
    const chunk = out.slice(i, i + 50);
    const res = await fetch(
      `${boletas.baseUrl}/api/database/records/promedio_ciclo`,
      { method: 'POST', headers, body: JSON.stringify(chunk) }
    );
    if (!res.ok) {
      console.error(await res.text());
      process.exit(1);
    }
    console.log('upserted', Math.min(i + chunk.length, out.length), '/', out.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
