/**
 * Destinatarios de avisos a familia (acceso autorizado, doc incorrecto, etc.).
 * Remitente SMTP = buzón masivo de servicios (avisos_no-replay).
 * - Alumno de prueba (ALAN PRUEBA / ref 29904; legados 29901–29903) → isc.escobedo@gmail.com
 * - Alumnos reales → correos de papá/mamá en alumno_familiar
 */
import type { createAdminClient } from '@insforge/sdk';

type Db = ReturnType<typeof createAdminClient>['database'];

/** Refs reservadas para alumnos de prueba. */
const REFS_PRUEBA = new Set([29904, 29903, 29902, 29901]);
const EMAIL_PRUEBA =
  process.env.BECAS_EMAIL_ACCESO_FAMILIA?.trim() || 'isc.escobedo@gmail.com';

const NOMBRES_PRUEBA = [
  'ALAN',
  'RUBEN',
  'RUBÉN',
  'LUIS',
  'JUAN',
] as const;

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

/** Portal servicios_admin (firma electrónica / activación de beca). */
export function portalServiciosAdminUrl(): string {
  const fromEnv = process.env.SERVICIOS_ADMIN_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'https://servicios-admin.vercel.app';
}

export function portalServiciosAdminDashboardUrl(): string {
  return `${portalServiciosAdminUrl()}/dashboard`;
}

export function portalServiciosAdminFirmaUrl(): string {
  return `${portalServiciosAdminUrl()}/firma-electronica`;
}

/** Enlace de ingreso con trámite y no. de control preseleccionados (correos a padres). */
export function portalBecasIngresoUrl(opts: {
  flujo: 'renovacion' | 'solicitud';
  alumnoRef: string | number;
}): string {
  const ref = String(opts.alumnoRef || '').replace(/\D/g, '');
  const params = new URLSearchParams();
  params.set('flujo', opts.flujo);
  if (ref) params.set('alumno_ref', ref);
  return `${portalBecasPublicUrl()}/?${params.toString()}`;
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
  return NOMBRES_PRUEBA.some((n) => joined.includes(n) || parts.includes(n));
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
