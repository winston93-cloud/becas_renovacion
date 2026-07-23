/**
 * 2026-07-16 - Transporte SMTP con Nodemailer (gratis vía servidor institucional).
 * Server-only. Credenciales solo por variables de entorno.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

let cached: Transporter<SMTPTransport.SentMessageInfo> | null = null;

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export function getMailFrom(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'avisos@winston93.edu.mx'
  );
}

export function getMailFromName(): string {
  return process.env.SMTP_FROM_NAME?.trim() || 'Instituto Winston Churchill';
}

/**
 * Crea (o reutiliza) el transporter SMTP.
 * En Vercel el puerto 25 suele estar bloqueado: usa 587 (STARTTLS) o 465 (SSL).
 */
export function getMailer(): Transporter<SMTPTransport.SentMessageInfo> {
  if (cached) return cached;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || '587');

  if (!host || !user || !pass) {
    throw new Error(
      'Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en el entorno del servidor.'
    );
  }

  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;

  // 2026-07-16 - Puerto 25 suele dar ETIMEDOUT; 587 = STARTTLS, 465 = SSL
  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: {
      // Institucional: a veces certificado no encaja con el hostname
      rejectUnauthorized: process.env.SMTP_TLS_REJECT !== 'false',
      minVersion: 'TLSv1.2',
    },
  });

  return cached;
}

export async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  // 2026-07-16 - BCC a sistemas en finalizar renovación
  bcc?: string | string[];
  attachments?: MailAttachment[];
}): Promise<{ messageId: string }> {
  const transporter = getMailer();

  // 2026-07-22 - Si To === BCC (modo prueba), omitir BCC para no duplicar
  const toList = (Array.isArray(options.to) ? options.to : [options.to]).map(
    (t) => t.toLowerCase()
  );
  let bcc = options.bcc;
  if (bcc) {
    const bccList = Array.isArray(bcc) ? bcc : [bcc];
    const filtered = bccList.filter((b) => !toList.includes(b.toLowerCase()));
    bcc = filtered.length === 0 ? undefined : filtered.length === 1 ? filtered[0] : filtered;
  }

  const info = await transporter.sendMail({
    from: `"${getMailFromName()}" <${getMailFrom()}>`,
    to: options.to,
    bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/pdf',
    })),
  });

  return { messageId: info.messageId || '' };
}
