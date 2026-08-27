/**
 * Correo institucional: beca autorizada → firma electrónica en Portal Servicios.
 */
import type { EmailSolicitudInteresData } from '@/lib/email-solicitud';

export type EmailBecaAutorizadaFirmaData = EmailSolicitudInteresData & {
  flujo: 'renovacion' | 'solicitud';
  portalUrl: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function academicRows(data: EmailBecaAutorizadaFirmaData): string {
  return `
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>`;
}

function wrapEmail(title: string, bodyInner: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#16213E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #DCE4F2;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0B173A;color:#ffffff;padding:20px 24px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Instituto Winston Churchill</p>
              <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${bodyInner}
              <p style="margin:24px 0 0;font-size:12px;color:#9AA6B2;line-height:1.4;">
                Este correo se generó automáticamente desde el Portal de Becas.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildBecaAutorizadaFirmaEmailSubject(
  data: EmailBecaAutorizadaFirmaData
): string {
  return `Beca autorizada — firma electrónica — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildBecaAutorizadaFirmaEmailHtml(
  data: EmailBecaAutorizadaFirmaData
): string {
  const tramite =
    data.flujo === 'renovacion'
      ? 'renovación de beca escolar'
      : 'solicitud de beca escolar';
  const portal = escapeHtml(data.portalUrl);

  return wrapEmail(
    'Beca autorizada — firma electrónica',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que la <strong style="color:#1F6B4A;">beca escolar ha sido autorizada</strong>
                para el ciclo ${escapeHtml(data.cicloLabel)}, tras la revisión de la ${tramite} del alumno referido.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Para <strong style="color:#16213E;">activar la beca</strong>, ingrese al
                <strong>Portal de Servicios Administrativos</strong> con el número de control y la
                contraseña escolar del alumno. En el panel principal abra la tarjeta
                <strong>Becas</strong> y complete la <strong>firma electrónica</strong> de la carta
                de aceptación (escriba su nombre completo como padre, madre o tutor).
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
                ${academicRows(data)}
              </table>
              <p style="margin:22px 0 12px;text-align:center;">
                <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin:4px;">
                  Portal de Servicios Administrativos
                </a>
              </p>
              <p style="margin:0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
                La beca no se activa en cobranza hasta que la carta firmada sea enviada desde el portal.
                Si tiene dudas, contacte Control Escolar del Instituto Winston Churchill.
              </p>`
  );
}
