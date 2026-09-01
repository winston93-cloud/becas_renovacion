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

/** Resumen para listados admin (renovación / solicitud). */
export type FirmaListaResumen = {
  activo: boolean;
  beca_activada: boolean;
  beca_activada_en: string | null;
  firmado_por: string | null;
};

function mapFirmaListaRow(data: {
  activo?: boolean | null;
  beca_activada?: boolean | null;
  beca_activada_en?: string | null;
  firmado_por?: string | null;
}): FirmaListaResumen {
  return {
    activo: Boolean(data.activo),
    beca_activada: Boolean(data.beca_activada),
    beca_activada_en: data.beca_activada_en
      ? String(data.beca_activada_en)
      : null,
    firmado_por: data.firmado_por ? String(data.firmado_por).trim() : null,
  };
}

function chunkStrings(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export async function fetchExpedienteIdsFirmaActivada(opts: {
  flujo: 'solicitud' | 'renovacion';
  ciclo: number;
}): Promise<string[]> {
  const db = getInsforgeAdmin().database;
  const { data, error } = await db
    .from('becas_autorizacion_firma')
    .select('expediente_id')
    .eq('ciclo_escolar', opts.ciclo)
    .eq('flujo', opts.flujo)
    .eq('beca_activada', true)
    .limit(5000);

  if (error) throw new Error(error.message);
  return [...new Set((data || []).map((r) => String(r.expediente_id)))];
}

export async function fetchFirmaResumenPorExpedientes(opts: {
  flujo: 'solicitud' | 'renovacion';
  ciclo: number;
  expedienteIds: string[];
}): Promise<Map<string, FirmaListaResumen>> {
  const map = new Map<string, FirmaListaResumen>();
  const ids = [...new Set(opts.expedienteIds.filter(Boolean))];
  if (!ids.length) return map;

  const db = getInsforgeAdmin().database;
  for (const slice of chunkStrings(ids, 200)) {
    const { data, error } = await db
      .from('becas_autorizacion_firma')
      .select(
        'expediente_id, activo, beca_activada, beca_activada_en, firmado_por'
      )
      .eq('ciclo_escolar', opts.ciclo)
      .eq('flujo', opts.flujo)
      .in('expediente_id', slice);

    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const id = String(row.expediente_id);
      map.set(id, mapFirmaListaRow(row));
    }
  }
  return map;
}

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
