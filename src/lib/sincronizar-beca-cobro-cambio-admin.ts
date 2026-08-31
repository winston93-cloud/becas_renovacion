/**
 * Si el papá ya firmó/activó la beca, el cambio de tipo/% debe reflejarse
 * de inmediato en alumno_beca del ciclo de cobro (23→24…).
 */
import { getCurrentSchoolCycle } from '@/lib/ciclo-escolar';
import type { PatchBecaAdmin } from '@/lib/admin-beca-catalogo';
import type { FlujoAutorizacionFirma } from '@/lib/registrar-autorizacion-firma-beca';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

const BECA_ESTATUS_ACTIVA = 1;

export async function becaYaActivadaEnCobro(opts: {
  db: Db;
  alumnoId: number;
  expedienteId: string;
  flujo: FlujoAutorizacionFirma;
}): Promise<boolean> {
  const cicloCobro = getCurrentSchoolCycle();
  const { data, error } = await opts.db
    .from('becas_autorizacion_firma')
    .select('beca_activada')
    .eq('alumno_id', opts.alumnoId)
    .eq('ciclo_escolar', cicloCobro)
    .eq('expediente_id', opts.expedienteId)
    .eq('flujo', opts.flujo)
    .eq('activo', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.beca_activada);
}

export async function sincronizarBecaCobroTrasCambioAdmin(opts: {
  db: Db;
  alumnoId: number;
  alumnoRef?: string | number | null;
  patch: PatchBecaAdmin;
}): Promise<{ ok: true; ciclo_cobro: number } | { ok: false; error: string }> {
  const cicloCobro = getCurrentSchoolCycle();
  const ahora = new Date().toISOString();

  const { data: existente, error: exErr } = await opts.db
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', opts.alumnoId)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };

  const fila: Record<string, unknown> = {
    beca_id: opts.patch.beca_id,
    beca_porcentaje: opts.patch.beca_porcentaje,
    beca_ciclo_escolar: cicloCobro,
    beca_estatus: BECA_ESTATUS_ACTIVA,
    beca_actualizacion: ahora,
  };
  if (opts.alumnoRef != null && String(opts.alumnoRef).trim()) {
    fila.alumno_ref = Number(opts.alumnoRef);
  }

  if (existente?.alumno_beca_id) {
    const { error } = await opts.db
      .from('alumno_beca')
      .update(fila)
      .eq('alumno_beca_id', existente.alumno_beca_id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, ciclo_cobro: cicloCobro };
  }

  const { error } = await opts.db.from('alumno_beca').insert([
    {
      alumno_id: opts.alumnoId,
      ...fila,
      beca_p: '0',
      beca_registro: ahora,
    },
  ]);
  if (error) return { ok: false, error: error.message };
  return { ok: true, ciclo_cobro: cicloCobro };
}
