/**
 * Correo institucional: resolución de rechazo de beca a la familia.
 * El cuerpo es editable en la vista previa admin antes del envío.
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

/** Texto plano editable en el modal de rechazo (sin HTML). */
export function buildBecaRechazoMensajeTexto(
  data: EmailBecaRechazoData
): string {
  const tramite =
    data.flujo === 'renovacion'
      ? 'renovación de beca escolar'
      : 'solicitud de beca escolar';

  return [
    'Estimada familia:',
    '',
    `Por medio del presente, el Instituto Winston Churchill le informa que, tras la revisión de la ${tramite} correspondiente al ciclo escolar ${data.cicloLabel}, no fue posible otorgar la beca al alumno referido.`,
    '',
    `Alumno: ${data.alumnoNombre}`,
    `No. Control: ${data.alumnoRef}`,
    `Nivel: ${data.nivelLabel}`,
    `Grado / Grupo: ${data.gradoGrupo}`,
    `Ciclo: ${data.cicloLabel}`,
    '',
    'Esta resolución forma parte del proceso de evaluación institucional. Para cualquier aclaración, puede comunicarse con el área de Control Escolar del Instituto Winston Churchill.',
    '',
    'Atentamente,',
    'Control Escolar — Instituto Winston Churchill',
  ].join('\n');
}

function mensajeTextoAHtml(mensajeTexto: string): string {
  const blocks = mensajeTexto
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return '<p style="margin:0;font-size:14px;line-height:1.55;color:#5E6C84;">(Sin mensaje)</p>';
  }

  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => escapeHtml(l));
      return `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">${lines.join('<br/>')}</p>`;
    })
    .join('\n');
}

export function buildBecaRechazoEmailHtml(
  data: EmailBecaRechazoData,
  mensajeTexto?: string | null
): string {
  const texto =
    mensajeTexto != null && String(mensajeTexto).trim()
      ? String(mensajeTexto)
      : buildBecaRechazoMensajeTexto(data);

  return wrapEmail('Resolución de beca', mensajeTextoAHtml(texto));
}
