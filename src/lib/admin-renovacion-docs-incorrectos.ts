/**
 * Renovaciones con documentos marcados incorrectos (familia avisada por correo).
 */
import type { getInsforgeAdmin } from '@/lib/insforge-server';
import { labelDocumentoTipo } from '@/lib/email-renovacion';

type AdminClient = ReturnType<typeof getInsforgeAdmin>;

const CHUNK_RENOVACION_IDS = 200;

export type DocIncorrectoResumen = {
  tipo: string;
  label: string;
  nota: string | null;
};

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** IDs de renovación con al menos un doc en revision_estado = incorrecto. */
export async function fetchRenovacionIdsConDocsIncorrectos(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Set<string>> {
  if (renovacionIds.length === 0) return new Set();

  const ids = new Set<string>();

  for (const slice of chunkIds(renovacionIds, CHUNK_RENOVACION_IDS)) {
    const { data, error } = await admin.database
      .from('becas_documento')
      .select('renovacion_id')
      .in('renovacion_id', slice)
      .eq('revision_estado', 'incorrecto');

    if (error) throw new Error(error.message);
    for (const row of data || []) {
      if (row.renovacion_id) ids.add(String(row.renovacion_id));
    }
  }

  return ids;
}

/** Detalle de docs incorrectos por renovacion_id (solo estado incorrecto). */
export async function fetchDocsIncorrectosPorRenovacion(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  const map = new Map<string, DocIncorrectoResumen[]>();
  if (renovacionIds.length === 0) return map;

  for (const slice of chunkIds(renovacionIds, CHUNK_RENOVACION_IDS)) {
    const { data, error } = await admin.database
      .from('becas_documento')
      .select('renovacion_id, tipo, revision_nota')
      .in('renovacion_id', slice)
      .eq('revision_estado', 'incorrecto');

    if (error) throw new Error(error.message);

    for (const row of data || []) {
      const renId = String(row.renovacion_id);
      const list = map.get(renId) || [];
      list.push({
        tipo: String(row.tipo),
        label: labelDocumentoTipo(String(row.tipo)),
        nota: row.revision_nota || null,
      });
      map.set(renId, list);
    }
  }

  return map;
}
