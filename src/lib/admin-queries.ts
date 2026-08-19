/**
 * 2026-07-24 - Helpers de listados admin (JOIN renovacion/solicitud ↔ alumno).
 * 2026-07-27 - Listados parten de renovacion/solicitud (pocas filas), no de
 *              miles de alumnos + `.in()` gigante (timeout InsForge 30s).
 */
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrado } from '@/lib/label-grado';
import { labelGrupo } from '@/lib/label-grupo';
import type { AdminAuth } from '@/lib/admin-auth';
import {
  fetchDocsIncorrectosPorRenovacion,
  fetchDocsIncorrectosPorSolicitud,
  fetchRenovacionIdsConDocsIncorrectos,
  type DocIncorrectoResumen,
} from '@/lib/admin-renovacion-docs-incorrectos';

export type { DocIncorrectoResumen };

export type AdminListEstado =
  | 'todas'
  | 'enviadas'
  | 'pendientes'
  | 'correccion_documentos'
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
    grado_label: labelGrado(nivel, a.alumno_grado as number | null),
    grupo: labelGrupo(a.alumno_grupo as number | null),
    permiso_solicitud: Number(a.alumno_permiso_solicitud_beca) === 1,
    acceso_enviada: Number(a.alumno_solicitud_acceso_enviada) === 1,
    acceso_enviada_en: a.alumno_solicitud_acceso_en || null,
  };
}

/** Pedidos de acceso a beca nueva (flag en alumno), filtrados por nivel del rol. */
export async function listPedidosAccesoSolicitud(admin: AdminAuth) {
  const db = getInsforgeAdmin();
  const { data, error } = await db.database
    .from('alumno')
    .select(SELECT_ALUMNO)
    .neq('alumno_status', 0)
    .in('alumno_nivel', admin.niveles)
    .or(
      'alumno_solicitud_acceso_enviada.eq.1,alumno_permiso_solicitud_beca.eq.1'
    )
    .limit(500);

  if (error) throw new Error(error.message);
  return (data || [])
    .map(mapAlumnoRow)
    .sort((a, b) => {
      const ta = a.acceso_enviada_en ? Date.parse(String(a.acceso_enviada_en)) : 0;
      const tb = b.acceso_enviada_en ? Date.parse(String(b.acceso_enviada_en)) : 0;
      return tb - ta;
    });
}

function applyEstadoRenovacionFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  estado: AdminListEstado
) {
  if (estado === 'enviadas') return q.eq('correo_enviado', true);
  if (estado === 'pendientes' || estado === 'correccion_documentos') {
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
  if (estado === 'pendientes' || estado === 'correccion_documentos') {
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

  let renRows = data || [];
  if (renRows.length === 0) return [];

  const dbAdmin = getInsforgeAdmin();
  let docsIncorrectosMap = new Map<string, DocIncorrectoResumen[]>();

  if (estado === 'pendientes' || estado === 'correccion_documentos') {
    const renIds = renRows.map((r) => String(r.id));
    docsIncorrectosMap = await fetchDocsIncorrectosPorRenovacion(
      dbAdmin,
      renIds
    );

    if (estado === 'pendientes') {
      renRows = renRows.filter((r) => !docsIncorrectosMap.has(String(r.id)));
    } else {
      renRows = renRows.filter((r) => docsIncorrectosMap.has(String(r.id)));
    }
  }

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
      const id = String(r.id);
      const docsIncorrectos = docsIncorrectosMap.get(id);
      return {
        id,
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
        docs_incorrectos: docsIncorrectos,
        docs_incorrectos_count: docsIncorrectos?.length,
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
    docs_incorrectos?: DocIncorrectoResumen[];
    docs_incorrectos_count?: number;
    alumno: ReturnType<typeof mapAlumnoRow>;
  }[];
}

/** Conteos de renovaciones enviadas: pendientes CE vs esperando corrección de docs. */
export async function contarRenovacionesRevision(enviadas: {
  id: string;
  verificado: boolean;
}[]) {
  const sinVerificar = enviadas.filter((r) => !r.verificado);
  if (sinVerificar.length === 0) {
    return { pendientes: 0, correccion_documentos: 0 };
  }

  const conIncorrectos = await fetchRenovacionIdsConDocsIncorrectos(
    getInsforgeAdmin(),
    sinVerificar.map((r) => r.id)
  );

  let correccion = 0;
  for (const r of sinVerificar) {
    if (conIncorrectos.has(r.id)) correccion += 1;
  }

  return {
    pendientes: sinVerificar.length - correccion,
    correccion_documentos: correccion,
  };
}

/** Conteos solicitudes enviadas: pendientes CE vs esperando corrección de docs. */
export async function contarSolicitudesRevision(enviadas: {
  id: string;
  verificado: boolean;
}[]) {
  const sinVerificar = enviadas.filter((r) => !r.verificado);
  if (sinVerificar.length === 0) {
    return { pendientes: 0, correccion_documentos: 0 };
  }

  const indice = await fetchDocsIncorrectosPorSolicitud(
    getInsforgeAdmin(),
    sinVerificar.map((r) => r.id)
  );

  let correccion = 0;
  for (const r of sinVerificar) {
    if (indice.has(r.id)) correccion += 1;
  }

  return {
    pendientes: sinVerificar.length - correccion,
    correccion_documentos: correccion,
  };
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

  let solRows = data || [];
  if (solRows.length === 0) return [];

  const dbAdmin = getInsforgeAdmin();
  let docsIncorrectosMap = new Map<string, DocIncorrectoResumen[]>();

  if (estado === 'pendientes' || estado === 'correccion_documentos') {
    const solIds = solRows.map((r) => String(r.id));
    docsIncorrectosMap = await fetchDocsIncorrectosPorSolicitud(
      dbAdmin,
      solIds
    );

    if (estado === 'pendientes') {
      solRows = solRows.filter((r) => !docsIncorrectosMap.has(String(r.id)));
    } else {
      solRows = solRows.filter((r) => docsIncorrectosMap.has(String(r.id)));
    }
  }

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
      const id = String(r.id);
      const docsIncorrectos = docsIncorrectosMap.get(id);
      return {
        id,
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
        docs_incorrectos: docsIncorrectos,
        docs_incorrectos_count: docsIncorrectos?.length,
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
    docs_incorrectos?: DocIncorrectoResumen[];
    docs_incorrectos_count?: number;
    alumno: ReturnType<typeof mapAlumnoRow>;
  }[];
}
