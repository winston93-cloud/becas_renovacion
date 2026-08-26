/**
 * Promedio Final Winston (secundaria) desde InsForge Boletas `boleta_calificacion`.
 * Misma fórmula que secundariaPromedioMysql (trimestres 1–3, sin Mindfulness).
 */
import { getInsforgeBoletasConfig } from '@/lib/insforge-boletas';

const BIMESTRES = [1, 2, 3] as const;
const MATERIA_IDS_MINDFULNESS = new Set([45, 46, 47]);

function parseNota(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().replace(/,/g, '.');
  if (!s || /^-+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null;
  return n;
}

function truncar(n: number, dec: number): number {
  const neg = n < 0;
  const abs = Math.abs(n);
  const f = 10 ** dec;
  const truncado = Math.floor(abs * f + 1e-9) / f;
  return neg ? -truncado : truncado;
}

function promedioLista(vals: number[], dec: number): number | null {
  if (vals.length === 0) return null;
  return truncar(vals.reduce((a, b) => a + b, 0) / vals.length, dec);
}

export async function promedioSecundariaDesdeBoletaCalificacion(opts: {
  alumnoId: number;
  cicloDatos: number;
}): Promise<number | null> {
  const cfg = getInsforgeBoletasConfig();
  if (!cfg) return null;

  const { createAdminClient } = await import('@insforge/sdk');
  const db = createAdminClient({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });

  const { data, error } = await db.database
    .from('boleta_calificacion')
    .select('materia_id, calificacion_bimestre, calificacion_puntos')
    .eq('alumno_id', opts.alumnoId)
    .eq('calificacion_ciclo_escolar', opts.cicloDatos)
    .in('calificacion_bimestre', [1, 2, 3]);

  if (error || !data?.length) return null;

  const porBim = new Map<number, number[]>();
  for (const row of data) {
    const mid = Number(row.materia_id);
    if (MATERIA_IDS_MINDFULNESS.has(mid)) continue;
    const bim = Number(row.calificacion_bimestre);
    if (!BIMESTRES.includes(bim as 1 | 2 | 3)) continue;
    const nota = parseNota(row.calificacion_puntos);
    if (nota == null) continue;
    if (!porBim.has(bim)) porBim.set(bim, []);
    porBim.get(bim)!.push(nota);
  }

  const trimAvgs: number[] = [];
  for (const bim of BIMESTRES) {
    const p = promedioLista(porBim.get(bim) ?? [], 1);
    if (p != null) trimAvgs.push(p);
  }
  return promedioLista(trimAvgs, 1);
}
