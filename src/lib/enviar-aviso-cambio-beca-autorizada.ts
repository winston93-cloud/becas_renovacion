/**
 * Aviso institucional a padres: cambio de tipo/porcentaje en beca ya autorizada.
 */
import type { createAdminClient } from '@insforge/sdk';
import { resolveAccesoAutorizadoDestinatarios } from '@/lib/email-acceso-autorizado';
import {
  buildBecaCambioAutorizadaEmailHtml,
  buildBecaCambioAutorizadaEmailSubject,
} from '@/lib/email-beca-cambio-autorizada';
import { resolverClasesBeca } from '@/lib/admin-beca-cambio';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';
import { sendMail } from '@/lib/mailer';

type Db = ReturnType<typeof createAdminClient>['database'];

export type EmailAvisoResult = {
  ok: boolean;
  messageId?: string;
  to?: string;
  error?: string;
};

export type DetalleCambioBeca = {
  beca_id_anterior: number | null;
  beca_id_nuevo: number;
  porcentaje_anterior: number | null;
  porcentaje_nuevo: number;
  beca_autorizada: boolean;
};

function labelBeca(clases: Map<number, string>, becaId: number | null): string {
  if (becaId == null || !(becaId > 0)) return 'Sin definir';
  return clases.get(becaId) || `Beca #${becaId}`;
}

function labelPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(Number(pct))) return 'Sin definir';
  return `${Math.round(Number(pct))}%`;
}

export async function enviarAvisoCambioBecaAutorizada(opts: {
  db: Db;
  flujo: 'renovacion' | 'solicitud';
  alumno: {
    alumno_id: number;
    alumno_ref?: string | number | null;
    alumno_app?: string | null;
    alumno_apm?: string | null;
    alumno_nombre?: string | null;
    alumno_nivel?: number | null;
    alumno_grado?: number | null;
    alumno_grupo?: number | null;
  };
  cambio: DetalleCambioBeca;
  cicloLabel?: string;
}): Promise<EmailAvisoResult> {
  const clases = await resolverClasesBeca(opts.db, [
    opts.cambio.beca_id_anterior,
    opts.cambio.beca_id_nuevo,
  ]);

  const nombreCompleto = [
    opts.alumno.alumno_app,
    opts.alumno.alumno_apm,
    opts.alumno.alumno_nombre,
  ]
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' ');

  const nivel =
    opts.alumno.alumno_nivel != null ? Number(opts.alumno.alumno_nivel) : null;
  const grado = labelGrado(nivel, opts.alumno.alumno_grado as number | null);
  const grupo = labelGrupo(opts.alumno.alumno_grupo as number | null);

  const emailData = {
    alumnoNombre: nombreCompleto || 'Sin nombre',
    alumnoRef: String(opts.alumno.alumno_ref ?? ''),
    nivelLabel: labelNivel(nivel),
    gradoGrupo: `${grado} / ${grupo}`,
    cicloLabel: opts.cicloLabel ?? getSchoolCycleLabel(),
    flujo: opts.flujo,
    becaAnteriorLabel: labelBeca(clases, opts.cambio.beca_id_anterior),
    becaNuevaLabel: labelBeca(clases, opts.cambio.beca_id_nuevo),
    porcentajeAnterior: labelPct(opts.cambio.porcentaje_anterior),
    porcentajeNuevo: labelPct(opts.cambio.porcentaje_nuevo),
  };

  const recipients = await resolveAccesoAutorizadoDestinatarios({
    db: opts.db,
    alumno_id: Number(opts.alumno.alumno_id),
    alumno_ref: opts.alumno.alumno_ref,
    alumno_app: opts.alumno.alumno_app,
    alumno_apm: opts.alumno.alumno_apm,
    alumno_nombre: opts.alumno.alumno_nombre,
  });

  if (recipients.sin_correo || recipients.to.length === 0) {
    return {
      ok: false,
      error: 'No hay correo de padre/madre registrado para este alumno.',
    };
  }

  try {
    const bccDesarrollo =
      process.env.BECAS_EMAIL_CC_CAMBIO_BECA?.trim() ||
      process.env.BECAS_EMAIL_CC_AUTORIZACION?.trim() ||
      'sistemas.desarrollo@winston93.edu.mx';
    const sent = await sendMail({
      to: recipients.to,
      bcc: bccDesarrollo,
      replyTo:
        process.env.BECAS_EMAIL_REPLY_TO?.trim() ||
        process.env.BECAS_EMAIL_TO?.trim() ||
        recipients.to[0],
      subject: buildBecaCambioAutorizadaEmailSubject(emailData),
      html: buildBecaCambioAutorizadaEmailHtml(emailData),
    });
    return {
      ok: true,
      messageId: sent.messageId,
      to: recipients.to.join(', '),
    };
  } catch (mailErr) {
    return {
      ok: false,
      to: recipients.to.join(', '),
      error: mailErr instanceof Error ? mailErr.message : 'Error SMTP',
    };
  }
}
