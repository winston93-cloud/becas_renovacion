/**
 * Estado de firma / activación ligado a un expediente de beca.
 */
import { getCurrentSchoolCycle } from '@/lib/ciclo-escolar';
import { getInsforgeAdmin } from '@/lib/insforge-server';

export type FirmaElectronicaEstado = {
  activo: boolean;
  beca_activada: boolean;
  beca_activada_en: string | null;
  firmado_por: string | null;
  tiene_carta_firmada: boolean;
  carta_firmada_key: string | null;
  carta_firmada_bucket: string | null;
};

export async function obtenerFirmaElectronicaExpediente(opts: {
  flujo: 'solicitud' | 'renovacion';
  expedienteId: string;
  alumnoId: number;
}): Promise<FirmaElectronicaEstado> {
  const db = getInsforgeAdmin().database;
  const ciclo = getCurrentSchoolCycle();

  const { data, error } = await db
    .from('becas_autorizacion_firma')
    .select(
      'activo, beca_activada, beca_activada_en, firmado_por, carta_firmada_key, carta_firmada_bucket'
    )
    .eq('alumno_id', opts.alumnoId)
    .eq('ciclo_escolar', ciclo)
    .eq('expediente_id', opts.expedienteId)
    .eq('flujo', opts.flujo)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      activo: false,
      beca_activada: false,
      beca_activada_en: null,
      firmado_por: null,
      tiene_carta_firmada: false,
      carta_firmada_key: null,
      carta_firmada_bucket: null,
    };
  }

  return {
    activo: Boolean(data.activo),
    beca_activada: Boolean(data.beca_activada),
    beca_activada_en: data.beca_activada_en
      ? String(data.beca_activada_en)
      : null,
    firmado_por: data.firmado_por ? String(data.firmado_por) : null,
    tiene_carta_firmada: Boolean(data.carta_firmada_key),
    carta_firmada_key: data.carta_firmada_key
      ? String(data.carta_firmada_key)
      : null,
    carta_firmada_bucket: data.carta_firmada_bucket
      ? String(data.carta_firmada_bucket)
      : null,
  };
}
