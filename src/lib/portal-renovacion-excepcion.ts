/**
 * Tras cierre de renovación: excepciones controladas (docs incorrectos o lista CE).
 */
import type { getInsforgeAdmin } from '@/lib/insforge-server';
import { getCicloBecaARenovar } from '@/lib/ciclo-escolar';
import {
  alumnoRefTieneExcepcionRenovacionCompleta,
} from '@/lib/renovacion-excepcion-completa-refs';
import {
  assertPortalAbierto,
  getPortalStatus,
  type FlujoPortal,
} from '@/lib/portal-ventanas';

type AdminClient = ReturnType<typeof getInsforgeAdmin>;

/** Lista CE: renovación completa post-cierre (por No. de control). */
export async function renovacionExentaCompletaPostCierre(
  admin: AdminClient,
  alumnoId: number
): Promise<boolean> {
  const { data: alumno, error } = await admin.database
    .from('alumno')
    .select('alumno_ref')
    .eq('alumno_id', alumnoId)
    .maybeSingle();

  if (error || !alumno?.alumno_ref) return false;
  return alumnoRefTieneExcepcionRenovacionCompleta(String(alumno.alumno_ref));
}

type RenovacionExcepcionRow = {
  id: string;
  correo_enviado?: boolean | null;
  verificado?: boolean | null;
};

async function renovacionCicloActual(
  admin: AdminClient,
  alumnoId: number
): Promise<RenovacionExcepcionRow | null> {
  const ciclo = getCicloBecaARenovar();
  const { data: renovacion, error: renErr } = await admin.database
    .from('becas_renovacion')
    .select('id, correo_enviado, verificado')
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', ciclo)
    .maybeSingle();

  if (renErr || !renovacion?.id) return null;
  return renovacion as RenovacionExcepcionRow;
}

/** Expediente enviado, con al menos un doc marcado incorrecto (aunque ya se hubiera verificado). */
export async function renovacionExentaPorDocsIncorrectos(
  admin: AdminClient,
  alumnoId: number
): Promise<boolean> {
  const renovacion = await renovacionCicloActual(admin, alumnoId);
  if (!renovacion?.id || !renovacion.correo_enviado) return false;

  const { data: docs, error: docErr } = await admin.database
    .from('becas_documento')
    .select('id, revision_estado')
    .eq('renovacion_id', renovacion.id)
    .eq('revision_estado', 'incorrecto')
    .limit(1);

  if (docErr) return false;
  return (docs?.length ?? 0) > 0;
}

async function renovacionExentaPostCierreAlguna(
  admin: AdminClient,
  alumnoId: number
): Promise<boolean> {
  if (await renovacionExentaCompletaPostCierre(admin, alumnoId)) return true;
  return renovacionExentaPorDocsIncorrectos(admin, alumnoId);
}

/** Expediente de renovación ya enviado (puede consultar / corregir docs). */
export async function renovacionYaEnviada(
  admin: AdminClient,
  alumnoId: number
): Promise<boolean> {
  const renovacion = await renovacionCicloActual(admin, alumnoId);
  return Boolean(renovacion?.correo_enviado);
}

/** null = puede continuar (GET consulta); objeto = bloqueo 403. */
export async function assertPortalRenovacionOExcepcionDocs(
  admin: AdminClient,
  alumnoId: number,
  now?: Date
): Promise<{ error: string; codigo: string; titulo: string } | null> {
  const status = getPortalStatus('renovacion', now);
  if (status.open) return null;
  if (await renovacionExentaPostCierreAlguna(admin, alumnoId)) return null;
  // Post-cierre: quien ya envió puede entrar a ver el expediente o corregir docs.
  if (await renovacionYaEnviada(admin, alumnoId)) return null;
  return assertPortalAbierto('renovacion', now)!;
}

/** POST formulario / finalizar: solo ventana abierta o excepción completa. */
export async function assertPortalRenovacionOExcepcionCompleta(
  admin: AdminClient,
  alumnoId: number,
  now?: Date
): Promise<{ error: string; codigo: string; titulo: string } | null> {
  const status = getPortalStatus('renovacion', now);
  if (status.open) return null;
  if (await renovacionExentaCompletaPostCierre(admin, alumnoId)) return null;
  return assertPortalAbierto('renovacion', now)!;
}

/** Por renovacion_id (POST documentos). */
export async function assertPortalRenovacionOExcepcionPorRenovacionId(
  admin: AdminClient,
  renovacionId: string,
  now?: Date
): Promise<{ error: string; codigo: string; titulo: string } | null> {
  const status = getPortalStatus('renovacion', now);
  if (status.open) return null;

  const { data: renovacion, error: renErr } = await admin.database
    .from('becas_renovacion')
    .select('alumno_id, correo_enviado, verificado')
    .eq('id', renovacionId)
    .maybeSingle();

  if (renErr || !renovacion) {
    return assertPortalAbierto('renovacion', now)!;
  }

  const alumnoId = Number(renovacion.alumno_id);
  if (await renovacionExentaCompletaPostCierre(admin, alumnoId)) return null;

  if (!renovacion.correo_enviado) {
    return assertPortalAbierto('renovacion', now)!;
  }

  const { data: docs, error: docErr } = await admin.database
    .from('becas_documento')
    .select('id')
    .eq('renovacion_id', renovacionId)
    .eq('revision_estado', 'incorrecto')
    .limit(1);

  if (docErr || !(docs?.length ?? 0)) {
    return assertPortalAbierto('renovacion', now)!;
  }

  return null;
}

/** GET comprobante: ventana abierta, excepción, o expediente ya enviado. */
export async function assertPortalRenovacionConsultaPorRenovacionId(
  admin: AdminClient,
  renovacionId: string,
  now?: Date
): Promise<{ error: string; codigo: string; titulo: string } | null> {
  const status = getPortalStatus('renovacion', now);
  if (status.open) return null;

  const { data: renovacion, error: renErr } = await admin.database
    .from('becas_renovacion')
    .select('alumno_id, correo_enviado')
    .eq('id', renovacionId)
    .maybeSingle();

  if (renErr || !renovacion) {
    return assertPortalAbierto('renovacion', now)!;
  }

  const alumnoId = Number(renovacion.alumno_id);
  if (await renovacionExentaCompletaPostCierre(admin, alumnoId)) return null;
  if (renovacion.correo_enviado) return null;
  return assertPortalAbierto('renovacion', now)!;
}

export function mensajeExcepcionCorreccionPostCierre(): string {
  return 'El periodo general de renovación ya cerró, pero Control Escolar le pidió corregir documento(s). Puede subir solo esos archivos; el resto del trámite no se vuelve a llenar.';
}

export function mensajeExcepcionRenovacionCompletaPostCierre(): string {
  return 'El periodo de renovación cerró, pero tiene acceso especial para completar su renovación de beca (formulario, documentos y envío).';
}

/** Solo renovación; solicitud sin cambios. */
export function flujoEsRenovacion(flujo: FlujoPortal): flujo is 'renovacion' {
  return flujo === 'renovacion';
}
