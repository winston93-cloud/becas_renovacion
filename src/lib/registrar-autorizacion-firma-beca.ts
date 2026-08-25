/**
 * Al pulsar «Autorizar beca» en admin: registra al alumno para acceso futuro
 * a firma electrónica. No modifica alumno_beca ni activa descuentos en cobro.
 */
import { getCurrentSchoolCycle } from '@/lib/ciclo-escolar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type FlujoAutorizacionFirma = 'solicitud' | 'renovacion';

export async function registrarAutorizacionFirmaBeca(opts: {
  db: Db;
  alumnoId: number;
  expedienteId: string;
  flujo: FlujoAutorizacionFirma;
  autorizada: boolean;
  autorizadoPor?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const alumnoId = Number(opts.alumnoId);
  if (!(alumnoId > 0)) {
    return { ok: false, error: 'alumno_id inválido.' };
  }

  const ciclo = getCurrentSchoolCycle();
  const ahora = new Date().toISOString();

  if (opts.autorizada) {
    const { data: existente } = await opts.db
      .from('becas_autorizacion_firma')
      .select('id')
      .eq('alumno_id', alumnoId)
      .eq('ciclo_escolar', ciclo)
      .maybeSingle();

    const fila = {
      alumno_id: alumnoId,
      ciclo_escolar: ciclo,
      flujo: opts.flujo,
      expediente_id: opts.expedienteId,
      activo: true,
      autorizado_en: ahora,
      autorizado_por: opts.autorizadoPor?.trim() || null,
      revocado_en: null,
    };

    if (existente?.id) {
      const { error } = await opts.db
        .from('becas_autorizacion_firma')
        .update(fila)
        .eq('id', existente.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await opts.db
        .from('becas_autorizacion_firma')
        .insert([fila]);
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  const { error } = await opts.db
    .from('becas_autorizacion_firma')
    .update({
      activo: false,
      revocado_en: ahora,
    })
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', ciclo)
    .eq('activo', true);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
