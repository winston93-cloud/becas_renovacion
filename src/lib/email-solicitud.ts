/**
 * 2026-07-17 - Correos de solicitud de beca (nuevo ingreso).
 * - Acceso: interés para que coordinación autorice el trámite.
 * - Finalizar: expediente listo + lista de documentos (adjuntos en SMTP).
 */

export type EmailSolicitudInteresData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
};

export type DocLinkForSolicitudEmail = {
  tipo: string;
  label: string;
  url: string;
};

export type EmailSolicitudFinalizarData = EmailSolicitudInteresData & {
  documentos?: DocLinkForSolicitudEmail[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function academicRows(data: EmailSolicitudInteresData): string {
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

/** 2026-07-17 - Pedido de acceso (antes de llenar el formulario). */
export function buildSolicitudAccesoEmailSubject(
  data: EmailSolicitudInteresData
): string {
  return `Solicitud de acceso a beca — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildSolicitudAccesoEmailHtml(
  data: EmailSolicitudInteresData
): string {
  return wrapEmail(
    'Solicitud de acceso a beca',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#5E6C84;">
                El alumno (o su familia) <strong style="color:#16213E;">solicita acceso</strong> para tramitar
                una beca por primera vez. Revise los datos académicos y, si corresponde, autorice el
                trámite en el portal de gestión de becas para que puedan completar el formulario.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
                ${academicRows(data)}
              </table>
              <p style="margin:20px 0 0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
                Acción sugerida: activar el permiso de solicitud nueva para este No. de Control cuando se apruebe el acceso.
              </p>`
  );
}

export function buildSolicitudEmailSubject(
  data: EmailSolicitudFinalizarData
): string {
  return `Solicitud de beca nueva — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildSolicitudEmailHtml(
  data: EmailSolicitudFinalizarData
): string {
  const docs = data.documentos || [];
  const docsList =
    docs.length > 0
      ? docs
          .map(
            (d) =>
              `<li style="margin:8px 0;"><a href="${escapeHtml(d.url)}" style="color:#0B173A;font-weight:600;">${escapeHtml(d.label)}</a></li>`
          )
          .join('')
      : '';

  const docsBlock =
    docs.length > 0
      ? `
              <h2 style="margin:24px 0 8px;font-size:15px;color:#0B173A;">Documentos</h2>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5E6C84;">
                Los PDFs van adjuntos a este correo; también puede descargarlos con los enlaces (válidos por 7 días).
              </p>
              <ul style="margin:0;padding-left:18px;font-size:14px;">
                ${docsList}
              </ul>`
      : '';

  return wrapEmail(
    'Solicitud de beca nueva',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#5E6C84;">
                El alumno (o su familia) completó una <strong style="color:#16213E;">solicitud de beca por primera vez</strong>
                y manifiesta interés en tramitar el apoyo. Los datos académicos quedan a continuación
                para dar seguimiento en el portal de gestión de becas.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
                ${academicRows(data)}
              </table>
              ${docsBlock}
              <p style="margin:20px 0 0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
                Expediente listo para revisión.
              </p>`
  );
}

export type EmailAccesoAutorizadoData = EmailSolicitudInteresData & {
  portalUrl: string;
};

/** Aviso a la familia: acceso autorizado para solicitar beca nueva. */
export function buildAccesoAutorizadoEmailSubject(
  data: EmailAccesoAutorizadoData
): string {
  return `Acceso autorizado al Portal de Becas — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildAccesoAutorizadoEmailHtml(
  data: EmailAccesoAutorizadoData
): string {
  const portal = escapeHtml(data.portalUrl);
  return wrapEmail(
    'Acceso autorizado al Portal de Becas',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa de manera oficial que su solicitud de acceso al Portal de Becas
                ha sido <strong style="color:#1F6B4A;">autorizada</strong>.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Ya puede ingresar al portal con el número de control y la contraseña escolar
                del alumno para completar el formulario de <strong style="color:#16213E;">solicitud de beca por primera vez</strong>
                correspondiente al ciclo ${escapeHtml(data.cicloLabel)}.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
                ${academicRows(data)}
              </table>
              <p style="margin:22px 0 12px;text-align:center;">
                <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
                  Ingresar al Portal de Becas
                </a>
              </p>
              <p style="margin:0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
                Conserve este correo como comprobante de autorización. Si no solicitó este acceso,
                comuníquese con Control Escolar / área de becas del Instituto.
              </p>`
  );
}

