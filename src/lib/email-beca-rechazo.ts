/**
 * Correo institucional: resolución de rechazo de beca a la familia.
 */

export type EmailBecaRechazoData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
  flujo: 'renovacion' | 'solicitud';
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

export function buildBecaRechazoEmailSubject(
  data: EmailBecaRechazoData
): string {
  return `Resolución de beca — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildBecaRechazoEmailHtml(data: EmailBecaRechazoData): string {
  const tramite =
    data.flujo === 'renovacion'
      ? 'renovación de beca escolar'
      : 'solicitud de beca escolar';

  return wrapEmail(
    'Resolución de beca',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Estimada familia:
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que, tras la revisión de la <strong style="color:#16213E;">${escapeHtml(tramite)}</strong>
                correspondiente al ciclo escolar <strong style="color:#16213E;">${escapeHtml(data.cicloLabel)}</strong>,
                <strong style="color:#16213E;">no fue posible otorgar la beca</strong> al alumno referido.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Esta resolución forma parte del proceso de evaluación institucional.
                Para cualquier aclaración, puede comunicarse con el área de Control Escolar
                del Instituto Winston Churchill.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#5E6C84;">
                Atentamente,<br/>
                <strong style="color:#16213E;">Control Escolar — Instituto Winston Churchill</strong>
              </p>`
  );
}
