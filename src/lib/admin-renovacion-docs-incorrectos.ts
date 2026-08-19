/**
 * Renovaciones con documentos marcados incorrectos (familia avisada por correo).
 * Una sola consulta a becas_documento (sin .in masivo de UUIDs → evita 502 InsForge).
 */
import type { getInsforgeAdmin } from '@/lib/insforge-server';
import { labelDocumentoTipo } from '@/lib/email-renovacion';

type AdminClient = ReturnType<typeof getInsforgeAdmin>;

export type DocIncorrectoResumen = {
  tipo: string;
  label: string;
  nota: string | null;
};

/**
 * Mapa renovacion_id → docs incorrectos, limitado a los IDs dados.
 * Una query: revision_estado = incorrecto (pocos registros) + filtro en memoria.
 */
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

  if (error) {
    const msg = String(error.message || 'Error al consultar documentos.');
    if (msg.includes('<html>') || msg.includes('502')) {
      throw new Error(
        'El servidor de datos no respondió (502). Intente de nuevo en unos segundos.'
      );
    }
    throw new Error(msg);
  }

  for (const row of data || []) {
    const renId = String(row.renovacion_id);
    if (!allowed.has(renId)) continue;
    const list = map.get(renId) || [];
    list.push({
      tipo: String(row.tipo),
      label: labelDocumentoTipo(String(row.tipo)),
      nota: row.revision_nota || null,
    });
    map.set(renId, list);
  }

  return map;
}

/** IDs de renovación con al menos un doc incorrecto (subconjunto de renovacionIds). */
export async function fetchRenovacionIdsConDocsIncorrectos(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Set<string>> {
  const indice = await fetchIndiceDocsIncorrectos(admin, renovacionIds);
  return new Set(indice.keys());
}

/** Alias explícito para el listado admin. */
export async function fetchDocsIncorrectosPorRenovacion(
  admin: AdminClient,
  renovacionIds: string[]
): Promise<Map<string, DocIncorrectoResumen[]>> {
  return fetchIndiceDocsIncorrectos(admin, renovacionIds);
}
