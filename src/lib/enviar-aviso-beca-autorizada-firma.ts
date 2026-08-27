/**
 * Aviso institucional a padres: beca autorizada → firma en servicios_admin.
 */
import type { createAdminClient } from '@insforge/sdk';
import {
  portalServiciosAdminDashboardUrl,
  portalServiciosAdminFirmaUrl,
  resolveAccesoAutorizadoDestinatarios,
} from '@/lib/email-acceso-autorizado';
import {
  buildBecaAutorizadaFirmaEmailHtml,
  buildBecaAutorizadaFirmaEmailSubject,
} from '@/lib/email-beca-autorizada-firma';
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

export async function enviarAvisoBecaAutorizadaFirma(opts: {
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
  cicloLabel?: string;
}): Promise<EmailAvisoResult> {
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
    portalUrl: portalServiciosAdminDashboardUrl(),
    firmaUrl: portalServiciosAdminFirmaUrl(),
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
    const sent = await sendMail({
      to: recipients.to,
      replyTo:
        process.env.BECAS_EMAIL_REPLY_TO?.trim() ||
        process.env.BECAS_EMAIL_TO?.trim() ||
        recipients.to[0],
      subject: buildBecaAutorizadaFirmaEmailSubject(emailData),
      html: buildBecaAutorizadaFirmaEmailHtml(emailData),
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
