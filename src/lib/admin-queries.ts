/**
 * 2026-07-24 - Helpers de listados admin (JOIN renovacion/solicitud ↔ alumno).
 * 2026-07-27 - Listados parten de renovacion/solicitud (pocas filas), no de
 *              miles de alumnos + `.in()` gigante (timeout InsForge 30s).
 */
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import type { AdminAuth } from '@/lib/admin-auth';

export type AdminListEstado =
  | 'todas'
  | 'enviadas'
  | 'pendientes'
  | 'verificadas'
  | 'autorizadas';

const CHUNK_ALUMNO_IDS = 200;

function nombreCompleto(a: {
  alumno_app?: string | null;
  alumno_apm?: string | null;
  alumno_nombre?: string | null;
}): string {
  return `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.trim();
}

function chunkIds(ids: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada, alumno_solicitud_acceso_en';

export async function fetchAlumnosByNivel(
  niveles: number[],
  grado?: number | null
) {
  const admin = getInsforgeAdmin();
  let q = admin.database
    .from('alumno')
    .select(SELECT_ALUMNO)
    .neq('alumno_status', 0)
    .in('alumno_nivel', niveles);

  if (grado != null && Number.isFinite(grado)) {
    q = q.eq('alumno_grado', grado);
  }

  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchAlumnosByIds(
  ids: number[],
  niveles: number[],
  grado?: number | null
) {
  if (ids.length === 0) return [];
  const db = getInsforgeAdmin();
  const rows: Record<string, unknown>[] = [];

  for (const slice of chunkIds(ids, CHUNK_ALUMNO_IDS)) {
    let q = db.database
      .from('alumno')
      .select(SELECT_ALUMNO)
      .in('alumno_id', slice)
      .in('alumno_nivel', niveles)
      .neq('alumno_status', 0);

    if (grado != null && Number.isFinite(grado)) {
      q = q.eq('alumno_grado', grado);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data || []) rows.push(r as Record<string, unknown>);
  }

  return rows;
}

export function mapAlumnoRow(a: Record<string, unknown>) {
  const nivel = a.alumno_nivel != null ? Number(a.alumno_nivel) : null;
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: String(a.alumno_ref ?? ''),
    nombre: nombreCompleto(a as never),
    nivel,
    nivel_label: labelNivel(nivel),
    grado: a.alumno_grado != null ? Number(a.alumno_grado) : null,
    grupo: labelGrupo(a.alumno_grupo as number | null),
    permiso_solicitud: Boolean(a.alumno_permiso_solicitud_beca),
    acceso_enviada: Boolean(a.alumno_solicitud_acceso_enviada),
    acceso_enviada_en: a.alumno_solicitud_acceso_en || null,
  };
}

function applyEstadoRenovacionFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  estado: AdminListEstado
) {
  if (estado === 'enviadas') return q.eq('correo_enviado', true);
  if (estado === 'pendientes') {
    return q.eq('correo_enviado', true).eq('verificado', false);
  }
  if (estado === 'verificadas') return q.eq('verificado', true);
  if (estado === 'autorizadas') return q.eq('beca_autorizada', true);
  return q;
}

function applyEstadoSolicitudFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  estado: AdminListEstado
) {
  if (estado === 'enviadas') return q.eq('enviado', true);
  if (estado === 'pendientes') {
    return q.eq('enviado', true).eq('verificado', false);
  }
  if (estado === 'verificadas') return q.eq('verificado', true);
  if (estado === 'autorizadas') return q.eq('beca_autorizada', true);
  return q;
}

export async function listRenovaciones(opts: {
  admin: AdminAuth;
  ciclo: number;
  grado?: number | null;
  estado?: AdminListEstado;
}) {
  const estado = opts.estado || 'enviadas';
  const db = getInsforgeAdmin();

  let q = db.database
    .from('becas_renovacion')
    .select(
      'id, alumno_id, ciclo_escolar, correo_enviado, correo_enviado_en, verificado, fecha_verificado, beca_autorizada, pdf_solicitud_key, motivo, created_at, updated_at'
    )
    .eq('ciclo_escolar', opts.ciclo)
    .order('correo_enviado_en', { ascending: false })
    .limit(2000);

  q = applyEstadoRenovacionFilter(q, estado);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const renRows = data || [];
  if (renRows.length === 0) return [];

  const alumnoIds = [...new Set(renRows.map((r) => Number(r.alumno_id)))];
  const alumnos = await fetchAlumnosByIds(
    alumnoIds,
    opts.admin.niveles,
    opts.grado
  );
  const byId = new Map(alumnos.map((a) => [Number(a.alumno_id), a]));

  return renRows
    .map((r) => {
      const a = byId.get(Number(r.alumno_id));
      if (!a) return null;
      return {
        id: String(r.id),
        ciclo_escolar: Number(r.ciclo_escolar),
        correo_enviado: Boolean(r.correo_enviado),
        correo_enviado_en: r.correo_enviado_en || null,
        verificado: Boolean(r.verificado),
        fecha_verificado: r.fecha_verificado || null,
        beca_autorizada: Boolean(r.beca_autorizada),
        tiene_pdf: Boolean(r.pdf_solicitud_key),
        motivo: r.motivo || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        alumno: mapAlumnoRow(a),
      };
    })
    .filter(Boolean) as {
    id: string;
    ciclo_escolar: number;
    correo_enviado: boolean;
    correo_enviado_en: string | null;
    verificado: boolean;
    fecha_verificado: string | null;
    beca_autorizada: boolean;
    tiene_pdf: boolean;
    motivo: string | null;
    created_at: string;
    updated_at: string;
    alumno: ReturnType<typeof mapAlumnoRow>;
  }[];
}

export async function listSolicitudes(opts: {
  admin: AdminAuth;
  ciclo: number;
  grado?: number | null;
  estado?: AdminListEstado;
}) {
  const estado = opts.estado || 'enviadas';
  const db = getInsforgeAdmin();

  let q = db.database
    .from('becas_solicitud')
    .select(
      'id, alumno_id, ciclo_escolar, enviado, enviado_en, verificado, fecha_verificado, beca_autorizada, pdf_solicitud_key, motivo, created_at, updated_at'
    )
    .eq('ciclo_escolar', opts.ciclo)
    .order('enviado_en', { ascending: false })
    .limit(2000);

  q = applyEstadoSolicitudFilter(q, estado);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const solRows = data || [];
  if (solRows.length === 0) return [];

  const alumnoIds = [...new Set(solRows.map((r) => Number(r.alumno_id)))];
  const alumnos = await fetchAlumnosByIds(
    alumnoIds,
    opts.admin.niveles,
    opts.grado
  );
  const byId = new Map(alumnos.map((a) => [Number(a.alumno_id), a]));

  return solRows
    .map((r) => {
      const a = byId.get(Number(r.alumno_id));
      if (!a) return null;
      return {
        id: String(r.id),
        ciclo_escolar: Number(r.ciclo_escolar),
        enviado: Boolean(r.enviado),
        enviado_en: r.enviado_en || null,
        verificado: Boolean(r.verificado),
        fecha_verificado: r.fecha_verificado || null,
        beca_autorizada: Boolean(r.beca_autorizada),
        tiene_pdf: Boolean(r.pdf_solicitud_key),
        motivo: r.motivo || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        alumno: mapAlumnoRow(a),
      };
    })
    .filter(Boolean) as {
    id: string;
    ciclo_escolar: number;
    enviado: boolean;
    enviado_en: string | null;
    verificado: boolean;
    fecha_verificado: string | null;
    beca_autorizada: boolean;
    tiene_pdf: boolean;
    motivo: string | null;
    created_at: string;
    updated_at: string;
    alumno: ReturnType<typeof mapAlumnoRow>;
  }[];
}
