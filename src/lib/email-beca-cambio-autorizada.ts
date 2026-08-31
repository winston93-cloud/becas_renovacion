/**
 * Correo institucional: ajuste de tipo o porcentaje de beca ya autorizada.
 */
import type { EmailSolicitudInteresData } from '@/lib/email-solicitud';

export type EmailBecaCambioAutorizadaData = EmailSolicitudInteresData & {
  flujo: 'renovacion' | 'solicitud';
  becaAnteriorLabel: string;
  becaNuevaLabel: string;
  porcentajeAnterior: string;
  porcentajeNuevo: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export function buildBecaCambioAutorizadaEmailSubject(
  data: EmailBecaCambioAutorizadaData
): string {
  return `Ajuste de beca autorizada — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildBecaCambioAutorizadaEmailHtml(
  data: EmailBecaCambioAutorizadaData
): string {
  const tramite =
    data.flujo === 'renovacion'
      ? 'renovación de beca escolar'
      : 'solicitud de beca escolar';

  return wrapEmail(
    'Ajuste en beca autorizada',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que, tras la autorización de la beca escolar del ciclo
                ${escapeHtml(data.cicloLabel)}, se registró un <strong style="color:#16213E;">ajuste</strong>
                en el tipo y/o porcentaje de la beca correspondiente a la ${tramite} del alumno referido.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;margin-bottom:16px;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #DCE4F2;border-radius:8px;overflow:hidden;margin-bottom:16px;">
                <tr style="background:#F0F4FA;">
                  <th style="padding:10px 12px;text-align:left;color:#5E6C84;font-weight:600;">Concepto</th>
                  <th style="padding:10px 12px;text-align:left;color:#5E6C84;font-weight:600;">Anterior</th>
                  <th style="padding:10px 12px;text-align:left;color:#5E6C84;font-weight:600;">Actual</th>
                </tr>
                <tr>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;">Tipo de beca</td>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;">${escapeHtml(data.becaAnteriorLabel)}</td>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;font-weight:600;">${escapeHtml(data.becaNuevaLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;">Porcentaje</td>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;">${escapeHtml(data.porcentajeAnterior)}</td>
                  <td style="padding:10px 12px;border-top:1px solid #DCE4F2;font-weight:600;">${escapeHtml(data.porcentajeNuevo)}</td>
                </tr>
              </table>
              <p style="margin:0;padding:12px 14px;background:#FFF8E6;border-radius:8px;font-size:13px;line-height:1.5;color:#7A5B00;">
                Si la beca ya estaba activa en cobranza, el ajuste se aplicó de inmediato en el sistema.
                Si aún no ha firmado la carta en el portal, al activarla se usará el porcentaje y tipo actualizados.
                Para dudas, contacte Control Escolar.
              </p>`
  );
}
