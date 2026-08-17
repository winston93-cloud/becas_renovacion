/**
 * Helpers: ¿todos los docs requeridos están en revisión OK?
 */
import { docsRequeridos } from '@/lib/documentos-requeridos';
import { normalizarRevisionEstado } from '@/lib/doc-revision';

export async function expedienteDocsTodosOk(params: {
  // Cliente InsForge admin (select/eq thenable).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { database: any };
  flujo: 'renovacion' | 'solicitud';
  expedienteId: string;
  nivel: number | null | undefined;
  grado: number | null | undefined;
  becaId?: number | null;
  becaClase?: string | null;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const tipos = docsRequeridos({
    flujo: params.flujo,
    nivel: params.nivel,
    grado: params.grado,
    becaId: params.becaId,
    becaClase: params.becaClase,
  });
  if (tipos.length === 0) {
    return { ok: false, motivo: 'No hay documentos requeridos configurados.' };
  }

  const tabla =
    params.flujo === 'renovacion'
      ? 'becas_documento'
      : 'becas_solicitud_documento';
  const fk =
    params.flujo === 'renovacion' ? 'renovacion_id' : 'solicitud_id';

  const { data: docs, error } = await params.db.database
    .from(tabla)
    .select('tipo, revision_estado')
    .eq(fk, params.expedienteId);

  if (error) {
    return { ok: false, motivo: error.message };
  }

  const porTipo = new Map<string, string>();
  for (const d of docs || []) {
    porTipo.set(String(d.tipo), normalizarRevisionEstado(d.revision_estado));
  }

  const faltan: string[] = [];
  const noOk: string[] = [];
  for (const t of tipos) {
    const est = porTipo.get(t);
    if (!est) faltan.push(t);
    else if (est !== 'ok') noOk.push(t);
  }

  if (faltan.length || noOk.length) {
    const partes: string[] = [];
    if (faltan.length) partes.push(`faltan: ${faltan.join(', ')}`);
    if (noOk.length) {
      partes.push(`sin revisión OK: ${noOk.join(', ')}`);
    }
    return {
      ok: false,
      motivo: `No se puede verificar el expediente hasta revisar todos los documentos (${partes.join('; ')}).`,
    };
  }
  return { ok: true };
}
