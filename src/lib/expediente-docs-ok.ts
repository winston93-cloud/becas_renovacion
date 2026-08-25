/**
 * Helpers: ¿todos los docs requeridos están en revisión OK?
 * 2026-08-25 - Solicitud usa buildSolicitudDocsContext (ingresos, boleta SEP, exenciones).
 */
import { docsRequeridos } from '@/lib/documentos-requeridos';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import { buildSolicitudDocsContext } from '@/lib/solicitud-docs-context';
import type { DocumentoTipo } from '@/lib/types';

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
  let tipos: DocumentoTipo[];

  if (params.flujo === 'solicitud') {
    const { data: sol, error: solErr } = await params.db.database
      .from('becas_solicitud')
      .select('id, alumno_id, sin_boleta_sep, beca_deseada_id')
      .eq('id', params.expedienteId)
      .maybeSingle();

    if (solErr) {
      return { ok: false, motivo: solErr.message };
    }
    if (!sol) {
      return { ok: false, motivo: 'Solicitud no encontrada.' };
    }

    const { data: alumno, error: alErr } = await params.db.database
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nivel, alumno_grado')
      .eq('alumno_id', Number(sol.alumno_id))
      .maybeSingle();

    if (alErr) {
      return { ok: false, motivo: alErr.message };
    }
    if (!alumno) {
      return { ok: false, motivo: 'Alumno no encontrado.' };
    }

    let becaClase = params.becaClase ?? null;
    const becaId =
      sol.beca_deseada_id != null ? Number(sol.beca_deseada_id) : params.becaId;
    if (becaId != null && becaId > 0 && !becaClase) {
      const { data: concepto } = await params.db.database
        .from('becas_concepto_beca')
        .select('beca_clase')
        .eq('beca_id', becaId)
        .maybeSingle();
      becaClase = concepto?.beca_clase ? String(concepto.beca_clase) : null;
    }

    const ctx = await buildSolicitudDocsContext({
      alumno,
      solicitud: sol,
      becaClase,
    });
    tipos = ctx.tipos;
  } else {
    tipos = docsRequeridos({
      flujo: 'renovacion',
      nivel: params.nivel,
      grado: params.grado,
    });
  }

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
