/**
 * Destinatarios y URL del aviso de acceso autorizado (familia).
 * Remitente SMTP = buzón masivo de servicios (avisos_no-replay).
 */
import { emailBccSistemas } from '@/lib/email-renovacion';

export function portalBecasPublicUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BECAS_PORTAL_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
  }
  return 'https://becas-renovacion.vercel.app';
}

/** Destino del aviso a familia (prueba / producción). */
export function resolveAccesoAutorizadoMailTo(): {
  to: string;
  bcc?: string;
} {
  const forced =
    process.env.BECAS_EMAIL_ACCESO_FAMILIA?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'avisos_no-replay@winston93.edu.mx';
  const bcc = emailBccSistemas();
  return {
    to: forced,
    bcc: bcc.toLowerCase() === forced.toLowerCase() ? undefined : bcc,
  };
}
