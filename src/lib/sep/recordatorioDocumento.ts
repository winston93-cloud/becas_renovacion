/**
 * 2026-10-12 - Recordatorio "SEP sin documento": familias que contestaron en el cuestionario que ya recibieron
 * la Beca SEP pero no tienen trámite. Solo lee el cuestionario y el trámite; el envío queda en la bitácora
 * (becas_admin_auditoria), que también sirve como límite: un recordatorio por alumno cada 7 días.
 */
import 'server-only';
import type { AdminAuth } from '@/lib/admin-auth';
import { registrarAuditoria } from '@/lib/admin-auditoria';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import type { AdminSepSesion } from '@/lib/sep/admin';
import { correoRecordatorioDocumentoSep } from '@/lib/sep/correosFamilia';
import { alumnoPorRef } from '@/lib/sep/insforge/consultas';
import { getSepRepo } from '@/lib/sep/repo';
import { cicloSep } from '@/lib/sep/servicio';

const ACCION = 'sep.recordatorio_documento';
export const DIAS_ENTRE_RECORDATORIOS = 7;
const DIA_MS = 86_400_000;

/** Fecha (ISO) a partir de la cual se puede volver a recordar; null si ya se puede. */
export function siguienteRecordatorio(ultimo: string | null | undefined, ahora = Date.now()): string | null {
  if (!ultimo) return null;
  const t = Date.parse(ultimo);
  if (!Number.isFinite(t)) return null;
  const siguiente = t + DIAS_ENTRE_RECORDATORIOS * DIA_MS;
  return siguiente > ahora ? new Date(siguiente).toISOString() : null;
}

/** Último recordatorio enviado por No. de control (del ciclo vigente, aprox. últimos 120 días). */
export async function ultimosRecordatorios(refs: number[]): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (!refs.length) return mapa;
  try {
    const desde = new Date(Date.now() - 120 * DIA_MS).toISOString();
    const { data, error } = await getInsforgeAdmin()
      .database.from('becas_admin_auditoria')
      .select('alumno_ref, created_at, detalle')
      .eq('accion', ACCION)
      .gte('created_at', desde)
      .in('alumno_ref', refs.map(String))
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    for (const r of (data ?? []) as { alumno_ref: string | null; created_at: string; detalle?: { enviado?: boolean } }[]) {
      const ref = Number(r.alumno_ref);
      if (!Number.isFinite(ref) || r.detalle?.enviado === false || mapa.has(ref)) continue;
      mapa.set(ref, r.created_at);
    }
  } catch (e) {
    console.error('[sep/recordatorio] bitácora', e);
  }
  return mapa;
}

export type ResultadoRecordatorio =
  | { ok: true; detalle: string; enviadoEn: string }
  | { ok: false; status: number; error: string };

export async function enviarRecordatorioDocumento(admin: AdminSepSesion, ref: number): Promise<ResultadoRecordatorio> {
  const ciclo = cicloSep();
  const { data, error } = await getInsforgeAdmin()
    .database.from('beneficios_externos_respuesta')
    .select('alumno_ref, alumno_nivel, beneficio, recibio, es_prueba')
    .eq('ciclo_escolar', ciclo)
    .eq('alumno_ref', ref)
    .limit(1);
  if (error) return { ok: false, status: 500, error: 'No se pudo leer el cuestionario.' };
  const fila = (data ?? [])[0] as { alumno_nivel: number | null; beneficio: string | null; recibio: boolean | null } | undefined;
  if (!fila || fila.beneficio !== 'sep' || fila.recibio !== true) {
    return { ok: false, status: 409, error: 'Esta familia no contestó que ya recibió la Beca SEP.' };
  }
  if (fila.alumno_nivel == null || !admin.niveles.includes(fila.alumno_nivel)) {
    return { ok: false, status: 403, error: 'El alumno no pertenece a sus niveles.' };
  }

  const alumno = await alumnoPorRef(ref);
  if (!alumno) return { ok: false, status: 404, error: 'No se encontró el alumno.' };
  if (await getSepRepo().porAlumno(alumno.alumnoId, ciclo)) {
    return { ok: false, status: 409, error: 'La familia ya inició su trámite de Beca SEP.' };
  }

  const ultimo = (await ultimosRecordatorios([ref])).get(ref);
  const siguiente = siguienteRecordatorio(ultimo);
  if (siguiente) {
    const fecha = new Date(siguiente).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' });
    return { ok: false, status: 429, error: `Ya se le envió un recordatorio. El siguiente se puede enviar a partir del ${fecha}.` };
  }

  const envio = await correoRecordatorioDocumentoSep({ alumnoId: alumno.alumnoId, alumnoRef: ref, nombre: alumno.nombre, ciclo });
  const auth: AdminAuth = { role: admin.role as AdminAuth['role'], label: admin.label, niveles: admin.niveles };
  await registrarAuditoria(auth, {
    accion: ACCION,
    entidad: 'beca_sep',
    alumno_id: alumno.alumnoId,
    alumno_ref: String(ref),
    alumno_nombre: alumno.nombre,
    alumno_nivel: fila.alumno_nivel,
    detalle: { enviado: envio.enviado, resultado: envio.detalle, ciclo },
  });
  if (!envio.enviado) return { ok: false, status: 422, error: envio.detalle };
  return { ok: true, detalle: envio.detalle, enviadoEn: new Date().toISOString() };
}
