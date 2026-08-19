/**
 * Expedientes con documentos marcados incorrectos (familia avisada por correo).
 * Una sola consulta por tabla (sin .in masivo de UUIDs → evita 502 InsForge).
 */
import type { getInsforgeAdmin } from '@/lib/insforge-server';
import { labelDocumentoTipo } from '@/lib/email-renovacion';

type AdminClient = ReturnType<typeof getInsforgeAdmin>;

export type AdminDocsParentFlujo = 'renovacion' | 'solicitud';

export type DocIncorrectoResumen = {
  tipo: string;
  label: string;
  nota: string | null;
};

function mensajeErrorDocs(error: { message?: string }) {
  const msg = String(error.message || 'Error al consultar documentos.');
  if (msg.includes('<html>') || msg.includes('502')) {
    throw new Error(
      'El servidor de datos no respondió (502). Intente de nuevo en unos segundos.'
    );
  }
  throw new Error(msg);
}

/**
 * Mapa parent_id → docs incorrectos, limitado a los IDs dados.
 */
export async function fetchIndiceDocsIncorrectosPorFlujo(
  admin: AdminClient,
  flujo: AdminDocsParentFlujo,
  parentIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  if (flujo === 'renovacion') {
    return fetchIndiceDocsIncorrectos(admin, parentIds);
  }
  return fetchIndiceDocsIncorrectosSolicitudRows(admin, parentIds);
}

async function fetchIndiceDocsIncorrectosSolicitudRows(
  admin: AdminClient,
  solicitudIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  const map = new Map<string, DocIncorrectoResumen[]>();
  if (solicitudIds.length === 0) return map;

  const allowed = new Set(solicitudIds);

  const { data, error } = await admin.database
    .from('becas_solicitud_documento')
    .select('solicitud_id, tipo, revision_nota')
    .eq('revision_estado', 'incorrecto')
    .limit(5000);

  if (error) mensajeErrorDocs(error);

  for (const row of data || []) {
    const parentId = String(row.solicitud_id);
    if (!allowed.has(parentId)) continue;
    const list = map.get(parentId) || [];
    list.push({
      tipo: String(row.tipo),
      label: labelDocumentoTipo(String(row.tipo)),
      nota: row.revision_nota || null,
    });
    map.set(parentId, list);
  }

  return map;
}

export async function fetchIndiceDocsIncorrectos(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  const map = new Map<string, DocIncorrectoResumen[]>();
  if (renovacionIds.length === 0) return map;

  const allowed = new Set(renovacionIds);

  const { data, error } = await admin.database
    .from('becas_documento')
    .select('renovacion_id, tipo, revision_nota')
    .eq('revision_estado', 'incorrecto')
    .limit(5000);

  if (error) mensajeErrorDocs(error);

  for (const row of data || []) {
    const parentId = String(row.renovacion_id);
    if (!allowed.has(parentId)) continue;
    const list = map.get(parentId) || [];
    list.push({
      tipo: String(row.tipo),
      label: labelDocumentoTipo(String(row.tipo)),
      nota: row.revision_nota || null,
    });
    map.set(parentId, list);
  }

  return map;
}

export async function fetchRenovacionIdsConDocsIncorrectos(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Set<string>> {
  const indice = await fetchIndiceDocsIncorrectos(admin, renovacionIds);
  return new Set(indice.keys());
}

export async function fetchDocsIncorrectosPorRenovacion(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  return fetchIndiceDocsIncorrectos(admin, renovacionIds);
}

export async function fetchDocsIncorrectosPorSolicitud(
  admin: AdminClient,
  solicitudIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  return fetchIndiceDocsIncorrectosSolicitudRows(admin, solicitudIds);
}
