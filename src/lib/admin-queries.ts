/**
 * 2026-07-24 - Helpers de listados admin (JOIN renovacion/solicitud ↔ alumno).
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

function nombreCompleto(a: {
  alumno_app?: string | null;
  alumno_apm?: string | null;
  alumno_nombre?: string | null;
}): string {
  return `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.trim();
}

export async function fetchAlumnosByNivel(
  niveles: number[],
  grado?: number | null
) {
  const admin = getInsforgeAdmin();
  let q = admin.database
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada, alumno_solicitud_acceso_en'
    )
    .neq('alumno_status', 0)
    .in('alumno_nivel', niveles);

  if (grado != null && Number.isFinite(grado)) {
    q = q.eq('alumno_grado', grado);
  }

  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  return data || [];
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

export async function listRenovaciones(opts: {
  admin: AdminAuth;
  ciclo: number;
  grado?: number | null;
  estado?: AdminListEstado;
}) {
  const alumnos = await fetchAlumnosByNivel(opts.admin.niveles, opts.grado);
  const byId = new Map(alumnos.map((a) => [Number(a.alumno_id), a]));
  const ids = [...byId.keys()];
  if (ids.length === 0) return [];

  const db = getInsforgeAdmin();
  const { data, error } = await db.database
    .from('becas_renovacion')
    .select(
      'id, alumno_id, ciclo_escolar, correo_enviado, correo_enviado_en, verificado, fecha_verificado, beca_autorizada, pdf_solicitud_key, motivo, created_at, updated_at'
    )
    .eq('ciclo_escolar', opts.ciclo)
    .in('alumno_id', ids)
    .order('correo_enviado_en', { ascending: false });

  if (error) throw new Error(error.message);

  let rows = (data || [])
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
    .filter(Boolean);

  const estado = opts.estado || 'enviadas';
  if (estado === 'enviadas') {
    rows = rows.filter((r) => r!.correo_enviado);
  } else if (estado === 'pendientes') {
    rows = rows.filter((r) => r!.correo_enviado && !r!.verificado);
  } else if (estado === 'verificadas') {
    rows = rows.filter((r) => r!.verificado);
  } else if (estado === 'autorizadas') {
    rows = rows.filter((r) => r!.beca_autorizada);
  }

  return rows as NonNullable<(typeof rows)[number]>[];
}

export async function listSolicitudes(opts: {
  admin: AdminAuth;
  ciclo: number;
  grado?: number | null;
  estado?: AdminListEstado;
}) {
  const alumnos = await fetchAlumnosByNivel(opts.admin.niveles, opts.grado);
  const byId = new Map(alumnos.map((a) => [Number(a.alumno_id), a]));
  const ids = [...byId.keys()];
  if (ids.length === 0) return [];

  const db = getInsforgeAdmin();
  const { data, error } = await db.database
    .from('becas_solicitud')
    .select(
      'id, alumno_id, ciclo_escolar, enviado, enviado_en, verificado, fecha_verificado, beca_autorizada, pdf_solicitud_key, motivo, created_at, updated_at'
    )
    .eq('ciclo_escolar', opts.ciclo)
    .in('alumno_id', ids)
    .order('enviado_en', { ascending: false });

  if (error) throw new Error(error.message);

  let rows = (data || [])
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
    .filter(Boolean);

  const estado = opts.estado || 'enviadas';
  if (estado === 'enviadas') {
    rows = rows.filter((r) => r!.enviado);
  } else if (estado === 'pendientes') {
    rows = rows.filter((r) => r!.enviado && !r!.verificado);
  } else if (estado === 'verificadas') {
    rows = rows.filter((r) => r!.verificado);
  } else if (estado === 'autorizadas') {
    rows = rows.filter((r) => r!.beca_autorizada);
  }

  return rows as NonNullable<(typeof rows)[number]>[];
}
