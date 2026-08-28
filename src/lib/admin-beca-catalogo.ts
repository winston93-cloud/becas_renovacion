/**
 * Catálogo y validación de tipo/porcentaje de beca en admin.
 */
import { esBecaNoTramitable, esConceptoTramitable } from '@/lib/becas-excluidas';
import {
  getCicloBecaARenovar,
} from '@/lib/ciclo-escolar';
import type { ConceptoBeca } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type ConceptoBecaAdmin = ConceptoBeca & {
  beca_porcentaje_default?: number | null;
};

export type PatchBecaAdmin = {
  beca_id: number;
  beca_porcentaje: number;
};

export function normalizarPorcentajeBeca(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parsePatchBecaAdmin(body: {
  beca_id?: unknown;
  beca_porcentaje?: unknown;
}): { ok: true; data: PatchBecaAdmin } | { ok: false; error: string } {
  const beca_id = Number(body.beca_id);
  const beca_porcentaje = normalizarPorcentajeBeca(body.beca_porcentaje);

  if (!(beca_id > 0)) {
    return { ok: false, error: 'Seleccione un tipo de beca válido.' };
  }
  if (esBecaNoTramitable(beca_id)) {
    return { ok: false, error: 'La beca SEP no se tramita en este portal.' };
  }
  if (beca_porcentaje == null) {
    return { ok: false, error: 'Indique un porcentaje entre 0 y 100.' };
  }

  return { ok: true, data: { beca_id, beca_porcentaje } };
}

export function filtrarConceptosTramitables(
  conceptos: ConceptoBecaAdmin[],
  becaIdActual?: number | null
): ConceptoBecaAdmin[] {
  return conceptos.filter(
    (c) => esConceptoTramitable(c) || c.beca_id === becaIdActual
  );
}

export async function cargarConceptosBecaAdmin(
  db: Db
): Promise<ConceptoBecaAdmin[]> {
  const { data, error } = await db
    .from('becas_concepto_beca')
    .select('beca_id, beca_clase, beca_porcentaje_default')
    .order('beca_id', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((c: Record<string, unknown>) => ({
    beca_id: Number(c.beca_id),
    beca_clase: String(c.beca_clase),
    beca_porcentaje_default:
      c.beca_porcentaje_default != null
        ? Number(c.beca_porcentaje_default)
        : null,
  }));
}

/** Renovación: actualiza alumno_beca del ciclo origen (beca a renovar). */
export async function actualizarBecaRenovacionAdmin(opts: {
  db: Db;
  alumnoId: number;
  alumnoRef?: string | number | null;
  patch: PatchBecaAdmin;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cicloOrigen = getCicloBecaARenovar();
  const ahora = new Date().toISOString();

  const upsertCiclo = async (
    ciclo: number,
    estatus?: number
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { data: porCiclo } = await opts.db
      .from('alumno_beca')
      .select('alumno_beca_id, beca_estatus')
      .eq('alumno_id', opts.alumnoId)
      .eq('beca_ciclo_escolar', ciclo)
      .maybeSingle();

    // 2026-08-28 - alumno_beca tiene UNIQUE(alumno_id). Si no hay fila del ciclo
    // (ej. Hellen 21546 Hermanos→Socioeconómica), actualizar esa fila; no INSERT.
    let existente = porCiclo;
    if (!existente?.alumno_beca_id) {
      const { data: porAlumno } = await opts.db
        .from('alumno_beca')
        .select('alumno_beca_id, beca_estatus')
        .eq('alumno_id', opts.alumnoId)
        .maybeSingle();
      existente = porAlumno;
    }

    const fila: Record<string, unknown> = {
      alumno_id: opts.alumnoId,
      beca_id: opts.patch.beca_id,
      beca_porcentaje: opts.patch.beca_porcentaje,
      beca_ciclo_escolar: ciclo,
      beca_actualizacion: ahora,
    };

    if (opts.alumnoRef != null && String(opts.alumnoRef).trim()) {
      fila.alumno_ref = Number(opts.alumnoRef);
    }

    if (existente?.alumno_beca_id) {
      if (estatus != null) fila.beca_estatus = estatus;
      const { error } = await opts.db
        .from('alumno_beca')
        .update(fila)
        .eq('alumno_beca_id', existente.alumno_beca_id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    fila.beca_estatus = estatus ?? 0;
    fila.beca_p = '0';
    fila.beca_registro = ahora;
    const { error } = await opts.db.from('alumno_beca').insert([fila]);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const origen = await upsertCiclo(cicloOrigen);
  if (!origen.ok) return origen;

  return { ok: true };
}

/** Solicitud: actualiza tipo y porcentaje deseado en becas_solicitud. */
export async function actualizarBecaSolicitudAdmin(opts: {
  db: Db;
  solicitudId: string;
  patch: PatchBecaAdmin;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await opts.db
    .from('becas_solicitud')
    .update({
      beca_deseada_id: opts.patch.beca_id,
      beca_porcentaje_deseado: opts.patch.beca_porcentaje,
    })
    .eq('id', opts.solicitudId);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
