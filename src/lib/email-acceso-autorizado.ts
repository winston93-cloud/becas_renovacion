/**
 * Destinatarios de avisos a familia (acceso autorizado, doc incorrecto, etc.).
 * Remitente SMTP = buzón masivo de servicios (avisos_no-replay).
 * - Alumno de prueba (LUIS PRUEBA / ref 29902; legado JUAN/29901) → isc.escobedo@gmail.com
 * - Alumnos reales → correos de papá/mamá en alumno_familiar
 * Sin BCC visible ni enviado a la familia.
 */
import type { createAdminClient } from '@insforge/sdk';

type Db = ReturnType<typeof createAdminClient>['database'];

/** Ref actual de alumno de prueba (LUIS). 29901 = legado JUAN. */
const REFS_PRUEBA = new Set([29902, 29901]);
const EMAIL_PRUEBA =
  process.env.BECAS_EMAIL_ACCESO_FAMILIA?.trim() || 'isc.escobedo@gmail.com';

export function portalBecasPublicUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BECAS_PORTAL_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
  }
  return 'https://becas-renovacion.vercel.app';
}

export function esAlumnoPruebaAcceso(opts: {
  alumno_ref?: string | number | null;
  alumno_app?: string | null;
  alumno_apm?: string | null;
  alumno_nombre?: string | null;
}): boolean {
  const ref = Number(opts.alumno_ref);
  if (Number.isFinite(ref) && REFS_PRUEBA.has(ref)) return true;
  const parts = [opts.alumno_app, opts.alumno_apm, opts.alumno_nombre]
    .map((p) => (p != null ? String(p).trim().toUpperCase() : ''))
    .filter(Boolean);
  const joined = parts.join(' ');
  const pruebas = (joined.match(/\bPRUEBA\b/g) || []).length;
  if (pruebas < 2) return false;
  if (joined.includes('LUIS') || joined.includes('JUAN')) return true;
  if (
    (parts.includes('LUIS') || parts.includes('JUAN')) &&
    parts.filter((p) => p === 'PRUEBA').length >= 2
  ) {
    return true;
  }
  return false;
}

function emailValido(raw: unknown): string | null {
  const e = String(raw || '')
    .trim()
    .toLowerCase();
  if (!e || !e.includes('@') || e.length < 5) return null;
  return e;
}

/** Correos únicos de mamá (tutor 1) y papá (tutor 2). */
export async function fetchEmailsPadres(
  db: Db,
  alumnoId: number
): Promise<string[]> {
  const { data, error } = await db
    .from('alumno_familiar')
    .select('tutor_id, familiar_email')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [1, 2]);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data || []) {
    const em = emailValido(row.familiar_email);
    if (!em || seen.has(em)) continue;
    seen.add(em);
    out.push(em);
  }
  return out;
}

export async function fetchEmailsPadresPorAlumnos(
  db: Db,
  alumnoIds: number[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  const ids = [...new Set(alumnoIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return map;

  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await db
      .from('alumno_familiar')
      .select('alumno_id, tutor_id, familiar_email')
      .in('alumno_id', slice)
      .in('tutor_id', [1, 2]);
    if (error) throw new Error(error.message);

    for (const row of data || []) {
      const aid = Number(row.alumno_id);
      const em = emailValido(row.familiar_email);
      if (!em) continue;
      const list = map.get(aid) || [];
      if (!list.includes(em)) list.push(em);
      map.set(aid, list);
    }
  }
  return map;
}

export type DestinatariosAccesoAutorizado = {
  to: string[];
  es_prueba: boolean;
  sin_correo: boolean;
};

export async function resolveAccesoAutorizadoDestinatarios(opts: {
  db: Db;
  alumno_id: number;
  alumno_ref?: string | number | null;
  alumno_app?: string | null;
  alumno_apm?: string | null;
  alumno_nombre?: string | null;
}): Promise<DestinatariosAccesoAutorizado> {
  if (
    esAlumnoPruebaAcceso({
      alumno_ref: opts.alumno_ref,
      alumno_app: opts.alumno_app,
      alumno_apm: opts.alumno_apm,
      alumno_nombre: opts.alumno_nombre,
    })
  ) {
    return { to: [EMAIL_PRUEBA], es_prueba: true, sin_correo: false };
  }

  const padres = await fetchEmailsPadres(opts.db, opts.alumno_id);
  return {
    to: padres,
    es_prueba: false,
    sin_correo: padres.length === 0,
  };
}
