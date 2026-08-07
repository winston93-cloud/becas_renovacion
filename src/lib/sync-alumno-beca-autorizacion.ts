/**
 * Al autorizar beca (último paso en admin), activa la beca Winston
 * en alumno_beca del ciclo calendario actual para que el cobro
 * (servicios_admin / portal) aplique el descuento.
 *
 * Al quitar autorización, deja beca_estatus = 0 en ese ciclo.
 */
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
} from '@/lib/ciclo-escolar';

// Cliente InsForge database (from/select/eq…).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

const BECA_ESTATUS_ACTIVA = 1;
const BECA_ESTATUS_INACTIVA = 0;

export type SyncAutorizacionResult =
  | { ok: true; cicloDestino: number; porcentaje: number }
  | { ok: false; error: string };

async function resolverOrigenBeca(
  db: Db,
  alumnoId: number,
  porcentajeFallback?: number | null,
  becaIdFallback?: number | null
): Promise<{ beca_id: number; beca_porcentaje: number; beca_p: string } | null> {
  const cicloOrigen = getCicloBecaARenovar();

  const { data: origenCiclo } = await db
    .from('alumno_beca')
    .select('beca_id, beca_porcentaje, beca_p, beca_estatus')
    .eq('alumno_id', alumnoId)
    .eq('beca_ciclo_escolar', cicloOrigen)
    .order('beca_estatus', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (origenCiclo && Number(origenCiclo.beca_porcentaje) > 0) {
    return {
      beca_id: Number(origenCiclo.beca_id),
      beca_porcentaje: Number(origenCiclo.beca_porcentaje),
      beca_p: String(origenCiclo.beca_p ?? '0'),
    };
  }

  const { data: cualquier } = await db
    .from('alumno_beca')
    .select('beca_id, beca_porcentaje, beca_p')
    .eq('alumno_id', alumnoId)
    .order('beca_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cualquier && Number(cualquier.beca_porcentaje) > 0) {
    return {
      beca_id: Number(cualquier.beca_id),
      beca_porcentaje: Number(cualquier.beca_porcentaje),
      beca_p: String(cualquier.beca_p ?? '0'),
    };
  }

  const pct = Number(porcentajeFallback);
  if (Number.isFinite(pct) && pct > 0) {
    return {
      beca_id: Number(becaIdFallback) > 0 ? Number(becaIdFallback) : 9,
      beca_porcentaje: Math.max(0, Math.min(100, Math.round(pct))),
      beca_p: '0',
    };
  }

  return null;
}

/** Sincroniza alumno_beca del ciclo actual con la autorización admin. */
export async function syncAlumnoBecaPorAutorizacion(opts: {
  db: Db;
  alumnoId: number;
  autorizada: boolean;
  porcentajeFallback?: number | null;
  becaIdFallback?: number | null;
}): Promise<SyncAutorizacionResult> {
  const cicloDestino = getCurrentSchoolCycle();
  const alumnoId = Number(opts.alumnoId);
  if (!(alumnoId > 0)) {
    return { ok: false, error: 'alumno_id inválido.' };
  }

  if (!opts.autorizada) {
    const { error } = await opts.db
      .from('alumno_beca')
      .update({
        beca_estatus: BECA_ESTATUS_INACTIVA,
        beca_actualizacion: new Date().toISOString(),
      })
      .eq('alumno_id', alumnoId)
      .eq('beca_ciclo_escolar', cicloDestino);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, cicloDestino, porcentaje: 0 };
  }

  const origen = await resolverOrigenBeca(
    opts.db,
    alumnoId,
    opts.porcentajeFallback,
    opts.becaIdFallback
  );
  if (!origen) {
    return {
      ok: false,
      error:
        'No hay porcentaje de beca Winston para activar (revisa la beca del ciclo anterior o el % deseado).',
    };
  }

  const { data: existente } = await opts.db
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', alumnoId)
    .eq('beca_ciclo_escolar', cicloDestino)
    .maybeSingle();

  const fila = {
    alumno_id: alumnoId,
    beca_id: origen.beca_id,
    beca_porcentaje: origen.beca_porcentaje,
    beca_estatus: BECA_ESTATUS_ACTIVA,
    beca_ciclo_escolar: cicloDestino,
    beca_p: origen.beca_p || '0',
    beca_actualizacion: new Date().toISOString(),
  };

  if (existente?.alumno_beca_id) {
    const { error } = await opts.db
      .from('alumno_beca')
      .update(fila)
      .eq('alumno_beca_id', existente.alumno_beca_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await opts.db.from('alumno_beca').insert([
      {
        ...fila,
        beca_registro: new Date().toISOString(),
      },
    ]);
    if (error) return { ok: false, error: error.message };
  }

  return {
    ok: true,
    cicloDestino,
    porcentaje: origen.beca_porcentaje,
  };
}
